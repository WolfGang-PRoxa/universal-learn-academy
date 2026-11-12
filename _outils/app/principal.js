"use strict";
/* ==========================================================================
   Application de bureau Studies (_outils/app)
   --------------------------------------------------------------------------
   Le portail, les cours, les quiz et les TD dans leur propre fenêtre, sans
   navigateur ni terminal. Les pages et le serveur sont ceux de lancer.bat ;
   l'application ajoute la fenêtre, le menu et ce qu'un navigateur donnait
   d'office (voir fenetres.js).

   Ce fichier est chargé par l'amorce (amorce/main.js) une fois Electron prêt.
   ========================================================================== */

const { app, dialog, shell, BrowserWindow, Menu, Notification } = require("electron");
const path = require("path");
const serveur = require("./serveur");
const fenetres = require("./fenetres");
const { construireMenu } = require("./menu");

const ID_APP = "fr.studies.app";

function creerRaccourcis() {
  if (process.platform !== "win32") return;
  const lien = {
    target: process.execPath, cwd: path.dirname(process.execPath), appUserModelId: ID_APP,
    icon: process.execPath, iconIndex: 0, description: "Cours, quiz et TD interactifs"
  };
  const menuDemarrer = path.join(app.getPath("appData"), "Microsoft", "Windows", "Start Menu", "Programs");
  shell.writeShortcutLink(path.join(app.getPath("desktop"), "Studies.lnk"), "create", lien);
  shell.writeShortcutLink(path.join(menuDemarrer, "Studies.lnk"), "create", lien);
}

// Prévient quand une génération de quiz se termine alors que Studies n'a pas la main
function prevenirFinDeTache(t) {
  if (BrowserWindow.getFocusedWindow()) return;
  if (t.etat !== "terminee" && t.etat !== "erreur") return;
  const n = new Notification(t.etat === "terminee"
    ? { title: "Nouveau quiz prêt", body: path.basename(t.fichier) }
    : { title: "Génération du quiz interrompue", body: "Le détail est dans le portail." });
  if (t.etat === "terminee") n.on("click", () => fenetres.ouvrir(serveur.adresse() + t.fichier));
  n.show();
}

function surArretServeur(code) {
  const choix = dialog.showMessageBoxSync({
    type: "error", title: "Universal Learn Academy", message: "Le serveur local s'est arrêté (code " + code + ").",
    detail: "Le détail est dans le journal.", buttons: ["Relancer", "Voir le journal", "Quitter"], defaultId: 0, cancelId: 2
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
    dialog.showErrorBox("Universal Learn Academy", "Le serveur local n'a pas démarré : " + e.message + "\n\nJournal : " + serveur.JOURNAL);
    app.quit();
  }
}

// Application installée (studies/app) : son hôte publie global.studiesHote avant
// de charger ce fichier (paramètres, mises à jour, fenêtre au lancement). Sans
// hôte (lancer-app.bat), tout se passe comme avant.
const hote = global.studiesHote || null;

app.setAppUserModelId((hote && hote.idApp) || ID_APP);
if (!hote && process.argv.includes("--raccourcis")) creerRaccourcis();

app.on("second-instance", () => {
  const f = BrowserWindow.getAllWindows().find((w) => !w.studiesAnnexe);
  if (!f) return;
  if (f.isMinimized()) f.restore();
  f.focus();
});

// Petit délai : les pages enregistrent le travail en cours en se fermant (pagehide),
// et le serveur doit encore être là pour le recevoir
app.on("window-all-closed", () => setTimeout(() => app.quit(), 300));

let arretFait = false;
app.on("will-quit", (e) => {
  if (arretFait) return;
  e.preventDefault();
  serveur.arreter().finally(() => { arretFait = true; app.quit(); });
});

Menu.setApplicationMenu(construireMenu());
fenetres.preparerSession();
demarrerServeur(fenetres.ecranAttente());
