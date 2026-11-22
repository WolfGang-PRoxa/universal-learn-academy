'use strict';
/* Chemins de l'outil et conversions sûres entre URL et fichiers.
   Toute lecture ou écriture du serveur passe par ces fonctions : aucune ne
   peut sortir de la racine des données ni du dossier des outils.

   Deux dossiers :
   - OUTILS : le dossier _outils/ qui contient ce serveur ; servi sous /_outils/ ;
   - RACINE : la racine des données ula/ (explore/, profils, index.html) ; par
     défaut le dossier qui contient _outils (dépôt git, lancer.bat), ou celui
     que donne ULA_RACINE (application installée, outils livrés à part). */

const fs = require('fs');
const os = require('os');
const path = require('path');
const espace = require('../../../ula/lib/espace');

const QUIZ = path.resolve(__dirname, '..', '..'); // _outils/quiz
const OUTILS = path.resolve(QUIZ, '..'); // _outils
const RACINE = process.env.ULA_RACINE ? path.resolve(process.env.ULA_RACINE) : path.resolve(OUTILS, '..');
const VERSION = require('../package.json').version;

// Dossier local, hors de la racine : dépendances Node, fichiers temporaires,
// dossier de travail des conversations avec Claude.
const LOCAL = path.join(
  process.env.LOCALAPPDATA || process.env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache'),
  'studies-quiz',
);

// Segments jamais servis ni écrits
const INTERDITS = new Set(['.git', 'node_modules', '.dist']);

function sous(parent, abs) {
  const rel = path.relative(parent, abs);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function dansRacine(abs) {
  return sous(RACINE, abs) || sous(OUTILS, abs);
}

// Chemin absolu -> chemin d'URL relatif à la racine, avec des « / » (« _outils/… » pour les outils)
function relatif(abs) {
  if (sous(OUTILS, abs))
    return ['_outils', path.relative(OUTILS, abs)].filter(Boolean).join('/').split(path.sep).join('/');
  return path.relative(RACINE, abs).split(path.sep).join('/');
}

// Chemin d'URL (« /explore/informatique/codage/generated_quizzes/quiz-x.html ») -> chemin absolu, ou null
function depuisUrl(chemin) {
  let brut;
  try {
    brut = decodeURIComponent(String(chemin).split('?')[0].split('#')[0]);
  } catch (e) {
    return null;
  }
  if (brut.includes('\0')) return null;
  const segments = brut.split(/[/\\]/).filter(Boolean);
  if (segments.some((s) => INTERDITS.has(s) || s === '..' || s === '.')) return null;
  if (segments[0] === '_outils') {
    const abs = path.resolve(OUTILS, ...segments.slice(1));
    return sous(OUTILS, abs) ? abs : null;
  }
  const abs = path.resolve(RACINE, ...segments);
  return sous(RACINE, abs) ? abs : null;
}

// Vérifie qu'une page est un quiz et renvoie ses dossiers, ou null.
// - quiz du catalogue (explore/<d>/<cours>/generated_quizzes/x.html) : les tentatives
//   vont dans <dossier du cours dans l'espace du profil actif>/quiz_results/ ;
// - quiz de l'espace d'un profil (<…>/<cours>/generated_quizzes/x.html, quiz générés) :
//   dans <cours>/quiz_results/ ;
// - autre quiz (la démonstration de _outils/quiz/) : dans quiz_results/ à côté de la page.
// `resultats` est null si aucun profil n'est choisi ; avec { creer: true }, le lien
// vers le cours est ajouté au cursus s'il n'y est pas encore.
function pageQuiz(chemin, { creer = false } = {}) {
  const abs = depuisUrl(chemin);
  if (!abs || path.extname(abs) !== '.html' || !fs.existsSync(abs)) return null;
  const dossierQuiz = path.dirname(abs);
  const deMatiere = path.basename(dossierQuiz) === 'generated_quizzes';
  const cours = deMatiere ? path.dirname(dossierQuiz) : dossierQuiz; // contenu (pages de cours)
  const t = espace.travailDePage(RACINE, abs, { creer });
  const matiere = t.dossier || null; // travail de l'étudiant
  return {
    abs,
    cours,
    matiere,
    dossierQuiz,
    deMatiere,
    catalogue: Boolean(t.cours),
    idCours: t.cours,
    raison: t.raison || null,
    resultats: matiere ? path.join(matiere, 'quiz_results') : null,
  };
}

// Crée le dossier local au besoin et le renvoie
function dossierLocal(...sousDossiers) {
  const d = path.join(LOCAL, ...sousDossiers);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

module.exports = {
  QUIZ,
  OUTILS,
  RACINE,
  LOCAL,
  VERSION,
  INTERDITS,
  dansRacine,
  relatif,
  depuisUrl,
  pageQuiz,
  dossierLocal,
  espace,
};
