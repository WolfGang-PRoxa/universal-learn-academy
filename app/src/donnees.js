'use strict';
/* Dossier des données et outils de l'application installée.

   Racine des données (ula/) : le catalogue téléchargé (explore/) et les espaces
   des profils. Par défaut dans le dossier local de l'application :
     Windows  %LOCALAPPDATA%\Universal Learn Academy\donnees
     Linux    ~/.local/share/Universal Learn Academy/donnees
   Un autre dossier se choisit dans les paramètres (ou s'y déplace avec
   « Déplacer… », voir deplacement.js). Jusqu'à la version 2.7, le dossier par
   défaut était « Documents/ULA » : il est déplacé au premier lancement de la 2.8
   (main.js, preparerDossier), sauf s'il est un dépôt Git, qui reste en place.
   Les paramètres, eux, sont dans %APPDATA% (reglages.js). Si ce dossier est un dépôt git d'ula (il contient _outils/app),
   c'est le « mode dépôt » de l'auteur du catalogue : les outils et le catalogue
   sont ceux du dépôt, git pull et git push synchronisent tout.

   Outils (_outils/) : livrés avec l'application (resources/outils), copiés dans
   un dossier local où le serveur peut écrire ses réglages :
     Windows  %LOCALAPPDATA%\Universal Learn Academy\outils
     Linux    ~/.local/share/Universal Learn Academy/outils
   À chaque nouvelle version, la copie est mise à jour d'après le manifeste
   (.ula-outils.json) : un fichier livré n'est remplacé ou supprimé que s'il n'a
   pas été modifié depuis sa copie (réglages du quiz, par exemple).

   En développement (npm start), les outils sont ceux du dépôt (app/..). */

const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const MANIFESTE = '.ula-outils.json';
const PROGRAMME = path.join('_outils', 'app', 'principal.js');
const NOM_DOSSIER = 'Universal Learn Academy';

function dossierLocalApp() {
  if (process.platform === 'win32')
    return path.join(process.env.LOCALAPPDATA || path.join(app.getPath('home'), 'AppData', 'Local'), NOM_DOSSIER);
  return path.join(process.env.XDG_DATA_HOME || path.join(app.getPath('home'), '.local', 'share'), NOM_DOSSIER);
}
function dossierOutilsLocal() {
  return path.join(dossierLocalApp(), 'outils');
}
function outilsLivres() {
  return path.join(process.resourcesPath, 'outils');
}
function depotDeDeveloppement() {
  return path.resolve(app.getAppPath(), '..');
}
function dossierParDefaut() {
  return path.join(dossierLocalApp(), 'donnees');
}
/** Dossier par défaut jusqu'à la version 2.7 (migré au premier lancement de la 2.8). */
function ancienDossierParDefaut() {
  return path.join(app.getPath('documents'), 'ULA');
}

/** Le dossier contient-il les outils (programme de la fenêtre et serveur) ? */
function contientOutils(dossier) {
  return (
    Boolean(dossier) &&
    fs.existsSync(path.join(dossier, PROGRAMME)) &&
    fs.existsSync(path.join(dossier, '_outils', 'quiz', 'serveur', 'serveur.js'))
  );
}
/** Dépôt git d'ula (mode de l'auteur du catalogue) ? */
function estDepot(dossier) {
  return contientOutils(dossier) && fs.existsSync(path.join(dossier, 'explore'));
}

function lireJson(f) {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    return null;
  }
}

/** Versions des outils livrés et de la copie locale, pour les paramètres. */
function versions() {
  const livre = app.isPackaged ? lireJson(path.join(outilsLivres(), MANIFESTE)) : null;
  const local = lireJson(path.join(dossierOutilsLocal(), MANIFESTE));
  const resume = (m) => (m ? { commit: m.commit, cree: m.cree, fichiers: Object.keys(m.fichiers || {}).length } : null);
  return { livre: resume(livre), local: resume(local) };
}

/* -- Mise à jour de la copie locale des outils --------------------------------- */

function inchange(f, trace) {
  if (!trace) return false;
  try {
    const s = fs.statSync(f);
    return s.size === trace.taille && Math.round(s.mtimeMs) === trace.mtime;
  } catch (e) {
    return false;
  }
}

function tracer(f, empreinte) {
  const s = fs.statSync(f);
  return { empreinte, taille: s.size, mtime: Math.round(s.mtimeMs) };
}

/**
 * Met la copie locale à jour d'après le manifeste livré.
 * @param {(fait: number, total: number) => void} progression
 */
function synchroniser(source, cible, progression = () => {}) {
  const nouveau = lireJson(path.join(source, MANIFESTE));
  if (!nouveau)
    throw Object.assign(new Error("Les outils livrés avec l'application sont introuvables (" + source + ').'), {
      code: 'OUTILS_INTROUVABLES',
      dossier: source,
    });
  const etatFichier = path.join(cible, MANIFESTE);
  const ancien = lireJson(etatFichier) || { version: null, fichiers: {}, traces: {} };
  if (ancien.version === nouveau.version) return { copies: 0, supprimes: 0, conserves: [], aJour: true };

  const traces = Object.assign({}, ancien.traces || {});
  const conserves = [];
  let copies = 0,
    supprimes = 0,
    fait = 0;
  const chemins = Object.keys(nouveau.fichiers);
  const total = chemins.length;
  for (const chemin of chemins) {
    const n = nouveau.fichiers[chemin];
    const f = path.join(cible, ...chemin.split('/'));
    const trace = traces[chemin];
    const present = fs.existsSync(f);
    if (present && trace && trace.empreinte === n.empreinte && inchange(f, trace)) {
      // déjà la bonne version
    } else if (!present || inchange(f, trace)) {
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.copyFileSync(path.join(source, ...chemin.split('/')), f);
      traces[chemin] = tracer(f, n.empreinte);
      copies++;
    } else {
      conserves.push(chemin);
    }
    if (++fait % 50 === 0 || fait === total) progression(fait, total);
  }
  for (const chemin of Object.keys(ancien.fichiers || {})) {
    if (nouveau.fichiers[chemin]) continue;
    const f = path.join(cible, ...chemin.split('/'));
    if (inchange(f, traces[chemin])) {
      fs.rmSync(f, { force: true });
      supprimes++;
    }
    delete traces[chemin];
  }
  fs.writeFileSync(
    etatFichier,
    JSON.stringify({
      version: nouveau.version,
      commit: nouveau.commit,
      cree: nouveau.cree,
      fichiers: nouveau.fichiers,
      traces,
    }),
  );
  return { copies, supprimes, conserves, aJour: false };
}

/* -- Choix des dossiers ----------------------------------------------------------- */

/** Racine des données d'après les paramètres (avec reprise de l'ancien réglage « cours »). */
function racineChoisie(reglages) {
  let d = reglages.donnees && reglages.donnees.dossier;
  const ancien = reglages.cours;
  if (!d && ancien && ancien.mode === 'dossier' && ancien.dossier) d = ancien.dossier;
  if (d && !fs.existsSync(d)) {
    // Le dépôt « studies » est devenu « ula » (12 novembre 2026) : un dossier noté qui
    // n'existe plus est remplacé par le dépôt ula voisin, s'il y en a un
    const voisin = path.join(path.dirname(d), 'ula');
    if (estDepot(voisin)) d = voisin;
  }
  if (d) return d;
  // Ancien dossier par défaut encore là (migration échouée, à retenter) : on y reste
  const ancienDefaut = ancienDossierParDefaut();
  if (fs.existsSync(ancienDefaut)) return ancienDefaut;
  return dossierParDefaut();
}

/**
 * Dossiers à utiliser : { racine, outils, mode, aSynchroniser, erreur? }
 *   mode « depot » : la racine est un dépôt d'ula, outils compris ;
 *   mode « developpement » : npm start, outils du dépôt de l'application ;
 *   mode « installe » : outils livrés, copiés dans le dossier local.
 */
function resoudre(reglages) {
  const racine = racineChoisie(reglages);
  if (!fs.existsSync(racine)) {
    if ((reglages.donnees && reglages.donnees.dossier) || (reglages.cours && reglages.cours.mode === 'dossier')) {
      return { racine: null, erreur: 'Le dossier des données est introuvable : ' + racine, introuvable: racine };
    }
    fs.mkdirSync(racine, { recursive: true });
  }
  if (contientOutils(racine))
    return { racine, outils: path.join(racine, '_outils'), mode: 'depot', aSynchroniser: false };
  if (!app.isPackaged)
    return {
      racine,
      outils: path.join(depotDeDeveloppement(), '_outils'),
      mode: 'developpement',
      aSynchroniser: false,
    };
  const local = lireJson(path.join(dossierOutilsLocal(), MANIFESTE));
  const livre = lireJson(path.join(outilsLivres(), MANIFESTE));
  return {
    racine,
    outils: path.join(dossierOutilsLocal(), '_outils'),
    mode: 'installe',
    aSynchroniser: !local || !livre || local.version !== livre.version,
  };
}

module.exports = {
  MANIFESTE,
  PROGRAMME,
  NOM_DOSSIER,
  dossierLocalApp,
  dossierOutilsLocal,
  outilsLivres,
  dossierParDefaut,
  ancienDossierParDefaut,
  racineChoisie,
  contientOutils,
  estDepot,
  resoudre,
  synchroniser,
  versions,
};
