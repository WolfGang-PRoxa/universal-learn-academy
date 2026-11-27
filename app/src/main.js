'use strict';
/* ==========================================================================
   Universal Learn Academy, application installée (app/) : processus principal
   --------------------------------------------------------------------------
   L'application installée est un « hôte » autour du programme des outils
   (_outils/app/principal.js : fenêtres, menu, serveur local), le même que
   lance lancer-app.bat. L'hôte ajoute ce qu'une application distribuée doit
   avoir : paramètres, mises à jour automatiques, fenêtre au lancement,
   raccourcis, connexion à Claude, dossier des données, profils.

   Au démarrage :
   1. il lit les paramètres, déplace le dossier des données s'il le faut
      (ancien Documents/ULA, ou « Déplacer… » demandé dans les paramètres :
      deplacement.js), puis choisit le dossier des données et celui des
      outils (donnees.js) ; les outils livrés sont copiés ou mis à jour dans le
      dossier local ; les cours, eux, se téléchargent depuis l'accueil ;
   2. il installe PGlite (questions SQL) dans le dossier local de l'outil s'il
      manque, à partir de la copie livrée : pas besoin de Node sur le poste ;
   3. il applique les clés d'API enregistrées (Anthropic : claude.js ; OpenAI et
      Gemini : ia.js) ;
   4. il publie global.studiesHote et ULA_RACINE, puis charge le programme des outils ;
   5. il recherche une mise à jour si le paramètre est activé ;
   6. si le dossier des données est un dépôt Git suivi, il le synchronise
      (synchro.js : au lancement, toutes les 30 minutes, au réveil, en quittant).

   Avant tout cela, tant que la langue n'est pas choisie, la fenêtre de choix
   de la langue s'ouvre (choix-langue.js) : c'est le premier écran après
   l'installation. Textes de l'hôte : src/i18n (français et anglais).
   ========================================================================== */

const { app, BrowserWindow, Notification, dialog, ipcMain, nativeTheme, session, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const reglages = require('./reglages');
const lancement = require('./fenetre-lancement');
const majs = require('./mises-a-jour');
const raccourcis = require('./raccourcis');
const claude = require('./claude');
const ia = require('./ia');
const donnees = require('./donnees');
const deplacement = require('./deplacement');
const diagnostic = require('./diagnostic');
const arrierePlan = require('./arriere-plan');
const synchro = require('./synchro');
const i18n = require('./i18n');
const choixLangue = require('./choix-langue');
const annexe = require('./annexe');
const integres = require('./parametres-integres');
const docIntegree = integres.documentation;
const doc = require('./documentation');
const { ID_APP, URL_RELEASES } = require('./depot');

const NOM = 'Universal Learn Academy';

// Dossier de paramètres alternatif (essais automatiques)
const essai = process.env.ULA_USER_DATA || process.env.STUDIES_USER_DATA;
if (essai) app.setPath('userData', essai);
else migrerParametres();

// Jusqu'à la version 1.0.3, l'application s'appelait Studies : ses paramètres étaient
// dans %APPDATA%\Studies (~/.config/Studies). Ils sont repris une fois.
function migrerParametres() {
  try {
    const nouveau = app.getPath('userData');
    const ancien = path.join(app.getPath('appData'), 'Studies');
    if (fs.existsSync(path.join(nouveau, 'parametres.json')) || !fs.existsSync(path.join(ancien, 'parametres.json')))
      return;
    fs.mkdirSync(nouveau, { recursive: true });
    for (const f of ['parametres.json', 'fenetre.json']) {
      if (fs.existsSync(path.join(ancien, f))) fs.copyFileSync(path.join(ancien, f), path.join(nouveau, f));
    }
  } catch (e) {
    /* paramètres par défaut */
  }
}

// Calcul des fenêtres masquées de Windows (Chromium) désactivé, comme le fait VS Code :
// quand il se trompe, ou tarde à voir que la fenêtre est de nouveau visible, la page
// se croit cachée, ne se dessine plus et ne défile plus jusqu'au prochain clic. C'est
// le gel de la molette observé jusqu'à la 2.3.0 (voir diagnostic.js).
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

// Lancé depuis un terminal de VS Code : Electron se prendrait pour Node dans le serveur
delete process.env.ELECTRON_RUN_AS_NODE;

app.setAppUserModelId(ID_APP);

// Tant que le programme n'est pas chargé (préparation des outils, dialogues), fermer
// une fenêtre ne doit pas quitter l'application ; principal.js gère ensuite la fin.
app.on('window-all-closed', () => {});

i18n.brancher(reglages);
const { t } = i18n;

let fenetreGuide = null;

/* -- Échelle de l'interface ------------------------------------------------------- */

// Réglage « affichage.echelle » : 0 (Automatique, 100 %) ou 50 à 200 par pas de 10.
// Le programme des outils (fenetres.js) l'applique à toutes les fenêtres et s'abonne
// aux changements faits dans les paramètres.
const auditeursEchelle = new Set();
function echelleValide(v) {
  const n = Math.round(Number(v) / 10) * 10;
  return Number.isFinite(n) && n >= 50 && n <= 200 ? n : 0;
}
function facteurEchelle() {
  return (echelleValide((reglages.lire().affichage || {}).echelle) || 100) / 100;
}
function annoncerEchelle() {
  const e = facteurEchelle();
  for (const fn of auditeursEchelle) {
    try {
      fn(e);
    } catch (err) {
      /* fenêtre fermée entre-temps */
    }
  }
  integres.zoomer(e);
  docIntegree.zoomer(e);
}

let racine = null;
let outils = null;
let modeDonnees = null;

/* -- Fenêtre de préparation des outils (première ouverture, nouvelle version) -- */

function fenetrePreparation(titre = t('m.preparation.titre'), texte = t('m.preparation.texte'), indetermine = false) {
  const sombre = nativeTheme.shouldUseDarkColors;
  const f = new BrowserWindow({
    width: 460,
    height: 170,
    resizable: false,
    minimizable: false,
    maximizable: false,
    frame: false,
    show: false,
    backgroundColor: sombre ? '#131417' : '#fafaf8',
    icon: path.join(__dirname, 'assets', 'icone.png'),
    webPreferences: { sandbox: true, contextIsolation: true },
  });
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:28px 32px;font:15px system-ui,"Segoe UI",sans-serif;color:${sombre ? '#e8e6e1' : '#1f1d1a'};background:${sombre ? '#131417' : '#fafaf8'}}
    h1{font-size:17px;margin:0 0 6px}p{margin:0 0 16px;opacity:.75}
    .barre{height:8px;border-radius:4px;background:${sombre ? '#2a2c31' : '#e6e3dc'};overflow:hidden}
    .barre i{display:block;height:100%;width:0;background:#3d6fb6;transition:width .2s}
    .barre.indetermine i{width:30%;animation:va 1.4s ease-in-out infinite alternate}
    @keyframes va{from{margin-left:0}to{margin-left:70%}}</style>
    <h1>${echapper(titre)}</h1><p id="t">${echapper(texte)}</p>
    <div class="barre${indetermine ? ' indetermine' : ''}"><i id="b"></i></div>`;
  f.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  f.once('ready-to-show', () => f.show());
  return f;
}

function echapper(texte) {
  return String(texte).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function attendre(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function synchroniserOutils(cible) {
  const f = fenetrePreparation();
  await attendre(150);
  let resultat;
  try {
    resultat = donnees.synchroniser(donnees.outilsLivres(), cible, (fait, total) => {
      const p = Math.round((fait / total) * 100);
      if (!f.isDestroyed())
        f.webContents
          .executeJavaScript(
            `b.style.width="${p}%";t.textContent=${JSON.stringify(t('m.preparation.fichiers', { fait, total }))}`,
          )
          .catch(() => {});
    });
  } finally {
    if (!f.isDestroyed()) f.destroy();
  }
  if (resultat.conserves.length) {
    fs.writeFileSync(
      path.join(cible, '.ula-conserves.txt'),
      'Fichiers modifiés dans ce dossier, gardés tels quels lors de la mise à jour des outils / Files modified in this folder, kept as they are when the tools were updated:\n' +
        resultat.conserves.join('\n') +
        '\n',
    );
  }
  return resultat;
}

/* -- Déplacement du dossier des données au démarrage -------------------------------- */

// Avant le serveur local : rien n'est ouvert dans le dossier pendant la copie
async function deplacerAvecFenetre(source, cible) {
  const f = fenetrePreparation(t('m.deplacement.titre'), t('m.deplacement.texte', { cible }), true);
  await attendre(150);
  try {
    return await deplacement.deplacer(source, cible);
  } finally {
    if (!f.isDestroyed()) f.destroy();
  }
}

function signalerDeplacement(r, source, cible) {
  if (r.ok && r.ancienRestant)
    dialog.showMessageBoxSync({
      type: 'warning',
      title: NOM,
      message: t('m.deplacement.ancienRestant', { dossier: r.ancienRestant }),
      detail: r.message,
    });
  else if (!r.ok)
    dialog.showMessageBoxSync({
      type: 'error',
      title: NOM,
      message: t('m.deplacement.echec', { source, cible }),
      detail: t('m.deplacement.raison.' + r.raison, { cible }) + (r.raison === 'copie' ? '\n' + r.message : ''),
    });
}

async function preparerDossier() {
  const r = reglages.lire();
  // « Déplacer… » demandé dans les paramètres
  const demande = r.donnees && r.donnees.deplacement;
  if (demande) {
    reglages.modifier({ donnees: { deplacement: '' } });
    const source = donnees.racineChoisie(r);
    const res = await deplacerAvecFenetre(source, demande);
    if (res.ok) {
      const dossier = path.resolve(demande) === path.resolve(donnees.dossierParDefaut()) ? '' : demande;
      reglages.modifier({ donnees: { dossier }, cours: { mode: 'integre', dossier: '' } });
    }
    signalerDeplacement(res, source, demande);
    return;
  }
  // Version 2.8.0 : l'ancien dossier par défaut Documents/ULA quitte Documents
  const ancien = donnees.ancienDossierParDefaut();
  const nouveau = donnees.dossierParDefaut();
  const action = deplacement.migrationAFaire(r, ancien, nouveau);
  if (action === 'noter') reglages.modifier({ donnees: { dossier: ancien } });
  else if (action === 'deplacer') signalerDeplacement(await deplacerAvecFenetre(ancien, nouveau), ancien, nouveau);
}

/* -- Choix du dossier des données au démarrage ------------------------------------ */

async function dossierDesDonnees() {
  for (;;) {
    const r = donnees.resoudre(reglages.lire());
    if (r.racine) {
      if (r.aSynchroniser) {
        try {
          await synchroniserOutils(donnees.dossierOutilsLocal());
        } catch (e) {
          dialog.showErrorBox(
            NOM,
            t('m.preparation.echec', {
              message: e.code === 'OUTILS_INTROUVABLES' ? t('m.outilsIntrouvables', { dossier: e.dossier }) : e.message,
            }),
          );
          return null;
        }
      }
      return r;
    }
    const choix = dialog.showMessageBoxSync({
      type: 'warning',
      title: NOM,
      message: r.introuvable ? t('m.donnees.introuvable', { dossier: r.introuvable }) : r.erreur,
      detail: t('m.donnees.detail', { dossier: donnees.dossierParDefaut() }),
      buttons: [t('m.donnees.choisir'), t('m.donnees.defaut'), t('m.donnees.quitter')],
      defaultId: 0,
      cancelId: 2,
    });
    if (choix === 2) return null;
    if (choix === 1) {
      reglages.modifier({ donnees: { dossier: '' }, cours: { mode: 'integre', dossier: '' } });
      continue;
    }
    const d = dialog.showOpenDialogSync({
      title: t('m.donnees.titre'),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (d && d[0]) reglages.modifier({ donnees: { dossier: d[0] }, cours: { mode: 'integre', dossier: '' } });
  }
}

/* -- PGlite (questions SQL) -------------------------------------------------------- */

// Le serveur cherche PGlite dans son dossier local (_outils/quiz/serveur/lib/chemins.js)
function dossierLocalQuiz() {
  return path.join(
    process.env.LOCALAPPDATA || process.env.XDG_CACHE_HOME || path.join(app.getPath('home'), '.cache'),
    'studies-quiz',
  );
}

function installerPglite() {
  const local = dossierLocalQuiz();
  const cible = path.join(local, 'node_modules', '@electric-sql', 'pglite');
  if (fs.existsSync(path.join(cible, 'package.json'))) return;
  const source = path.join(
    app.getAppPath() + (app.isPackaged ? '.unpacked' : ''),
    'node_modules',
    '@electric-sql',
    'pglite',
  );
  if (!fs.existsSync(source)) return;
  try {
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.cpSync(source, cible, { recursive: true });
    const pkg = path.join(local, 'package.json');
    if (!fs.existsSync(pkg))
      fs.writeFileSync(pkg, JSON.stringify({ name: 'studies-quiz-dependances', private: true }, null, 2));
  } catch (e) {
    /* le serveur essaiera npm, comme sans l'application */
  }
}

/* -- Anciens raccourcis « Studies » ---------------------------------------------------- */

// Jusqu'à la version 1.0.3, les raccourcis s'appelaient « Studies ». Ceux du Bureau
// et du menu Démarrer qui ouvrent cette installation (ou une installation disparue)
// sont retirés : les nouveaux portent le nom de l'application.
function nettoyerAnciensRaccourcis() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  const dossiers = [
    app.getPath('desktop'),
    path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  ];
  const ici = path.dirname(process.execPath).toLowerCase();
  for (const d of dossiers) {
    const f = path.join(d, 'Studies.lnk');
    if (!fs.existsSync(f)) continue;
    try {
      const cible = String(shell.readShortcutLink(f).target || '');
      if (path.dirname(cible).toLowerCase() === ici || (/studies\.exe$/i.test(cible) && !fs.existsSync(cible)))
        fs.rmSync(f, { force: true });
    } catch (e) {
      /* raccourci illisible : laissé */
    }
  }
}

/* -- Paramètres ------------------------------------------------------------------- */

// Depuis la version 2.6.2, les paramètres s'ouvrent dans la fenêtre des cours, par-dessus
// la page (voile et panneau centré, comme Modding Manager) : parametres-integres.js.
// La fenêtre des cours est d'abord montrée si elle était cachée (zone de notification).
integres.configurer({ zoom: () => facteurEchelle() });

function ouvrirParametres(section) {
  if (!integres.ouvrir(section)) {
    montrerFenetre();
    integres.ouvrir(section);
  }
}

/** Fenêtre d'un appel : celle de la page, ou celle qui porte les paramètres (ou la doc). */
function fenetreDe(emetteur) {
  if (emetteur && emetteur === integres.contenu()) return integres.fenetre();
  if (emetteur && emetteur === docIntegree.contenu()) return docIntegree.fenetre();
  return BrowserWindow.fromWebContents(emetteur);
}

/* -- Documentation et paramétrage guidé (2.6.0) ------------------------------------- */

// Documentation (doc/) : depuis la version 2.7.0, posée par-dessus la page dans la
// fenêtre des cours, comme les paramètres (parametres-integres.js) ; déjà ouverte, elle
// passe devant et va à la page demandée.
function ouvrirDocumentation(page) {
  if (!docIntegree.ouvrir(page)) {
    montrerFenetre();
    docIntegree.ouvrir(page);
  }
}

// Paramétrage guidé (guide/) : fenêtre moyenne, une étape à la fois. Les réglages
// s'appliquent au fil des étapes, par les mêmes canaux que les paramètres.
function ouvrirGuide() {
  if (fenetreGuide && !fenetreGuide.isDestroyed()) {
    if (fenetreGuide.isMinimized()) fenetreGuide.restore();
    fenetreGuide.show();
    fenetreGuide.focus();
    return;
  }
  fenetreGuide = annexe.creer({
    page: path.join(__dirname, 'guide', 'index.html'),
    preload: path.join(__dirname, 'parametres', 'pont.cjs'),
    titre: t('g.titreFenetre'),
    largeur: 720,
    hauteur: 640,
    min: { width: 520, height: 480 },
    zoom: facteurEchelle,
  });
  fenetreGuide.on('closed', () => {
    fenetreGuide = null;
  });
}

/* -- Langue de l'interface ------------------------------------------------------------ */

// Les pages servies par le serveur local lisent la langue dans l'agent utilisateur
// (« ULA-langue/en ») : cours.js (barre du haut) et l'accueil.
let agentDeBase = null;
function agentUtilisateur() {
  return `${agentDeBase} StudiesApp/${app.getVersion()} ULA-langue/${i18n.langue()}`;
}

// Changement de langue : agent utilisateur de toutes les pages, barre du haut et
// accueil prévenus (window.ulaLangue de cours.js), fenêtres de l'hôte prévenues
// (« i18n:changee »), menu de l'application refait par le programme des outils,
// menu de l'icône de la zone de notification refait.
const auditeursLangue = new Set();
function surLangueChangee(code) {
  if (agentDeBase) session.defaultSession.setUserAgent(agentUtilisateur());
  for (const f of BrowserWindow.getAllWindows()) {
    if (f.isDestroyed()) continue;
    if (agentDeBase) f.webContents.setUserAgent(agentUtilisateur());
    if (f.studiesAnnexe) {
      f.webContents.send('i18n:changee', code);
      if (f === fenetreGuide) f.setTitle(t('g.titreFenetre'));
    } else {
      f.webContents
        .executeJavaScript(`window.ulaLangue && window.ulaLangue(${JSON.stringify(code)})`, false)
        .catch(() => {});
    }
  }
  integres.envoyer('i18n:changee', code);
  docIntegree.envoyer('i18n:changee', code);
  for (const fn of auditeursLangue) {
    try {
      fn(code);
    } catch (e) {
      /* tant pis */
    }
  }
  arrierePlan.rafraichir();
}
i18n.surChangement(surLangueChangee);

/** Recharge les fenêtres de cours qui affichent l'accueil général ou un accueil de domaine. */
function rechargerAccueils() {
  for (const f of BrowserWindow.getAllWindows()) {
    if (f.isDestroyed() || f.studiesAnnexe) continue;
    let chemin;
    try {
      chemin = new URL(f.webContents.getURL()).pathname;
    } catch (e) {
      continue;
    }
    if (chemin === '/' || chemin === '/index.html' || /^\/explore\/[^/]+\/index\.html$/.test(chemin))
      f.webContents.reload();
  }
}

function redemarrer() {
  app.relaunch();
  app.quit();
}

/** Appel à l'API du serveur local de l'outil de quiz (port de _outils/quiz/reglages.json). */
async function apiQuiz(methode, route, corps) {
  let port = 5178;
  try {
    port = JSON.parse(fs.readFileSync(path.join(outils, 'quiz', 'reglages.json'), 'utf8')).port || port;
  } catch (e) {
    /* port par défaut */
  }
  let r;
  try {
    r = await fetch(`http://127.0.0.1:${port}/api/${route}`, {
      method: methode,
      // La langue de l'interface, pour que le serveur réponde dans cette langue
      headers: Object.assign(
        { 'X-ULA-Langue': i18n.langue() },
        corps ? { 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${port}` } : {},
      ),
      body: corps ? JSON.stringify(corps) : undefined,
      signal: AbortSignal.timeout(route.startsWith('claude/') ? 180000 : 20000),
    });
  } catch (e) {
    throw new Error(t('m.serveurMuet'), { cause: e });
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erreur || t('m.serveurErreur', { statut: r.status }));
  return d;
}

function enregistrerIpc() {
  const traiter = (canal, fn) =>
    ipcMain.handle(canal, (evenement, ...args) => diagnostic.suivre(canal, () => fn(...args, evenement)));

  traiter('app:info', () => ({
    nom: NOM,
    version: app.getVersion(),
    electron: process.versions.electron,
    plateforme: process.platform,
    installee: app.isPackaged,
    donnees: app.getPath('userData'),
    racine,
    outils,
    modeDonnees,
    releases: URL_RELEASES,
    versionsOutils: donnees.versions(),
    dossierLocal: donnees.dossierOutilsLocal(),
    dossierParDefaut: donnees.dossierParDefaut(),
    journaux: diagnostic.dossier(),
    zoneNotification: arrierePlan.zone(),
    intervalleMaj: majs.INTERVALLE_MS,
  }));
  traiter('app:redemarrer', () => redemarrer());
  traiter('app:ouvrir-dossier', (quoi) => {
    const dossier = {
      parametres: app.getPath('userData'),
      donnees: racine,
      outils,
      local: donnees.dossierOutilsLocal(),
      journaux: diagnostic.dossier(),
    }[quoi];
    return dossier ? shell.openPath(dossier) : false;
  });
  traiter('app:ouvrir-releases', () => shell.openExternal(URL_RELEASES));

  traiter('reglages:lire', () => reglages.publics());
  traiter('reglages:modifier', (partiel) => {
    // L'interface ne touche ni à la clé d'API, ni à la liste des dossiers de raccourcis,
    // ni au dossier des données (qui passe par donnees:choisir)
    const sur = Object.assign({}, partiel);
    for (const f of ['claude', 'codex', 'gemini'])
      if (sur[f]) sur[f] = { mode: sur[f].mode === 'cle' ? 'cle' : 'compte' };
    delete sur.raccourcis;
    delete sur.cours;
    delete sur.donnees;
    if (sur.affichage) sur.affichage = { echelle: echelleValide(sur.affichage.echelle) };
    if (sur.arrierePlan) sur.arrierePlan = { fermeture: sur.arrierePlan.fermeture !== false };
    delete sur.synchro;
    delete sur.langue;
    const r = reglages.publics(reglages.modifier(sur));
    if (sur.affichage) annoncerEchelle();
    return r;
  });
  traiter('fenetre:ecrans', () => lancement.ecrans());
  traiter('fenetre:bornes', () => {
    const f = BrowserWindow.getAllWindows().find((w) => !w.studiesAnnexe && !w.isDestroyed());
    return f ? f.getNormalBounds() : null;
  });

  traiter('donnees:choisir', async (evenement) => {
    const r = await dialog.showOpenDialog(fenetreDe(evenement.sender), {
      title: t('m.donnees.titre'),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false, annule: true };
    reglages.modifier({
      donnees: { dossier: r.filePaths[0], deplacement: '' },
      cours: { mode: 'integre', dossier: '' },
    });
    return { ok: true, dossier: r.filePaths[0], depot: donnees.estDepot(r.filePaths[0]) };
  });
  traiter('donnees:defaut', () => {
    reglages.modifier({ donnees: { dossier: '', deplacement: '' }, cours: { mode: 'integre', dossier: '' } });
    return { ok: true, dossier: donnees.dossierParDefaut() };
  });
  // « Déplacer… » : copie vérifiée au prochain démarrage, avant le serveur local.
  // Un dossier choisi qui n'est pas vide reçoit un sous-dossier « ULA ».
  traiter('donnees:deplacer', async (evenement) => {
    const r = await dialog.showOpenDialog(fenetreDe(evenement.sender), {
      title: t('m.deplacement.choisir'),
      defaultPath: donnees.dossierLocalApp(),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (r.canceled || !r.filePaths[0]) return { ok: false, annule: true };
    let cible = r.filePaths[0];
    let raison = deplacement.empechement(racine, cible);
    if (raison === 'cible-non-vide') {
      cible = path.join(cible, 'ULA');
      raison = deplacement.empechement(racine, cible);
    }
    if (raison) return { ok: false, message: t('m.deplacement.raison.' + raison, { cible }) };
    reglages.modifier({ donnees: { deplacement: cible } });
    return { ok: true, dossier: cible };
  });

  // Profils : par l'API du serveur local (extension ula), comme l'accueil
  traiter('profils:etat', () => apiQuiz('GET', 'ula/etat'));
  // Un profil créé, choisi ou renommé depuis les paramètres ou le guide : les accueils
  // ouverts se rechargent pour le montrer (sinon l'accueil demanderait encore un nom)
  const puisAccueils = (promesse) =>
    promesse.then((r) => {
      rechargerAccueils();
      return r;
    });
  traiter('profils:choisir', (nom) => puisAccueils(apiQuiz('PUT', 'ula/profil', { nom: String(nom) })));
  traiter('profils:creer', (nom, cursus, telecharger) =>
    puisAccueils(
      apiQuiz('POST', 'ula/profils', {
        nom: String(nom),
        cursus: cursus ? String(cursus) : null,
        telecharger: telecharger !== false,
      }),
    ),
  );
  traiter('profils:cursus', () =>
    apiQuiz('GET', 'ula/catalogue')
      .then((c) => c.cursus || [])
      .catch(() => []),
  );
  traiter('profils:renommer', (ancien, nouveau) =>
    puisAccueils(apiQuiz('POST', 'ula/profils/renommer', { ancien: String(ancien), nouveau: String(nouveau) })),
  );

  traiter('raccourcis:statut', () => raccourcis.statut());
  traiter('raccourcis:creer', (id, options) =>
    raccourcis.creer(String(id), { confirmReplace: Boolean(options && options.confirmReplace) }),
  );
  traiter('raccourcis:supprimer', (id) => raccourcis.supprimer(String(id)));
  traiter('raccourcis:afficher', (id) => raccourcis.afficher(String(id)));
  traiter('raccourcis:choisir', (evenement) => raccourcis.choisirDossier(fenetreDe(evenement.sender)));
  traiter('raccourcis:oublier', (id) => raccourcis.oublierDossier(String(id)));

  traiter('claude:statut', () => claude.statut(outils));
  traiter('claude:connecter', () => claude.connecter(outils));
  traiter('claude:deconnecter', () => claude.deconnecter(outils));
  traiter('claude:cle', (valeur) => claude.enregistrerCle(valeur));
  traiter('claude:lien', (nom) => claude.ouvrirLien(String(nom)));
  // ChatGPT (Codex CLI) et Gemini (Gemini CLI) : l'outil est géré par le serveur local
  traiter('ia:statut', (f) => ia.statut(String(f), apiQuiz));
  traiter('ia:connecter', (f) => apiQuiz('POST', 'ia/connecter', { f: String(f) }));
  traiter('ia:deconnecter', (f) => apiQuiz('POST', 'ia/deconnecter', { f: String(f) }));
  traiter('ia:cle', (f, valeur) => ia.enregistrerCle(String(f), valeur));
  traiter('ia:lien', (f, nom) => ia.ouvrirLien(String(f), String(nom)));

  // Réglages de l'outil de quiz (modèles de Claude par usage, chemin de Claude Code,
  // exécution du code) : lus et modifiés par l'API du serveur local
  traiter('quiz:etat', () => apiQuiz('GET', 'etat?forcer=1'));
  traiter('quiz:reglages', (r) => apiQuiz('PUT', 'reglages', r));
  traiter('quiz:tester', (usage) => apiQuiz('POST', 'claude/test', { usage: String(usage) }));

  // Synchronisation du dossier des données (dépôt Git suivi)
  traiter('synchro:statut', () => synchro.statut());
  traiter('synchro:maintenant', () => synchro.synchroniser());
  traiter('synchro:auto', (valeur) => synchro.definirAuto(valeur === true));

  // Langue de l'interface (src/i18n)
  traiter('i18n:textes', () => ({
    langue: i18n.langue(),
    locale: i18n.locale(),
    langues: i18n.LANGUES.map(({ code, nom }) => ({ code, nom })),
    textes: i18n.dictionnaire(),
  }));
  traiter('i18n:definir', (code) => i18n.definir(String(code)));

  // Documentation et paramétrage guidé
  traiter('aide:documentation', (page) => ouvrirDocumentation(page ? String(page) : undefined));
  traiter('aide:guide', () => ouvrirGuide());
  traiter('aide:parametres', (section) => ouvrirParametres(section ? String(section) : undefined));
  traiter('aide:fermer', (evenement) => {
    if (evenement.sender === integres.contenu()) return integres.fermer();
    if (evenement.sender === docIntegree.contenu()) return docIntegree.fermer();
    const f = BrowserWindow.fromWebContents(evenement.sender);
    if (f && f.studiesAnnexe) f.close();
  });
  traiter('doc:sommaire', () => doc.sommaire(i18n.langue()));
  traiter('doc:page', (id) => doc.page(i18n.langue(), String(id)));
  traiter('doc:chercher', (texte) => doc.chercher(i18n.langue(), String(texte || '')));
  traiter('doc:lien', (url) => {
    if (/^https:\/\//i.test(String(url))) shell.openExternal(String(url));
  });

  traiter('maj:verifier', () => majs.verifier());
  traiter('maj:statut', () => majs.statut());
  traiter('maj:installer', () => majs.installerMaintenant());
}

/* -- Démarrage --------------------------------------------------------------------- */

/* -- Arrière-plan et mises à jour ---------------------------------------------------- */

// Montre la fenêtre des cours (icône de la zone de notification, nouveau lancement)
function montrerFenetre() {
  const f = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && !w.studiesAnnexe);
  if (!f) return;
  if (f.isMinimized()) f.restore();
  f.show();
  f.focus();
}

// Fenêtre cachée par la croix : les paramètres se ferment avec elle, la bulle
// s'affiche la première fois, et la recherche de mise à jour est examinée peu après
function fenetreCachee() {
  integres.fermer();
  docIntegree.fermer();
  majs.bientot();
  if ((reglages.lire().arrierePlan || {}).bulleMontree) return;
  arrierePlan.annoncer();
  try {
    reglages.modifier({ arrierePlan: { bulleMontree: true } });
  } catch (e) {
    /* elle reviendra */
  }
}

// Une seule notification par version prête
let versionAnnoncee = null;
function surStatutMaj(statut) {
  for (const f of BrowserWindow.getAllWindows()) if (!f.isDestroyed()) f.webContents.send('maj:statut', statut);
  integres.envoyer('maj:statut', statut);
  arrierePlan.rafraichir();
  if (statut.etat !== 'pret' || !statut.version || versionAnnoncee === statut.version) return;
  versionAnnoncee = statut.version;
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title: t('m.maj.titre', { version: statut.version }),
    body: t('m.maj.texte'),
  });
  n.on('click', () => {
    montrerFenetre();
    ouvrirParametres('mises-a-jour');
  });
  n.show();
}

async function demarrer() {
  diagnostic.demarrer();
  enregistrerIpc();
  majs.init(surStatutMaj);

  // Premier écran après l'installation : le choix de la langue
  if (!i18n.choisie()) await choixLangue.demander();

  await preparerDossier();
  const choix = await dossierDesDonnees();
  if (!choix) return app.quit();
  // Ancien réglage « cours » (Studies 1.x) ou dossier renommé : le dossier retenu est
  // noté dans le nouveau réglage, une fois pour toutes
  const r0 = reglages.lire();
  // (sauf l'ancien Documents/ULA après une migration échouée : elle sera retentée)
  if (
    choix.racine !== donnees.dossierParDefaut() &&
    choix.racine !== donnees.ancienDossierParDefaut() &&
    (r0.donnees || {}).dossier !== choix.racine
  ) {
    reglages.modifier({ donnees: { dossier: choix.racine }, cours: { mode: 'integre', dossier: '' } });
  }
  racine = choix.racine;
  outils = choix.outils;
  modeDonnees = choix.mode;
  // Le serveur local (et tout ce qu'il lance) lit la racine des données dans ULA_RACINE
  process.env.ULA_RACINE = racine;

  installerPglite();
  claude.appliquer();
  ia.appliquer();
  nettoyerAnciensRaccourcis();

  // Les pages reconnaissent l'application installée à son agent utilisateur et ajoutent
  // alors le bouton « Paramètres » à leur barre (_outils/charte/assets/cours.js)
  // La langue y figure aussi (« ULA-langue/fr »), pour la barre du haut et l'accueil
  agentDeBase = session.defaultSession.getUserAgent();
  session.defaultSession.setUserAgent(agentUtilisateur());

  global.studiesHote = {
    version: app.getVersion(),
    idApp: ID_APP,
    nom: NOM,
    racine,
    // Fenêtre principale au lancement : { bornes, agrandie }
    etatFenetre: () => lancement.etatInitial(reglages.lire().fenetre),
    // Échelle de l'interface (facteur, 1 = 100 %) et abonnement à ses changements
    echelle: facteurEchelle,
    surEchelle: (fn) => {
      if (typeof fn === 'function') auditeursEchelle.add(fn);
    },
    ouvrirParametres,
    verifierMiseAJour: () => {
      ouvrirParametres('mises-a-jour');
      majs.verifier();
    },
    // Arrière-plan (2.4.0) : la croix de la dernière fenêtre la cache seulement
    // (fenetres.js), tant que l'application n'est pas en train de quitter
    garderEnArrierePlan: () => arrierePlan.garder(),
    fenetreCachee,
    quitterAnnule: () => arrierePlan.quitterAnnule(),
    montrerFenetre,
    // Bouton nuage de la barre des pages (/_app/synchro, fenetres.js)
    synchroniserMaintenant: () => {
      synchro.synchroniser();
    },
    // Langue de l'interface (2.6.0) : code (« fr », « en »), abonnement aux changements
    langue: () => i18n.langue(),
    surLangue: (fn) => {
      if (typeof fn === 'function') auditeursLangue.add(fn);
    },
    // Documentation (F1, bouton « ? » de la barre des pages : /_app/aide) et
    // paramétrage guidé (/_app/guide)
    ouvrirDocumentation: (page) => {
      ouvrirDocumentation(page);
    },
    ouvrirGuide: () => {
      ouvrirGuide();
    },
  };

  try {
    require(path.join(outils, 'app', 'principal.js'));
  } catch (e) {
    dialog.showErrorBox(NOM, t('m.outilsEchec', { message: e.message, dossier: outils }));
    return app.quit();
  }

  arrierePlan
    .demarrer({
      ouvrir: montrerFenetre,
      documentation: () => ouvrirDocumentation(),
      verifierMiseAJour: () => {
        montrerFenetre();
        global.studiesHote.verifierMiseAJour();
      },
      installer: () => majs.installerMaintenant(),
      majStatut: () => majs.statut(),
      synchro: () => synchro.statut(),
      synchroniser: () => synchro.synchroniser(),
      actif: () => (reglages.lire().arrierePlan || {}).fermeture !== false,
    })
    .catch((e) => diagnostic.noter('icône de la zone de notification impossible : ' + e.message));

  if (reglages.lire().miseAJourAuto) setTimeout(() => majs.verifier(), 4000);
  majs.demarrerPeriodique({ actif: () => reglages.lire().miseAJourAuto !== false, journal: diagnostic.noter });

  // Dépôt d'ula de l'auteur du catalogue : seule la progression est committée seule ;
  // dossier des données devenu dépôt : tout, sauf le catalogue
  synchro
    .demarrer({
      racine,
      mode: modeDonnees === 'depot' ? 'progression' : 'tout',
      nom: NOM,
      reglages,
      journal: diagnostic.noter,
      ouvrirParametres: (section) => {
        montrerFenetre();
        ouvrirParametres(section);
      },
      surStatut: () => arrierePlan.rafraichir(),
    })
    .catch((e) => diagnostic.noter('synchronisation impossible : ' + e.message));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(demarrer);
}
