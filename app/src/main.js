"use strict";
/* ==========================================================================
   Studies, application installée (app/) : processus principal
   --------------------------------------------------------------------------
   L'application installée est un « hôte » autour du programme de studies/
   (_outils/app/principal.js : fenêtres, menu, serveur local), le même que
   lance lancer-app.bat. L'hôte ajoute ce qu'une application distribuée doit
   avoir : paramètres, mises à jour automatiques, fenêtre au lancement,
   raccourcis, connexion à Claude, choix du dossier des cours.

   Au démarrage :
   1. il lit les paramètres et choisit le dossier des cours (cours.js) ; les
      cours intégrés sont copiés ou mis à jour dans le dossier local ;
   2. il installe PGlite (questions SQL) dans le dossier local de l'outil s'il
      manque, à partir de la copie livrée : pas besoin de Node sur le poste ;
   3. il applique la clé d'API Anthropic s'il y en a une (claude.js) ;
   4. il publie global.studiesHote, puis charge le programme du dossier des cours ;
   5. il recherche une mise à jour si le paramètre est activé.
   ========================================================================== */

const { app, BrowserWindow, dialog, ipcMain, nativeTheme, shell } = require("electron");
const fs = require("fs");
const path = require("path");

const reglages = require("./reglages");
const lancement = require("./fenetre-lancement");
const majs = require("./mises-a-jour");
const raccourcis = require("./raccourcis");
const claude = require("./claude");
const cours = require("./cours");
const { ID_APP, URL_RELEASES } = require("./depot");

// Dossier de données alternatif (essais automatiques)
if (process.env.STUDIES_USER_DATA) app.setPath("userData", process.env.STUDIES_USER_DATA);

// Lancé depuis un terminal de VS Code : Electron se prendrait pour Node dans le serveur
delete process.env.ELECTRON_RUN_AS_NODE;

app.setAppUserModelId(ID_APP);

// Tant que le programme n'est pas chargé (préparation des cours, dialogues), fermer
// une fenêtre ne doit pas quitter l'application ; principal.js gère ensuite la fin.
app.on("window-all-closed", () => {});

let fenetreParametres = null;
let racine = null;
let modeCours = null;

/* -- Fenêtre de préparation des cours (première ouverture, nouvelle version) -- */

function fenetrePreparation() {
  const sombre = nativeTheme.shouldUseDarkColors;
  const f = new BrowserWindow({
    width: 460, height: 170, resizable: false, minimizable: false, maximizable: false, frame: false,
    show: false, backgroundColor: sombre ? "#131417" : "#fafaf8", icon: path.join(__dirname, "assets", "icone.png"),
    webPreferences: { sandbox: true, contextIsolation: true }
  });
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;padding:28px 32px;font:15px system-ui,"Segoe UI",sans-serif;color:${sombre ? "#e8e6e1" : "#1f1d1a"};background:${sombre ? "#131417" : "#fafaf8"}}
    h1{font-size:17px;margin:0 0 6px}p{margin:0 0 16px;opacity:.75}
    .barre{height:8px;border-radius:4px;background:${sombre ? "#2a2c31" : "#e6e3dc"};overflow:hidden}
    .barre i{display:block;height:100%;width:0;background:#3d6fb6;transition:width .2s}</style>
    <h1>Préparation des cours…</h1><p id="t">Copie des cours de cette version dans le dossier local.</p>
    <div class="barre"><i id="b"></i></div>`;
  f.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  f.once("ready-to-show", () => f.show());
  return f;
}

function attendre(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function synchroniserCours(cible) {
  const f = fenetrePreparation();
  await attendre(150);
  let resultat;
  try {
    resultat = cours.synchroniser(cours.dossierLivre(), cible, (fait, total) => {
      const p = Math.round((fait / total) * 100);
      if (!f.isDestroyed()) f.webContents.executeJavaScript(`b.style.width="${p}%";t.textContent="${fait} fichiers sur ${total}"`).catch(() => {});
    });
  } finally {
    if (!f.isDestroyed()) f.destroy();
  }
  if (resultat.conserves.length) {
    fs.writeFileSync(path.join(cible, ".studies-conserves.txt"),
      "Fichiers modifiés dans ce dossier, gardés tels quels lors de la mise à jour des cours :\n" + resultat.conserves.join("\n") + "\n");
  }
  return resultat;
}

/* -- Choix du dossier des cours au démarrage ------------------------------------ */

async function dossierDesCours() {
  for (;;) {
    const r = cours.resoudre(reglages.lire().cours);
    if (r.racine) {
      if (r.aSynchroniser) {
        try { await synchroniserCours(r.racine); }
        catch (e) {
          dialog.showErrorBox("Studies", "La copie des cours a échoué : " + e.message);
          return null;
        }
      }
      return r;
    }
    const choix = dialog.showMessageBoxSync({
      type: "warning", title: "Studies", message: r.erreur,
      detail: "Choisir le dossier studies (celui qui contient _outils et les dossiers L1, L2, L3), ou revenir aux cours livrés avec l'application.",
      buttons: ["Choisir un dossier…", "Utiliser les cours intégrés", "Quitter"], defaultId: 0, cancelId: 2
    });
    if (choix === 2) return null;
    if (choix === 1) { reglages.modifier({ cours: { mode: "integre" } }); continue; }
    const d = dialog.showOpenDialogSync({ title: "Dossier studies", properties: ["openDirectory"] });
    if (d && d[0]) reglages.modifier({ cours: { mode: "dossier", dossier: d[0] } });
  }
}

/* -- PGlite (questions SQL) -------------------------------------------------------- */

// Le serveur cherche PGlite dans son dossier local (_outils/quiz/serveur/lib/chemins.js)
function dossierLocalQuiz() {
  return path.join(process.env.LOCALAPPDATA || process.env.XDG_CACHE_HOME || path.join(app.getPath("home"), ".cache"), "studies-quiz");
}

function installerPglite() {
  const local = dossierLocalQuiz();
  const cible = path.join(local, "node_modules", "@electric-sql", "pglite");
  if (fs.existsSync(path.join(cible, "package.json"))) return;
  const source = path.join(app.getAppPath() + (app.isPackaged ? ".unpacked" : ""), "node_modules", "@electric-sql", "pglite");
  if (!fs.existsSync(source)) return;
  try {
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.cpSync(source, cible, { recursive: true });
    const pkg = path.join(local, "package.json");
    if (!fs.existsSync(pkg)) fs.writeFileSync(pkg, JSON.stringify({ name: "studies-quiz-dependances", private: true }, null, 2));
  } catch (e) { /* le serveur essaiera npm, comme sans l'application */ }
}

/* -- Paramètres ------------------------------------------------------------------- */

function ouvrirParametres(section) {
  if (fenetreParametres && !fenetreParametres.isDestroyed()) {
    if (fenetreParametres.isMinimized()) fenetreParametres.restore();
    fenetreParametres.focus();
    if (section) fenetreParametres.webContents.send("parametres:section", section);
    return;
  }
  const parent = BrowserWindow.getFocusedWindow() || undefined;
  fenetreParametres = new BrowserWindow({
    width: 900, height: 820, minWidth: 640, minHeight: 480, show: false, parent,
    title: "Paramètres de Studies", autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#131417" : "#fafaf8",
    icon: path.join(__dirname, "assets", "icone.png"),
    webPreferences: { preload: path.join(__dirname, "parametres", "pont.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  fenetreParametres.setMenu(null);
  // Fenêtre annexe : fenetres.js ne la compte pas parmi les fenêtres de cours
  fenetreParametres.studiesAnnexe = true;
  fenetreParametres.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  fenetreParametres.webContents.on("will-navigate", (e) => e.preventDefault());
  fenetreParametres.once("ready-to-show", () => fenetreParametres.show());
  fenetreParametres.on("closed", () => { fenetreParametres = null; });
  fenetreParametres.loadFile(path.join(__dirname, "parametres", "index.html"), { hash: section || "" });
}

function redemarrer() {
  app.relaunch();
  app.quit();
}

function enregistrerIpc() {
  const traiter = (canal, fn) => ipcMain.handle(canal, (evenement, ...args) => fn(...args, evenement));

  traiter("app:info", () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    plateforme: process.platform,
    installee: app.isPackaged,
    donnees: app.getPath("userData"),
    racine,
    modeCours,
    releases: URL_RELEASES,
    versionsCours: cours.versions(),
    dossierLocal: cours.dossierLocal()
  }));
  traiter("app:redemarrer", () => redemarrer());
  traiter("app:ouvrir-dossier", (quoi) => {
    const dossier = { donnees: app.getPath("userData"), cours: racine, local: cours.dossierLocal() }[quoi];
    return dossier ? shell.openPath(dossier) : false;
  });
  traiter("app:ouvrir-releases", () => shell.openExternal(URL_RELEASES));

  traiter("reglages:lire", () => reglages.publics());
  traiter("reglages:modifier", (partiel) => {
    // L'interface ne touche ni à la clé d'API ni à la liste des dossiers de raccourcis
    const sur = Object.assign({}, partiel);
    if (sur.claude) sur.claude = { mode: sur.claude.mode === "cle" ? "cle" : "compte" };
    delete sur.raccourcis;
    if (sur.cours) sur.cours = { mode: sur.cours.mode === "dossier" ? "dossier" : "integre" };
    return reglages.publics(reglages.modifier(sur));
  });
  traiter("fenetre:ecrans", () => lancement.ecrans());
  traiter("fenetre:bornes", () => {
    const f = BrowserWindow.getAllWindows().find((w) => w !== fenetreParametres && !w.isDestroyed());
    return f ? f.getNormalBounds() : null;
  });

  traiter("cours:choisir", async (evenement) => {
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(evenement.sender), { title: "Dossier studies", properties: ["openDirectory"] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, annule: true };
    if (!cours.estDossierStudies(r.filePaths[0])) {
      return { ok: false, message: "Ce dossier ne contient pas studies (il faut _outils/app et _outils/quiz/serveur)." };
    }
    reglages.modifier({ cours: { mode: "dossier", dossier: r.filePaths[0] } });
    return { ok: true, dossier: r.filePaths[0] };
  });

  traiter("raccourcis:statut", () => raccourcis.statut());
  traiter("raccourcis:creer", (id, options) => raccourcis.creer(String(id), { confirmReplace: Boolean(options && options.confirmReplace) }));
  traiter("raccourcis:supprimer", (id) => raccourcis.supprimer(String(id)));
  traiter("raccourcis:afficher", (id) => raccourcis.afficher(String(id)));
  traiter("raccourcis:choisir", (evenement) => raccourcis.choisirDossier(BrowserWindow.fromWebContents(evenement.sender)));
  traiter("raccourcis:oublier", (id) => raccourcis.oublierDossier(String(id)));

  traiter("claude:statut", () => claude.statut(racine));
  traiter("claude:connecter", () => claude.connecter(racine));
  traiter("claude:deconnecter", () => claude.deconnecter(racine));
  traiter("claude:cle", (valeur) => claude.enregistrerCle(valeur));
  traiter("claude:lien", (nom) => claude.ouvrirLien(String(nom)));

  traiter("maj:verifier", () => majs.verifier());
  traiter("maj:statut", () => majs.statut());
  traiter("maj:installer", () => majs.installerMaintenant());
}

/* -- Démarrage --------------------------------------------------------------------- */

async function demarrer() {
  enregistrerIpc();
  majs.init((statut) => {
    for (const f of BrowserWindow.getAllWindows()) if (!f.isDestroyed()) f.webContents.send("maj:statut", statut);
  });

  const choix = await dossierDesCours();
  if (!choix) return app.quit();
  racine = choix.racine;
  modeCours = choix.mode;

  installerPglite();
  claude.appliquer();

  global.studiesHote = {
    version: app.getVersion(),
    idApp: ID_APP,
    // Fenêtre principale au lancement : { bornes, agrandie }
    etatFenetre: () => lancement.etatInitial(reglages.lire().fenetre),
    ouvrirParametres,
    verifierMiseAJour: () => { ouvrirParametres("mises-a-jour"); majs.verifier(); }
  };

  try {
    require(path.join(racine, cours.PROGRAMME));
  } catch (e) {
    dialog.showErrorBox("Studies", "Le programme du dossier des cours n'a pas pu démarrer :\n" + e.message + "\n\nDossier : " + racine);
    return app.quit();
  }

  if (reglages.lire().miseAJourAuto) setTimeout(() => majs.verifier(), 4000);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(demarrer);
}
