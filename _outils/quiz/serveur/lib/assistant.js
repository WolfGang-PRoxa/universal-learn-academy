'use strict';
/* Les demandes à Claude faites depuis les quiz : aide sur une question (ou
   question libre), correction d'une question ouverte, évaluation détaillée
   d'une tentative. Ce module construit les messages à partir du contexte
   envoyé par la page ; les consignes données à Claude sont dans prompts/. */

const fs = require('fs');
const { tr } = require('./langue');
const path = require('path');
const crypto = require('crypto');
const { RACINE, OUTILS, depuisUrl, dansRacine, pageQuiz, dossierLocal } = require('./chemins');
const claude = require('./claude');
const catalogue = require('./catalogue');
const archives = require('./archives');

// Prompt système ; application en anglais : Claude répond en anglais (le quiz et le
// cours restent en français)
function prompt(nom) {
  return (
    fs.readFileSync(path.join(__dirname, '..', 'prompts', nom + '.md'), 'utf8').trim() +
    tr(
      '',
      '\n\nThe student uses the application in English: write your whole answer in English, even though the quiz and the course are in French.',
    )
  );
}

function uuid() {
  return crypto.randomUUID();
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ligne(etiquette, valeur) {
  if (valeur === undefined || valeur === null || valeur === '') return '';
  return etiquette + ' : ' + valeur + '\n';
}

// Extrait de la section de cours visée par un lien « revoir » (relatif à la page du quiz)
function extraitCours(page, lien) {
  if (!lien || /^[a-z]+:/i.test(lien)) return null;
  const q = pageQuiz(page);
  const base = q ? path.dirname(q.abs) : RACINE;
  const [chemin, ancre] = lien.split('#');
  const fichier = chemin.startsWith('/') ? depuisUrl(chemin) : path.resolve(base, decodeURIComponent(chemin));
  if (!fichier || !dansRacine(fichier) || !ancre) return null;
  return catalogue.extraireSection(fichier, ancre, 6000);
}

/* Contexte d'une question, mis en texte ------------------------------------ */

function texteQuestion(q) {
  if (!q) return '';
  let t = '## Question ' + (q.numero || '?') + (q.total ? ' sur ' + q.total : '') + '\n';
  t += ligne('Type', q.type) + ligne('Thème', q.theme) + ligne('Difficulté', q.difficulte ? q.difficulte + '/3' : '');
  t += '\nÉnoncé :\n' + (q.enonce || '') + '\n';
  if (q.details) t += '\n' + q.details + '\n';
  t +=
    '\n' +
    ligne(
      "Réponse actuelle de l'étudiant",
      q.reponse == null || q.reponse === '' ? "(aucune pour l'instant)" : '\n' + q.reponse,
    );
  t += ligne('Corrigée', q.corrigee ? 'oui' : 'non');
  if (q.corrigee && q.score != null) t += ligne('Score obtenu', Math.round(q.score * 100) + ' %');
  t += ligne('Réponse attendue' + (q.corrigee ? '' : ' (ne pas la révéler)'), q.solution ? '\n' + q.solution : '');
  t += ligne('Explication du quiz', q.explication ? '\n' + q.explication : '');
  if (q.indices_vus && q.indices_vus.length)
    t += 'Indices déjà affichés :\n' + q.indices_vus.map((x) => '- ' + x).join('\n') + '\n';
  if (q.revoir) t += ligne('Section du cours liée', q.revoir.texte + ' (' + q.revoir.lien + ')');
  return t;
}

function messageAide(demande) {
  const c = demande.contexte || {};
  let m = '';
  if (!demande.reprendre) {
    m += '# Contexte\n';
    if (c.quiz)
      m +=
        ligne('Quiz', c.quiz.titre) +
        ligne('Matière', [c.quiz.matiere, c.quiz.niveau].filter(Boolean).join(', ')) +
        ligne('Mode', c.mode);
    m += ligne('Page du quiz', demande.page);
    if (c.question) {
      m += '\n' + texteQuestion(c.question);
      const extrait = c.question.revoir && extraitCours(demande.page, c.question.revoir.lien);
      if (extrait)
        m += '\n## Extrait du cours : ' + extrait.titre + ' · ' + extrait.section + '\n' + extrait.texte + '\n';
    }
    if (c.tentative) m += '\n## Tentative en cours\n' + c.tentative + '\n';
    const h = texteHistorique(demande.historique);
    if (h) m += '\n' + h;
    m += "\n# Demande de l'étudiant\n";
  } else if (c.question && demande.majContexte) {
    m += '(État mis à jour de la question)\n' + texteQuestion(c.question) + "\n# Demande de l'étudiant\n";
  }
  return m + String(demande.message || '').slice(0, 8000);
}

// Échanges précédents de la conversation, redonnés à une IA qui prend le relais d'une
// autre (une session ne passe pas d'un outil à l'autre)
function texteHistorique(historique) {
  if (!Array.isArray(historique) || !historique.length) return '';
  const lignes = historique
    .filter((x) => x && (x.role === 'etudiant' || x.role === 'claude') && x.texte)
    .slice(-20)
    .map((x) => (x.role === 'etudiant' ? "### L'étudiant\n" : "### L'assistant\n") + String(x.texte).slice(0, 4000));
  if (!lignes.length) return '';
  return (
    '## Conversation jusqu’ici (tenue par une autre IA, à poursuivre sans la répéter)\n\n' + lignes.join('\n\n') + '\n'
  );
}

/* Aide : conversation reprenable ------------------------------------------------ */

function aide(demande, surEvenement) {
  const session = UUID.test(demande.session || '') ? demande.session : uuid();
  const reprendre = Boolean(demande.reprendre && UUID.test(demande.session || ''));
  const appel = claude.lancer({
    usage: 'aide',
    systeme: prompt('aide'),
    message: messageAide(Object.assign({}, demande, { reprendre })),
    session,
    reprendre,
    fournisseurSession: reprendre ? demande.fournisseur || null : null,
    messageSansReprise: reprendre ? messageAide(Object.assign({}, demande, { reprendre: false })) : undefined,
    outils: 'Read,Grep,Glob',
    dossiers: [RACINE, OUTILS],
    cwd: dossierLocal('conversations'),
    delai: 4 * 60 * 1000,
    surEvenement,
  });
  return { session, appel };
}

/* Correction d'une question ouverte ---------------------------------------------- */

const SCHEMA_CORRECTION = {
  type: 'object',
  properties: {
    note: { type: 'number', enum: [0, 0.5, 1] },
    commentaire: { type: 'string' },
    points_manquants: { type: 'array', items: { type: 'string' } },
  },
  required: ['note', 'commentaire', 'points_manquants'],
};

async function corriger(demande) {
  const q = demande.question || {};
  const message =
    'Question :\n' +
    (q.enonce || '') +
    '\n\nRéponse modèle :\n' +
    (q.solution || '') +
    '\n\nPoints attendus :\n' +
    (q.criteres || []).map((c) => '- ' + c).join('\n') +
    "\n\nRéponse de l'étudiant :\n" +
    (String(demande.reponse || '').trim() || '(vide)');
  const r = await claude.lancer({
    usage: 'correction',
    systeme: prompt('correction'),
    message,
    persistance: false,
    outils: '',
    schema: SCHEMA_CORRECTION,
    cwd: dossierLocal('conversations'),
    delai: 3 * 60 * 1000,
  }).promesse;
  let s = r.structure;
  if (!s) {
    try {
      s = JSON.parse(r.texte);
    } catch (e) {
      throw new Error('Réponse de correction illisible.', { cause: e });
    }
  }
  return { note: s.note, commentaire: s.commentaire, points_manquants: s.points_manquants || [], modele: r.modele };
}

/* Évaluation détaillée d'une tentative ------------------------------------------- */

function duree(ms) {
  if (!ms && ms !== 0) return '?';
  const s = Math.round(ms / 1000);
  return s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + (s % 60) + ' s';
}

function texteTentative(t) {
  const sc = t.score || {};
  let m = ligne('Date', t.debut) + ligne('Mode', t.mode) + ligne('Durée', duree(t.duree_ms));
  m += ligne(
    'Score',
    (sc.pourcent != null ? sc.pourcent + ' %' : '?') +
      (sc.note20 != null ? ' (' + sc.note20 + '/20)' : '') +
      ' : ' +
      (sc.justes || 0) +
      ' justes, ' +
      (sc.partielles || 0) +
      ' partielles, ' +
      (sc.fausses || 0) +
      ' fausses, ' +
      (sc.sans_reponse || 0) +
      ' sans réponse' +
      (sc.a_evaluer ? ', ' + sc.a_evaluer + ' à évaluer' : ''),
  );
  (t.questions || []).forEach((q, i) => {
    m +=
      '\n### Q' +
      (i + 1) +
      ' · ' +
      q.type +
      (q.theme ? ' · ' + q.theme : '') +
      (q.difficulte ? ' · difficulté ' + q.difficulte : '') +
      '\n';
    m += ligne('Score', q.score == null ? 'à évaluer' : Math.round(q.score * 100) + ' %');
    m += ligne('Temps passé', duree(q.duree_ms));
    if (q.indices_total) m += ligne('Indices utilisés', (q.indices_vus || 0) + ' sur ' + q.indices_total);
    if (q.aide && q.aide.length)
      m += ligne(
        "Demandes d'aide à Claude",
        q.aide
          .filter((x) => x.role === 'etudiant')
          .map((x) => '« ' + x.texte.slice(0, 200) + ' »')
          .join(' ; '),
      );
    m += 'Énoncé :\n' + (q.enonce || '') + '\n';
    m += ligne("Réponse de l'étudiant", q.reponse_texte ? '\n' + q.reponse_texte : '(pas de réponse)');
    m += ligne('Réponse attendue', q.attendu_texte ? '\n' + q.attendu_texte : '');
    if (q.correction_claude) m += ligne('Correction', q.correction_claude.commentaire);
  });
  return m;
}

function historique(page, idCourant) {
  let liste;
  try {
    liste = archives
      .lister(page)
      .filter((t) => t.statut === 'terminee' && t.id !== idCourant)
      .slice(0, 5);
  } catch (e) {
    return '';
  }
  if (!liste.length) return 'Aucune tentative précédente sur ce quiz.';
  return liste
    .map(
      (t) =>
        '- ' +
        t.debut +
        ' : ' +
        (t.score ? t.score.pourcent + ' %' : '?') +
        ' (' +
        t.mode +
        ', ' +
        t.nb +
        ' questions)',
    )
    .join('\n');
}

function evaluer(demande, surEvenement) {
  const t = demande.tentative;
  if (!t || !Array.isArray(t.questions)) throw new Error('Tentative manquante.');
  const q = pageQuiz(demande.page);
  const session = uuid();
  let message =
    '# Quiz\n' +
    ligne('Titre', t.quiz && t.quiz.titre) +
    ligne('Matière', t.quiz && [t.quiz.matiere, t.quiz.niveau].filter(Boolean).join(', ')) +
    ligne('Page', demande.page) +
    '\n# Tentative à évaluer\n' +
    texteTentative(t) +
    '\n# Tentatives précédentes\n' +
    historique(demande.page, t.id) +
    '\n';
  if (q)
    message +=
      '\n# Plan des cours de la matière (chemins relatifs à la page du quiz)\n' + catalogue.planCours(q.cours) + '\n';
  message += '\nRédige le bilan détaillé de cette tentative.';
  const appel = claude.lancer({
    usage: 'evaluation',
    systeme: prompt('evaluation'),
    message,
    session,
    outils: 'Read,Grep,Glob',
    dossiers: [RACINE, OUTILS],
    cwd: dossierLocal('conversations'),
    delai: 6 * 60 * 1000,
    surEvenement,
  });
  return { session, appel };
}

module.exports = { aide, corriger, evaluer, texteTentative, prompt };
