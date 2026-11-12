"use strict";
/* Règles des raccourcis (repris de CV Studio), sans dépendance à Electron pour
   pouvoir être vérifiées par scripts/check.mjs.

   Un emplacement (dossier) est classé dans l'un de ces états :
     missing     aucun raccourci vers l'application ;
     ok          le raccourci de l'application ouvre bien cette installation ;
     other-name  pas de raccourci au nom de l'application, mais un autre l'ouvre ;
     outdated    il ouvre une autre copie de l'application (ancien emplacement) ;
     broken      il ouvre un fichier qui n'existe plus ;
     foreign     il ouvre un autre programme, ou n'est pas un raccourci lisible.

   Sous Windows, les chemins se comparent sans tenir compte de la casse ; sous
   Linux, à l'identique. */

const path = require("path");

const NOM = "Studies";

function fichierRaccourci(plateforme = process.platform) {
  return plateforme === "win32" ? NOM + ".lnk" : "studies.desktop";
}

/** Chemin comparable : séparateurs unifiés, sans guillemets (et sans casse sous Windows). */
function normaliserChemin(valeur, plateforme = process.platform) {
  const texte = String(valeur || "").trim().replace(/^"(.*)"$/, "$1");
  if (!texte) return "";
  if (plateforme === "win32") return path.win32.normalize(texte).replace(/[\\]+$/, "").toLowerCase();
  return path.posix.normalize(texte).replace(/\/+$/, "");
}

/** Arguments comparables : guillemets et espaces superflus retirés, chemins normalisés. */
function normaliserArguments(valeur, plateforme = process.platform) {
  return String(valeur || "").trim().split(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/).filter(Boolean)
    .map((a) => normaliserChemin(a, plateforme)).join(" ");
}

/** Le raccourci lance-t-il exactement cette installation (même exécutable, mêmes arguments) ? */
function lanceApp(lien, attendu, plateforme = process.platform) {
  if (!lien || !lien.target || normaliserChemin(lien.target, plateforme) !== normaliserChemin(attendu.target, plateforme)) return false;
  return normaliserArguments(lien.args, plateforme) === normaliserArguments(attendu.args, plateforme);
}

/** Le raccourci vise-t-il une copie de l'application (même nom d'exécutable) ailleurs ? */
function ressembleApp(lien, attendu, plateforme = process.platform) {
  if (!lien || !lien.target) return false;
  const p = plateforme === "win32" ? path.win32 : path.posix;
  const nom = (c) => p.basename(normaliserChemin(c, plateforme)).replace(/-\d+(\.\d+)*(-[\w.]+)?(?=\.appimage$)/i, "");
  return nom(lien.target) === nom(attendu.target);
}

/**
 * État d'un emplacement.
 * @param {object} trouve
 * @param {{ target?: string, args?: string, error?: string } | null} trouve.primary  raccourci au nom de l'application (null s'il n'existe pas)
 * @param {boolean} trouve.primaryTargetExists  sa cible existe-t-elle ?
 * @param {string[]} trouve.others  autres raccourcis du dossier qui lancent l'application
 * @param {{ target: string, args?: string }} attendu
 */
function classer({ primary, primaryTargetExists = true, others = [] }, attendu, plateforme = process.platform) {
  if (!primary) return others.length ? "other-name" : "missing";
  if (primary.error || !primary.target) return "foreign";
  if (lanceApp(primary, attendu, plateforme)) return "ok";
  if (!primaryTargetExists) return "broken";
  if (ressembleApp(primary, attendu, plateforme)) return "outdated";
  return "foreign";
}

/**
 * Action à mener pour obtenir un raccourci valide.
 *   create   aucun fichier : création ;
 *   repair   le raccourci est à nous mais périmé : il est remplacé ;
 *   replace  le fichier ouvre autre chose : remplacement après confirmation ;
 *   none     un raccourci valide existe déjà, rien à faire.
 */
function actionPrevue(etat) {
  switch (etat) {
    case "missing": return "create";
    case "outdated":
    case "broken": return "repair";
    case "foreign": return "replace";
    default: return "none";
  }
}

/** Le raccourci trouvé peut-il être mis à la corbeille par l'application ? */
function supprimable(etat) {
  return ["ok", "other-name", "outdated", "broken"].includes(etat);
}

/* -- Fichiers .desktop (Linux) ------------------------------------------- */

/** Découpe la ligne Exec d'un .desktop en { target, args }. */
function lireDesktop(texte) {
  const entree = /^\[Desktop Entry\]/m.test(texte);
  const exec = (texte.match(/^Exec=(.*)$/m) || [])[1];
  if (!entree || !exec) return { error: "pas un raccourci .desktop lisible" };
  const morceaux = exec.trim().match(/"(?:[^"\\]|\\.)*"|\S+/g) || [];
  const target = (morceaux.shift() || "").replace(/^"(.*)"$/, "$1").replace(/\\(.)/g, "$1");
  const args = morceaux.filter((m) => !/^%[fFuUick]$/.test(m)).join(" ");
  return { target, args };
}

function guillemets(valeur) {
  return /[\s"\\$`]/.test(valeur) ? '"' + valeur.replace(/(["\\$`])/g, "\\$1") + '"' : valeur;
}

function ecrireDesktop({ target, args, icon, description }) {
  return [
    "[Desktop Entry]",
    "Type=Application",
    "Name=" + NOM,
    "Comment=" + description,
    "Exec=" + [guillemets(target), args].filter(Boolean).join(" ") + " %U",
    "Icon=" + icon,
    "Terminal=false",
    "Categories=Education;",
    "StartupWMClass=" + NOM,
    ""
  ].join("\n");
}

module.exports = {
  NOM, fichierRaccourci, normaliserChemin, normaliserArguments, lanceApp, ressembleApp,
  classer, actionPrevue, supprimable, lireDesktop, ecrireDesktop
};
