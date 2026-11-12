"use strict";
/* Mises à jour automatiques à partir des releases GitHub (electron-updater),
   sur le modèle de CV Studio. Au lancement (si le paramètre est activé), la
   nouvelle version est téléchargée en arrière-plan puis installée à la fermeture,
   ou tout de suite sur demande.

   Dépôt privé : GitHub ne montre ses releases qu'avec un jeton. Aucun jeton n'est
   jamais placé dans l'exécutable. Si la lecture publique échoue (404), on essaie
   le jeton de GitHub CLI déjà connectée sur ce poste (`gh auth token`) : il reste
   en mémoire le temps de la recherche et du téléchargement. Pour les autres
   utilisateurs, la mise à jour ne fonctionnera qu'une fois le dépôt public. */

const { app } = require("electron");
const { spawnSync } = require("child_process");
const { autoUpdater } = require("electron-updater");
const { DEPOT } = require("./depot");

let envoyer = () => {};
let dernier = { etat: "repos" };
let configure = false;
let viaGh = false;

function messageCourt(erreur) {
  const texte = String((erreur && erreur.message) || erreur || "erreur inconnue");
  if (/\b404\b/.test(texte)) return "aucune version publiée n'a été trouvée sur GitHub (dépôt privé ou aucune release).";
  if (/\b401\b|\b403\b/.test(texte)) return "GitHub refuse l'accès aux releases (jeton invalide ou sans droit de lecture).";
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|net::ERR_/i.test(texte)) return "connexion à GitHub impossible.";
  const ligne = texte.split("\n")[0].trim();
  return ligne.length > 160 ? ligne.slice(0, 157) + "…" : ligne;
}

function emettre(statut) {
  dernier = Object.assign({}, statut, { a: new Date().toISOString(), viaGh });
  envoyer(dernier);
}

function configurer() {
  if (configure) return;
  configure = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = null;
  autoUpdater.on("checking-for-update", () => emettre({ etat: "recherche" }));
  autoUpdater.on("update-available", (info) => emettre({ etat: "disponible", version: info.version }));
  autoUpdater.on("update-not-available", () => emettre({ etat: "a-jour" }));
  autoUpdater.on("download-progress", (p) => emettre({ etat: "telechargement", pourcent: Math.round(p.percent) }));
  autoUpdater.on("update-downloaded", (info) => emettre({ etat: "pret", version: info.version }));
  autoUpdater.on("error", (e) => emettre({ etat: "erreur", message: messageCourt(e) }));
}

/** Jeton de GitHub CLI connectée sur ce poste, ou null. */
function jetonGh() {
  try {
    const r = spawnSync("gh", ["auth", "token", "--hostname", "github.com"], { encoding: "utf8", timeout: 10000, windowsHide: true });
    const jeton = (r.stdout || "").trim();
    return r.status === 0 && /^[\w-]{20,}$/.test(jeton) ? jeton : null;
  } catch (e) { return null; }
}

function init(rappel) { envoyer = rappel; }
function statut() { return dernier; }

async function verifier() {
  if (!app.isPackaged) {
    emettre({ etat: "indisponible", message: "Les mises à jour ne concernent que la version installée de l'application." });
    return dernier;
  }
  if (process.platform === "linux" && !process.env.APPIMAGE) {
    emettre({ etat: "indisponible", message: "Les mises à jour automatiques sous Linux demandent la version AppImage." });
    return dernier;
  }
  configurer();
  try {
    await autoUpdater.checkForUpdates();
  } catch (e) {
    // Dépôt privé : nouvel essai avec le jeton de GitHub CLI, s'il y en a un
    const jeton = !viaGh && /\b404\b/.test(String(e && e.message)) ? jetonGh() : null;
    if (!jeton) { emettre({ etat: "erreur", message: messageCourt(e) }); return dernier; }
    viaGh = true;
    autoUpdater.setFeedURL({ provider: "github", owner: DEPOT.proprietaire, repo: DEPOT.nom, private: true, token: jeton });
    try { await autoUpdater.checkForUpdates(); }
    catch (e2) { emettre({ etat: "erreur", message: messageCourt(e2) }); }
  }
  return dernier;
}

function installerMaintenant() {
  if (dernier.etat !== "pret") return false;
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return true;
}

module.exports = { init, statut, verifier, installerMaintenant };
