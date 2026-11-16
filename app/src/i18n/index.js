"use strict";
/* ==========================================================================
   Langue de l'application (version 2.6.0)
   --------------------------------------------------------------------------
   Les textes de l'hôte (paramètres, paramétrage guidé, documentation, menus,
   notifications, fenêtres annexes) sont rangés par clé dans un dictionnaire par
   langue : fr.js (la référence) et en.js. Une clé absente d'une langue reprend
   le texte français ; `npm run check` vérifie que les deux dictionnaires ont les
   mêmes clés et les mêmes variables.

   La langue choisie est le réglage « langue » de parametres.json (null tant que
   l'utilisateur ne l'a pas choisie : la fenêtre de choix s'ouvre alors au
   lancement, langue du système présélectionnée).

   Les pages servies par le serveur local (accueil, barre du haut) lisent la
   langue dans l'agent utilisateur (« ULA-langue/en ») ; le programme des outils
   (_outils/app) la demande à l'hôte (global.studiesHote.langue()).

   Ajouter une langue : un fichier <code>.js sur le modèle d'en.js, une entrée
   dans LANGUES, et les dictionnaires des pages (_outils/app/textes.js,
   _outils/ula/assets/textes.js, _outils/charte/assets/cours.js) et la
   documentation (src/doc/contenu/<code>/). Voir la documentation technique.
   ========================================================================== */

const { app } = require("electron");

const LANGUES = [
  { code: "fr", nom: "Français", locale: "fr-FR" },
  { code: "en", nom: "English", locale: "en-GB" }
];
const DICTIONNAIRES = { fr: require("./fr"), en: require("./en") };

let reglages = null;
const auditeurs = new Set();

function valide(code) {
  return LANGUES.some((l) => l.code === code) ? code : null;
}

/** Langue du système : français s'il parle français, anglais sinon. */
function detecter() {
  let l = "";
  try { l = String(app.getLocale() || app.getSystemLocale() || ""); } catch (e) { /* avant ready */ }
  return /^fr\b/i.test(l) ? "fr" : "en";
}

function brancher(r) { reglages = r; }

/** Langue choisie par l'utilisateur, ou null s'il ne l'a pas encore choisie. */
function choisie() {
  return reglages ? valide(reglages.lire().langue) : null;
}

/** Langue en usage : celle choisie, sinon celle du système. */
function langue() {
  return choisie() || detecter();
}

function locale(code = langue()) {
  return (LANGUES.find((l) => l.code === code) || LANGUES[0]).locale;
}

function definir(code) {
  const c = valide(code);
  if (!c) throw new Error("Langue inconnue : " + code);
  const avant = langue();
  reglages.modifier({ langue: c });
  if (c !== avant) for (const fn of auditeurs) { try { fn(c); } catch (e) { /* fenêtre fermée */ } }
  return c;
}

function surChangement(fn) {
  if (typeof fn === "function") auditeurs.add(fn);
}

function remplir(texte, vars) {
  if (!vars) return texte;
  return texte.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k])));
}

/** Texte de la clé dans la langue en usage (ou celle demandée), variables {nom} remplacées. */
function t(cle, vars, code = langue()) {
  const d = DICTIONNAIRES[code] || DICTIONNAIRES.fr;
  const texte = d[cle] !== undefined ? d[cle] : DICTIONNAIRES.fr[cle];
  return remplir(texte === undefined ? cle : texte, vars);
}

/** Singulier (« .un ») ou pluriel (« .plusieurs ») selon n ; 0 est singulier en français. */
function tn(cle, n, vars, code = langue()) {
  const un = n === 1 || (code === "fr" && n === 0);
  return t(`${cle}.${un ? "un" : "plusieurs"}`, Object.assign({ n }, vars), code);
}

/** Dictionnaire complet d'une langue (français pour les clés manquantes), pour les pages de l'hôte. */
function dictionnaire(code = langue()) {
  return Object.assign({}, DICTIONNAIRES.fr, DICTIONNAIRES[code] || {});
}

module.exports = { LANGUES, DICTIONNAIRES, brancher, detecter, choisie, langue, locale, definir, surChangement, t, tn, dictionnaire, remplir };
