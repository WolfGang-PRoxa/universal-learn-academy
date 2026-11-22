'use strict';
/* Mises à jour automatiques à partir des releases GitHub (electron-updater),
   sur le modèle de CV Studio. Au lancement (si le paramètre est activé), la
   nouvelle version est téléchargée en arrière-plan puis installée à la fermeture,
   ou tout de suite sur demande.

   Dépôt privé : GitHub ne montre ses releases qu'avec un jeton. Aucun jeton n'est
   jamais placé dans l'exécutable. Si la lecture publique échoue (404), on essaie
   le jeton de GitHub CLI déjà connectée sur ce poste (`gh auth token`) : il reste
   en mémoire le temps de la recherche et du téléchargement. Pour les autres
   utilisateurs, la mise à jour ne fonctionnera qu'une fois le dépôt public. */

const { app } = require('electron');
const { t } = require('./i18n');
const { execFile } = require('child_process');
const { autoUpdater } = require('electron-updater');
const { DEPOT } = require('./depot');

let envoyer = () => {};
let dernier = { etat: 'repos' };
let configure = false;
let viaGh = false;

function messageCourt(erreur) {
  const texte = String((erreur && erreur.message) || erreur || 'erreur inconnue');
  if (/\b404\b/.test(texte)) return t('u.aucuneVersion');
  if (/\b401\b|\b403\b/.test(texte)) return t('u.refus');
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|net::ERR_/i.test(texte)) return t('u.connexion');
  const ligne = texte.split('\n')[0].trim();
  return ligne.length > 160 ? ligne.slice(0, 157) + '…' : ligne;
}

function emettre(statut) {
  dernier = Object.assign({}, statut, { a: new Date().toISOString(), viaGh });
  envoyer(dernier);
}

function configurer() {
  if (configure) return;
  configure = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;
  autoUpdater.on('checking-for-update', () => emettre({ etat: 'recherche' }));
  autoUpdater.on('update-available', (info) => emettre({ etat: 'disponible', version: info.version }));
  autoUpdater.on('update-not-available', () => emettre({ etat: 'a-jour' }));
  autoUpdater.on('download-progress', (p) => emettre({ etat: 'telechargement', pourcent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => emettre({ etat: 'pret', version: info.version }));
  autoUpdater.on('error', (e) => emettre({ etat: 'erreur', message: messageCourt(e) }));
}

/** Jeton de GitHub CLI connectée sur ce poste, ou null. Sans bloquer le processus
    principal : il achemine aussi la molette et le clavier vers les fenêtres. */
function jetonGh() {
  return new Promise((resolve) => {
    try {
      execFile(
        'gh',
        ['auth', 'token', '--hostname', 'github.com'],
        { encoding: 'utf8', timeout: 10000, windowsHide: true },
        (err, stdout) => {
          const jeton = String(stdout || '').trim();
          resolve(!err && /^[\w-]{20,}$/.test(jeton) ? jeton : null);
        },
      );
    } catch (e) {
      resolve(null);
    }
  });
}

function init(rappel) {
  envoyer = rappel;
}
function statut() {
  return dernier;
}

let verificationEnCours = null;

// Une seule recherche à la fois (démarrage, recherche périodique, paramètres, icône)
function verifier() {
  if (!verificationEnCours)
    verificationEnCours = verifierUneFois().finally(() => {
      verificationEnCours = null;
    });
  return verificationEnCours;
}

async function verifierUneFois() {
  if (process.env.ULA_MAJ_ESSAI === '1') {
    // Essais de la recherche périodique hors application installée
    emettre({ etat: 'a-jour', essai: true });
    return dernier;
  }
  if (!app.isPackaged) {
    emettre({ etat: 'indisponible', message: t('u.seulementInstallee') });
    return dernier;
  }
  if (process.platform === 'linux' && !process.env.APPIMAGE) {
    emettre({ etat: 'indisponible', message: t('u.appImage') });
    return dernier;
  }
  configurer();
  try {
    await autoUpdater.checkForUpdates();
  } catch (e) {
    // Dépôt privé : nouvel essai avec le jeton de GitHub CLI, s'il y en a un
    const jeton = !viaGh && /\b404\b/.test(String(e && e.message)) ? await jetonGh() : null;
    if (!jeton) {
      emettre({ etat: 'erreur', message: messageCourt(e) });
      return dernier;
    }
    viaGh = true;
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: DEPOT.proprietaire,
      repo: DEPOT.nom,
      private: true,
      token: jeton,
    });
    try {
      await autoUpdater.checkForUpdates();
    } catch (e2) {
      emettre({ etat: 'erreur', message: messageCourt(e2) });
    }
  }
  return dernier;
}

/* -- Recherche périodique ------------------------------------------------------
   Comme Modding Manager : fermer la fenêtre laisse l'application en arrière-plan,
   elle ne se relancerait donc plus et ne verrait jamais de nouvelle version. Toutes
   les 6 heures (examen tous les quarts d'heure), au réveil du PC et peu après que la
   fenêtre se cache, elle relit les releases si le réglage « mises à jour
   automatiques » est actif. La version trouvée se télécharge en arrière-plan et
   s'installe en quittant l'application (Quitter dans le menu de l'icône) ou par
   « Redémarrer et installer » ; une notification le dit, une seule fois par version.
   ULA_MAJ_INTERVALLE_MS (essais) raccourcit l'intervalle et l'examen. */

const INTERVALLE_MS = Number(process.env.ULA_MAJ_INTERVALLE_MS) || 6 * 60 * 60000;
const EXAMEN_MS = Math.min(15 * 60000, Math.max(1000, Math.round(INTERVALLE_MS / 4)));
const BIENTOT_MS = Math.min(60000, EXAMEN_MS);

let periodique = null;

/** Ce qu'un examen décide : rien, ou relire les releases. */
function etapeSuivante({ derniere, maintenant, pret }) {
  if (pret) return 'attendre'; // déjà téléchargée : elle s'installe en quittant
  return maintenant - derniere >= INTERVALLE_MS ? 'verifier' : 'attendre';
}

function demarrerPeriodique({ actif, journal = () => {} }) {
  if (periodique) return periodique;
  // Le lancement vient de vérifier (ou va le faire, quelques secondes après)
  let derniere = Date.now();
  let encours = false;
  let minuterie = null;
  async function examiner() {
    if (encours) return;
    encours = true;
    try {
      if (!actif()) return;
      if (etapeSuivante({ derniere, maintenant: Date.now(), pret: dernier.etat === 'pret' }) !== 'verifier') return;
      derniere = Date.now();
      journal('recherche périodique de mise à jour');
      await verifier();
    } catch (e) {
      journal('recherche périodique impossible : ' + messageCourt(e));
    } finally {
      encours = false;
    }
  }
  const t = setInterval(() => {
    examiner();
  }, EXAMEN_MS);
  if (t.unref) t.unref();
  // PC réveillé : il a pu dormir toute la nuit, la relecture est due
  try {
    require('electron').powerMonitor.on('resume', () => {
      derniere = 0;
      periodique.bientot();
    });
  } catch (e) {
    /* pas de powerMonitor : l'examen régulier suffit */
  }
  periodique = {
    bientot() {
      if (minuterie) clearTimeout(minuterie);
      minuterie = setTimeout(() => {
        minuterie = null;
        examiner();
      }, BIENTOT_MS);
    },
    intervalle: INTERVALLE_MS,
  };
  return periodique;
}

function bientot() {
  if (periodique) periodique.bientot();
}

function installerMaintenant() {
  if (dernier.etat !== 'pret') return false;
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return true;
}

module.exports = {
  init,
  statut,
  verifier,
  installerMaintenant,
  demarrerPeriodique,
  bientot,
  etapeSuivante,
  INTERVALLE_MS,
};
