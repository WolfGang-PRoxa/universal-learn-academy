"use strict";
/* Menu de l'application. La barre reste masquée (touche Alt pour l'afficher) :
   la barre du haut des pages sert à la navigation, le menu aux raccourcis. */

const { app, Menu, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { RACINE } = require("../quiz/serveur/lib/chemins");
const paquet = require("./package.json");
const serveur = require("./serveur");
const fenetres = require("./fenetres");
const { t } = require("./textes");

// Application installée (studies/app) : entrées « Paramètres », « Mise à jour »,
// « Documentation » (F1) et « Paramétrage guidé » ; textes dans sa langue (textes.js)
const hote = global.studiesHote || null;

// Commande sur la fenêtre active, s'il y en a une
function surFenetre(action) {
  return (element, f) => { if (f) action(f); };
}

// « Mon suivi » (page du TODO.md) : outil du développement, présent dans le dépôt ula
// seulement ; ni l'application installée ni le dépôt public ne l'ont
const SUIVI = "_outils/todo/index.html";
const suiviPresent = () => fs.existsSync(path.join(__dirname, "..", "todo", "index.html"));

function aller(label, chemin, accelerator) {
  return { label, accelerator, click: surFenetre((f) => fenetres.allerA(f, chemin)) };
}

function construireMenu() {
  return Menu.buildFromTemplate([
    {
      label: t("menu.fichier"),
      submenu: [
        { label: t("menu.nouvelleFenetre"), accelerator: "CmdOrCtrl+N", click: () => fenetres.ouvrir(serveur.adresse() + fenetres.PORTAIL) },
        { type: "separator" },
        { label: t("menu.imprimer"), accelerator: "CmdOrCtrl+P", click: surFenetre(fenetres.imprimer) },
        { label: t("menu.pdf"), accelerator: "CmdOrCtrl+Shift+S", click: surFenetre(fenetres.enregistrerPdf) },
        { type: "separator" },
        { label: t("menu.dossierDonnees"), click: () => shell.openPath(RACINE) },
        ...(hote ? [{ label: t("menu.parametres"), accelerator: "CmdOrCtrl+,", click: () => hote.ouvrirParametres() }] : []),
        { type: "separator" },
        { label: t("menu.fermerFenetre"), role: "close", accelerator: "CmdOrCtrl+W" },
        { label: t("menu.quitter"), role: "quit", accelerator: "CmdOrCtrl+Q" }
      ]
    },
    {
      label: t("menu.edition"),
      submenu: [
        { label: t("menu.annuler"), role: "undo" },
        { label: t("menu.retablir"), role: "redo" },
        { type: "separator" },
        { label: t("menu.couper"), role: "cut" },
        { label: t("menu.copier"), role: "copy" },
        { label: t("menu.coller"), role: "paste" },
        { label: t("menu.toutSelectionner"), role: "selectAll" },
        { type: "separator" },
        { label: t("menu.rechercher"), accelerator: "CmdOrCtrl+F", click: surFenetre(fenetres.rechercher) }
      ]
    },
    {
      label: t("menu.aller"),
      submenu: [
        { label: t("menu.precedent"), accelerator: "Alt+Left", click: surFenetre((f) => f.webContents.navigationHistory.goBack()) },
        { label: t("menu.suivant"), accelerator: "Alt+Right", click: surFenetre((f) => f.webContents.navigationHistory.goForward()) },
        { type: "separator" },
        aller(t("menu.accueil"), fenetres.PORTAIL, "Alt+Home"),
        aller(t("menu.revisions"), "_outils/quiz/portail.html"),
        ...(suiviPresent() ? [aller(t("menu.suivi"), SUIVI)] : [])
      ]
    },
    {
      label: t("menu.affichage"),
      submenu: [
        { label: t("menu.recharger"), accelerator: "F5", click: surFenetre((f) => f.webContents.reload()) },
        { label: t("menu.recharger"), accelerator: "CmdOrCtrl+R", visible: false, click: surFenetre((f) => f.webContents.reload()) },
        { type: "separator" },
        { label: t("menu.agrandir"), role: "zoomIn", accelerator: "CmdOrCtrl+Plus" },
        { label: t("menu.agrandir"), role: "zoomIn", accelerator: "CmdOrCtrl+=", visible: false },
        { label: t("menu.reduire"), role: "zoomOut", accelerator: "CmdOrCtrl+-" },
        { label: t("menu.tailleNormale"), accelerator: "CmdOrCtrl+0", click: surFenetre(fenetres.echelleNormale) },
        { type: "separator" },
        { label: t("menu.pleinEcran"), role: "togglefullscreen", accelerator: "F11" },
        { label: t("menu.outilsDev"), role: "toggleDevTools", accelerator: "F12" }
      ]
    },
    {
      label: t("menu.aide"),
      submenu: [
        ...(hote && hote.ouvrirDocumentation ? [
          { label: t("menu.documentation"), accelerator: "F1", click: () => hote.ouvrirDocumentation() },
          { label: t("menu.guide"), click: () => hote.ouvrirGuide() },
          { type: "separator" }
        ] : []),
        { label: t("menu.journal"), click: () => shell.openPath(serveur.JOURNAL) },
        ...(hote ? [{ label: t("menu.maj"), click: () => hote.verifierMiseAJour() }] : []),
        { type: "separator" },
        { label: t("menu.apropos", { version: hote ? hote.version : paquet.version, electron: process.versions.electron }), enabled: false }
      ]
    }
  ]);
}

module.exports = { construireMenu };
