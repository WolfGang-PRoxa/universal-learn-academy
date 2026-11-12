#!/usr/bin/env node
"use strict";
/* ==========================================================================
   Serveur local de l'outil de quiz (_outils/quiz)
   --------------------------------------------------------------------------
   Sert la racine des données ula/ (catalogue explore/, espaces des profils,
   accueil index.html) et les outils (/_outils/) sur http://127.0.0.1:<port>/,
   et ajoute une API pour ce qu'une page ouverte depuis le disque ne peut pas faire :
     - demander de l'aide, une correction ou un bilan à Claude (Claude Code,
       avec l'abonnement du compte connecté) ;
     - exécuter le code des questions (SQL, Python, JavaScript, C) ;
     - enregistrer les tentatives dans l'espace du profil actif, et les relire ;
     - générer un nouveau quiz en arrière-plan ;
     - lire et modifier les réglages (_outils/quiz/reglages.json).

   Lancement : lancer.bat (Windows) ou lancer.sh, à la racine, ou
               node _outils/quiz/serveur/serveur.js [--port 5178] [--ouvrir]
   Racine des données : le dossier qui contient _outils, ou ULA_RACINE.

   Sécurité : écoute sur 127.0.0.1 seulement ; refuse les requêtes dont
   l'hôte ou l'origine n'est pas le serveur lui-même (pas d'appel possible
   depuis un autre site) ; aucun fichier servi ou écrit hors de la racine
   des données et du dossier des outils.
   ========================================================================== */

const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const { RACINE, OUTILS, VERSION, depuisUrl, relatif, espace } = require("./lib/chemins");
const reglages = require("./lib/reglages");
const claude = require("./lib/claude");
const executer = require("./lib/executer");
const archives = require("./lib/archives");
const catalogue = require("./lib/catalogue");
const assistant = require("./lib/assistant");
const taches = require("./lib/taches");
const extensions = require("./lib/extensions");

const TYPES_MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".ico": "image/x-icon", ".pdf": "application/pdf",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".wasm": "application/wasm",
  ".c": "text/plain; charset=utf-8", ".h": "text/plain; charset=utf-8", ".py": "text/plain; charset=utf-8",
  ".sql": "text/plain; charset=utf-8",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".wav": "audio/wav", ".mp4": "video/mp4", ".webm": "video/webm"
};

let port = 5178;
let dernierQuota = null;

/* Réponses ------------------------------------------------------------------ */

function envoyerJson(res, statut, objet) {
  const corps = JSON.stringify(objet);
  res.writeHead(statut, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(corps);
}

function erreur(res, statut, message) {
  envoyerJson(res, statut, { erreur: message });
}

function lireCorps(req, limite) {
  return new Promise((resolve, reject) => {
    let taille = 0;
    const morceaux = [];
    req.on("data", (m) => {
      taille += m.length;
      if (taille > (limite || 5 * 1024 * 1024)) { reject(new Error("Requête trop volumineuse.")); req.destroy(); return; }
      morceaux.push(m);
    });
    req.on("end", () => {
      try { resolve(morceaux.length ? JSON.parse(Buffer.concat(morceaux).toString("utf8")) : {}); }
      catch (e) { reject(new Error("JSON invalide.")); }
    });
    req.on("error", reject);
  });
}

// Flux d'événements (text/event-stream) pour les réponses de Claude au fil de l'eau
function flux(res) {
  res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
  return (type, donnees) => {
    if (!res.writableEnded) res.write("event: " + type + "\ndata: " + JSON.stringify(donnees) + "\n\n");
  };
}

// Relaie un appel à Claude sur un flux ; l'appel est arrêté si la page se ferme
function relayer(res, session, appel) {
  const envoyer = flux(res);
  envoyer("session", { session });
  res.on("close", () => { if (!res.writableEnded) appel.arreter(); });
  return {
    surEvenement(e) {
      if (e.type === "quota") dernierQuota = Object.assign({ date: Date.now() }, e.info);
      envoyer(e.type, e);
    },
    fin() {
      appel.promesse.then((r) => {
        envoyer("fin", { texte: r.texte, session: r.session || session, modele: r.modele, duree: r.duree });
      }).catch((e) => {
        envoyer("erreur", { message: e.message });
      }).finally(() => res.end());
    }
  };
}

/* Sécurité ------------------------------------------------------------------ */

function hoteLocal(valeur) {
  return valeur === "127.0.0.1:" + port || valeur === "localhost:" + port;
}

function autorise(req) {
  if (!hoteLocal((req.headers.host || "").toLowerCase())) return "Hôte refusé.";
  if (req.method === "GET" || req.method === "HEAD") return null;
  const origine = (req.headers.origin || "").toLowerCase();
  if (!origine || !hoteLocal(origine.replace(/^http:\/\//, ""))) return "Origine refusée.";
  if (!/^application\/json/i.test(req.headers["content-type"] || "")) return "Type de contenu refusé.";
  return null;
}

/* Fichiers statiques ------------------------------------------------------------- */

// Un fichier absent d'un cours du catalogue est cherché dans le dossier de ce cours
// de l'espace du profil actif (son TP, son devoir…) : les liens relatifs des pages
// (« ../TP/TP1/script.txt ») mènent ainsi au travail de l'utilisateur.
function superposition(abs) {
  const c = espace.coursDuChemin(relatif(abs));
  if (!c || !c.reste) return null;
  const lien = espace.lienDuCours(RACINE, espace.profilActif(RACINE), c.id);
  if (!lien) return null;
  const f = path.resolve(lien, ...c.reste.split("/"));
  return f.startsWith(lien) && fs.existsSync(f) ? f : null;
}

function echapperHtml(t) {
  return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// Page d'un cours qui n'est pas (ou plus) installé : renvoi vers le catalogue de l'accueil
function pageAbsente(res, chemin) {
  const c = espace.coursDuChemin(relatif(depuisUrl(chemin) || RACINE));
  if (c && /\.html?$/i.test(chemin) && !fs.existsSync(path.join(RACINE, "explore", c.domaine, c.id))) {
    const corps = `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Cours non installé</title>
<link rel="stylesheet" href="/_outils/charte/assets/cours.css"><script src="/_outils/charte/assets/cours.js"></script>
<header class="barre"><nav class="fil"><span class="pastille"></span><a href="/index.html">ULA</a><span aria-current="page">Cours non installé</span></nav></header>
<div class="page"><main class="cours sans-numeros sans-sommaire"><header class="entete"><h1>Cours non installé</h1>
<p class="chapeau">La page demandée appartient au cours « ${echapperHtml(c.id)} », qui n'est pas installé sur ce poste.</p></header>
<p><a class="bouton principal" href="/index.html#catalogue">Ouvrir le catalogue</a> pour le télécharger, puis revenir à cette page.</p></main></div></html>`;
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    return res.end(corps);
  }
  return erreur(res, 404, "Introuvable : " + chemin);
}

// Accueil général et accueils de domaine : servis par la page dynamique de l'outil ula
// (profils, cursus, catalogue). Le fichier index.html de la racine, produit par
// index_niveau.py, ne sert qu'aux pages ouvertes depuis le disque.
const ACCUEIL = path.join(OUTILS, "ula", "accueil.html");
function estAccueil(chemin, abs) {
  if (chemin === "/index.html") return true;
  return /^\/explore\/[^/]+\/index\.html$/.test(chemin) && !fs.existsSync(abs);
}

function servirFichier(req, res, chemin) {
  let abs = depuisUrl(chemin);
  if (!abs) return erreur(res, 403, "Chemin refusé.");
  if (estAccueil(decodeURIComponent(chemin), abs) && fs.existsSync(ACCUEIL)) abs = ACCUEIL;
  let stat;
  try { stat = fs.statSync(abs); } catch (e) {
    const autre = superposition(abs);
    if (!autre) return pageAbsente(res, chemin);
    abs = autre;
    stat = fs.statSync(abs);
  }
  if (stat.isDirectory()) {
    if (!chemin.endsWith("/")) { res.writeHead(301, { Location: chemin + "/" }); return res.end(); }
    abs = path.join(abs, "index.html");
    try { stat = fs.statSync(abs); } catch (e) { return erreur(res, 404, "Pas de page d'accueil dans ce dossier."); }
  }
  const type = TYPES_MIME[path.extname(abs).toLowerCase()] || "application/octet-stream";
  // Plages d'octets (Range) : sans elles, le navigateur ne peut pas se déplacer
  // dans une piste audio ou vidéo, ni en lire un passage (#t=début,fin).
  const plage = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  if (plage && stat.size > 0) {
    let debut = plage[1] === "" ? Math.max(0, stat.size - Number(plage[2])) : Number(plage[1]);
    let fin = plage[1] !== "" && plage[2] !== "" ? Math.min(Number(plage[2]), stat.size - 1) : stat.size - 1;
    if (debut > fin || debut >= stat.size) {
      res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
      return res.end();
    }
    res.writeHead(206, {
      "Content-Type": type, "Content-Length": fin - debut + 1, "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${debut}-${fin}/${stat.size}`, "Cache-Control": "no-cache"
    });
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(abs, { start: debut, end: fin }).pipe(res);
  }
  res.writeHead(200, { "Content-Type": type, "Content-Length": stat.size, "Accept-Ranges": "bytes", "Cache-Control": "no-cache" });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(abs).pipe(res);
}

/* API -------------------------------------------------------------------------- */

function etatServeur(forcer) {
  const c = claude.trouver(forcer);
  const r = reglages.lire();
  return {
    app: "studies-quiz",
    version: VERSION,
    racine: RACINE,
    outils: OUTILS,
    profil: espace.profilActif(RACINE),
    claude: c.executable ? { disponible: true, executable: c.executable, version: c.version } : { disponible: false, erreur: c.erreur },
    executeurs: Object.fromEntries(Object.entries(executer.disponibilite(forcer)).map(([k, v]) => [k, v ? v.version : null])),
    reglages: r,
    usages: reglages.USAGES,
    modeles: reglages.MODELES,
    efforts: reglages.EFFORTS,
    quota: dernierQuota,
    extensions: extensions.lister().map((x) => x.nom)
  };
}

async function api(req, res, url) {
  const route = url.pathname.replace(/^\/api\//, "");
  const m = req.method;
  const q = url.searchParams;

  if (route === "ping") return envoyerJson(res, 200, { app: "studies-quiz", version: VERSION, racine: RACINE });
  if (route === "etat" && m === "GET") return envoyerJson(res, 200, etatServeur(q.get("forcer") === "1"));

  if (route === "reglages") {
    if (m === "GET") return envoyerJson(res, 200, reglages.lire());
    if (m === "PUT") {
      const r = reglages.modifier(await lireCorps(req));
      claude.trouver(true);
      return envoyerJson(res, 200, r);
    }
  }

  if (route === "catalogue" && m === "GET") {
    return envoyerJson(res, 200, { matieres: catalogue.inventaire(), taches: taches.lister() });
  }

  if (route === "tentatives") {
    if (m === "GET") {
      if (q.get("page")) return envoyerJson(res, 200, { tentatives: archives.lister(q.get("page")) });
      if (q.get("matiere")) return envoyerJson(res, 200, { tentatives: archives.listerMatiere(q.get("matiere")) });
      return erreur(res, 400, "Paramètre « page » ou « matiere » attendu.");
    }
    if (m === "POST") {
      const b = await lireCorps(req);
      return envoyerJson(res, 200, { fichier: archives.enregistrer(b.page, b.tentative) });
    }
  }
  if (route === "tentatives/supprimer" && m === "POST") {
    const b = await lireCorps(req);
    archives.supprimer(b.page, b.id);
    return envoyerJson(res, 200, { ok: true });
  }
  if (route === "tentative" && m === "GET") {
    return envoyerJson(res, 200, archives.lire(q.get("fichier")));
  }

  if (route === "executer" && m === "POST") {
    return envoyerJson(res, 200, await executer.executer(await lireCorps(req, 1024 * 1024)));
  }

  if (route === "claude/test" && m === "POST") {
    const b = await lireCorps(req);
    const debut = Date.now();
    const r = await claude.lancer({
      usage: reglages.USAGES[b.usage] ? b.usage : "aide",
      systeme: "Tu réponds en un seul mot.",
      message: "Réponds seulement : OK",
      persistance: false,
      outils: "",
      delai: 90000,
      surEvenement(e) { if (e.type === "quota") dernierQuota = Object.assign({ date: Date.now() }, e.info); }
    }).promesse;
    return envoyerJson(res, 200, { ok: true, texte: r.texte, modele: r.modele, duree: Date.now() - debut });
  }

  if (route === "claude/aide" && m === "POST") {
    const b = await lireCorps(req);
    let relais;
    const { session, appel } = assistant.aide(b, (e) => relais && relais.surEvenement(e));
    relais = relayer(res, session, appel);
    return relais.fin();
  }

  if (route === "claude/evaluer" && m === "POST") {
    const b = await lireCorps(req);
    let relais;
    const { session, appel } = assistant.evaluer(b, (e) => relais && relais.surEvenement(e));
    relais = relayer(res, session, appel);
    return relais.fin();
  }

  if (route === "claude/corriger" && m === "POST") {
    return envoyerJson(res, 200, await assistant.corriger(await lireCorps(req)));
  }

  if (route === "generer" && m === "POST") {
    const b = await lireCorps(req);
    return envoyerJson(res, 200, taches.creer(b.page, b.options || {}));
  }
  if (route === "taches" && m === "GET") return envoyerJson(res, 200, { taches: taches.lister() });
  let t = route.match(/^taches\/([0-9a-f-]{36})$/);
  if (t && m === "GET") {
    const e = taches.etat(t[1]);
    return e ? envoyerJson(res, 200, e) : erreur(res, 404, "Tâche inconnue.");
  }
  t = route.match(/^taches\/([0-9a-f-]{36})\/annuler$/);
  if (t && m === "POST") return envoyerJson(res, 200, taches.annuler(t[1]) || {});

  // Routes des autres outils (_outils/atelier/serveur/extension.js…)
  const outils = { envoyerJson, erreur, lireCorps, relayer, chemins: require("./lib/chemins"), reglages, claude, catalogue, archives, assistant, quota: (q) => { dernierQuota = Object.assign({ date: Date.now() }, q); } };
  if (await extensions.traiter(route, req, res, outils)) return;

  return erreur(res, 404, "Route inconnue : " + m + " /api/" + route);
}

/* Serveur ------------------------------------------------------------------------ */

const serveur = http.createServer(async (req, res) => {
  const refus = autorise(req);
  if (refus) return erreur(res, 403, refus);
  let url;
  try { url = new URL(req.url, "http://127.0.0.1:" + port); } catch (e) { return erreur(res, 400, "URL invalide."); }
  try {
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return erreur(res, 405, "Méthode refusée.");
    if (url.pathname === "/") { res.writeHead(302, { Location: "/index.html" }); return res.end(); }
    if (url.pathname === "/favicon.ico") { res.writeHead(204); return res.end(); }
    return servirFichier(req, res, url.pathname);
  } catch (e) {
    if (!res.headersSent) erreur(res, 500, e.message);
    else res.end();
  }
});

function ouvrirNavigateur(adresse) {
  const cmd = process.platform === "win32" ? ["cmd", ["/c", "start", "", adresse]]
    : process.platform === "darwin" ? ["open", [adresse]] : ["xdg-open", [adresse]];
  spawn(cmd[0], cmd[1], { detached: true, stdio: "ignore", windowsHide: true }).unref();
}

async function dejaLance(p) {
  try {
    const r = await fetch("http://127.0.0.1:" + p + "/api/ping", { signal: AbortSignal.timeout(1500) });
    return (await r.json()).app === "studies-quiz";
  } catch (e) { return false; }
}

async function demarrer() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--port");
  port = i >= 0 ? Number(args[i + 1]) : reglages.lire().port;
  const ouvrir = args.includes("--ouvrir");
  const adresse = "http://127.0.0.1:" + port + "/";

  if (await dejaLance(port)) {
    console.log("Le serveur tourne déjà sur " + adresse);
    if (ouvrir) ouvrirNavigateur(adresse);
    return;
  }
  console.log("Outil de quiz " + VERSION + " · données " + RACINE + (path.relative(RACINE, OUTILS) === "_outils" ? "" : " · outils " + OUTILS));
  extensions.charger((m) => console.log(m));
  executer.nettoyer();
  executer.installerPglite((m) => console.log(m));
  const c = claude.trouver(true);
  console.log(c.executable ? "Claude Code " + c.version + " : " + c.executable : "Attention : " + c.erreur);
  const d = executer.disponibilite(true);
  console.log("Exécution du code : " + Object.entries(d).map(([k, v]) => k + (v ? " ✓" : " ✗")).join(", "));

  serveur.listen(port, "127.0.0.1", () => {
    console.log("\nPrêt : " + adresse + "\n(Fermer cette fenêtre, ou Ctrl+C, pour arrêter le serveur.)");
    if (ouvrir) ouvrirNavigateur(adresse);
  });
  serveur.on("error", (e) => {
    console.error(e.code === "EADDRINUSE" ? "Le port " + port + " est déjà utilisé par un autre programme. Changer « port » dans _outils/quiz/reglages.json." : e.message);
    process.exit(1);
  });
}

function arreter() {
  taches.toutArreter();
  process.exit(0);
}
process.on("SIGINT", arreter);
process.on("SIGTERM", arreter);
// Sous l'application de bureau (_outils/app) : arrêt demandé, ou application disparue
if (process.send) {
  process.on("message", (m) => { if (m === "arreter") arreter(); });
  process.on("disconnect", arreter);
}

demarrer();
