"use strict";
/* Amorce de l'application Studies : seul code embarqué dans l'exécutable.
   Elle retrouve le dossier studies/ (noté par installer.js dans racine.json,
   à côté de l'exécutable) et y charge le vrai programme,
   _outils/app/principal.js : un changement dans le dépôt s'applique donc sans
   réinstaller. Au démarrage de Windows, Google Drive peut ne pas avoir encore
   monté son lecteur : elle patiente, puis propose de réessayer. */

const { app, dialog } = require("electron");
const fs = require("fs");
const path = require("path");

const RACINE_JSON = path.join(path.dirname(process.execPath), "racine.json");
const ESSAIS = 20, PAUSE = 500;

function programme() {
  try {
    const { racine } = JSON.parse(fs.readFileSync(RACINE_JSON, "utf8"));
    const f = path.join(racine, "_outils", "app", "principal.js");
    return fs.existsSync(f) ? f : null;
  } catch (e) { return null; }
}

async function demarrer() {
  for (let i = 0; i < ESSAIS; i++) {
    const f = programme();
    if (f) return require(f);
    await new Promise((r) => setTimeout(r, PAUSE));
  }
  const choix = dialog.showMessageBoxSync({
    type: "warning", title: "Studies", message: "Le dossier studies est introuvable.",
    detail: "Google Drive n'a peut-être pas fini de démarrer. Si le dossier a changé de place, relancer lancer-app.bat depuis son nouvel emplacement.",
    buttons: ["Réessayer", "Quitter"], defaultId: 0, cancelId: 1
  });
  return choix === 0 ? demarrer() : app.quit();
}

if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(demarrer);
