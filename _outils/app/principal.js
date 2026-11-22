'use strict';
/* ==========================================================================
   Application de bureau Studies (_outils/app)
   --------------------------------------------------------------------------
   Le portail, les cours, les quiz et les TD dans leur propre fenêtre, sans
   navigateur ni terminal. Les pages et le serveur sont ceux de lancer.bat ;
   l'application ajoute la fenêtre, le menu et ce qu'un navigateur donnait
   d'office (voir fenetres.js).

   Ce fichier est chargé par l'amorce (amorce/main.js) une fois Electron prêt.
   ========================================================================== */

const { app, dialog, shell, BrowserWindow, Menu, Notification } = require('electron');
const path = require('path');
const serveur = require('./serveur');
const fenetres = require('./fenetres');
const { construireMenu } = require('./menu');
const { t } = require('./textes');

const ID_APP = 'fr.studies.app';

function creerRaccourcis() {
  if (process.platform !== 'win32') return;
  const lien = {
    target: process.execPath,
    cwd: path.dirname(process.execPath),
    appUserModelId: ID_APP,
    icon: process.execPath,
    iconIndex: 0,
    description: 'Cours, quiz et TD interactifs',
  };
  const menuDemarrer = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
  shell.writeShortcutLink(path.join(app.getPath('desktop'), 'Studies.lnk'), 'create', lien);
  shell.writeShortcutLink(path.join(menuDemarrer, 'Studies.lnk'), 'create', lien);
}

// Prévient quand une génération de quiz se termine alors que Studies n'a pas la main
function prevenirFinDeTache(tache) {
  if (BrowserWindow.getFocusedWindow()) return;
  if (tache.etat !== 'terminee' && tache.etat !== 'erreur') return;
  const n = new Notification(
    tache.etat === 'terminee'
      ? { title: t('notif.quizPret'), body: path.basename(tache.fichier) }
      : { title: t('notif.quizInterrompu'), body: t('notif.quizDetail') },
  );
  if (tache.etat === 'terminee') n.on('click', () => fenetres.ouvrir(serveur.adresse() + tache.fichier));
  n.show();
}

function surArretServeur(code) {
  const choix = dialog.showMessageBoxSync({
    type: 'error',
    title: 'Universal Learn Academy',
    message: t('dialogue.serveurArrete', { code }),
    detail: t('dialogue.serveurDetail'),
    buttons: [t('dialogue.relancer'), t('dialogue.voirJournal'), t('menu.quitter')],
    defaultId: 0,
    cancelId: 2,
  });
  if (choix === 1) shell.openPath(serveur.JOURNAL);
  if (choix === 2) return app.quit();
  demarrerServeur(BrowserWindow.getAllWindows().find((w) => !w.studiesAnnexe) || fenetres.ecranAttente());
}

async function demarrerServeur(fenetre) {
  try {
    const adresse = await serveur.demarrer({ journal: (l) => fenetres.noter(fenetre, l), surArret: surArretServeur });
    if (!adresse) return;
    fenetres.relier(adresse);
    await fenetres.afficherPageDeDepart(fenetre);
    serveur.surveillerTaches(prevenirFinDeTache);
  } catch (e) {
    dialog.showErrorBox(
      'Universal Learn Academy',
      t('dialogue.serveurEchec', { message: e.message, journal: serveur.JOURNAL }),
    );
    app.quit();
  }
}

// Application installée (studies/app) : son hôte publie global.studiesHote avant
// de charger ce fichier (paramètres, mises à jour, fenêtre au lancement). Sans
// hôte (lancer-app.bat), tout se passe comme avant.
const hote = global.studiesHote || null;

app.setAppUserModelId((hote && hote.idApp) || ID_APP);
if (!hote && process.argv.includes('--raccourcis')) creerRaccourcis();

app.on('second-instance', () => {
  const f = BrowserWindow.getAllWindows().find((w) => !w.studiesAnnexe);
  if (!f) return;
  if (f.isMinimized()) f.restore();
  // Cachée en arrière-plan (application installée) : elle revient
  if (!f.isVisible()) f.show();
  f.focus();
});

// Petit délai : les pages enregistrent le travail en cours en se fermant (pagehide),
// et le serveur doit encore être là pour le recevoir
app.on('window-all-closed', () => setTimeout(() => app.quit(), 300));

let arretFait = false;
app.on('will-quit', (e) => {
  if (arretFait) return;
  e.preventDefault();
  serveur.arreter().finally(() => {
    arretFait = true;
    app.quit();
  });
});

Menu.setApplicationMenu(construireMenu());
// Langue changée dans l'application installée : menu refait dans la nouvelle langue
if (hote && typeof hote.surLangue === 'function') hote.surLangue(() => Menu.setApplicationMenu(construireMenu()));
fenetres.preparerSession();
demarrerServeur(fenetres.ecranAttente());
