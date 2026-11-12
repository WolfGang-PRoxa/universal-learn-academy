"use strict";
/* ==========================================================================
   Universal Learn Academy, application installée (app/) : processus principal
   --------------------------------------------------------------------------
   L'application installée est un « hôte » autour du programme des outils
   (_outils/app/principal.js : fenêtres, menu, serveur local), le même que
   lance lancer-app.bat. L'hôte ajoute ce qu'une application distribuée doit
   avoir : paramètres, mises à jour automatiques, fenêtre au lancement,
   raccourcis, connexion à Claude, dossier des données, profils.

   Au démarrage :
   1. il lit les paramètres et choisit le dossier des données et celui des
      outils (donnees.js) ; les outils livrés sont copiés ou mis à jour dans le
      dossier local ; les cours, eux, se téléchargent depuis l'accueil ;
   2. il installe PGlite (questions SQL) dans le dossier local de l'outil s'il
      manque, à partir de la copie livrée : pas besoin de Node sur le poste ;
   3. il applique la clé d'API Anthropic s'il y en a une (claude.js) ;
   4. il publie global.studiesHote et ULA_RACINE, puis charge le programme des outils ;
   5. il recherche une mise à jour si le paramètre est activé.
   ========================================================================== */

const { app, BrowserWindow, dialog, ipcMain, nativeTheme, session, shell } = require("electron");
const fs = require("fs");
const path = require("path");

const reglages = require("./reglages");
const lancement = require("./fenetre-lancement");
const majs = require("./mises-a-jour");
const raccourcis = require("./raccourcis");
const claude = require("./claude");
const donnees = require("./donnees");
const { ID_APP, URL_RELEASES } = require("./depot");

const NOM = "Universal Learn Academy";

// Dossier de paramètres alternatif (essais automatiques)
const essai = process.env.ULA_USER_DATA || process.env.STUDIES_USER_DATA;
if (essai) app.setPath("userData", essai);
else migrerParametres();

// Jusqu'à la version 1.0.3, l'application s'appelait Studies : ses paramètres étaient
// dans %APPDATA%\Studies (~/.config/Studies). Ils sont repris une fois.
function migrerParametres() {
  try {
    const nouveau = app.getPath("userData");
    const ancien = path.join(app.getPath("appData"), "Studies");
    if (fs.existsSync(path.join(nouveau, "parametres.json")) || !fs.existsSync(path.join(ancien, "parametres.json"))) return;
    fs.mkdirSync(nouveau, { recursive: true });
    for (const f of ["parametres.json", "fenetre.json"]) {
      if (fs.existsSync(path.join(ancien, f))) fs.copyFileSync(path.join(ancien, f), path.join(nouveau, f));
    }
  } catch (e) { /* paramètres par défaut */ }
}

// Lancé depuis un terminal de VS Code : Electron se prendrait pour Node dans le serveur
delete process.env.ELECTRON_RUN_AS_NODE;

app.setAppUserModelId(ID_APP);

// Tant que le programme n'est pas chargé (préparation des outils, dialogues), fermer
// une fenêtre ne doit pas quitter l'application ; principal.js gère ensuite la fin.
app.on("window-all-closed", () => {});

let fenetreParametres = null;
let racine = null;
let outils = null;
let modeDonnees = null;

/* -- Fenêtre de préparation des outils (première ouverture, nouvelle version) -- */

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
    <h1>Préparation des outils…</h1><p id="t">Copie des outils de cette version dans le dossier local.</p>
    <div class="barre"><i id="b"></i></div>`;
  f.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  f.once("ready-to-show", () => f.show());
  return f;
}

function attendre(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function synchroniserOutils(cible) {
  const f = fenetrePreparation();
  await attendre(150);
  let resultat;
  try {
    resultat = donnees.synchroniser(donnees.outilsLivres(), cible, (fait, total) => {
      const p = Math.round((fait / total) * 100);
      if (!f.isDestroyed()) f.webContents.executeJavaScript(`b.style.width="${p}%";t.textContent="${fait} fichiers sur ${total}"`).catch(() => {});
    });
  } finally {
    if (!f.isDestroyed()) f.destroy();
  }
  if (resultat.conserves.length) {
    fs.writeFileSync(path.join(cible, ".ula-conserves.txt"),
      "Fichiers modifiés dans ce dossier, gardés tels quels lors de la mise à jour des outils :\n" + resultat.conserves.join("\n") + "\n");
  }
  return resultat;
}

/* -- Choix du dossier des données au démarrage ------------------------------------ */

async function dossierDesDonnees() {
  for (;;) {
    const r = donnees.resoudre(reglages.lire());
    if (r.racine) {
      if (r.aSynchroniser) {
        try { await synchroniserOutils(donnees.dossierOutilsLocal()); }
        catch (e) {
          dialog.showErrorBox(NOM, "La copie des outils a échoué : " + e.message);
          return null;
        }
      }
      return r;
    }
    const choix = dialog.showMessageBoxSync({
      type: "warning", title: NOM, message: r.erreur,
      detail: "Choisir le dossier des données (celui qui contient explore et les dossiers des profils), ou revenir au dossier par défaut (" + donnees.dossierParDefaut() + ").",
      buttons: ["Choisir un dossier…", "Dossier par défaut", "Quitter"], defaultId: 0, cancelId: 2
    });
    if (choix === 2) return null;
    if (choix === 1) { reglages.modifier({ donnees: { dossier: "" }, cours: { mode: "integre", dossier: "" } }); continue; }
    const d = dialog.showOpenDialogSync({ title: "Dossier des données", properties: ["openDirectory", "createDirectory"] });
    if (d && d[0]) reglages.modifier({ donnees: { dossier: d[0] }, cours: { mode: "integre", dossier: "" } });
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

/* -- Anciens raccourcis « Studies » ---------------------------------------------------- */

// Jusqu'à la version 1.0.3, les raccourcis s'appelaient « Studies ». Ceux du Bureau
// et du menu Démarrer qui ouvrent cette installation (ou une installation disparue)
// sont retirés : les nouveaux portent le nom de l'application.
function nettoyerAnciensRaccourcis() {
  if (process.platform !== "win32" || !app.isPackaged) return;
  const dossiers = [app.getPath("desktop"), path.join(app.getPath("appData"), "Microsoft", "Windows", "Start Menu", "Programs")];
  const ici = path.dirname(process.execPath).toLowerCase();
  for (const d of dossiers) {
    const f = path.join(d, "Studies.lnk");
    if (!fs.existsSync(f)) continue;
    try {
      const cible = String(shell.readShortcutLink(f).target || "");
      if (path.dirname(cible).toLowerCase() === ici || (/studies\.exe$/i.test(cible) && !fs.existsSync(cible))) fs.rmSync(f, { force: true });
    } catch (e) { /* raccourci illisible : laissé */ }
  }
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
    title: "Paramètres de " + NOM, autoHideMenuBar: true,
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

/** Appel à l'API du serveur local de l'outil de quiz (port de _outils/quiz/reglages.json). */
async function apiQuiz(methode, route, corps) {
  let port = 5178;
  try { port = JSON.parse(fs.readFileSync(path.join(outils, "quiz", "reglages.json"), "utf8")).port || port; } catch (e) { /* port par défaut */ }
  let r;
  try {
    r = await fetch(`http://127.0.0.1:${port}/api/${route}`, {
      method: methode,
      headers: corps ? { "Content-Type": "application/json", Origin: `http://127.0.0.1:${port}` } : undefined,
      body: corps ? JSON.stringify(corps) : undefined,
      signal: AbortSignal.timeout(route.startsWith("claude/") ? 180000 : 20000)
    });
  } catch (e) {
    throw new Error("Le serveur local ne répond pas (il démarre avec la fenêtre des cours).");
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erreur || `Erreur ${r.status} du serveur local.`);
  return d;
}

function enregistrerIpc() {
  const traiter = (canal, fn) => ipcMain.handle(canal, (evenement, ...args) => fn(...args, evenement));

  traiter("app:info", () => ({
    nom: NOM,
    version: app.getVersion(),
    electron: process.versions.electron,
    plateforme: process.platform,
    installee: app.isPackaged,
    donnees: app.getPath("userData"),
    racine,
    outils,
    modeDonnees,
    releases: URL_RELEASES,
    versionsOutils: donnees.versions(),
    dossierLocal: donnees.dossierOutilsLocal(),
    dossierParDefaut: donnees.dossierParDefaut()
  }));
  traiter("app:redemarrer", () => redemarrer());
  traiter("app:ouvrir-dossier", (quoi) => {
    const dossier = { parametres: app.getPath("userData"), donnees: racine, outils, local: donnees.dossierOutilsLocal() }[quoi];
    return dossier ? shell.openPath(dossier) : false;
  });
  traiter("app:ouvrir-releases", () => shell.openExternal(URL_RELEASES));

  traiter("reglages:lire", () => reglages.publics());
  traiter("reglages:modifier", (partiel) => {
    // L'interface ne touche ni à la clé d'API, ni à la liste des dossiers de raccourcis,
    // ni au dossier des données (qui passe par donnees:choisir)
    const sur = Object.assign({}, partiel);
    if (sur.claude) sur.claude = { mode: sur.claude.mode === "cle" ? "cle" : "compte" };
    delete sur.raccourcis;
    delete sur.cours;
    delete sur.donnees;
    return reglages.publics(reglages.modifier(sur));
  });
  traiter("fenetre:ecrans", () => lancement.ecrans());
  traiter("fenetre:bornes", () => {
    const f = BrowserWindow.getAllWindows().find((w) => w !== fenetreParametres && !w.isDestroyed());
    return f ? f.getNormalBounds() : null;
  });

  traiter("donnees:choisir", async (evenement) => {
    const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(evenement.sender), { title: "Dossier des données", properties: ["openDirectory", "createDirectory"] });
    if (r.canceled || !r.filePaths[0]) return { ok: false, annule: true };
    reglages.modifier({ donnees: { dossier: r.filePaths[0] }, cours: { mode: "integre", dossier: "" } });
    return { ok: true, dossier: r.filePaths[0], depot: donnees.estDepot(r.filePaths[0]) };
  });
  traiter("donnees:defaut", () => {
    reglages.modifier({ donnees: { dossier: "" }, cours: { mode: "integre", dossier: "" } });
    return { ok: true, dossier: donnees.dossierParDefaut() };
  });

  // Profils : par l'API du serveur local (extension ula), comme l'accueil
  traiter("profils:etat", () => apiQuiz("GET", "ula/etat"));
  traiter("profils:choisir", (nom) => apiQuiz("PUT", "ula/profil", { nom: String(nom) }));
  traiter("profils:creer", (nom) => apiQuiz("POST", "ula/profils", { nom: String(nom) }));
  traiter("profils:renommer", (ancien, nouveau) => apiQuiz("POST", "ula/profils/renommer", { ancien: String(ancien), nouveau: String(nouveau) }));

  traiter("raccourcis:statut", () => raccourcis.statut());
  traiter("raccourcis:creer", (id, options) => raccourcis.creer(String(id), { confirmReplace: Boolean(options && options.confirmReplace) }));
  traiter("raccourcis:supprimer", (id) => raccourcis.supprimer(String(id)));
  traiter("raccourcis:afficher", (id) => raccourcis.afficher(String(id)));
  traiter("raccourcis:choisir", (evenement) => raccourcis.choisirDossier(BrowserWindow.fromWebContents(evenement.sender)));
  traiter("raccourcis:oublier", (id) => raccourcis.oublierDossier(String(id)));

  traiter("claude:statut", () => claude.statut(outils));
  traiter("claude:connecter", () => claude.connecter(outils));
  traiter("claude:deconnecter", () => claude.deconnecter(outils));
  traiter("claude:cle", (valeur) => claude.enregistrerCle(valeur));
  traiter("claude:lien", (nom) => claude.ouvrirLien(String(nom)));

  // Réglages de l'outil de quiz (modèles de Claude par usage, chemin de Claude Code,
  // exécution du code) : lus et modifiés par l'API du serveur local
  traiter("quiz:etat", () => apiQuiz("GET", "etat?forcer=1"));
  traiter("quiz:reglages", (r) => apiQuiz("PUT", "reglages", r));
  traiter("quiz:tester", (usage) => apiQuiz("POST", "claude/test", { usage: String(usage) }));

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

  const choix = await dossierDesDonnees();
  if (!choix) return app.quit();
  // Ancien réglage « cours » (Studies 1.x) ou dossier renommé : le dossier retenu est
  // noté dans le nouveau réglage, une fois pour toutes
  const r0 = reglages.lire();
  if (choix.racine !== donnees.dossierParDefaut() && (r0.donnees || {}).dossier !== choix.racine) {
    reglages.modifier({ donnees: { dossier: choix.racine }, cours: { mode: "integre", dossier: "" } });
  }
  racine = choix.racine;
  outils = choix.outils;
  modeDonnees = choix.mode;
  // Le serveur local (et tout ce qu'il lance) lit la racine des données dans ULA_RACINE
  process.env.ULA_RACINE = racine;

  installerPglite();
  claude.appliquer();
  nettoyerAnciensRaccourcis();

  // Les pages reconnaissent l'application installée à son agent utilisateur et ajoutent
  // alors le bouton « Paramètres » à leur barre (_outils/charte/assets/cours.js)
  session.defaultSession.setUserAgent(session.defaultSession.getUserAgent() + " StudiesApp/" + app.getVersion());

  global.studiesHote = {
    version: app.getVersion(),
    idApp: ID_APP,
    nom: NOM,
    racine,
    // Fenêtre principale au lancement : { bornes, agrandie }
    etatFenetre: () => lancement.etatInitial(reglages.lire().fenetre),
    ouvrirParametres,
    verifierMiseAJour: () => { ouvrirParametres("mises-a-jour"); majs.verifier(); }
  };

  try {
    require(path.join(outils, "app", "principal.js"));
  } catch (e) {
    dialog.showErrorBox(NOM, "Le programme des outils n'a pas pu démarrer :\n" + e.message + "\n\nDossier : " + outils);
    return app.quit();
  }

  if (reglages.lire().miseAJourAuto) setTimeout(() => majs.verifier(), 4000);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(demarrer);
}
