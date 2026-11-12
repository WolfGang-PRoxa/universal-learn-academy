"use strict";
/* Crochet afterPack d'electron-builder : contrôle le paquet avant que l'installeur
   (Windows) ou l'AppImage (Linux) soit créé. Une donnée personnelle trouvée fait
   échouer la construction. */

const path = require("path");
const { verifier } = require("./verifier-paquet.cjs");

module.exports = async function apresEmpaquetage(contexte) {
  const resources = contexte.electronPlatformName === "darwin"
    ? path.join(contexte.appOutDir, `${contexte.packager.appInfo.productFilename}.app`, "Contents", "Resources")
    : path.join(contexte.appOutDir, "resources");
  const { problemes, fichiersCours } = verifier(resources);
  if (problemes.length) {
    throw new Error(`Paquet refusé (${contexte.electronPlatformName}) : données personnelles ou contenu invalide.\n- ${problemes.join("\n- ")}`);
  }
  console.log(`  • contrôle du paquet  plateforme=${contexte.electronPlatformName} cours=${fichiersCours} fichiers, aucune donnée personnelle`);
};
