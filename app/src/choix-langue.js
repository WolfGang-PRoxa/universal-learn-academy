"use strict";
/* ==========================================================================
   Choix de la langue au premier lancement (version 2.6.0)
   --------------------------------------------------------------------------
   Tant que le réglage « langue » n'est pas fixé, une petite fenêtre au style de
   l'application (langue/), centrée sur l'écran, le demande avant tout le
   reste : c'est le premier écran après l'installation. La langue du système
   est proposée. Fermée sans choix (croix, Échap), la langue du système sert
   pour cette fois et la question revient au lancement suivant.
   ========================================================================== */

const { ipcMain } = require("electron");
const path = require("path");
const i18n = require("./i18n");
const annexe = require("./annexe");

const LARGEUR = 520;
let enCours = null;

function demander() {
  if (enCours) return enCours.reponse;
  let repondre;
  const reponse = new Promise((r) => { repondre = r; });
  const f = annexe.creer({
    page: path.join(__dirname, "langue", "index.html"),
    preload: path.join(__dirname, "langue", "pont.cjs"),
    titre: "Universal Learn Academy",
    largeur: LARGEUR, hauteur: 300, min: { width: LARGEUR, height: 200 },
    redimensionnable: false
  });
  let choix = null;
  const depuis = (e) => e.sender === f.webContents;
  const infos = (e) => (depuis(e) ? { langues: i18n.LANGUES.map(({ code, nom }) => ({ code, nom })), proposee: i18n.langue() } : null);
  const choisir = (e, code) => {
    if (!depuis(e) || !i18n.LANGUES.some((l) => l.code === code)) return;
    choix = code;
    i18n.definir(code);
    if (!f.isDestroyed()) f.close();
  };
  const taille = (e, hauteur) => { if (depuis(e)) annexe.ajuster(f, LARGEUR, hauteur); };
  ipcMain.handle("langue:infos", infos);
  ipcMain.handle("langue:choisir", choisir);
  ipcMain.handle("langue:taille", taille);
  f.webContents.on("before-input-event", (_e, entree) => {
    if (entree.type === "keyDown" && entree.key === "Escape" && !f.isDestroyed()) f.close();
  });
  f.on("closed", () => {
    for (const canal of ["langue:infos", "langue:choisir", "langue:taille"]) ipcMain.removeHandler(canal);
    enCours = null;
    repondre(choix);
  });
  enCours = { reponse };
  return reponse;
}

module.exports = { demander };
