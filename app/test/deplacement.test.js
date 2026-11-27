'use strict';
// Déplacement du dossier des données (src/deplacement.js) : migration de Documents/ULA
// en 2.8.0 et bouton « Déplacer… » des paramètres.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { deplacer, difference, empechement, migrationAFaire, inventaire } = require('../src/deplacement.js');

function bac() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ula-deplacement-'));
  test.after(() => fs.rmSync(d, { recursive: true, force: true }));
  return d;
}

function remplir(racine) {
  const ecrire = (rel, contenu) => {
    const f = path.join(racine, ...rel.split('/'));
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, contenu);
  };
  ecrire('explore/L1/maths/index.html', '<h1>Cours</h1>');
  ecrire('explore/L1/maths/.ula-version.json', '{"v":3}');
  ecrire('alice/L1/maths/progression.json', '{"fait":12}');
  fs.mkdirSync(path.join(racine, 'bob', 'vide'), { recursive: true });
}

test('déplacer copie tout, vérifie, puis supprime la source', async () => {
  const d = bac();
  const source = path.join(d, 'Documents', 'ULA');
  const cible = path.join(d, 'Local', 'Universal Learn Academy', 'donnees');
  remplir(source);
  const avant = inventaire(source);
  const r = await deplacer(source, cible);
  assert.equal(r.ok, true);
  assert.equal(fs.existsSync(source), false);
  assert.deepEqual(inventaire(cible), avant, 'mêmes fichiers, dossiers vides compris, mêmes tailles');
  assert.equal(fs.readFileSync(path.join(cible, 'alice', 'L1', 'maths', 'progression.json'), 'utf8'), '{"fait":12}');
  assert.deepEqual(
    fs.readdirSync(path.dirname(cible)).filter((n) => n.includes('.deplacement-')),
    [],
    'pas de dossier temporaire laissé',
  );
});

test('une cible vide existante est acceptée', async () => {
  const d = bac();
  const source = path.join(d, 'a');
  const cible = path.join(d, 'b');
  remplir(source);
  fs.mkdirSync(cible);
  assert.equal((await deplacer(source, cible)).ok, true);
  assert.ok(fs.existsSync(path.join(cible, 'explore', 'L1', 'maths', 'index.html')));
});

test('une cible non vide est refusée et rien n’est effacé', async () => {
  const d = bac();
  const source = path.join(d, 'a');
  const cible = path.join(d, 'b');
  remplir(source);
  fs.mkdirSync(cible);
  fs.writeFileSync(path.join(cible, 'autre.txt'), 'x');
  const avant = inventaire(source);
  const r = await deplacer(source, cible);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'cible-non-vide');
  assert.deepEqual(inventaire(source), avant);
  assert.deepEqual(fs.readdirSync(cible), ['autre.txt']);
});

async function avecCopieTruquee(truc, fn) {
  const original = fs.promises.cp;
  fs.promises.cp = truc(original);
  try {
    return await fn();
  } finally {
    fs.promises.cp = original;
  }
}

test('un échec de copie ne touche pas à la source et ne laisse rien', async () => {
  const d = bac();
  const source = path.join(d, 'a');
  const cible = path.join(d, 'b');
  remplir(source);
  const avant = inventaire(source);
  const r = await avecCopieTruquee(
    (original) => async (de, vers, options) => {
      await original(de, vers, options);
      throw new Error('disque plein');
    },
    () => deplacer(source, cible),
  );
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'copie');
  assert.deepEqual(inventaire(source), avant);
  assert.deepEqual(fs.readdirSync(d), ['a'], 'ni cible ni dossier temporaire');
});

test('une copie incomplète est détectée : rien n’est effacé', async () => {
  const d = bac();
  const source = path.join(d, 'a');
  const cible = path.join(d, 'b');
  remplir(source);
  const avant = inventaire(source);
  const r = await avecCopieTruquee(
    (original) => async (de, vers, options) => {
      await original(de, vers, options);
      fs.rmSync(path.join(vers, 'alice', 'L1', 'maths', 'progression.json'));
    },
    () => deplacer(source, cible),
  );
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'verification');
  assert.deepEqual(inventaire(source), avant);
  assert.deepEqual(fs.readdirSync(d), ['a']);
});

test('déplacer un dossier dans lui-même (ou l’inverse) est refusé', () => {
  const d = bac();
  const source = path.join(d, 'a');
  remplir(source);
  assert.equal(empechement(source, path.join(source, 'dedans')), 'cible-dans-source');
  assert.equal(empechement(source, source), 'cible-dans-source');
  assert.equal(empechement(source, d), 'source-dans-cible');
  assert.equal(empechement(path.join(d, 'absent'), path.join(d, 'b')), 'source-introuvable');
  assert.equal(empechement(source, path.join(d, 'b')), null);
});

test('la vérification repère un fichier manquant ou de taille différente', () => {
  const d = bac();
  const a = path.join(d, 'a');
  const b = path.join(d, 'b');
  remplir(a);
  remplir(b);
  assert.equal(difference(a, b), null);
  fs.writeFileSync(path.join(b, 'alice', 'L1', 'maths', 'progression.json'), '{}');
  assert.match(difference(a, b), /progression\.json/);
  fs.rmSync(path.join(b, 'explore'), { recursive: true });
  assert.ok(difference(a, b));
});

test('migration 2.8.0 : quand déplacer Documents/ULA', () => {
  const d = bac();
  const ancien = path.join(d, 'Documents', 'ULA');
  const nouveau = path.join(d, 'Local', 'donnees');
  const vide = { donnees: { dossier: '' }, cours: { mode: 'integre', dossier: '' } };

  assert.equal(migrationAFaire(vide, ancien, nouveau), 'rien', 'pas d’ancien dossier');
  remplir(ancien);
  assert.equal(migrationAFaire(vide, ancien, nouveau), 'deplacer');
  assert.equal(migrationAFaire({}, ancien, nouveau), 'deplacer', 'réglages absents');
  assert.equal(
    migrationAFaire({ donnees: { dossier: ancien } }, ancien, nouveau),
    'rien',
    'dossier choisi à la main : on n’y touche pas',
  );
  assert.equal(
    migrationAFaire({ donnees: { dossier: '' }, cours: { mode: 'dossier', dossier: 'D:\\cours' } }, ancien, nouveau),
    'rien',
    'ancien réglage « cours » (Studies 1.x)',
  );

  fs.mkdirSync(path.join(ancien, '.git'));
  assert.equal(migrationAFaire(vide, ancien, nouveau), 'noter', 'dépôt Git (synchro) : laissé en place');
  fs.rmSync(path.join(ancien, '.git'), { recursive: true });
  fs.mkdirSync(path.join(ancien, '_outils', 'app'), { recursive: true });
  fs.writeFileSync(path.join(ancien, '_outils', 'app', 'principal.js'), '');
  assert.equal(migrationAFaire(vide, ancien, nouveau), 'noter', 'dépôt d’ula (mode dépôt) : laissé en place');
});
