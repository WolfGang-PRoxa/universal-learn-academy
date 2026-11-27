/* ==========================================================================
   Paramètres et documentation dans la fenêtre des cours
   --------------------------------------------------------------------------
   Les paramètres (2.6.2) puis la documentation (2.7.0) ne sont plus des
   fenêtres du système : comme ceux de Modding Manager, ils s'ouvrent
   par-dessus la page, dans la fenêtre des cours. Une vue (WebContentsView)
   transparente couvre toute la fenêtre ; la page y dessine un voile sombre et
   un panneau centré (<html class="integre">, parametres.css et doc/doc.css).
   Échap, la croix ou un clic sur le voile la referment.

   Une vue par page, une seule fois chacune : rouverte depuis une autre fenêtre
   de cours, elle y est déplacée ; rouverte alors qu'elle est sous l'autre, elle
   passe devant. Fermée, elle est détruite (la page relit tout à la prochaine
   ouverture). Même pont (parametres/pont.cjs) et mêmes canaux que les fenêtres
   annexes ; ce qui leur était envoyé doit aussi être envoyé aux vues : envoyer().
   ========================================================================== */

const { BrowserWindow, WebContentsView, shell } = require('electron');
const path = require('path');

let options = {}; // { zoom: () => facteur }, commun aux deux vues

/** Réglages du module : zoom (facteur d'échelle de l'interface). */
function configurer(o) {
  options = Object.assign({}, options, o);
}

/** Fenêtre des cours à utiliser : celle qui a le focus, sinon la première visible. */
function fenetreDesCours() {
  const active = BrowserWindow.getFocusedWindow();
  if (active && !active.isDestroyed() && !active.studiesAnnexe) return active;
  const toutes = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed() && !w.studiesAnnexe);
  return (
    toutes.find((w) => w.isVisible() && !w.isMinimized()) || toutes.find((w) => w.isVisible()) || toutes[0] || null
  );
}

/**
 * Vue posée par-dessus la fenêtre des cours.
 * page        fichier HTML (relatif à src/)
 * canalAller  message envoyé à la page déjà ouverte pour aller à une section ou une page
 */
function superposition({ page, canalAller }) {
  let vue = null; // WebContentsView de la page, ou null
  let hote = null; // fenêtre des cours qui la porte
  function placer() {
    if (!vue || !hote || hote.isDestroyed()) return;
    const [width, height] = hote.getContentSize();
    vue.setBounds({ x: 0, y: 0, width, height });
  }

  function detacher() {
    if (!hote) return;
    const f = hote;
    hote = null;
    for (const ev of ['resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'restore'])
      f.removeListener(ev, placer);
    f.removeListener('closed', surFermetureHote);
    if (!f.isDestroyed() && vue) {
      try {
        f.contentView.removeChildView(vue);
      } catch (e) {
        /* déjà retirée */
      }
    }
  }

  function surFermetureHote() {
    hote = null;
    fermer();
  }

  function attacher(f) {
    if (hote === f) {
      // Déjà là, peut-être sous l'autre vue : remise au-dessus
      f.contentView.addChildView(vue);
      return;
    }
    detacher();
    hote = f;
    f.contentView.addChildView(vue);
    placer();
    for (const ev of ['resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen', 'restore'])
      f.on(ev, placer);
    f.once('closed', surFermetureHote);
  }

  function creer(section) {
    vue = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, 'parametres', 'pont.cjs'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    vue.setBackgroundColor('#00000000');
    const wc = vue.webContents;
    wc.setWindowOpenHandler(({ url }) => {
      if (/^https:\/\//i.test(url)) shell.openExternal(url);
      return { action: 'deny' };
    });
    // La page ne quitte jamais sa page ; recharger la même page reste permis (langue)
    const sansAncre = (u) => String(u).split('#')[0];
    wc.on('will-navigate', (e, url) => {
      if (sansAncre(url) !== sansAncre(wc.getURL())) e.preventDefault();
    });
    // L'échelle de l'interface s'applique aussi aux paramètres (même lisibilité partout)
    wc.on('did-finish-load', () => {
      if (vue && options.zoom) wc.setZoomFactor(options.zoom());
    });
    // Page plantée : la vue est retirée, la fenêtre des cours reste utilisable
    wc.on('render-process-gone', () => fermer());
    wc.loadFile(path.join(__dirname, page), { hash: section || '' });
  }

  /**
   * Ouvre la page par-dessus la fenêtre des cours (section : id d'une carte des
   * paramètres, ou page de la documentation). Renvoie false s'il n'y a aucune
   * fenêtre de cours pour la porter.
   */
  function ouvrir(section) {
    const f = fenetreDesCours();
    if (!f) return false;
    if (f.isMinimized()) f.restore();
    if (!f.isVisible()) f.show();
    f.focus();
    if (vue) {
      attacher(f);
      if (section) vue.webContents.send(canalAller, section);
    } else {
      creer(section);
      attacher(f);
    }
    vue.webContents.focus();
    return true;
  }

  /** Referme la vue et rend le focus à la page des cours (ou à l'autre vue). */
  function fermer() {
    if (!vue) return;
    const f = hote;
    detacher();
    const v = vue;
    vue = null;
    try {
      if (!v.webContents.isDestroyed()) v.webContents.close();
    } catch (e) {
      /* déjà fermée */
    }
    if (f && !f.isDestroyed() && f.isFocused()) {
      const autre = [...vues].find((x) => x.fenetre() === f);
      if (autre) autre.contenu().focus();
      else f.webContents.focus();
    }
  }

  function ouverts() {
    return Boolean(vue);
  }

  /** Contenu de la vue (pour reconnaître l'émetteur d'un appel), ou null. */
  function contenu() {
    return vue && !vue.webContents.isDestroyed() ? vue.webContents : null;
  }

  /** Fenêtre des cours qui porte la vue (dialogues du système), ou null. */
  function fenetre() {
    return hote && !hote.isDestroyed() ? hote : null;
  }

  /** Message à la page, si elle est ouverte. */
  function envoyer(canal, valeur) {
    const wc = contenu();
    if (wc) wc.send(canal, valeur);
  }

  /** Nouvelle échelle de l'interface. */
  function zoomer(facteur) {
    const wc = contenu();
    if (wc) wc.setZoomFactor(facteur);
  }

  const instance = { ouvrir, fermer, ouverts, contenu, fenetre, envoyer, zoomer };
  vues.add(instance);
  return instance;
}

const vues = new Set();
const parametres = superposition({ page: 'parametres/index.html', canalAller: 'parametres:section' });
const documentation = superposition({ page: 'doc/index.html', canalAller: 'doc:aller' });

// Les paramètres restent l'export principal (main.js, synchro.js) ; la documentation à côté
module.exports = Object.assign({ configurer, documentation }, parametres);
