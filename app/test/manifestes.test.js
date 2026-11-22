'use strict';
// Manifestes des packs et des cursus exemples du catalogue (_outils/ula/lib/catalogue.js) :
// règles de validation, et manifestes réels du dépôt (explore/packs, explore/cursus).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { verifierPack, verifierCursus, niveauCourt } = require('../../_outils/ula/lib/catalogue.js');

const explore = path.resolve(__dirname, '..', '..', 'explore');
const lire = (dossier) =>
  fs.existsSync(path.join(explore, dossier))
    ? fs
        .readdirSync(path.join(explore, dossier))
        .filter((n) => n.endsWith('.json'))
        .map((n) => ({ fichier: n, contenu: JSON.parse(fs.readFileSync(path.join(explore, dossier, n), 'utf8')) }))
    : [];

const pack = { format: 'ula-pack-1', id: 'licence-1-test', titre: 'Licence 1 test', dossier: 'L1', cours: ['a', 'b'] };

test('un pack valide est accepté', () => {
  assert.deepEqual(verifierPack(pack, new Set(['a', 'b'])), []);
  assert.deepEqual(verifierPack(pack), [], 'sans liste de cours connus, seule la forme est vérifiée');
});

test('un pack invalide est refusé avec la raison', () => {
  assert.ok(verifierPack({ ...pack, format: 'autre' }).includes('format ula-pack-1 attendu'));
  assert.ok(verifierPack({ ...pack, id: 'Avec Espace' }).includes('id invalide'));
  assert.ok(verifierPack({ ...pack, titre: '' }).includes('titre manquant'));
  assert.ok(verifierPack({ ...pack, cours: [] }).includes('liste de cours vide'));
  assert.ok(verifierPack({ ...pack, cours: ['a', 'a'] }).includes('cours en double'));
  assert.ok(verifierPack(pack, new Set(['a'])).includes('cours inconnu : b'));
  assert.ok(verifierPack({ ...pack, dossier: 'L1/../x' }).includes('nom de dossier proposé invalide'));
  assert.ok(verifierPack(null).length >= 4);
});

test('un cursus invalide est refusé avec la raison', () => {
  const cursus = {
    format: 'ula-cursus-1',
    id: 'info',
    titre: 'Info',
    packs: [{ pack: 'licence-1-test', dossier: 'L1' }],
  };
  assert.deepEqual(verifierCursus(cursus, new Set(['licence-1-test'])), []);
  assert.ok(verifierCursus(cursus, new Set()).includes('pack inconnu : licence-1-test'));
  assert.ok(verifierCursus({ ...cursus, packs: [] }).includes('liste de packs vide'));
  assert.ok(verifierCursus({ ...cursus, packs: [{ pack: 'p', dossier: 'a:b' }] }).includes('dossier invalide pour p'));
});

test('niveau court des packs', () => {
  assert.equal(niveauCourt('Licence 1 informatique'), 'L1');
  assert.equal(niveauCourt('  Prépa  '), 'Prépa');
  assert.equal(niveauCourt(undefined), '');
});

test('les manifestes du dépôt sont valides', () => {
  const ids = new Set(
    fs
      .readdirSync(explore, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !['packs', 'cursus'].includes(d.name))
      .flatMap((d) => fs.readdirSync(path.join(explore, d.name), { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name),
  );
  const packs = lire('packs');
  for (const { fichier, contenu } of packs) {
    assert.equal(`${contenu.id}.json`, fichier, 'le fichier porte l’id du pack');
    assert.deepEqual(verifierPack(contenu, ids), [], fichier);
  }
  const idsPacks = new Set(packs.map((p) => p.contenu.id));
  for (const { fichier, contenu } of lire('cursus')) {
    assert.equal(`${contenu.id}.json`, fichier, 'le fichier porte l’id du cursus');
    assert.deepEqual(verifierCursus(contenu, idsPacks), [], fichier);
  }
});
