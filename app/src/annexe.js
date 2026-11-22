'use strict';
/* ==========================================================================
   Fenêtres annexes au style de l'application (version 2.6.0)
   --------------------------------------------------------------------------
   Choix de la langue, paramétrage guidé, documentation : des fenêtres de
   l'hôte, au style des paramètres (jetons et boutons de parametres.css),
   centrées sur la fenêtre des cours, ou sur l'écran principal si elle est
   cachée ou pas encore ouverte, sans jamais déborder de la zone de travail.
   Même logique que la proposition de synchronisation (synchro.js).

   Une fenêtre annexe porte studiesAnnexe = true : le programme des outils
   (fenetres.js) ne la compte pas parmi les fenêtres de cours.
   ========================================================================== */

const { BrowserWindow, nativeTheme, screen, shell } = require('electron');
const path = require('path');

/** Fenêtre des cours visible, s'il y en a une. */
function fenetreDesCours() {
  return (
    BrowserWindow.getAllWindows().find(
      (w) => !w.isDestroyed() && !w.studiesAnnexe && w.isVisible() && !w.isMinimized(),
    ) || null
  );
}

/**
 * Bornes d'une fenêtre de taille donnée, centrée sur la fenêtre des cours (ou
 * l'écran principal). largeur et hauteur : pixels, ou fraction (< 1) de la zone de
 * travail de l'écran ; min et max bornent le résultat.
 */
function bornesCentrees({ largeur, hauteur, min = { width: 420, height: 240 }, max = { width: 1600, height: 1100 } }) {
  const parent = fenetreDesCours();
  const zone = (parent ? screen.getDisplayMatching(parent.getBounds()) : screen.getPrimaryDisplay()).workArea;
  const mesure = (v, total, mi, ma) => Math.min(total, Math.max(mi, Math.min(ma, Math.round(v < 1 ? total * v : v))));
  const width = mesure(largeur, zone.width, min.width, max.width);
  const height = mesure(hauteur, zone.height, min.height, max.height);
  const ref = parent ? parent.getBounds() : zone;
  const x = Math.min(Math.max(Math.round(ref.x + (ref.width - width) / 2), zone.x), zone.x + zone.width - width);
  const y = Math.min(Math.max(Math.round(ref.y + (ref.height - height) / 2), zone.y), zone.y + zone.height - height);
  return { parent, bornes: { x, y, width, height } };
}

/**
 * Crée une fenêtre annexe. options : { page (chemin du HTML), preload, titre,
 * largeur, hauteur, min, redimensionnable, modale, zoom (facteur d'échelle) }.
 * La fenêtre s'affiche quand la page est prête ; les liens https s'ouvrent dans le
 * navigateur du système, toute autre navigation est refusée.
 */
function creer(o) {
  const { parent, bornes } = bornesCentrees({ largeur: o.largeur, hauteur: o.hauteur, min: o.min });
  const redim = o.redimensionnable !== false;
  const f = new BrowserWindow({
    ...bornes,
    parent: o.modale ? parent || undefined : undefined,
    modal: Boolean(o.modale && parent),
    show: false,
    resizable: redim,
    minimizable: redim,
    maximizable: redim,
    fullscreenable: false,
    minWidth: o.min ? o.min.width : undefined,
    minHeight: o.min ? o.min.height : undefined,
    title: o.titre,
    autoHideMenuBar: true,
    useContentSize: !redim,
    backgroundColor: nativeTheme.shouldUseDarkColors ? (redim ? '#131417' : '#1b1c20') : redim ? '#fafaf8' : '#ffffff',
    icon: path.join(__dirname, 'assets', 'icone.png'),
    webPreferences: { preload: o.preload, contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  f.setMenu(null);
  f.studiesAnnexe = true;
  f.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  bloquerNavigation(f);
  if (o.zoom)
    f.webContents.on('did-finish-load', () => {
      if (!f.isDestroyed()) f.webContents.setZoomFactor(o.zoom());
    });
  // Fenêtre de taille fixe : elle s'affiche quand sa page a donné sa hauteur
  // (ajuster()), avec un secours si la page ne le fait pas
  f.once('ready-to-show', () => {
    if (redim) f.show();
    else
      setTimeout(() => {
        if (!f.isDestroyed() && !f.isVisible()) f.show();
      }, 1500);
  });
  f.loadFile(o.page, o.hash ? { hash: o.hash } : undefined);
  return f;
}

/** Hauteur d'une fenêtre fixe ajustée à son contenu, recentrée, puis affichée. */
function ajuster(f, largeur, hauteur) {
  if (!f || f.isDestroyed()) return;
  const h = Math.max(200, Math.min(1000, Math.round(Number(hauteur) * f.webContents.getZoomFactor()) || 440));
  f.setContentSize(largeur, h);
  const { bornes } = bornesCentrees({ largeur, hauteur: f.getBounds().height, min: { width: largeur, height: 200 } });
  f.setPosition(bornes.x, bornes.y);
  if (!f.isVisible()) f.show();
}

/** Une fenêtre annexe ne quitte jamais sa page ; recharger cette même page reste
 *  permis (changement de langue : location.reload()). */
function bloquerNavigation(f) {
  const sansAncre = (u) => String(u).split('#')[0];
  f.webContents.on('will-navigate', (e, url) => {
    if (sansAncre(url) !== sansAncre(f.webContents.getURL())) e.preventDefault();
  });
}

module.exports = { creer, ajuster, bornesCentrees, fenetreDesCours, bloquerNavigation };
