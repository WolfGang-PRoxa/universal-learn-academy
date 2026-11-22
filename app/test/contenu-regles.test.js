'use strict';
// Règles des données personnelles (scripts/contenu-regles.cjs, qui reprend
// _outils/ula/lib/regles.js) : ce qui ne doit jamais être publié, et ce qui doit l'être.

const test = require('node:test');
const assert = require('node:assert/strict');
const regles = require('../scripts/contenu-regles.cjs');

test('les données personnelles sont reconnues, avec leur raison', () => {
  // racine: false, sinon la règle de l'espace des profils passe avant les autres
  const personnels = {
    'alice/L3/BDD/quiz_results/bd-cours-01/2026-10-01.json': 'tentatives aux quiz',
    'alice/L3/Codage/td_results/td-02.json': 'travail enregistré dans les TD interactifs',
    'explore/informatique/codage/quiz_results/q/1.json': 'tentatives aux quiz',
    'alice/TODO.md': 'suivi personnel',
    '_outils/todo/index.html': 'outil de suivi du développement (TODO), réservé au dépôt ula',
    '_outils/numerisation/scans/td1.pdf': 'scans, avec parfois des réponses manuscrites',
    '_outils/quiz/reglages.json': "réglages locaux de l'outil de quiz",
    'explore/langues/anglais-l3/STUDENT-lesson1.docx': "fiches d'anglais remplies par l'étudiant",
    'CLAUDE.md': 'consignes et réglages de Claude Code',
  };
  for (const [chemin, raison] of Object.entries(personnels)) {
    const r = regles.personnel(chemin, { racine: false });
    assert.ok(r, `${chemin} devrait être personnel`);
    assert.equal(r.raison, raison, chemin);
  }
});

test("l'espace d'un profil n'est jamais publiable", () => {
  for (const chemin of ['alice/ula-profil.json', 'alice/L1/Maths/ula-lien.json', 'bob/Perso/notes.md']) {
    assert.ok(regles.personnel(chemin), chemin);
    assert.ok(regles.exclusion(chemin), chemin);
  }
});

test('le catalogue, les outils et les documents du projet restent publiables', () => {
  const publics = [
    'explore/informatique/codage/generated_courses/cours-01.html',
    'explore/informatique/codage/ula-cours.json',
    'explore/packs/licence-1-informatique.json',
    '_outils/charte/assets/cours.css',
    '_outils/ula/lib/regles.js',
    'index.html',
    'lancer.bat',
    'lancer-app.sh',
    'LICENSE',
    'README.md',
    'README.fr.md',
    'CHANGELOG.md',
    'CHANGELOG.fr.md',
    '.prettierrc.json',
    '.prettierignore',
    'eslint.config.js',
  ];
  for (const chemin of publics) assert.equal(regles.personnel(chemin), null, chemin);
});

test('un fichier de TP du catalogue passe par la liste blanche', () => {
  const tp = 'explore/informatique/programmation-systeme/TP/TP1/sujet.pdf';
  assert.ok(regles.estTP(tp));
  assert.ok(regles.personnel(tp), 'sans la liste blanche, un fichier de TP est écarté');
  assert.equal(regles.personnel(tp, { tp: false }), null, 'un fichier de la liste blanche est accepté');
  assert.ok(!regles.estTP('explore/informatique/programmation-systeme/TD/td1.pdf'));
});

test('les chemins Windows sont normalisés', () => {
  assert.equal(regles.normaliser('.\\explore\\informatique\\x.html'), 'explore/informatique/x.html');
  assert.ok(regles.personnel('alice\\L3\\quiz_results\\a.json'));
});

test('le programme et git sont écartés sans être personnels', () => {
  assert.equal(regles.personnel('app/src/main.js'), null);
  assert.ok(regles.exclusion('app/src/main.js'));
  assert.ok(regles.exclusion('.git/config'));
  assert.ok(regles.exclusion('_outils/quiz/Thumbs.db'));
  assert.equal(regles.exclusion('_outils/quiz/serveur/serveur.js'), null);
});

test('l’option racine: false ignore seulement la règle de l’espace des profils', () => {
  assert.equal(regles.personnel('src/main.js', { racine: false }), null);
  assert.ok(regles.personnel('src/quiz_results/a.json', { racine: false }));
});
