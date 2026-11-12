"use strict";
/* Le dossier des cours que l'application affiche.

   Deux modes, au choix dans les paramètres :
   - « integre » : les cours livrés avec l'application (resources/cours, en lecture
     seule) sont copiés dans un dossier local où le serveur peut écrire les
     tentatives, le travail des TD et les quiz générés :
       Windows  %LOCALAPPDATA%\Studies\cours
       Linux    ~/.local/share/Studies/cours
     À chaque nouvelle version, la copie est mise à jour d'après le manifeste des
     cours (.studies-contenu.json) : un fichier livré n'est remplacé ou supprimé que
     s'il n'a pas été modifié depuis sa copie. Ce que le serveur a écrit
     (quiz_results/, td_results/, quiz générés, réglages) n'est jamais touché.
   - « dossier » : un dossier studies existant, par exemple un clone git du dépôt,
     utilisé tel quel. C'est le mode de l'étudiant : son travail reste dans le dépôt
     et le git pull continue de tout synchroniser.

   En développement (npm start), le mode « integre » utilise le dépôt lui-même. */

const { app } = require("electron");
const fs = require("fs");
const path = require("path");

const MANIFESTE = ".studies-contenu.json";
const PROGRAMME = path.join("_outils", "app", "principal.js");

function dossierLocal() {
  if (process.platform === "win32") {
    return path.join(process.env.LOCALAPPDATA || path.join(app.getPath("home"), "AppData", "Local"), "Studies", "cours");
  }
  return path.join(process.env.XDG_DATA_HOME || path.join(app.getPath("home"), ".local", "share"), "Studies", "cours");
}

function dossierLivre() {
  return path.join(process.resourcesPath, "cours");
}

function depotDeDeveloppement() {
  return path.resolve(app.getAppPath(), "..");
}

/** Un dossier est un dossier studies utilisable s'il contient le programme et le serveur. */
function estDossierStudies(dossier) {
  return Boolean(dossier) && fs.existsSync(path.join(dossier, PROGRAMME))
    && fs.existsSync(path.join(dossier, "_outils", "quiz", "serveur", "serveur.js"));
}

function lireJson(f) {
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; }
}

/** Version des cours livrés et de la copie locale, pour les paramètres. */
function versions() {
  const livre = app.isPackaged ? lireJson(path.join(dossierLivre(), MANIFESTE)) : null;
  const local = lireJson(path.join(dossierLocal(), MANIFESTE));
  const resume = (m) => (m ? { commit: m.commit, cree: m.cree, fichiers: Object.keys(m.fichiers || {}).length } : null);
  return { livre: resume(livre), local: resume(local) };
}

/* -- Mise à jour de la copie locale ----------------------------------------------- */

function inchange(f, trace) {
  if (!trace) return false;
  try {
    const s = fs.statSync(f);
    return s.size === trace.taille && Math.round(s.mtimeMs) === trace.mtime;
  } catch (e) { return false; }
}

function tracer(f, empreinte) {
  const s = fs.statSync(f);
  return { empreinte, taille: s.size, mtime: Math.round(s.mtimeMs) };
}

/**
 * Met la copie locale à jour d'après le manifeste livré.
 * @param {(fait: number, total: number) => void} progression
 * @returns {{ copies: number, supprimes: number, conserves: string[], aJour: boolean }}
 */
function synchroniser(source, cible, progression = () => {}) {
  const nouveau = lireJson(path.join(source, MANIFESTE));
  if (!nouveau) throw new Error("Les cours livrés avec l'application sont introuvables (" + source + ").");
  const etatFichier = path.join(cible, MANIFESTE);
  const ancien = lireJson(etatFichier) || { version: null, fichiers: {}, traces: {} };
  if (ancien.version === nouveau.version) return { copies: 0, supprimes: 0, conserves: [], aJour: true };

  const traces = Object.assign({}, ancien.traces || {});
  const conserves = [];
  let copies = 0, supprimes = 0, fait = 0;
  const chemins = Object.keys(nouveau.fichiers);
  const total = chemins.length;

  for (const chemin of chemins) {
    const n = nouveau.fichiers[chemin];
    const f = path.join(cible, ...chemin.split("/"));
    const trace = traces[chemin];
    const present = fs.existsSync(f);
    if (present && trace && trace.empreinte === n.empreinte && inchange(f, trace)) {
      // déjà la bonne version
    } else if (!present || inchange(f, trace)) {
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.copyFileSync(path.join(source, ...chemin.split("/")), f);
      traces[chemin] = tracer(f, n.empreinte);
      copies++;
    } else {
      // Modifié dans la copie locale (un accueil où un quiz généré a été ajouté…) : conservé
      conserves.push(chemin);
    }
    if (++fait % 50 === 0 || fait === total) progression(fait, total);
  }

  // Fichiers retirés des cours : supprimés s'ils n'ont pas été modifiés
  for (const chemin of Object.keys(ancien.fichiers || {})) {
    if (nouveau.fichiers[chemin]) continue;
    const f = path.join(cible, ...chemin.split("/"));
    if (inchange(f, traces[chemin])) { fs.rmSync(f, { force: true }); supprimes++; }
    delete traces[chemin];
  }

  fs.writeFileSync(etatFichier, JSON.stringify({ version: nouveau.version, commit: nouveau.commit, cree: nouveau.cree, fichiers: nouveau.fichiers, traces }));
  return { copies, supprimes, conserves, aJour: false };
}

/* -- Choix du dossier -------------------------------------------------------------- */

/**
 * Dossier des cours à utiliser d'après les paramètres.
 * @returns {{ racine: string|null, mode: string, aSynchroniser: boolean, erreur?: string }}
 */
function resoudre(reglage) {
  if (reglage.mode === "dossier") {
    if (estDossierStudies(reglage.dossier)) return { racine: reglage.dossier, mode: "dossier", aSynchroniser: false };
    return { racine: null, mode: "dossier", aSynchroniser: false, erreur: "Le dossier des cours est introuvable : " + (reglage.dossier || "(aucun)") };
  }
  if (!app.isPackaged) return { racine: depotDeDeveloppement(), mode: "integre", aSynchroniser: false };
  const cible = dossierLocal();
  const livre = lireJson(path.join(dossierLivre(), MANIFESTE));
  const local = lireJson(path.join(cible, MANIFESTE));
  return { racine: cible, mode: "integre", aSynchroniser: !local || !livre || local.version !== livre.version };
}

module.exports = { dossierLocal, dossierLivre, estDossierStudies, resoudre, synchroniser, versions, PROGRAMME };
