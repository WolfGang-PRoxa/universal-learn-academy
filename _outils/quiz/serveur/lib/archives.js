'use strict';
/* Archives des tentatives : un fichier JSON par tentative, dans le dossier du
   cours de l'espace du profil actif (jamais dans explore/) :
     <profil>/<cursus>/<cours>/quiz_results/<id du quiz>/<AAAA-MM-JJ_HH-MM-SS>.json
   Le fichier est créé dès le début du quiz (statut « en_cours »), mis à jour
   au fil des réponses, puis passe au statut « terminee » : c'est ce qui permet
   de reprendre un quiz interrompu. Le format est décrit dans _outils/quiz/README.md
   (« Archives des tentatives »). */

const fs = require('fs');
const path = require('path');
const { tr } = require('./langue');
const { RACINE, relatif, depuisUrl, pageQuiz, espace } = require('./chemins');

const MOTIF_ID = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(-\d{1,3})?$/;

// Identifiant du quiz, lu dans le bloc de données de la page
function idQuiz(fichierPage) {
  const source = fs.readFileSync(fichierPage, 'utf8');
  const m = source.match(/<script[^>]*id="quiz-donnees"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    const id = JSON.parse(m[1]).id;
    return /^[a-z0-9][a-z0-9-]*$/.test(id) ? id : null;
  } catch (e) {
    return null;
  }
}

function dossierTentatives(page, creer) {
  const q = pageQuiz(page, { creer });
  if (!q) throw new Error('Page de quiz invalide : ' + page);
  const id = idQuiz(q.abs);
  if (!id) throw new Error('Identifiant de quiz introuvable dans ' + page);
  if (!q.resultats && creer) throw new Error(q.raison || tr('Aucun profil choisi.', 'No profile selected.'));
  return { dossier: q.resultats ? path.join(q.resultats, id) : null, q, id };
}

// Enregistre (ou met à jour) une tentative ; renvoie le chemin relatif du fichier
function enregistrer(page, tentative) {
  if (!tentative || typeof tentative !== 'object') throw new Error('Tentative manquante.');
  if (!MOTIF_ID.test(String(tentative.id))) throw new Error('Identifiant de tentative invalide.');
  const { dossier, q, id } = dossierTentatives(page, true);
  fs.mkdirSync(dossier, { recursive: true });
  tentative.quiz = Object.assign({}, tentative.quiz, { id, page: relatif(q.abs) });
  tentative.enregistre = new Date().toISOString();
  const fichier = path.join(dossier, tentative.id + '.json');
  const tmp = fichier + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(tentative, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, fichier);
  return relatif(fichier);
}

function resume(fichier) {
  try {
    const t = JSON.parse(fs.readFileSync(fichier, 'utf8'));
    const qs = t.questions || [];
    return {
      id: t.id,
      fichier: relatif(fichier),
      statut: t.statut || 'terminee',
      debut: t.debut,
      maj: t.enregistre,
      duree_ms: t.duree_ms,
      mode: t.mode,
      score: t.score,
      nb: qs.length,
      repondues: qs.filter((q) => q.repondue).length,
      position: t.session ? t.session.index : null,
      evaluation: Boolean(t.evaluation && t.evaluation.texte),
      quiz: t.quiz ? { id: t.quiz.id, titre: t.quiz.titre, page: t.quiz.page } : null,
    };
  } catch (e) {
    return null;
  }
}

function listerDossier(dossier) {
  if (!dossier) return [];
  let noms;
  try {
    noms = fs.readdirSync(dossier).filter((n) => n.endsWith('.json'));
  } catch (e) {
    return [];
  }
  return noms
    .map((n) => resume(path.join(dossier, n)))
    .filter(Boolean)
    .sort((a, b) => (a.id < b.id ? 1 : -1));
}

// Tentatives d'un quiz, de la plus récente à la plus ancienne
function lister(page) {
  return listerDossier(dossierTentatives(page).dossier);
}

// Tentatives de tous les quiz d'un cours (« explore/informatique/codage », ou un
// dossier de l'espace du profil)
function listerMatiere(dossierMatiere) {
  const abs = path.resolve(RACINE, String(dossierMatiere));
  if (!abs.startsWith(RACINE)) return [];
  const t = espace.travailDePage(RACINE, path.join(abs, 'generated_quizzes', 'x.html'));
  if (!t.dossier) return [];
  const res = path.join(t.dossier, 'quiz_results');
  let quiz;
  try {
    quiz = fs.readdirSync(res, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch (e) {
    return [];
  }
  return quiz.flatMap((d) => listerDossier(path.join(res, d.name))).sort((a, b) => (a.id < b.id ? 1 : -1));
}

function cheminArchive(fichierRelatif) {
  const abs = depuisUrl('/' + String(fichierRelatif));
  if (!abs || !abs.includes(path.sep + 'quiz_results' + path.sep) || !abs.endsWith('.json')) {
    throw new Error('Chemin invalide.');
  }
  return abs;
}

// Tentative complète (pour la reprise, l'évaluation, la génération)
function lire(fichierRelatif) {
  return JSON.parse(fs.readFileSync(cheminArchive(fichierRelatif), 'utf8'));
}

// Supprime une tentative (abandon d'un quiz en cours sans réponse)
function supprimer(page, id) {
  if (!MOTIF_ID.test(String(id))) throw new Error('Identifiant de tentative invalide.');
  const d = dossierTentatives(page).dossier;
  if (!d) return;
  const f = path.join(d, id + '.json');
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

module.exports = { enregistrer, lister, listerMatiere, lire, supprimer, idQuiz };
