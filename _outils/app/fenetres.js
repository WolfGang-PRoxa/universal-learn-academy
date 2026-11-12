"use strict";
/* Les fenêtres de Studies, et ce qu'un navigateur donne d'office et qu'Electron
   laisse à l'application : liens externes, menu du clic droit, zoom à la
   molette, avertissement avant de quitter une page non enregistrée, boutons
   latéraux de la souris, impression, recherche dans la page.

   Chaque fenêtre affiche les pages du serveur local dans un rendu isolé
   (sandbox, sans Node) : tout ce qui sort de cette origine part dans le
   navigateur du système. */

const { app, BrowserWindow, Menu, WebContentsView, clipboard, dialog, ipcMain, nativeTheme, screen, session, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const serveur = require("./serveur");

const ICONE = path.join(__dirname, "assets", "icone.png");
const ETAT = path.join(app.getPath("userData"), "fenetre.json");
// Page de départ : l'accueil (profils, cursus, catalogue), servi à la place de index.html
const PORTAIL = "index.html";
const TAILLE = { width: 1280, height: 860 };
const RECHERCHE = { largeur: 360, hauteur: 48, marge: 16, haut: 60 };
const PERMISSIONS = new Set(["clipboard-read", "clipboard-sanitized-write", "fullscreen"]);

let origine = null;   // « http://127.0.0.1:5178 », connue une fois le serveur prêt

/* Page ou fenêtre : état mémorisé ------------------------------------------------ */

function lireEtat() {
  try { return JSON.parse(fs.readFileSync(ETAT, "utf8")); } catch (e) { return {}; }
}

function enregistrerEtat(f) {
  const etat = {
    bornes: f.getNormalBounds(), maximisee: f.isMaximized(),
    zoom: f.webContents.getZoomLevel(), page: f.pageCourante || null
  };
  try { fs.writeFileSync(ETAT, JSON.stringify(etat, null, 2)); } catch (e) { /* tant pis pour cette fois */ }
}

// Une position enregistrée sur un écran débranché ne doit pas perdre la fenêtre
function bornesValides(b) {
  if (!b) return TAILLE;
  const visible = screen.getAllDisplays().some(({ workArea: z }) =>
    b.x + 100 > z.x && b.x + 100 < z.x + z.width && b.y + 20 > z.y && b.y + 20 < z.y + z.height);
  return visible ? b : { width: b.width, height: b.height };
}

/* Liens ------------------------------------------------------------------------- */

function interne(url) {
  try { return new URL(url).origin === origine; } catch (e) { return false; }
}

// La visionneuse occupe toute la fenêtre, sans barre ni « Précédent » : un PDF s'ouvre
// à part, et le fermer ramène à la page
function estPdf(url) {
  return new URL(url).pathname.toLowerCase().endsWith(".pdf");
}

function versNavigateur(url) {
  if (/^(https?|mailto):/i.test(url)) shell.openExternal(url);
}

// Bouton « Paramètres » de la barre des pages (charte/assets/cours.js), dans
// l'application installée seulement : il ouvre la fenêtre des paramètres de l'hôte
function parametres(url) {
  const hote = global.studiesHote;
  if (!hote || !interne(url) || new URL(url).pathname !== "/_app/parametres") return false;
  hote.ouvrirParametres(new URL(url).hash.slice(1) || undefined);
  return true;
}

function brancherLiens(f) {
  const page = f.webContents;
  page.on("will-navigate", (e, url) => {
    if (parametres(url)) return e.preventDefault();
    if (interne(url) && !estPdf(url)) return;
    e.preventDefault();
    if (interne(url)) ouvrir(url);
    else versNavigateur(url);
  });
  page.setWindowOpenHandler(({ url }) => {
    if (parametres(url)) return { action: "deny" };
    if (interne(url)) ouvrir(url);
    else versNavigateur(url);
    return { action: "deny" };
  });
  const noter = (e, url) => { if (interne(url) && !estPdf(url)) f.pageCourante = url; };
  page.on("did-navigate", noter);
  page.on("did-navigate-in-page", noter);
}

/* Comportements de navigateur ----------------------------------------------------- */

function brancherPage(f) {
  const page = f.webContents;

  page.on("zoom-changed", (e, sens) => page.setZoomLevel(page.getZoomLevel() + (sens === "in" ? 0.5 : -0.5)));

  // Page avec un enregistrement en cours (suivi) : Electron bloquerait la fermeture sans rien dire
  page.on("will-prevent-unload", (e) => {
    const choix = dialog.showMessageBoxSync(f, {
      type: "warning", title: "Universal Learn Academy", message: "Des modifications ne sont pas encore enregistrées.",
      buttons: ["Quitter la page quand même", "Rester"], defaultId: 1, cancelId: 1
    });
    if (choix === 0) e.preventDefault();
  });

  f.on("app-command", (e, commande) => {
    if (commande === "browser-backward") page.navigationHistory.goBack();
    if (commande === "browser-forward") page.navigationHistory.goForward();
  });

  page.on("context-menu", (e, p) => Menu.buildFromTemplate(menuContextuel(page, p)).popup({ window: f }));

  page.on("found-in-page", (e, r) => {
    if (f.recherche) f.recherche.webContents.send("recherche:resultat", r.activeMatchOrdinal, r.matches);
  });

  f.on("resize", () => placerRecherche(f));
}

function menuContextuel(page, p) {
  const m = [];
  for (const mot of p.dictionarySuggestions) m.push({ label: mot, click: () => page.replaceMisspelling(mot) });
  if (m.length) m.push({ type: "separator" });
  if (p.linkURL) {
    if (interne(p.linkURL)) m.push({ label: "Ouvrir dans une nouvelle fenêtre", click: () => ouvrir(p.linkURL) });
    else m.push({ label: "Ouvrir dans le navigateur", click: () => versNavigateur(p.linkURL) });
    m.push({ label: "Copier l'adresse du lien", click: () => clipboard.writeText(p.linkURL) }, { type: "separator" });
  }
  if (p.mediaType === "image") m.push({ label: "Copier l'image", click: () => page.copyImageAt(p.x, p.y) }, { type: "separator" });
  if (p.isEditable) {
    m.push({ label: "Couper", role: "cut", enabled: p.editFlags.canCut });
    m.push({ label: "Copier", role: "copy", enabled: p.editFlags.canCopy });
    m.push({ label: "Coller", role: "paste", enabled: p.editFlags.canPaste });
    m.push({ label: "Tout sélectionner", role: "selectAll" });
  } else if (p.selectionText) {
    m.push({ label: "Copier", role: "copy" });
  } else if (!m.length) {
    m.push({ label: "Précédent", enabled: page.navigationHistory.canGoBack(), click: () => page.navigationHistory.goBack() });
    m.push({ label: "Suivant", enabled: page.navigationHistory.canGoForward(), click: () => page.navigationHistory.goForward() });
    m.push({ label: "Recharger", click: () => page.reload() });
  }
  if (m[m.length - 1].type === "separator") m.pop();
  return m;
}

/* Recherche dans la page (Ctrl+F) ---------------------------------------------------
   Une petite vue posée sur la page : un champ placé dans la page elle-même
   perdrait le focus à chaque findInPage, et serait trouvé par la recherche. */

function placerRecherche(f) {
  if (!f.recherche) return;
  const [largeur] = f.getContentSize();
  f.recherche.setBounds({
    x: Math.max(0, largeur - RECHERCHE.largeur - RECHERCHE.marge), y: RECHERCHE.haut,
    width: RECHERCHE.largeur, height: RECHERCHE.hauteur
  });
}

function rechercher(f) {
  if (!f.recherche) {
    f.recherche = new WebContentsView({
      webPreferences: { preload: path.join(__dirname, "recherche-pont.js"), contextIsolation: true, sandbox: true }
    });
    f.recherche.setBackgroundColor("#00000000");
    f.recherche.webContents.loadFile(path.join(__dirname, "recherche.html"));
    f.contentView.addChildView(f.recherche);
    placerRecherche(f);
    f.once("closed", () => { if (f.recherche) f.recherche.webContents.close(); });
  }
  f.recherche.setVisible(true);
  f.recherche.webContents.focus();
  f.recherche.webContents.send("recherche:ouvrir");
}

function fenetreDeRecherche(emetteur) {
  return BrowserWindow.getAllWindows().find((f) => f.recherche && f.recherche.webContents === emetteur);
}

ipcMain.on("recherche:chercher", (e, texte, avant) => {
  const f = fenetreDeRecherche(e.sender);
  if (!f) return;
  if (texte) f.webContents.findInPage(texte, { forward: !avant, findNext: true });
  else f.webContents.stopFindInPage("clearSelection");
});

ipcMain.on("recherche:fermer", (e) => {
  const f = fenetreDeRecherche(e.sender);
  if (!f) return;
  f.webContents.stopFindInPage("keepSelection");
  f.recherche.setVisible(false);
  f.webContents.focus();
});

/* Impression -------------------------------------------------------------------- */

function imprimer(f) {
  f.webContents.print({}, (ok, raison) => {
    if (!ok && raison !== "Print job canceled") dialog.showErrorBox("Universal Learn Academy", "Impression impossible : " + raison);
  });
}

async function enregistrerPdf(f) {
  const nom = f.getTitle().replace(/[\\/:*?"<>|]+/g, "-").trim() || "page";
  const r = await dialog.showSaveDialog(f, {
    title: "Enregistrer en PDF", defaultPath: path.join(app.getPath("documents"), nom + ".pdf"),
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });
  if (r.canceled) return;
  try {
    fs.writeFileSync(r.filePath, await f.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true }));
    shell.openPath(r.filePath);
  } catch (e) {
    dialog.showErrorBox("Universal Learn Academy", "Enregistrement impossible : " + e.message);
  }
}

/* Création ------------------------------------------------------------------------ */

function creer(bornes) {
  const f = new BrowserWindow({
    ...bornes,
    title: "Universal Learn Academy", icon: ICONE, minWidth: 480, minHeight: 360, autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#131417" : "#fafaf8",
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, plugins: true }
  });
  brancherLiens(f);
  brancherPage(f);

  // Dernière fenêtre : la fermer arrête le serveur, et une génération de quiz avec lui.
  // Les fenêtres annexes de l'application installée (paramètres) ne comptent pas, et
  // se ferment avec la dernière fenêtre de cours.
  const autres = () => BrowserWindow.getAllWindows().filter((w) => w !== f && !w.studiesAnnexe);
  f.on("closed", () => {
    if (!BrowserWindow.getAllWindows().some((w) => !w.studiesAnnexe)) BrowserWindow.getAllWindows().forEach((w) => w.close());
  });
  f.on("close", (e) => {
    if (autres().length) return;
    enregistrerEtat(f);
    if (f.fermetureConfirmee) return;
    e.preventDefault();
    serveur.tachesMenacees().then((n) => {
      const quitter = !n || dialog.showMessageBoxSync(f, {
        type: "warning", title: "Universal Learn Academy", message: "Une génération de quiz est en cours.",
        detail: "Fermer l’application l’arrête, et le quiz ne sera pas créé.",
        buttons: ["Fermer quand même", "Continuer"], defaultId: 1, cancelId: 1
      }) === 0;
      if (!quitter) return;
      f.fermetureConfirmee = true;
      f.close();
    });
  });
  return f;
}

// loadURL échoue si une autre navigation l'interrompt (un clic avant la fin du
// chargement) : ce n'est pas une panne, et la page d'erreur dira le reste
function charger(f, url) {
  return f.loadURL(url).catch(() => {});
}

// Fenêtre de démarrage, affichée dès le lancement : le serveur met quelques secondes
// Dans l'application installée, la taille et la position viennent de ses paramètres
// (« Fenêtre au lancement ») ; sinon, de la dernière fermeture
function ecranAttente() {
  const etat = lireEtat();
  const hote = global.studiesHote;
  const lancement = hote && hote.etatFenetre ? hote.etatFenetre() : null;
  const f = creer(lancement ? lancement.bornes : bornesValides(etat.bornes));
  if (lancement ? lancement.agrandie : etat.maximisee) f.maximize();
  f.loadFile(path.join(__dirname, "demarrage.html"));
  return f;
}

function noter(f, ligne) {
  if (f.isDestroyed() || origine) return;
  f.webContents.executeJavaScript("noter(" + JSON.stringify(ligne) + ")").catch(() => {});
}

function relier(adresse) { origine = new URL(adresse).origin; }

// Rouvre la dernière page, si elle existe encore ; sinon l'accueil
async function afficherPageDeDepart(f) {
  const etat = lireEtat();
  let url = origine + "/" + PORTAIL;
  if (etat.page && interne(etat.page)) {
    const r = await fetch(etat.page, { method: "HEAD" }).catch(() => null);
    if (r && r.ok) url = etat.page;
  }
  if (f.isDestroyed()) return;
  await charger(f, url);
  if (f.isDestroyed()) return;
  appliquerEchelle(f, etat);
  f.webContents.navigationHistory.clear();   // « Précédent » ne ramène pas à l'écran de démarrage
}

/* Échelle de l'interface ---------------------------------------------------------- */

// Application installée : l'échelle choisie dans les paramètres (« Automatique » =
// 100 %) s'applique à toutes les fenêtres ; Ctrl +/− reste un ajustement de la
// fenêtre, Ctrl+0 revient à l'échelle choisie. Sans hôte, ou avec un hôte qui ne
// connaît pas ce réglage (avant la version 2.3.0), le zoom mémorisé dans
// fenetre.json est repris comme avant.
function echelleChoisie() {
  const hote = global.studiesHote;
  return hote && typeof hote.echelle === "function" ? hote.echelle() : null;
}

function appliquerEchelle(f, etat) {
  if (f.isDestroyed()) return;
  const e = echelleChoisie();
  if (e) f.webContents.setZoomFactor(e);
  else f.webContents.setZoomLevel((etat && etat.zoom) || 0);
}

// Ctrl+0 : retour à l'échelle choisie
function echelleNormale(f) {
  const e = echelleChoisie();
  if (e) f.webContents.setZoomFactor(e);
  else f.webContents.setZoomLevel(0);
}

// Nouvelle échelle choisie dans les paramètres : toutes les fenêtres des cours
function surNouvelleEchelle(e) {
  for (const f of BrowserWindow.getAllWindows()) {
    if (!f.isDestroyed() && !f.studiesAnnexe) f.webContents.setZoomFactor(e);
  }
}
if (global.studiesHote && typeof global.studiesHote.surEchelle === "function") global.studiesHote.surEchelle(surNouvelleEchelle);

function ouvrir(url) {
  const f = creer(TAILLE);
  appliquerEchelle(f, lireEtat());
  charger(f, url);
  return f;
}

// Depuis le menu : une page du site, dans la fenêtre active
function allerA(f, chemin) {
  if (origine) charger(f, origine + "/" + chemin);
}

function preparerSession() {
  session.defaultSession.setPermissionRequestHandler((page, permission, reponse) => reponse(PERMISSIONS.has(permission)));
}

module.exports = {
  PORTAIL, allerA, afficherPageDeDepart, echelleNormale, ecranAttente, enregistrerPdf, imprimer,
  noter, ouvrir, preparerSession, rechercher, relier
};
