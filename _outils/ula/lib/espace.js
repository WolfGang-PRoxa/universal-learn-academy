"use strict";
/* ==========================================================================
   Espace de données ula : catalogue, profils, cursus (studies/_outils/ula)
   --------------------------------------------------------------------------
   ula/                               racine des données
     explore/<domaine>/<cours>/       catalogue, en lecture seule (ula-cours.json)
     <profil>/                        espace d'un utilisateur (ula-profil.json)
       <cursus libre>/<cours>/        lien vers un cours du catalogue (ula-lien.json)
         quiz_results/ td_results/    sa progression, à côté du lien
         TP/ …                        son travail

   Tout ce que l'utilisateur produit s'écrit dans son espace, jamais dans
   explore/ : une mise à jour d'un cours ne touche pas à son travail.

   Module sans dépendance (Node seul) : utilisé par le serveur local
   (_outils/quiz/serveur, extension _outils/ula/serveur/extension.js) et par
   l'application installée (app/src). Les chemins relatifs sont en « / ».
   ========================================================================== */

const fs = require("fs");
const os = require("os");
const path = require("path");

const FICHE_COURS = "ula-cours.json";
const FICHE_PROFIL = "ula-profil.json";
const FICHE_LIEN = "ula-lien.json";
const EXPLORE = "explore";
const DOSSIER_PAR_DEFAUT = "Cours suivis";

// Noms réservés à la racine (jamais des profils)
const RESERVES = new Set(["explore", "_outils", "app", "node_modules", "propositions"]);
// Dossiers de travail : jamais parcourus pour trouver des liens ou des sous-dossiers de cursus
const TRAVAIL = new Set(["quiz_results", "td_results", "generated_courses", "generated_quizzes", "TP", "DM", "node_modules", "__pycache__", "__MACOSX"]);

/* -- Petits utilitaires ------------------------------------------------------ */

function lireJson(f) {
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; }
}

function ecrireJson(f, objet) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = f + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(objet, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, f);
}

function rel(racine, abs) {
  return path.relative(racine, abs).split(path.sep).join("/");
}

function dans(parent, abs) {
  const r = path.relative(parent, abs);
  return r === "" || (!r.startsWith("..") && !path.isAbsolute(r));
}

function aujourdhui() { return new Date().toISOString().slice(0, 10); }

/** Nom de dossier acceptable (profil, dossier de cursus) : renvoie le nom nettoyé ou lève une erreur. */
function nomValide(nom, quoi = "nom") {
  const n = String(nom == null ? "" : nom).normalize("NFC").replace(/\s+/g, " ").trim();
  if (!n) throw new Error(`Le ${quoi} est vide.`);
  if (n.length > 60) throw new Error(`Le ${quoi} est trop long (60 caractères au plus).`);
  if (/[\\/:*?"<>|\x00-\x1f]/.test(n)) throw new Error(`Le ${quoi} ne peut pas contenir \\ / : * ? " < > |.`);
  if (/^\.|\.$/.test(n) || n === "." || n === "..") throw new Error(`Le ${quoi} ne peut ni commencer ni finir par un point.`);
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(n)) throw new Error(`« ${n} » est un nom réservé par Windows.`);
  return n;
}

/** Nom d'utilisateur de la session (Windows ou Linux), pour préremplir le premier profil. */
function nomSession() {
  let n = "";
  try { n = os.userInfo().username; } catch (e) { n = process.env.USERNAME || process.env.USER || ""; }
  n = String(n).replace(/[\\/:*?"<>|]/g, "").trim();
  return n || "moi";
}

/* -- Catalogue (explore/) ---------------------------------------------------- */

/** Cours présents dans explore/ : [{ id, domaine, chemin, fiche }] */
function cours(racine) {
  const res = [];
  const base = path.join(racine, EXPLORE);
  let domaines = [];
  try { domaines = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".")); } catch (e) { return res; }
  for (const d of domaines) {
    let ids = [];
    try { ids = fs.readdirSync(path.join(base, d.name), { withFileTypes: true }).filter((x) => x.isDirectory() && !x.name.startsWith(".")); } catch (e) { continue; }
    for (const x of ids) {
      const fiche = lireJson(path.join(base, d.name, x.name, FICHE_COURS));
      if (!fiche) continue;
      res.push({ id: x.name, domaine: d.name, chemin: `${EXPLORE}/${d.name}/${x.name}`, fiche });
    }
  }
  return res.sort((a, b) => a.domaine.localeCompare(b.domaine, "fr") || String(a.fiche.niveau || "").localeCompare(String(b.fiche.niveau || ""), "fr") || String(a.fiche.titre).localeCompare(String(b.fiche.titre), "fr"));
}

function coursParId(racine, id) {
  return cours(racine).find((c) => c.id === id) || null;
}

/** « explore/<domaine>/<id>/reste » -> { domaine, id, reste } ou null */
function coursDuChemin(cheminRelatif) {
  const m = /^explore\/([^/]+)\/([^/]+)(?:\/(.*))?$/.exec(String(cheminRelatif).replace(/\\/g, "/"));
  return m ? { domaine: m[1], id: m[2], reste: m[3] || "" } : null;
}

/* -- Profils ------------------------------------------------------------------ */

/** Profils de la racine : [{ nom, dossier, fiche }] */
function profils(racine) {
  let entrees = [];
  try { entrees = fs.readdirSync(racine, { withFileTypes: true }); } catch (e) { return []; }
  return entrees
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !RESERVES.has(e.name.toLowerCase()))
    .map((e) => ({ nom: e.name, dossier: path.join(racine, e.name), fiche: lireJson(path.join(racine, e.name, FICHE_PROFIL)) }))
    .filter((p) => p.fiche)
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
}

function profil(racine, nom) {
  return profils(racine).find((p) => p.nom === nom) || null;
}

function creerProfil(racine, nom) {
  const n = nomValide(nom, "nom d'utilisateur");
  if (RESERVES.has(n.toLowerCase())) throw new Error(`« ${n} » est réservé.`);
  const d = path.join(racine, n);
  if (fs.existsSync(path.join(d, FICHE_PROFIL))) throw new Error(`Le profil « ${n} » existe déjà.`);
  const existant = (() => { try { return fs.readdirSync(racine); } catch (e) { return []; } })();
  if (existant.some((x) => x.toLowerCase() === n.toLowerCase() && x !== n)) throw new Error(`Un dossier « ${n} » existe déjà (autre casse).`);
  ecrireJson(path.join(d, FICHE_PROFIL), { format: "ula-profil-1", nom: n, cree: aujourdhui() });
  oublierCache();
  return n;
}

function renommerProfil(racine, ancien, nouveau) {
  const p = profil(racine, ancien);
  if (!p) throw new Error(`Profil introuvable : ${ancien}`);
  const n = nomValide(nouveau, "nom d'utilisateur");
  if (n === ancien) return n;
  if (RESERVES.has(n.toLowerCase())) throw new Error(`« ${n} » est réservé.`);
  const cible = path.join(racine, n);
  const casse = n.toLowerCase() === ancien.toLowerCase();
  if (!casse && fs.existsSync(cible)) throw new Error(`Un dossier « ${n} » existe déjà.`);
  if (casse) {
    const tmp = path.join(racine, n + ".renommage-" + process.pid);
    fs.renameSync(p.dossier, tmp);
    fs.renameSync(tmp, cible);
  } else {
    fs.renameSync(p.dossier, cible);
  }
  const fiche = Object.assign({}, p.fiche, { nom: n });
  ecrireJson(path.join(cible, FICHE_PROFIL), fiche);
  // Le profil actif suit le renommage
  const memo = lireMemo();
  for (const k of Object.keys(memo)) if (memo[k] === ancien && path.resolve(k) === path.resolve(racine)) memo[k] = n;
  ecrireMemo(memo);
  oublierCache();
  return n;
}

/* Profil actif : mémorisé sur le poste (pas dans la racine, qui peut être partagée
   par git), par racine. Sans choix, le seul profil existant. */

function fichierMemo() {
  const local = process.env.LOCALAPPDATA || process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  return path.join(local, "studies-quiz", "ula-profil-actif.json");
}
function lireMemo() { return lireJson(fichierMemo()) || {}; }
function ecrireMemo(m) { try { ecrireJson(fichierMemo(), m); } catch (e) { /* lecture seule : tant pis */ } }

function profilActif(racine) {
  const liste = profils(racine);
  const memo = lireMemo()[path.resolve(racine)];
  if (memo && liste.some((p) => p.nom === memo)) return memo;
  return liste.length === 1 ? liste[0].nom : null;
}

function choisirProfil(racine, nom) {
  if (nom !== null && !profil(racine, nom)) throw new Error(`Profil introuvable : ${nom}`);
  const memo = lireMemo();
  if (nom === null) delete memo[path.resolve(racine)];
  else memo[path.resolve(racine)] = nom;
  ecrireMemo(memo);
  return nom;
}

/* -- Cursus : dossiers libres et liens vers les cours ------------------------- */

let cache = null;   // { cle, date, arbre }
function oublierCache() { cache = null; }

/** Arbre du cursus d'un profil : dossiers, liens vers des cours, cours personnels. */
function arbre(racine, nomProfil) {
  const p = profil(racine, nomProfil);
  if (!p) return null;
  const cle = path.resolve(p.dossier);
  if (cache && cache.cle === cle && Date.now() - cache.date < 3000) return cache.arbre;
  const parcourir = (dossier, profondeur) => {
    const noeud = { nom: path.basename(dossier), chemin: rel(racine, dossier), type: "dossier", enfants: [] };
    const lien = lireJson(path.join(dossier, FICHE_LIEN));
    if (lien && lien.cours) return Object.assign(noeud, { type: "lien", cours: String(lien.cours), ajoute: lien.ajoute || null });
    let entrees = [];
    try { entrees = fs.readdirSync(dossier, { withFileTypes: true }); } catch (e) { return noeud; }
    const noms = entrees.filter((e) => e.isDirectory()).map((e) => e.name);
    if (profondeur > 0 && (noms.includes("generated_courses") || noms.includes("generated_quizzes"))) return Object.assign(noeud, { type: "perso" });
    noeud.fichiers = entrees.filter((e) => e.isFile() && !e.name.startsWith(".") && e.name !== FICHE_PROFIL).length;
    if (profondeur >= 6) return noeud;
    for (const n of noms.sort((a, b) => a.localeCompare(b, "fr", { numeric: true }))) {
      if (n.startsWith(".") || n.startsWith("_") || TRAVAIL.has(n)) continue;
      noeud.enfants.push(parcourir(path.join(dossier, n), profondeur + 1));
    }
    return noeud;
  };
  const a = parcourir(p.dossier, 0);
  a.type = "profil";
  // Un dossier sans aucun cours dans son sous-arbre (documents, travaux…) est montré
  // replié : seuls les dossiers du cursus se déplient
  (function elaguer(n) {
    let cours = n.type === "lien" || n.type === "perso";
    for (const e of n.enfants || []) if (elaguer(e)) cours = true;
    if (n.type === "dossier" && !cours && n.enfants.length) {
      n.sousDossiers = n.enfants.length;
      n.enfants = [];
    }
    return cours;
  })(a);
  cache = { cle, date: Date.now(), arbre: a };
  return a;
}

/** Liens d'un profil vers les cours : [{ cours, chemin }] (chemin relatif à la racine) */
function liens(racine, nomProfil) {
  const res = [];
  const a = arbre(racine, nomProfil);
  (function p(n) {
    if (n.type === "lien") res.push({ cours: n.cours, chemin: n.chemin });
    for (const e of n.enfants || []) p(e);
  })(a || { enfants: [] });
  return res.sort((x, y) => x.chemin.localeCompare(y.chemin, "fr"));
}

/** Chemin (absolu) d'un dossier de cursus, vérifié dans l'espace du profil. */
function dossierDuProfil(racine, nomProfil, cheminRelatif) {
  const p = profil(racine, nomProfil);
  if (!p) throw new Error("Aucun profil choisi.");
  const abs = path.resolve(racine, String(cheminRelatif || nomProfil));
  if (!dans(p.dossier, abs)) throw new Error("Chemin hors de l'espace du profil.");
  return { p, abs };
}

function slug(texte) {
  return String(texte).normalize("NFC").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "cours";
}

/** Dossier de travail d'un cours pour un profil : le premier lien trouvé ; sinon, avec
    creer, un lien est ajouté dans « Cours suivis ». Renvoie le chemin absolu ou null. */
function lienDuCours(racine, nomProfil, id, { creer = false } = {}) {
  if (!nomProfil) return null;
  const l = liens(racine, nomProfil).find((x) => x.cours === id);
  if (l) return path.resolve(racine, l.chemin);
  if (!creer) return null;
  const c = coursParId(racine, id);
  const r = ajouterCours(racine, nomProfil, id, path.posix.join(nomProfil, DOSSIER_PAR_DEFAUT), c ? c.fiche.titre : id);
  return path.resolve(racine, r);
}

/** Ajoute un cours du catalogue dans un dossier du cursus ; renvoie le chemin du lien. */
function ajouterCours(racine, nomProfil, id, dossierCible, nom) {
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(String(id))) throw new Error("Identifiant de cours invalide.");
  const { abs } = dossierDuProfil(racine, nomProfil, dossierCible);
  const c = coursParId(racine, id);
  let n = nomValide(nom || (c ? slug(c.fiche.titre) : id), "nom du dossier");
  let cible = path.join(abs, n);
  for (let i = 2; fs.existsSync(cible); i++) cible = path.join(abs, `${n} (${i})`);
  ecrireJson(path.join(cible, FICHE_LIEN), { format: "ula-lien-1", cours: id, ajoute: aujourdhui() });
  oublierCache();
  return rel(racine, cible);
}

function creerDossier(racine, nomProfil, parent, nom) {
  const { abs } = dossierDuProfil(racine, nomProfil, parent);
  if (fs.existsSync(path.join(abs, FICHE_LIEN))) throw new Error("Un cours ne contient pas de dossier de cursus.");
  const cible = path.join(abs, nomValide(nom, "nom du dossier"));
  if (fs.existsSync(cible)) throw new Error("Ce dossier existe déjà.");
  fs.mkdirSync(cible, { recursive: true });
  oublierCache();
  return rel(racine, cible);
}

function renommer(racine, nomProfil, chemin, nom) {
  const { p, abs } = dossierDuProfil(racine, nomProfil, chemin);
  if (path.resolve(abs) === path.resolve(p.dossier)) throw new Error("Pour renommer le profil, passer par les profils.");
  const cible = path.join(path.dirname(abs), nomValide(nom, "nom du dossier"));
  if (cible === abs) return rel(racine, abs);
  if (fs.existsSync(cible) && cible.toLowerCase() !== abs.toLowerCase()) throw new Error("Un dossier porte déjà ce nom.");
  fs.renameSync(abs, cible);
  oublierCache();
  return rel(racine, cible);
}

function deplacer(racine, nomProfil, chemin, versDossier) {
  const { p, abs } = dossierDuProfil(racine, nomProfil, chemin);
  const { abs: dest } = dossierDuProfil(racine, nomProfil, versDossier);
  if (path.resolve(abs) === path.resolve(p.dossier)) throw new Error("Le profil ne se déplace pas.");
  if (dans(abs, dest)) throw new Error("Un dossier ne peut pas aller dans lui-même.");
  if (fs.existsSync(path.join(dest, FICHE_LIEN))) throw new Error("On ne range rien dans un cours.");
  const cible = path.join(dest, path.basename(abs));
  if (fs.existsSync(cible)) throw new Error("La destination contient déjà un élément de ce nom.");
  fs.mkdirSync(dest, { recursive: true });
  fs.renameSync(abs, cible);
  oublierCache();
  return rel(racine, cible);
}

/** Retire un dossier de cursus vide, ou un lien sans travail enregistré. Le travail
    n'est jamais effacé : un dossier qui en contient est refusé. */
function retirer(racine, nomProfil, chemin) {
  const { p, abs } = dossierDuProfil(racine, nomProfil, chemin);
  if (path.resolve(abs) === path.resolve(p.dossier)) throw new Error("Le profil ne se retire pas ici.");
  const restes = [];
  (function lister(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) lister(f);
      else if (!(e.name === FICHE_LIEN && d === abs)) restes.push(rel(abs, f));
    }
  })(abs);
  if (restes.length) throw new Error(`Ce dossier contient ${restes.length} fichier(s) de travail (${restes.slice(0, 3).join(", ")}${restes.length > 3 ? "…" : ""}) : le vider ou le déplacer d'abord.`);
  fs.rmSync(abs, { recursive: true });
  oublierCache();
}

/* -- Dossier de travail d'une page ------------------------------------------------ */

/**
 * Dossier où s'écrit le travail lié à une page (tentatives, td_results, quiz générés).
 * - page du catalogue (explore/<d>/<id>/…) : le dossier du lien vers ce cours dans
 *   l'espace du profil actif (créé au besoin avec creer) ; null sans profil ;
 * - autre page (espace d'un profil, démonstrations de _outils) : son dossier, ou le
 *   dossier parent pour une page de generated_courses / generated_quizzes.
 */
function travailDePage(racine, abs, { creer = false, profil: nom } = {}) {
  const c = coursDuChemin(rel(racine, abs));
  if (c && dans(racine, abs)) {
    const p = nom === undefined ? profilActif(racine) : nom;
    if (!p) return { dossier: null, cours: c.id, raison: "Aucun profil choisi : le choisir (ou le créer) sur l'accueil." };
    const d = lienDuCours(racine, p, c.id, { creer });
    return { dossier: d, cours: c.id, profil: p, aCreer: !d };
  }
  const d = path.dirname(abs);
  return { dossier: /^generated_/.test(path.basename(d)) ? path.dirname(d) : d, cours: null };
}

module.exports = {
  FICHE_COURS, FICHE_PROFIL, FICHE_LIEN, EXPLORE, DOSSIER_PAR_DEFAUT, RESERVES,
  lireJson, ecrireJson, nomValide, nomSession, slug,
  cours, coursParId, coursDuChemin,
  profils, profil, creerProfil, renommerProfil, profilActif, choisirProfil,
  arbre, liens, lienDuCours, ajouterCours, creerDossier, renommer, deplacer, retirer,
  travailDePage, oublierCache
};
