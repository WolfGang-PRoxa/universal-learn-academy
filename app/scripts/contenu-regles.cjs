"use strict";
/* Ce qui entre dans les exécutables, et surtout ce qui n'y entre jamais.

   Les cours livrés avec l'application sont les fichiers suivis par git dans
   studies/, moins ceux que ces règles écartent. Les mêmes règles servent :
   - à préparer le contenu (scripts/preparer-contenu.mjs) ;
   - à contrôler le paquet construit (scripts/apres-empaquetage.cjs, appelé par
     electron-builder : la construction échoue si un fichier personnel s'y trouve) ;
   - à lister les fichiers personnels suivis par git (npm run donnees-perso), le
     jour où le dépôt deviendra public.

   Les chemins sont relatifs à studies/, avec des « / ». */

// Données personnelles : jamais dans un exécutable. Elles restent suivies par git
// (le git pull à la fac en a besoin), mais le contrôle du paquet les refuse.
const PERSONNELS = [
  { motif: /(^|\/)quiz_results\//, raison: "tentatives aux quiz" },
  { motif: /(^|\/)td_results\//, raison: "travail enregistré dans les TD interactifs" },
  { motif: /^TODO\.md$/, raison: "suivi personnel des cours à générer" },
  // Les dossiers de TP ne sont jamais pris dans le dossier de travail : seuls les
  // fichiers de la liste blanche (tp-fournis.json) sont livrés, dans leur version
  // d'origine tirée de git (voir tp-fournis.mjs).
  { motif: /^L\d\/[^/]+\/TP\//, raison: "dossiers de TP : ton code y est mêlé aux fichiers fournis", tp: true },
  { motif: /^administratif\//, raison: "documents administratifs" },
  { motif: /^Hop3x\//, raison: "Hop3x : traces de ton travail en TP" },
  { motif: /^L1\/Web_statique\/Site Portfolio\//, raison: "portfolio personnel" },
  { motif: /^L1\/Web_statique\/website_project\//, raison: "projet de site web de l'étudiant" },
  { motif: /^L\d\/Communication\//i, raison: "communication : travaux de groupe et productions de l'étudiant" },
  { motif: /^L\d\/Anglais\/.*STUDENT.*\.docx$/i, raison: "fiches d'anglais remplies par l'étudiant" },
  { motif: /^L\d\/[^/]+\/DM\/.*\.ipynb$/i, raison: "devoir maison : notebook de l'étudiant" },
  { motif: /^_outils\/numerisation\/scans\//, raison: "scans, avec parfois des réponses manuscrites" },
  { motif: /romain|piau/i, raison: "nom de l'étudiant dans le chemin" },
  { motif: /(^|\/)reglages\.json$/, raison: "réglages locaux de l'outil de quiz" },
  { motif: /(^|\/)CLAUDE\.md$|^\.claude\//, raison: "consignes et réglages de Claude Code" }
];

// Écartés aussi, sans être personnels : inutiles une fois installé.
const INUTILES = [
  { motif: /^app\//, raison: "programme de l'application (déjà dans app.asar)" },
  { motif: /^\.git/, raison: "fichiers de git" },
  { motif: /^lancer(-app|-jupyter)?\.(bat|sh)$/, raison: "lanceurs du dossier studies" },
  { motif: /(^|\/)\.ipynb_checkpoints\//, raison: "sauvegardes de Jupyter" },
  // Fichiers système (macOS, Windows), qu'electron-builder écarte de toute façon
  { motif: /(^|\/)(\.DS_Store|\._[^/]*|Thumbs\.db|desktop\.ini)$/i, raison: "fichiers système" }
];

// Fichier écrit à la racine du contenu préparé : liste des fichiers et empreintes,
// lue par l'application pour mettre à jour la copie locale des cours.
const MANIFESTE = ".studies-contenu.json";

function normaliser(chemin) {
  return String(chemin).replace(/\\/g, "/").replace(/^\.\//, "");
}

/** Le chemin est-il dans un dossier de TP ? */
function estTP(chemin) {
  return /^L\d\/[^/]+\/TP\//.test(normaliser(chemin));
}

/** Première règle personnelle qui écarte ce chemin, ou null. `tp: false` ignore la
    règle des dossiers de TP (pour un fichier de la liste blanche). */
function personnel(chemin, { tp = true } = {}) {
  const c = normaliser(chemin);
  return PERSONNELS.find((r) => (tp || !r.tp) && r.motif.test(c)) || null;
}

/** Première règle (personnelle ou non) qui écarte ce chemin, ou null. */
function exclusion(chemin, options = {}) {
  const c = normaliser(chemin);
  return personnel(c, options) || INUTILES.find((r) => r.motif.test(c)) || null;
}

module.exports = { PERSONNELS, INUTILES, MANIFESTE, normaliser, personnel, exclusion, estTP };
