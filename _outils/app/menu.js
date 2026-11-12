"use strict";
/* Menu de l'application. La barre reste masquée (touche Alt pour l'afficher) :
   la barre du haut des pages sert à la navigation, le menu aux raccourcis. */

const { app, Menu, shell } = require("electron");
const { RACINE } = require("../quiz/serveur/lib/chemins");
const paquet = require("./package.json");
const serveur = require("./serveur");
const fenetres = require("./fenetres");

// Application installée (studies/app) : entrées « Paramètres » et « Mise à jour »
const hote = global.studiesHote || null;

// Commande sur la fenêtre active, s'il y en a une
function surFenetre(action) {
  return (element, f) => { if (f) action(f); };
}

function aller(label, chemin, accelerator) {
  return { label, accelerator, click: surFenetre((f) => fenetres.allerA(f, chemin)) };
}

function construireMenu() {
  return Menu.buildFromTemplate([
    {
      label: "&Fichier",
      submenu: [
        { label: "Nouvelle fenêtre", accelerator: "CmdOrCtrl+N", click: () => fenetres.ouvrir(serveur.adresse() + fenetres.PORTAIL) },
        { type: "separator" },
        { label: "Imprimer…", accelerator: "CmdOrCtrl+P", click: surFenetre(fenetres.imprimer) },
        { label: "Enregistrer en PDF…", accelerator: "CmdOrCtrl+Shift+S", click: surFenetre(fenetres.enregistrerPdf) },
        { type: "separator" },
        { label: "Ouvrir le dossier studies", click: () => shell.openPath(RACINE) },
        ...(hote ? [{ label: "Paramètres de l'application…", accelerator: "CmdOrCtrl+,", click: () => hote.ouvrirParametres() }] : []),
        { type: "separator" },
        { label: "Fermer la fenêtre", role: "close", accelerator: "CmdOrCtrl+W" },
        { label: "Quitter", role: "quit", accelerator: "CmdOrCtrl+Q" }
      ]
    },
    {
      label: "É&dition",
      submenu: [
        { label: "Annuler", role: "undo" },
        { label: "Rétablir", role: "redo" },
        { type: "separator" },
        { label: "Couper", role: "cut" },
        { label: "Copier", role: "copy" },
        { label: "Coller", role: "paste" },
        { label: "Tout sélectionner", role: "selectAll" },
        { type: "separator" },
        { label: "Rechercher dans la page…", accelerator: "CmdOrCtrl+F", click: surFenetre(fenetres.rechercher) }
      ]
    },
    {
      label: "&Aller",
      submenu: [
        { label: "Précédent", accelerator: "Alt+Left", click: surFenetre((f) => f.webContents.navigationHistory.goBack()) },
        { label: "Suivant", accelerator: "Alt+Right", click: surFenetre((f) => f.webContents.navigationHistory.goForward()) },
        { type: "separator" },
        aller("Portail", fenetres.PORTAIL, "Alt+Home"),
        aller("Accueil général", "index.html"),
        aller("Suivi (TODO)", "_outils/todo/index.html")
      ]
    },
    {
      label: "Afficha&ge",
      submenu: [
        { label: "Recharger", accelerator: "F5", click: surFenetre((f) => f.webContents.reload()) },
        { label: "Recharger", accelerator: "CmdOrCtrl+R", visible: false, click: surFenetre((f) => f.webContents.reload()) },
        { type: "separator" },
        { label: "Agrandir", role: "zoomIn", accelerator: "CmdOrCtrl+Plus" },
        { label: "Agrandir", role: "zoomIn", accelerator: "CmdOrCtrl+=", visible: false },
        { label: "Réduire", role: "zoomOut", accelerator: "CmdOrCtrl+-" },
        { label: "Taille normale", role: "resetZoom", accelerator: "CmdOrCtrl+0" },
        { type: "separator" },
        { label: "Plein écran", role: "togglefullscreen", accelerator: "F11" },
        { label: "Outils de développement", role: "toggleDevTools", accelerator: "F12" }
      ]
    },
    {
      label: "&Aide",
      submenu: [
        { label: "Journal du serveur", click: () => shell.openPath(serveur.JOURNAL) },
        ...(hote ? [{ label: "Rechercher une mise à jour", click: () => hote.verifierMiseAJour() }] : []),
        { type: "separator" },
        { label: "À propos de Studies " + (hote ? hote.version : paquet.version) + " (Electron " + process.versions.electron + ")", enabled: false }
      ]
    }
  ]);
}

module.exports = { construireMenu };
