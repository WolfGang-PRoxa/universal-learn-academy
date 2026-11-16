"use strict";
/* Fonctionnement en arrière-plan (version 2.4.0), repris de Modding Manager.

   Fermer la fenêtre ne quitte plus l'application : elle se cache, son icône reste
   dans la zone de notification (en bas à droite de la barre des tâches), le serveur
   local continue de tourner (une génération de quiz va à son terme) et la fenêtre
   se rouvre aussitôt, à la même page. On la quitte vraiment par le menu de l'icône
   (« Quitter »), qui garde l'avertissement sur les générations de quiz en cours.
   La première fois, une bulle le rappelle.

   Réglage « Garder l'application en arrière-plan à la fermeture » (paramètres,
   carte « Arrière-plan » ; activé par défaut). Modding Manager n'a pas de réglage pour
   cela ; il est ajouté ici pour qui préfère que la croix quitte l'application.

   Sous Linux, l'icône n'existe que si le bureau a une zone de notification
   (StatusNotifierItem : KDE, Cinnamon, XFCE, GNOME avec l'extension AppIndicator) :
   sans elle, la croix ferme l'application comme avant. */

const { app, Menu, Notification, Tray, nativeImage } = require("electron");
const { execFile } = require("child_process");
const path = require("path");
const { t } = require("./i18n");

const NOM = "Universal Learn Academy";

let icone = null;
let quitter = false;
let zoneDisponible = process.platform === "win32" || process.platform === "darwin";
let options = null;

// Linux : une zone de notification existe-t-elle ? (sans bloquer : dbus-send en asynchrone)
function detecterZoneLinux() {
  if (process.platform !== "linux") return Promise.resolve(zoneDisponible);
  return new Promise((resolve) => {
    execFile("dbus-send", ["--session", "--print-reply", "--dest=org.freedesktop.DBus", "/org/freedesktop/DBus",
      "org.freedesktop.DBus.NameHasOwner", "string:org.kde.StatusNotifierWatcher"], { timeout: 3000 }, (err, stdout) => {
      zoneDisponible = !err && /boolean true/.test(String(stdout));
      resolve(zoneDisponible);
    });
  });
}

function image() {
  const png = nativeImage.createFromPath(path.join(__dirname, "assets", "icone.png"));
  if (png.isEmpty()) return png;
  return png.resize({ width: process.platform === "win32" ? 32 : 24, height: process.platform === "win32" ? 32 : 24 });
}

/* Windows : l'icône vient du fichier .ico empaqueté (build/icon.ico, 16 à 256 px), dont
   Windows prend la taille qui convient à l'échelle de l'écran. Jusqu'à la 2.4.1, elle était
   extraite de l'exécutable installé (app.getFileIcon) et ne s'affichait pas dans le menu
   des icônes cachées ; cette extraction ne sert plus que de secours. */
async function imageIcone() {
  if (process.platform === "win32") {
    const ico = nativeImage.createFromPath(path.join(__dirname, "..", "build", "icon.ico"));
    if (!ico.isEmpty()) return ico;
    if (app.isPackaged) {
      const i = await app.getFileIcon(process.execPath, { size: "normal" }).catch(() => null);
      if (i && !i.isEmpty()) return i;
    }
  }
  return image();
}

function menu() {
  const maj = options.majStatut ? options.majStatut() : {};
  const synchro = options.synchro ? options.synchro() : {};
  return Menu.buildFromTemplate([
    { label: t("m.icone.ouvrir", { nom: NOM }), click: () => options.ouvrir() },
    { type: "separator" },
    ...(synchro.visible ? [{ label: t(synchro.enCours ? "p.synchro.enCours" : "p.synchro.maintenant"), enabled: !synchro.enCours, click: () => options.synchroniser() }] : []),
    maj.etat === "pret"
      ? { label: t("m.icone.installer", { version: maj.version || "" }).trim(), click: () => options.installer() }
      : { label: t("m.icone.maj"), click: () => options.verifierMiseAJour() },
    ...(options.documentation ? [{ label: t("m.icone.documentation"), click: () => options.documentation() }] : []),
    { type: "separator" },
    { label: t("m.icone.quitter", { nom: NOM }), click: () => app.quit() }
  ]);
}

/**
 * Installe l'icône. options : { ouvrir(), verifierMiseAJour(), installer(), majStatut(), synchro(), synchroniser(), actif() }
 * actif() : le réglage « garder en arrière-plan » est-il activé ?
 */
async function demarrer(opts) {
  options = opts;
  app.on("before-quit", () => { quitter = true; });
  await detecterZoneLinux();
  if (!zoneDisponible) return false;
  try {
    icone = new Tray(await imageIcone());
  } catch (e) {
    zoneDisponible = false;
    return false;
  }
  icone.setToolTip(NOM);
  icone.on("click", () => options.ouvrir());
  icone.on("double-click", () => options.ouvrir());
  if (process.platform === "linux") icone.setContextMenu(menu());
  icone.on("right-click", () => icone && icone.popUpContextMenu(menu()));
  app.on("will-quit", () => { if (icone) { icone.destroy(); icone = null; } });
  return true;
}

/** Linux : le menu de l'icône est fixé d'avance ; à refaire quand l'état change. */
function rafraichir() {
  if (icone && process.platform === "linux") icone.setContextMenu(menu());
}

/** La croix de la dernière fenêtre doit-elle seulement la cacher ? */
function garder() {
  return !quitter && Boolean(icone) && Boolean(options && options.actif());
}

/** Fermeture refusée (« Continuer » devant une génération en cours) : la croix recache. */
function quitterAnnule() { quitter = false; }

function quitte() { return quitter; }

/** Bulle (Windows) ou notification, la première fois que la fenêtre se cache. */
function annoncer() {
  const titre = t("m.bulle.titre", { nom: NOM });
  const texte = t("m.bulle.texte");
  if (icone && process.platform === "win32") {
    icone.displayBalloon({ title: titre, content: texte, iconType: "info", respectQuietTime: true });
  } else if (Notification.isSupported()) {
    new Notification({ title: titre, body: texte, silent: true }).show();
  }
}

module.exports = { demarrer, garder, quitterAnnule, quitte, annoncer, rafraichir, zone: () => Boolean(icone) };
