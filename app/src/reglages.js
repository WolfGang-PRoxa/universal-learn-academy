'use strict';
/* Paramètres de l'application installée, dans <userData>/parametres.json
   (%APPDATA%\Universal Learn Academy sous Windows, ~/.config/Universal Learn
   Academy sous Linux ; repris de %APPDATA%\Studies à la première ouverture).

   Les clés manquantes reprennent leur valeur par défaut. Les clés d'API (Anthropic,
   OpenAI, Gemini) y sont rangées chiffrées par le système (safeStorage, voir
   claude.js et ia.js) et ne sont jamais envoyées à l'interface des paramètres. */

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAUT = {
  // Recherche et installation des mises à jour au lancement
  miseAJourAuto: true,
  // Fenêtre au lancement : « agrandie » (par défaut) ou « personnalisee » (bornes)
  fenetre: { mode: 'agrandie', bornes: { x: 120, y: 80, width: 1400, height: 900 } },
  // Échelle de l'interface, en % : 0 pour « Automatique » (100 %, la page s'adapte
  // seule à la largeur de la fenêtre), sinon de 50 à 200 par pas de 10
  // infobulle : délai d'apparition des infobulles des pages, en ms (0 à 2500, pas de 100)
  affichage: { echelle: 0, infobulle: 0 },
  // Fermer la fenêtre la cache et garde l'application en arrière-plan (icône de la
  // zone de notification, comme Modding Manager) ; bulle d'explication déjà montrée ?
  arrierePlan: { fermeture: true, bulleMontree: false },
  // Dossier des données (catalogue explore/ et espaces des profils) : vide pour le
  // dossier local de l'application (donnees.js) ; un dépôt git d'ula (mode de
  // l'auteur du catalogue) est reconnu. deplacement : dossier où déplacer les
  // données au prochain démarrage (bouton « Déplacer… »), vide sinon
  donnees: { dossier: '', deplacement: '' },
  // Ancien réglage (versions 1.x, « Studies ») : repris s'il désignait un dossier
  cours: { mode: 'integre', dossier: '' },
  // Connexion à Claude : « compte » (Claude Code, connecté par l'utilisateur) ou
  // « cle » (clé d'API personnelle, chiffrée : « enc:… »)
  claude: { mode: 'compte', cle: '' },
  // Connexion à ChatGPT (Codex CLI) et à Gemini (Gemini CLI), même principe (ia.js)
  codex: { mode: 'compte', cle: '' },
  gemini: { mode: 'compte', cle: '' },
  // Jeton d'administration du service de soumission (chiffré : « enc:… »), seulement
  // dans l'installation de l'administrateur du catalogue (admin-soumissions.js)
  // intervalle : minutes entre deux vérifications automatiques ; vues : soumissions déjà
  // signalées par une notification
  admin: { jeton: '', intervalle: 30, vues: [] },
  // Synchronisation automatique du dossier des données quand c'est un dépôt Git suivi
  // (synchro.js) : null tant que l'utilisateur n'a pas répondu à la proposition
  synchro: { auto: null },
  // Dossiers où l'utilisateur a demandé un raccourci, en plus du Bureau et du menu
  raccourcis: { dossiers: [] },
  // Langue de l'application (« fr », « en ») : null tant qu'elle n'est pas choisie
  // (la fenêtre de choix s'ouvre alors au démarrage, voir choix-langue.js)
  langue: null,
};

function fichier() {
  return path.join(app.getPath('userData'), 'parametres.json');
}

function copie(x) {
  return JSON.parse(JSON.stringify(x));
}

function estObjet(x) {
  return x && typeof x === 'object' && !Array.isArray(x);
}

// Fusion récursive : les objets se complètent, le reste remplace
function fusion(base, ajout) {
  const r = copie(base);
  if (!estObjet(ajout)) return r;
  for (const [cle, valeur] of Object.entries(ajout)) {
    if (estObjet(valeur) && estObjet(r[cle])) r[cle] = fusion(r[cle], valeur);
    else if (valeur !== undefined) r[cle] = copie(valeur);
  }
  return r;
}

function lire() {
  let brut = null;
  try {
    brut = JSON.parse(fs.readFileSync(fichier(), 'utf8'));
  } catch (e) {
    /* absent ou illisible */
  }
  return fusion(DEFAUT, brut);
}

/** Écriture atomique : fichier temporaire puis renommage. */
function ecrire(reglages) {
  const f = fichier();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const temporaire = f + '.' + process.pid + '.tmp';
  fs.writeFileSync(temporaire, JSON.stringify(reglages, null, 2), 'utf8');
  fs.renameSync(temporaire, f);
  return reglages;
}

function modifier(partiel) {
  return ecrire(fusion(lire(), partiel));
}

/** Réglages sans la clé chiffrée, pour l'interface. */
function publics(reglages = lire()) {
  const r = copie(reglages);
  for (const f of ['claude', 'codex', 'gemini']) {
    r[f].cleEnregistree = Boolean(r[f].cle);
    delete r[f].cle;
  }
  return r;
}

module.exports = { DEFAUT, fichier, lire, ecrire, modifier, publics, fusion };
