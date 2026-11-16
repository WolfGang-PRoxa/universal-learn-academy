"use strict";
/* ==========================================================================
   Synchronisation Git du dossier des données (version 2.5.0)
   --------------------------------------------------------------------------
   Moteur sans Electron (Node seul, vérifié par npm run check) : l'hôte
   (synchro.js) décide quand le lancer, ce module fait un cycle complet :

     1. rien si une opération Git est en cours (index.lock, fusion, rebase) ;
     2. commit de ce qui a changé dans le périmètre autorisé ;
     3. git fetch, puis fusion avec la branche suivie (--autostash : les fichiers
        modifiés hors périmètre ne bloquent pas) ; les conflits passent par les
        règles de resoudre() ;
     4. git push, recommencé une fois depuis l'étape 3 si l'autre PC vient de
        pousser. Jamais de --force.

   Périmètre :
     « progression » (dépôt d'ula de l'auteur du catalogue) : seulement ce que
       l'application écrit dans l'espace d'un profil : quiz_results/, td_results/,
       ula-lien.json, ula-profil.json. Le reste (TP, cours en rédaction) reste à
       ses commits ; un conflit sur un autre fichier arrête la fusion (à faire à
       la main).
     « tout » (dossier des données devenu un dépôt) : tout, sauf le catalogue
       (explore/) et les outils.

   Règles de conflit (même fichier modifié sur deux PC entre deux synchros) :
     td_results/<page>.json      fusion atelier par atelier, le plus récent (maj)
     quiz_results/…/<id>.json    la tentative enregistrée le plus récemment
     ula-lien.json, ula-profil   la version locale
     autre fichier               la version locale reste, l'autre est enregistrée
                                 à côté : « nom (conflit 16-11-2026 15h50).ext »
     supprimé d'un côté          on garde la version modifiée

   Git doit être installé et déjà connecté au dépôt distant (Git Credential
   Manager, gh, clé SSH) : le moteur ne gère aucun identifiant et ne demande
   jamais rien (GIT_TERMINAL_PROMPT=0, GCM_INTERACTIVE=never, BatchMode SSH).
   ========================================================================== */

const { execFile } = require("child_process");
const { t, tn } = require("./i18n");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Dossiers de la racine jamais synchronisés par la synchro automatique
const RESERVES = new Set(["explore", "_outils", "app", "node_modules", "propositions", ".git"]);
const GROS_FICHIER = 50 * 1024 * 1024;   // GitHub refuse au-delà de 100 Mo

/* -- Exécution de Git ------------------------------------------------------------- */

function environnement() {
  const env = Object.assign({}, process.env, {
    GIT_TERMINAL_PROMPT: "0",       // jamais de demande d'identifiants dans un terminal
    GCM_INTERACTIVE: "never",       // ni de fenêtre de Git Credential Manager
    LC_ALL: "C", LANGUAGE: "C"      // messages en anglais : ils sont analysés
  });
  if (!env.GIT_SSH_COMMAND) env.GIT_SSH_COMMAND = "ssh -o BatchMode=yes -o ConnectTimeout=20";
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  return env;
}

let executable = null;   // retenu par versionGit()
/** Exécutables à essayer : celui du PATH, puis l'installation habituelle de Git for Windows. */
function candidatsGit() {
  const liste = ["git"];
  if (process.platform === "win32") {
    for (const base of [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs")]) {
      if (base) liste.push(path.join(base, "Git", "cmd", "git.exe"));
    }
  }
  return liste;
}

/**
 * Lance git dans la racine. Ne rejette jamais pour un code de sortie non nul :
 * renvoie { code, stdout (Buffer), stderr (texte), delai (dépassé ?) }.
 */
function git(racine, args, { entree = null, delai = 60000 } = {}) {
  const exe = executable || "git";
  return new Promise((resolve) => {
    let enfant;
    try {
      enfant = execFile(exe, ["-c", "core.quotepath=false", "-c", "color.ui=false", ...args], {
        cwd: racine, env: environnement(), encoding: "buffer", maxBuffer: 256 * 1024 * 1024,
        timeout: delai, windowsHide: true
      }, (err, stdout, stderr) => {
        resolve({
          code: err ? (typeof err.code === "number" ? err.code : -1) : 0,
          stdout: stdout || Buffer.alloc(0),
          stderr: String(stderr || "") + (err && typeof err.code !== "number" ? String(err.message || "") : ""),
          delai: Boolean(err && err.killed)
        });
      });
    } catch (e) {
      resolve({ code: -1, stdout: Buffer.alloc(0), stderr: String(e.message || e), delai: false });
      return;
    }
    if (entree !== null) { enfant.stdin.on("error", () => {}); enfant.stdin.end(entree); }
  });
}

const texte = (r) => r.stdout.toString("utf8").trim();

/** Version de git installée, ou null. Retient le premier exécutable qui répond. */
async function versionGit() {
  for (const c of candidatsGit()) {
    if (c !== "git" && !fs.existsSync(c)) continue;
    executable = c;
    const r = await git(os.tmpdir(), ["--version"], { delai: 15000 });
    const m = r.code === 0 && /git version (\d+)\.(\d+)/.exec(texte(r));
    if (m) return { texte: texte(r).replace(/^git version /, ""), majeur: Number(m[1]), mineur: Number(m[2]) };
    executable = null;
  }
  return null;
}

function auMoins(v, majeur, mineur) {
  return Boolean(v) && (v.majeur > majeur || (v.majeur === majeur && v.mineur >= mineur));
}

/** Adresse du dépôt distant, sans identifiants éventuels (https://jeton@…). */
function adresseSure(url) {
  return String(url || "").replace(/^(https?:\/\/)[^/@]*@/i, "$1");
}

function memeChemin(a, b) {
  const n = (x) => path.resolve(String(x || "")).replace(/[\\/]+$/, "");
  return process.platform === "win32" ? n(a).toLowerCase() === n(b).toLowerCase() : n(a) === n(b);
}

/**
 * Ce que l'on sait du dépôt : { git, depot, branche, distant, brancheDistante, adresse, dossierGit, raison? }
 * depot est faux si la racine n'est pas la racine d'un dépôt Git.
 */
async function infos(racine) {
  const v = await versionGit();
  if (!v) return { git: null, depot: false, raison: t("s.raison.sansGit") };
  const base = { git: v.texte, version: v, depot: false };
  if (!fs.existsSync(path.join(racine, ".git"))) return Object.assign(base, { raison: t("s.raison.pasDepot") });
  const haut = await git(racine, ["rev-parse", "--show-toplevel"], { delai: 15000 });
  if (haut.code !== 0 || !memeChemin(texte(haut), racine)) return Object.assign(base, { raison: t("s.raison.pasRacine") });
  const dg = await git(racine, ["rev-parse", "--absolute-git-dir"], { delai: 15000 });
  const branche = texte(await git(racine, ["symbolic-ref", "--short", "-q", "HEAD"], { delai: 15000 }));
  const r = Object.assign(base, { depot: true, dossierGit: texte(dg), branche: branche || null });
  if (!branche) return Object.assign(r, { raison: t("s.raison.detachee") });
  const distant = texte(await git(racine, ["config", "--get", `branch.${branche}.remote`], { delai: 15000 }));
  const fusion = texte(await git(racine, ["config", "--get", `branch.${branche}.merge`], { delai: 15000 }));
  if (!distant || !fusion || distant === ".") return Object.assign(r, { raison: t("s.raison.sansSuivi", { branche }) });
  const adresse = texte(await git(racine, ["remote", "get-url", distant], { delai: 15000 }));
  return Object.assign(r, { distant, brancheDistante: fusion.replace(/^refs\/heads\//, ""), adresse: adresseSure(adresse) });
}

/** Opération Git en cours (git pull à la main, fusion à finir…) : ne rien faire. */
function operationEnCours(dossierGit) {
  const marques = { "index.lock": t("s.encours.commande"), MERGE_HEAD: t("s.encours.fusion"), "rebase-merge": t("s.encours.rebase"),
    "rebase-apply": t("s.encours.rebase"), CHERRY_PICK_HEAD: t("s.encours.cherryPick"), REVERT_HEAD: t("s.encours.revert") };
  for (const [f, raison] of Object.entries(marques)) if (fs.existsSync(path.join(dossierGit, f))) return raison;
  return null;
}

/** Commit de HEAD lu dans les fichiers de .git, sans lancer git (surveillance des git pull à la main). */
function tete(dossierGit) {
  try {
    const head = fs.readFileSync(path.join(dossierGit, "HEAD"), "utf8").trim();
    const m = /^ref: (.+)$/.exec(head);
    if (!m) return head;
    const ref = path.join(dossierGit, ...m[1].split("/"));
    if (fs.existsSync(ref)) return m[1] + "@" + fs.readFileSync(ref, "utf8").trim();
    const packed = fs.readFileSync(path.join(dossierGit, "packed-refs"), "utf8");
    const ligne = packed.split("\n").find((l) => l.endsWith(" " + m[1]));
    return m[1] + "@" + (ligne ? ligne.split(" ")[0] : "");
  } catch (e) { return null; }
}

/* -- Périmètre ------------------------------------------------------------------- */

const PROGRESSION = /(^|\/)(quiz_results|td_results)\//;
const FICHES = /(^|\/)ula-(lien|profil)\.json$/;

/** Fichier de progression écrit par l'application ? (chemin relatif, en « / ») */
function estProgression(chemin) {
  return PROGRESSION.test(chemin) || FICHES.test(chemin);
}

/** Le chemin est-il dans le périmètre de la synchro automatique ? */
function dansPerimetre(chemin, mode) {
  const segments = chemin.split("/");
  if (RESERVES.has(segments[0]) || /\.tmp$/i.test(chemin)) return false;
  if (mode === "tout") return true;
  // Progression : dans l'espace d'un profil (<profil>/…), jamais à la racine
  return segments.length >= 2 && !segments[0].startsWith(".") && estProgression(chemin);
}

/** git status -z : [{ x, y, chemin }] (renommages : le nouveau et l'ancien chemin). */
function lireStatut(sortie) {
  const champs = sortie.toString("utf8").split("\0");
  const liste = [];
  for (let i = 0; i < champs.length; i++) {
    const c = champs[i];
    if (c.length < 4) continue;
    const e = { x: c[0], y: c[1], chemin: c.slice(3) };
    liste.push(e);
    if (e.x === "R" || e.x === "C") { const ancien = champs[++i]; if (ancien) liste.push({ x: "D", y: " ", chemin: ancien }); }
  }
  return liste;
}

/* -- Règles de conflit --------------------------------------------------------------- */

function json(b) {
  if (!b) return null;
  try { return JSON.parse(b.toString("utf8")); } catch (e) { return undefined; }
}
const date = (x) => String((x && (x.enregistre || x.maj || x.fin || x.debut)) || "");
const ecrireJson = (o) => Buffer.from(JSON.stringify(o, null, 2) + "\n", "utf8");

/** « 16-11-2026 15h50 » (heure locale) */
function horodatage(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}h${p(d.getMinutes())}`;
}

/** Nom de la copie de conflit : « dossier/nom (conflit 16-11-2026 15h50).ext » */
function nomCopie(chemin, maintenant = new Date(), existe = () => false) {
  const dossier = path.posix.dirname(chemin);
  const ext = path.posix.extname(chemin);
  const nom = path.posix.basename(chemin, ext);
  const prefixe = (dossier === "." ? "" : dossier + "/") + `${nom} (conflit ${horodatage(maintenant)}`;
  let c = `${prefixe})${ext}`;
  for (let i = 2; existe(c); i++) c = `${prefixe} ${i})${ext}`;
  return c;
}

/**
 * Résout un conflit : base, nous (local), eux (distant) sont des Buffer ou null
 * (fichier absent de ce côté). Renvoie { contenu (Buffer ou null : supprimer), copie (Buffer ou null), regle }.
 */
function resoudre(chemin, base, nous, eux) {
  if (!nous && !eux) return { contenu: null, copie: null, regle: t("s.regle.supprimeDeuxCotes") };
  if (!nous) return { contenu: eux, copie: null, regle: t("s.regle.supprimeIci") };
  if (!eux) return { contenu: nous, copie: null, regle: t("s.regle.supprimeAutre") };
  if (/(^|\/)td_results\/[^/]+\.json$/.test(chemin)) {
    const a = json(nous), b = json(eux);
    if (a && b && typeof a.ateliers === "object" && typeof b.ateliers === "object") {
      const r = Object.assign({}, a, { ateliers: Object.assign({}, a.ateliers) });
      for (const [id, etat] of Object.entries(b.ateliers || {})) {
        if (!r.ateliers[id] || date(etat) > date(r.ateliers[id])) r.ateliers[id] = etat;
      }
      if (date(b) > date(a)) r.maj = b.maj;
      return { contenu: ecrireJson(r), copie: null, regle: t("s.regle.ateliers") };
    }
  } else if (PROGRESSION.test(chemin) && /\.json$/.test(chemin)) {
    const a = json(nous), b = json(eux);
    if (a && b) return date(b) > date(a)
      ? { contenu: eux, copie: null, regle: t("s.regle.tentativeAutre") }
      : { contenu: nous, copie: null, regle: t("s.regle.tentativeIci") };
  } else if (FICHES.test(chemin)) {
    return { contenu: nous, copie: null, regle: "version de ce poste" };
  }
  return { contenu: nous, copie: eux, regle: t("s.regle.deuxGardees") };
}

/* -- Cycle ---------------------------------------------------------------------------- */

const AUTH = /Authentication failed|could not read (Username|Password)|terminal prompts disabled|Permission denied \(publickey|\b403\b|\b401\b|Repository not found|Invalid username or password|access denied/i;
const RESEAU = /Could not resolve host|unable to access|Failed to connect|Connection (timed out|refused|reset)|Operation timed out|Network is unreachable|Could not read from remote repository|early EOF|SSL|TLS/i;

function classer(r, quoi) {
  const msg = r.stderr.trim();
  const ligne = (msg.split("\n").find((l) => /fatal|error|rejected/i.test(l)) || msg.split("\n")[0] || "").replace(/^(fatal|error): /, "").trim();
  if (r.delai) return { etat: "hors-ligne", message: t("s.erreur.delai", { quoi: t(quoi) }) };
  if (AUTH.test(msg)) return { etat: "connexion", message: t("s.erreur.acces", { quoi: t(quoi), ligne }) };
  if (RESEAU.test(msg)) return { etat: "hors-ligne", message: t("s.erreur.reseau", { quoi: t(quoi) }) };
  return { etat: "erreur", message: `${t(quoi)} : ${ligne || t("s.erreur.code", { code: r.code })}` };
}

function messageCommit(poste, maintenant) {
  const p = (n) => String(n).padStart(2, "0");
  const d = maintenant;
  return `Progression du ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} à ${p(d.getHours())}:${p(d.getMinutes())} (${poste})`;
}

/** Commit des changements du périmètre. Renvoie { commits, ignores } ou { echec }. */
async function committer(racine, { mode, poste, maintenant }) {
  const st = await git(racine, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { delai: 120000 });
  if (st.code !== 0) return { echec: classer(st, "s.etape.lecture") };
  const ignores = [];
  const chemins = [...new Set(lireStatut(st.stdout).map((e) => e.chemin).filter((c) => dansPerimetre(c, mode)))].filter((c) => {
    try {
      const s = fs.statSync(path.join(racine, ...c.split("/")));
      if (s.isFile() && s.size > GROS_FICHIER) { ignores.push(c); return false; }
    } catch (e) { /* supprimé : la suppression se committe */ }
    return true;
  });
  if (!chemins.length) return { commits: 0, ignores };
  const liste = chemins.join("\0") + "\0";
  const add = await git(racine, ["add", "-A", "--pathspec-from-file=-", "--pathspec-file-nul"], { entree: liste, delai: 120000 });
  if (add.code !== 0) return { echec: classer(add, "s.etape.ajout") };
  const ci = await git(racine, ["commit", "--no-verify", "--quiet", "-m", messageCommit(poste, maintenant), "--only", "--pathspec-from-file=-", "--pathspec-file-nul"], { entree: liste, delai: 120000 });
  if (ci.code !== 0) {
    if (/nothing to commit|no changes added/i.test(ci.stderr + texte(ci))) return { commits: 0, ignores };
    if (/Please tell me who you are|user\.(name|email)/i.test(ci.stderr)) {
      return { echec: { etat: "erreur", message: t("s.erreur.identite") } };
    }
    return { echec: classer(ci, "s.etape.commit") };
  }
  return { commits: 1, chemins: chemins.length, ignores };
}

async function compter(racine) {
  const r = await git(racine, ["rev-list", "--left-right", "--count", "HEAD...@{u}"], { delai: 30000 });
  const m = /^(\d+)\s+(\d+)/.exec(texte(r));
  return m ? { avance: Number(m[1]), retard: Number(m[2]) } : null;
}

async function contenuEtape(racine, etape, chemin) {
  const r = await git(racine, ["show", `:${etape}:${chemin}`], { delai: 60000 });
  return r.code === 0 ? r.stdout : null;
}

/** Fusion avec la branche suivie, conflits résolus. */
async function fusionner(racine, { mode, maintenant, autostash }) {
  const avant = texte(await git(racine, ["rev-parse", "HEAD"], { delai: 15000 }));
  const args = ["merge", "--no-edit", "--no-verify", ...(autostash ? ["--autostash"] : []), "@{u}"];
  const m = await git(racine, args, { delai: 300000 });
  const conflits = [];
  const sortie = m.stderr + m.stdout.toString("utf8");
  const avertissement = /autostash[^\n]*conflict|changes are safe in the stash/i.test(sortie)
    ? t("s.erreur.stash") : "";
  if (m.code !== 0) {
    const u = await git(racine, ["diff", "--name-only", "-z", "--diff-filter=U"], { delai: 30000 });
    const enConflit = u.stdout.toString("utf8").split("\0").filter(Boolean);
    const dossierGit = texte(await git(racine, ["rev-parse", "--absolute-git-dir"], { delai: 15000 }));
    const fusionEnCours = fs.existsSync(path.join(dossierGit, "MERGE_HEAD"));
    if (!enConflit.length || (mode !== "tout" && enConflit.some((c) => !dansPerimetre(c, mode)))) {
      if (fusionEnCours) await git(racine, ["merge", "--abort"], { delai: 60000 });
      const hors = enConflit.filter((c) => !dansPerimetre(c, mode));
      const ligne = (m.stderr.split("\n").find((l) => /error|fatal/i.test(l)) || "").replace(/^(error|fatal): /, "").trim();
      return { echec: { etat: "manuel", message: hors.length
        ? tn("s.erreur.conflitHors", hors.length, { liste: hors.slice(0, 3).join(", ") + (hors.length > 3 ? "…" : "") })
        : t(ligne ? "s.erreur.fusionLigne" : "s.erreur.fusion", { ligne }) } };
    }
    for (const chemin of enConflit) {
      const [base, nous, eux] = await Promise.all([1, 2, 3].map((e) => contenuEtape(racine, e, chemin)));
      const r = resoudre(chemin, base, nous, eux);
      const abs = path.join(racine, ...chemin.split("/"));
      if (r.contenu) {
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, r.contenu);
        await git(racine, ["add", "--", chemin], { delai: 60000 });
      } else {
        fs.rmSync(abs, { force: true });
        await git(racine, ["rm", "--quiet", "--cached", "--ignore-unmatch", "--", chemin], { delai: 60000 });
      }
      const conflit = { chemin, regle: r.regle };
      if (r.copie) {
        const copie = nomCopie(chemin, maintenant, (c) => fs.existsSync(path.join(racine, ...c.split("/"))));
        fs.writeFileSync(path.join(racine, ...copie.split("/")), r.copie);
        await git(racine, ["add", "--", copie], { delai: 60000 });
        conflit.copie = copie;
      }
      conflits.push(conflit);
    }
    // Conclut la fusion ; git commit réapplique aussi les modifications mises de côté (--autostash)
    const ci = await git(racine, ["-c", "core.editor=true", "commit", "--no-edit", "--no-verify", "--quiet"], { delai: 120000 });
    if (ci.code !== 0) {
      await git(racine, ["merge", "--abort"], { delai: 60000 });
      return { echec: classer(ci, "s.etape.finFusion") };
    }
  }
  const diff = await git(racine, ["diff", "--name-only", "-z", avant, "HEAD"], { delai: 60000 });
  const recus = diff.stdout.toString("utf8").split("\0").filter(Boolean);
  return { recus, conflits, avertissement };
}

/**
 * Un cycle complet. options : { mode: "progression" | "tout", poste, maintenant, journal, delaiReseau }
 * Résultat : { etat, message, commits, envoyes, recus: [chemins], conflits: [{ chemin, regle, copie? }], ignores, a }
 *   etat : « a-jour », « synchronise », « hors-ligne », « connexion » (identifiants),
 *          « manuel » (fusion à faire à la main), « bloque » (opération Git en cours),
 *          « indisponible » (pas de dépôt suivi), « erreur ».
 */
async function cycle(racine, options = {}) {
  const mode = options.mode === "tout" ? "tout" : "progression";
  const poste = options.poste || os.hostname();
  const maintenant = options.maintenant || new Date();
  const journal = options.journal || (() => {});
  const delaiReseau = options.delaiReseau || 90000;
  const r = { etat: "a-jour", message: "", commits: 0, envoyes: 0, recus: [], conflits: [], ignores: [], a: maintenant.toISOString() };
  const fin = (x) => Object.assign(r, x, { a: new Date().toISOString() });

  const i = await infos(racine);
  if (!i.depot || !i.distant) return fin({ etat: "indisponible", message: i.raison || t("s.pasDistant") });
  const enCours = operationEnCours(i.dossierGit);
  if (enCours) return fin({ etat: "bloque", message: t("s.remise", { raison: enCours }) });

  const c = await committer(racine, { mode, poste, maintenant });
  if (c.echec) return fin(c.echec);
  r.commits = c.commits;
  r.ignores = c.ignores;
  if (c.commits) journal(`synchro : ${c.chemins} fichier(s) committé(s)`);

  for (let essai = 0; essai < 2; essai++) {
    const f = await git(racine, ["fetch", "--quiet", "--no-tags", i.distant, `+refs/heads/${i.brancheDistante}:refs/remotes/${i.distant}/${i.brancheDistante}`], { delai: delaiReseau });
    if (f.code !== 0) return fin(classer(f, "s.etape.reception"));
    let n = await compter(racine);
    if (!n) return fin({ etat: "erreur", message: t("s.erreur.comparaison") });
    if (n.retard > 0) {
      const m = await fusionner(racine, { mode, maintenant, autostash: auMoins(i.version, 2, 27) });
      if (m.echec) return fin(m.echec);
      r.recus.push(...m.recus.filter((x) => !r.recus.includes(x)));
      r.conflits.push(...m.conflits);
      if (m.avertissement) r.avertissement = m.avertissement;
      journal(`synchro : ${m.recus.length} fichier(s) reçu(s), ${m.conflits.length} conflit(s) résolu(s)`);
      n = await compter(racine);
    }
    if (!n || n.avance === 0) break;
    const p = await git(racine, ["push", "--quiet", i.distant, `HEAD:refs/heads/${i.brancheDistante}`], { delai: delaiReseau });
    if (p.code === 0) { r.envoyes += n.avance; break; }
    // L'autre poste vient de pousser : on reçoit et on recommence, une fois
    if (essai === 0 && /rejected|non-fast-forward|fetch first|stale info/i.test(p.stderr)) { journal("synchro : envoi refusé, nouvel essai"); continue; }
    return fin(classer(p, "s.etape.envoi"));
  }
  const fait = r.commits || r.envoyes || r.recus.length;
  return fin({ etat: fait ? "synchronise" : "a-jour", message: fait ? "" : t("s.dejaAJour") });
}

module.exports = { cycle, infos, tete, operationEnCours, resoudre, nomCopie, dansPerimetre, estProgression, lireStatut, adresseSure, versionGit, messageCommit };
