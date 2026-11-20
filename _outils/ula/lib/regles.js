"use strict";
/* Ce qui peut être publié, et surtout ce qui ne l'est jamais.

   Les mêmes règles servent :
   - à préparer les outils livrés avec l'application (app/scripts/preparer-contenu.mjs)
     et à contrôler le paquet construit (app/scripts/verifier-paquet.cjs) ;
   - à construire le catalogue (app/scripts/catalogue.mjs) et le dépôt public
     (app/scripts/exporter-public.mjs) ;
   - à vérifier une proposition de cours (« Proposer ce cours », proposition.js) ;
   - à lister les fichiers personnels suivis par git (npm run donnees-perso).

   Structure de la racine ula/ :
     explore/<domaine>/<cours>/   catalogue : publiable, sauf les exceptions ci-dessous
     _outils/                     outils : publiables, sauf les scans et les réglages
     index.html, lanceurs         publiables
     <profil>/…                   espace d'un utilisateur : jamais publié

   Les chemins sont relatifs à la racine, avec des « / ». */

// Données personnelles : jamais dans un exécutable, le catalogue ni le dépôt public.
// Elles restent suivies par git dans le dépôt de travail (le git pull à la fac en a
// besoin), mais tous les contrôles les refusent.
const PERSONNELS = [
  { motif: /^(?!explore\/|_outils\/|app\/|\.git|\.claude\/|index\.html$|lancer(-app|-jupyter)?\.(bat|sh)$)/, raison: "hors du catalogue et des outils : espace personnel d'un profil", racine: true },
  { motif: /(^|\/)quiz_results\//, raison: "tentatives aux quiz" },
  { motif: /(^|\/)td_results\//, raison: "travail enregistré dans les TD interactifs" },
  { motif: /(^|\/)TODO\.md$/, raison: "suivi personnel" },
  // Outil « Mon suivi » (page du TODO.md) : sert au développement de l'application,
  // réservé au dépôt ula ; ni dans l'application installée, ni dans le dépôt public
  { motif: /^_outils\/todo\//, raison: "outil de suivi du développement (TODO), réservé au dépôt ula" },
  { motif: /(^|\/)ula-(profil|lien)\.json$/, raison: "fiche de profil ou lien du cursus d'un utilisateur" },
  // Les dossiers de TP du catalogue ne contiennent que les fichiers fournis de la liste
  // blanche (app/tp-fournis.json), dans leur version d'origine : le contrôle les vérifie
  // un par un (empreinte).
  { motif: /^explore\/[^/]+\/[^/]+\/TP\//, raison: "fichier de TP : seulement ceux de la liste blanche, dans leur version d'origine", tp: true },
  { motif: /(^|\/)(administratif|Hop3x|propositions)\//, raison: "documents personnels, traces de TP, propositions en attente" },
  { motif: /(^|\/)(Site Portfolio|website_project)\//, raison: "portfolio ou projet de site de l'étudiant" },
  { motif: /(^|\/)L\d\/Communication\//i, raison: "communication : travaux de groupe et productions de l'étudiant" },
  { motif: /STUDENT[^/]*\.docx$/i, raison: "fiches d'anglais remplies par l'étudiant" },
  { motif: /(^|\/)DM\/.*\.ipynb$/i, raison: "devoir maison : notebook de l'étudiant" },
  { motif: /^_outils\/numerisation\/scans\//, raison: "scans, avec parfois des réponses manuscrites" },
  { motif: /romain|piau/i, raison: "nom de l'étudiant dans le chemin" },
  { motif: /(^|\/)reglages\.json$/, raison: "réglages locaux de l'outil de quiz" },
  { motif: /(^|\/)CLAUDE\.md$|^\.claude\//, raison: "consignes et réglages de Claude Code" }
];

// Écartés aussi, sans être personnels : inutiles une fois publié ou installé.
const INUTILES = [
  { motif: /^app\//, raison: "programme de l'application (déjà dans app.asar)" },
  { motif: /^\.git/, raison: "fichiers de git" },
  { motif: /^lancer(-app|-jupyter)?\.(bat|sh)$/, raison: "lanceurs du dossier ula" },
  { motif: /(^|\/)\.ipynb_checkpoints\//, raison: "sauvegardes de Jupyter" },
  { motif: /(^|\/)\.ula-version\.json$/, raison: "version d'un cours téléchargé" },
  // Fichiers système (macOS, Windows), qu'electron-builder écarte de toute façon
  { motif: /(^|\/)(\.DS_Store|\._[^/]*|Thumbs\.db|desktop\.ini)$/i, raison: "fichiers système" }
];

// Fichier écrit à la racine des outils préparés : liste des fichiers et empreintes,
// lue par l'application pour mettre à jour sa copie locale des outils.
const MANIFESTE = ".ula-outils.json";

function normaliser(chemin) {
  return String(chemin).replace(/\\/g, "/").replace(/^\.\//, "");
}

/** Le chemin est-il dans un dossier de TP du catalogue ? */
function estTP(chemin) {
  return /^explore\/[^/]+\/[^/]+\/TP\//.test(normaliser(chemin));
}

/** Première règle personnelle qui écarte ce chemin, ou null. `tp: false` ignore la
    règle des dossiers de TP (pour un fichier de la liste blanche) ; `racine: false`
    ignore celle des chemins hors du catalogue (fichiers du programme, d'une archive). */
function personnel(chemin, { tp = true, racine = true } = {}) {
  const c = normaliser(chemin);
  return PERSONNELS.find((r) => (tp || !r.tp) && (racine || !r.racine) && r.motif.test(c)) || null;
}

/** Première règle (personnelle ou non) qui écarte ce chemin, ou null. */
function exclusion(chemin, options = {}) {
  const c = normaliser(chemin);
  return personnel(c, options) || INUTILES.find((r) => r.motif.test(c)) || null;
}

module.exports = { PERSONNELS, INUTILES, MANIFESTE, normaliser, personnel, exclusion, estTP };
