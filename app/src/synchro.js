'use strict';
/* ==========================================================================
   Synchronisation automatique du dossier des données (version 2.5.0)
   --------------------------------------------------------------------------
   Quand le dossier des données est un dépôt Git qui suit une branche d'un dépôt
   distant (le dépôt d'ula de l'auteur du catalogue, ou un dossier des données
   devenu dépôt), l'application propose une fois de le synchroniser
   automatiquement. Activée, la synchro tourne :
     - au lancement (une dizaine de secondes après) ;
     - toutes les 30 minutes, même fenêtre fermée (l'application reste en
       arrière-plan) ;
     - au réveil du PC ;
     - en quittant l'application (10 secondes au plus).
   « Synchroniser maintenant » : bouton nuage de la barre des pages, menu de
   l'icône de la zone de notification, carte Synchronisation des paramètres.

   Le cycle lui-même est dans synchro-git.js. Ici : le calendrier, l'état montré
   aux pages et aux paramètres, les notifications, et le rechargement de
   l'accueil quand des fichiers arrivent (synchro, ou git pull fait à la main,
   repéré en surveillant le commit de HEAD).

   ULA_SYNCHRO_INTERVALLE_MS (essais) raccourcit l'intervalle de 30 minutes. */

const { app, BrowserWindow, Notification, ipcMain, nativeTheme, powerMonitor, screen } = require('electron');
const os = require('os');
const path = require('path');
const moteur = require('./synchro-git');
const { t, tn } = require('./i18n');
const integres = require('./parametres-integres');

const INTERVALLE_MS = Number(process.env.ULA_SYNCHRO_INTERVALLE_MS) || 30 * 60000;
const EXAMEN_MS = Math.min(60000, Math.max(1000, Math.round(INTERVALLE_MS / 10)));
const DELAI_LANCEMENT_MS = 10000;
const DELAI_REVEIL_MS = 30000;
const DELAI_FERMETURE_MS = 10000;
const SURVEILLANCE_MS = 5000;

let o = null; // options de demarrer()
let infos = null; // ce que l'on sait du dépôt (moteur.infos)
let dernier = null; // résultat du dernier cycle
let enCours = null; // promesse du cycle en cours
let derniere = 0; // date du dernier cycle (automatique ou non)
let teteConnue = null; // commit de HEAD vu en dernier
let fermetureFaite = false;
let fermetureEnCours = false;
const dejaSignales = new Set();

function reglage() {
  return (o.reglages.lire().synchro || {}).auto;
}
function active() {
  return Boolean(infos && infos.distant) && reglage() === true;
}

/** État pour les pages, les paramètres et le menu de l'icône. */
function statut() {
  const auto = o ? reglage() : null;
  return {
    visible: Boolean(infos && infos.distant),
    git: infos ? infos.git : null,
    depot: Boolean(infos && infos.depot),
    raison: infos && !infos.distant ? infos.raison || null : null,
    branche: infos ? infos.branche : null,
    distant: infos && infos.distant ? `${infos.distant}/${infos.brancheDistante}` : null,
    adresse: infos ? infos.adresse || null : null,
    mode: o ? o.mode : null,
    auto: auto === true ? true : auto === false ? false : null,
    intervalle: INTERVALLE_MS,
    enCours: Boolean(enCours),
    dernier,
  };
}

function annoncer() {
  const s = statut();
  for (const f of BrowserWindow.getAllWindows()) {
    if (f.isDestroyed()) continue;
    if (f.studiesAnnexe) f.webContents.send('synchro:statut', s);
    else pousserVersPage(f.webContents, s);
  }
  // Paramètres ouverts par-dessus une fenêtre des cours (parametres-integres.js)
  integres.envoyer('synchro:statut', s);
  if (o && o.surStatut) o.surStatut(s);
}

/* L'état va aux pages par executeJavaScript : cours.js (barre du haut) définit
   window.ulaSynchro et y montre le bouton nuage. Sans l'hôte, rien n'est appelé. */
function pousserVersPage(wc, s = statut()) {
  if (!s.visible || !wc || wc.isDestroyed()) return;
  const resume = {
    etat: s.enCours ? 'en-cours' : s.dernier ? s.dernier.etat : 'jamais',
    a: s.dernier ? s.dernier.a : null,
    message: s.dernier ? s.dernier.message || '' : '',
    auto: s.auto === true,
  };
  wc.executeJavaScript(`window.ulaSynchro && window.ulaSynchro(${JSON.stringify(resume)})`, false).catch(() => {});
}

/** Accueil rechargé (cursus, liens) quand des fichiers sont arrivés. */
function rechargerAccueil() {
  for (const f of BrowserWindow.getAllWindows()) {
    if (f.isDestroyed() || f.studiesAnnexe) continue;
    try {
      const u = new URL(f.webContents.getURL());
      if (/^https?:$/.test(u.protocol) && (u.pathname === '/' || u.pathname === '/index.html')) f.webContents.reload();
    } catch (e) {
      /* page vide ou d'erreur */
    }
  }
}

function notifier(cle, titre, texte) {
  if (dejaSignales.has(cle) || !Notification.isSupported()) return;
  dejaSignales.add(cle);
  const n = new Notification({ title: titre, body: texte });
  n.on('click', () => o.ouvrirParametres('synchro'));
  n.show();
}

async function rafraichirInfos() {
  try {
    infos = await moteur.infos(o.racine);
  } catch (e) {
    infos = { depot: false, raison: e.message };
  }
  if (infos && infos.dossierGit) teteConnue = moteur.tete(infos.dossierGit);
  return infos;
}

/**
 * Un cycle (un seul à la fois). raison : « lancement », « periodique », « reveil »,
 * « fermeture », « manuel ».
 */
function synchroniser(raison = 'manuel') {
  if (enCours) return enCours;
  enCours = (async () => {
    annoncer();
    if (!infos || raison === 'manuel' || raison === 'lancement') await rafraichirInfos();
    if (!infos.distant) {
      dernier = {
        etat: 'indisponible',
        message: infos.raison || t('s.pasDistant'),
        a: new Date().toISOString(),
        recus: [],
        conflits: [],
      };
      return dernier;
    }
    derniere = Date.now();
    o.journal(`synchro (${raison})`);
    const r = await moteur.cycle(o.racine, {
      mode: o.mode,
      poste: os.hostname(),
      journal: o.journal,
      delaiReseau: raison === 'fermeture' ? DELAI_FERMETURE_MS : 90000,
    });
    dernier = Object.assign({ raison }, r);
    if (infos.dossierGit) teteConnue = moteur.tete(infos.dossierGit);
    if (r.recus.length) rechargerAccueil();
    if (r.conflits.some((c) => c.copie)) {
      const copies = r.conflits.filter((c) => c.copie);
      notifier(
        `copies:${r.a}`,
        t('s.notif.conflitTitre'),
        tn('s.notif.conflitTexte', copies.length, { liste: copies.map((c) => c.copie.split('/').pop()).join(', ') }),
      );
    }
    if (r.etat === 'connexion' || r.etat === 'manuel' || r.etat === 'erreur') {
      notifier(`${r.etat}:${r.message}`, t('s.notif.impossible'), r.message);
    }
    if (r.avertissement) notifier(`stash:${r.a}`, t('p.synchro.titre'), r.avertissement);
    return dernier;
  })()
    .catch((e) => {
      dernier = {
        etat: 'erreur',
        message: String(e.message || e),
        a: new Date().toISOString(),
        recus: [],
        conflits: [],
      };
      return dernier;
    })
    .finally(() => {
      enCours = null;
      annoncer();
    });
  return enCours;
}

/* Proposition faite une fois, dans une petite fenêtre au style de l'application
   (proposition/), centrée sur la fenêtre des cours (sur l'écran principal si elle
   est cachée) : « Activer », « Plus tard » (redemandé au prochain lancement, comme
   la croix et Échap), « Non merci ». */
const LARGEUR_PROPOSITION = 560;
let proposition = null;

function bornesProposition(hauteur) {
  const parent = BrowserWindow.getAllWindows().find(
    (w) => !w.isDestroyed() && !w.studiesAnnexe && w.isVisible() && !w.isMinimized(),
  );
  const zone = (parent ? screen.getDisplayMatching(parent.getBounds()) : screen.getPrimaryDisplay()).workArea;
  const ref = parent ? parent.getBounds() : zone;
  const width = Math.min(LARGEUR_PROPOSITION, zone.width),
    height = Math.min(hauteur, zone.height);
  const x = Math.min(Math.max(Math.round(ref.x + (ref.width - width) / 2), zone.x), zone.x + zone.width - width);
  const y = Math.min(Math.max(Math.round(ref.y + (ref.height - height) / 2), zone.y), zone.y + zone.height - height);
  return { parent, bornes: { x, y, width, height } };
}

function proposer() {
  if (proposition) return proposition.reponse;
  let repondre;
  const reponse = new Promise((r) => {
    repondre = r;
  });
  const { parent, bornes } = bornesProposition(440);
  const f = new BrowserWindow({
    ...bornes,
    parent,
    modal: Boolean(parent),
    show: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: t('p.synchro.titre'),
    autoHideMenuBar: true,
    useContentSize: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1b1c20' : '#ffffff',
    icon: path.join(__dirname, 'assets', 'icone.png'),
    webPreferences: {
      preload: path.join(__dirname, 'proposition', 'pont.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  f.setMenu(null);
  f.studiesAnnexe = true; // pas une fenêtre de cours (fenetres.js)
  f.webContents.on('will-navigate', (e) => e.preventDefault());
  f.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  let choix = 'plus-tard';
  f.on('closed', () => {
    proposition = null;
    repondre(choix);
  });
  proposition = {
    fenetre: f,
    reponse,
    fermer: (c) => {
      choix = c;
      if (!f.isDestroyed()) f.close();
    },
  };
  // Secours : affichée même si la page n'a pas pu donner sa hauteur
  f.once('ready-to-show', () =>
    setTimeout(() => {
      if (!f.isDestroyed() && !f.isVisible()) f.show();
    }, 1500),
  );
  f.loadFile(path.join(__dirname, 'proposition', 'index.html'));
  return reponse.then((c) => {
    if (c === 'plus-tard') return false;
    definirAuto(c === 'activer');
    return c === 'activer';
  });
}

function brancherProposition() {
  const depuisProposition = (e) => proposition && e.sender === proposition.fenetre.webContents;
  ipcMain.handle('proposition:infos', (e) =>
    depuisProposition(e) && infos
      ? {
          adresse: infos.adresse,
          distant: `${infos.distant}/${infos.brancheDistante}`,
          branche: infos.brancheDistante,
          mode: o.mode,
          langue: require('./i18n').langue(),
          textes: Object.fromEntries(
            [
              'titre',
              'sousTitre',
              'depot',
              'lancement',
              'intervalle',
              'reveil',
              'fermeture',
              'perimetreProgression',
              'perimetreTout',
              'aide',
              'non',
              'plusTard',
              'activer',
            ].map((k) => [k, t('s.proposition.' + k)]),
          ),
        }
      : null,
  );
  ipcMain.handle('proposition:repondre', (e, c) => {
    if (depuisProposition(e)) proposition.fermer(['activer', 'non', 'plus-tard'].includes(c) ? c : 'plus-tard');
  });
  // Hauteur ajustée au contenu, puis affichée, toujours centrée
  ipcMain.handle('proposition:taille', (e, hauteur) => {
    if (!depuisProposition(e)) return;
    const f = proposition.fenetre;
    const h = Math.max(240, Math.min(900, Math.round(Number(hauteur) * f.webContents.getZoomFactor()) || 440));
    f.setContentSize(LARGEUR_PROPOSITION, h);
    const { bornes } = bornesProposition(f.getBounds().height);
    f.setPosition(bornes.x, bornes.y);
    if (!f.isVisible()) f.show();
  });
}

function definirAuto(valeur) {
  o.reglages.modifier({ synchro: { auto: Boolean(valeur) } });
  annoncer();
  if (valeur) synchroniser('manuel');
  return statut();
}

/** Calendrier : examen régulier, réveil, surveillance des git pull faits à la main. */
function planifier() {
  const examen = setInterval(() => {
    if (active() && !enCours && Date.now() - derniere >= INTERVALLE_MS) synchroniser('periodique');
  }, EXAMEN_MS);
  if (examen.unref) examen.unref();

  try {
    powerMonitor.on('resume', () => {
      setTimeout(() => {
        if (active()) synchroniser('reveil');
      }, DELAI_REVEIL_MS);
    });
  } catch (e) {
    /* pas de powerMonitor : l'examen régulier suffit */
  }

  // git pull (ou commit) fait à la main pendant que l'application tourne : l'accueil
  // est rechargé pour ne pas montrer un cursus périmé
  const surveillance = setInterval(() => {
    if (enCours || !infos || !infos.dossierGit) return;
    const t = moteur.tete(infos.dossierGit);
    if (t && teteConnue && t !== teteConnue) {
      o.journal('synchro : HEAD a changé (commande git faite à la main)');
      rechargerAccueil();
      annoncer();
    }
    if (t) teteConnue = t;
  }, SURVEILLANCE_MS);
  if (surveillance.unref) surveillance.unref();

  // En quittant : un dernier cycle, 10 secondes au plus. Les pages ont déjà enregistré
  // leur travail (pagehide) ; principal.js arrête le serveur en parallèle.
  app.on('will-quit', (e) => {
    if (fermetureFaite || !active()) return;
    e.preventDefault();
    if (fermetureEnCours) return;
    fermetureEnCours = true;
    const limite = new Promise((r) => setTimeout(r, DELAI_FERMETURE_MS + 2000));
    Promise.race([(enCours || Promise.resolve()).then(() => synchroniser('fermeture')), limite]).finally(() => {
      fermetureFaite = true;
      app.quit();
    });
  });
}

/**
 * options : { racine, mode (« progression » | « tout »), reglages, journal(texte),
 *             ouvrirParametres(section), surStatut(statut) }
 */
async function demarrer(options) {
  o = options;
  brancherProposition();
  app.on('web-contents-created', (_e, wc) => {
    wc.on('did-finish-load', () => {
      if (infos && infos.distant) pousserVersPage(wc);
    });
  });
  planifier();
  await new Promise((r) => setTimeout(r, DELAI_LANCEMENT_MS));
  await rafraichirInfos();
  annoncer();
  if (!infos.distant) return;
  const auto = reglage();
  if (auto === true) synchroniser('lancement');
  else if (auto !== false) await proposer();
}

module.exports = { demarrer, statut, synchroniser: () => synchroniser('manuel'), definirAuto, INTERVALLE_MS };
