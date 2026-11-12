"use strict";
/* Chemins de l'outil et conversions sûres entre URL et fichiers.
   Toute lecture ou écriture du serveur passe par ces fonctions : aucune ne
   peut sortir du dossier studies/. */

const fs = require("fs");
const os = require("os");
const path = require("path");

const QUIZ = path.resolve(__dirname, "..", "..");      // studies/_outils/quiz
const RACINE = path.resolve(QUIZ, "..", "..");          // studies/
const VERSION = require("../package.json").version;

// Dossier local, hors de Google Drive : dépendances Node, fichiers temporaires,
// dossier de travail des conversations avec Claude.
const LOCAL = path.join(
  process.env.LOCALAPPDATA || process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"),
  "studies-quiz"
);

// Segments jamais servis ni écrits
const INTERDITS = new Set([".git", "node_modules", ".dist"]);

function dansRacine(abs) {
  const rel = path.relative(RACINE, abs);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

// Chemin absolu -> chemin relatif à studies/, avec des « / »
function relatif(abs) {
  return path.relative(RACINE, abs).split(path.sep).join("/");
}

// Chemin d'URL (« /L3/BDD/generated_quizzes/quiz-x.html ») -> chemin absolu, ou null
function depuisUrl(chemin) {
  let brut;
  try { brut = decodeURIComponent(String(chemin).split("?")[0].split("#")[0]); }
  catch (e) { return null; }
  if (brut.includes("\0")) return null;
  const segments = brut.split("/").filter(Boolean);
  if (segments.some((s) => INTERDITS.has(s) || s === "..")) return null;
  const abs = path.resolve(RACINE, ...segments);
  return dansRacine(abs) ? abs : null;
}

// Vérifie qu'une page est un quiz et renvoie ses dossiers, ou null. Un quiz de
// matière (<…>/<Matière>/generated_quizzes/<fichier>.html) archive ses
// tentatives dans <Matière>/quiz_results/ ; un autre quiz (la démonstration
// de _outils/quiz/, par exemple) dans un dossier quiz_results/ à côté de la page.
function pageQuiz(chemin) {
  const abs = depuisUrl(chemin);
  if (!abs || path.extname(abs) !== ".html" || !fs.existsSync(abs)) return null;
  const dossierQuiz = path.dirname(abs);
  const deMatiere = path.basename(dossierQuiz) === "generated_quizzes";
  const matiere = deMatiere ? path.dirname(dossierQuiz) : dossierQuiz;
  return { abs, matiere, dossierQuiz, deMatiere, resultats: path.join(matiere, "quiz_results") };
}

// Crée le dossier local au besoin et le renvoie
function dossierLocal(...sous) {
  const d = path.join(LOCAL, ...sous);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

module.exports = { QUIZ, RACINE, LOCAL, VERSION, INTERDITS, dansRacine, relatif, depuisUrl, pageQuiz, dossierLocal };
