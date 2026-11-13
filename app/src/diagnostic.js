"use strict";
/* Journal de diagnostic des gels (version 2.4.0).

   Le défilement à la molette s'interrompait parfois, sur n'importe quelle page,
   et reprenait après un clic. Deux causes possibles, toutes deux notées ici, dans
   le dossier des journaux de l'application (Paramètres › Mises à jour › « Dossier
   des journaux », ou %APPDATA%\Universal Learn Academy\logs\gels.log) :

   - le processus principal bloqué : sous Windows, la molette et le clavier passent
     par lui avant d'atteindre la page. Un minuteur toutes les 100 ms note chaque
     retard de plus de 150 ms, avec l'action en cours (appel des paramètres…) ;
   - une page que Chromium croit cachée alors que sa fenêtre est affichée (calcul
     des fenêtres masquées de Windows) : elle ne dessine plus et ne défile plus
     jusqu'au prochain clic. Ce calcul est désactivé depuis la 2.4.0 (main.js) ;
     si une page se dit encore cachée dans une fenêtre visible, c'est noté.

   Le journal est court (gardé sous 512 Ko, l'ancien passe en gels.1.log). */

const { app, BrowserWindow } = require("electron");
const fs = require("fs");
const path = require("path");

const PERIODE = 100;
const SEUIL = 150;
const TAILLE_MAX = 512 * 1024;
const MARQUE = "__ula_visibilite__:";

let fichier = null;
let action = null;

function dossier() {
  try { return app.getPath("logs"); } catch (e) { return path.join(app.getPath("userData"), "logs"); }
}

function noter(ligne) {
  try {
    if (!fichier) {
      fs.mkdirSync(dossier(), { recursive: true });
      fichier = path.join(dossier(), "gels.log");
    }
    try {
      if (fs.statSync(fichier).size > TAILLE_MAX) fs.renameSync(fichier, path.join(dossier(), "gels.1.log"));
    } catch (e) { /* pas encore de journal */ }
    // Écriture asynchrone : le journal ne doit pas lui-même bloquer le processus principal
    fs.appendFile(fichier, new Date().toISOString() + " " + ligne + "\n", () => {});
  } catch (e) { /* journal impossible : tant pis */ }
}

/** Nomme l'action en cours dans le processus principal (appel IPC…), pour le journal. */
function enCours(nom) { action = nom; }

async function suivre(nom, fn) {
  const avant = action;
  action = nom;
  try { return await fn(); } finally { action = avant; }
}

function surveillerBoucle() {
  let attendu = Date.now() + PERIODE;
  const t = setInterval(() => {
    const maintenant = Date.now();
    const retard = maintenant - attendu;
    attendu = maintenant + PERIODE;
    if (retard > SEUIL) noter(`processus principal bloqué ${retard} ms` + (action ? ` (pendant : ${action})` : ""));
  }, PERIODE);
  if (t.unref) t.unref();
}

// Chaque page des fenêtres de cours signale ses changements de visibilité par la
// console (les pages n'ont pas de passerelle vers le processus principal)
const SCRIPT_VISIBILITE = `(() => {
  if (window.__ulaVisibilite) return;
  window.__ulaVisibilite = true;
  let quitte = false;
  addEventListener("pagehide", () => { quitte = true; });
  // Une page qu'on quitte passe aussi par « hidden » : seule compte une page encore
  // cachée une seconde plus tard
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    setTimeout(() => { if (!quitte && document.visibilityState === "hidden") console.debug(${JSON.stringify(MARQUE)} + "hidden"); }, 1000);
  });
})()`;

function surveillerPage(f) {
  const page = f.webContents;
  page.on("did-finish-load", () => { page.executeJavaScript(SCRIPT_VISIBILITE).catch(() => {}); });
  page.on("console-message", (e, ...anciens) => {
    const message = (e && typeof e.message === "string") ? e.message : String(anciens[1] || "");
    if (!message.startsWith(MARQUE)) return;
    const etat = message.slice(MARQUE.length);
    if (f.isDestroyed()) return;
    if (etat === "hidden" && f.isVisible() && !f.isMinimized()) {
      noter(`page cachée dans une fenêtre affichée (${f.isFocused() ? "active" : "inactive"}) : ${page.getURL()}`);
    }
  });
}

function demarrer() {
  surveillerBoucle();
  app.on("browser-window-created", (e, f) => surveillerPage(f));
  for (const f of BrowserWindow.getAllWindows()) surveillerPage(f);
  noter(`démarrage ${app.getName()} ${app.getVersion()} (Electron ${process.versions.electron}, ${process.platform})`);
}

module.exports = { demarrer, noter, enCours, suivre, dossier };
