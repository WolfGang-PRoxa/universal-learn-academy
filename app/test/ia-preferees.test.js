'use strict';
// IA préférées : ordre d'essai enregistré dans les réglages de l'outil de quiz
// (_outils/quiz/serveur/lib/reglages.js), et reprise des anciens réglages à une seule IA.
const test = require('node:test');
const assert = require('node:assert');
const { fusion, DEFAUT } = require('../../_outils/quiz/serveur/lib/reglages.js');

test('ordre par défaut : Claude, ChatGPT, Gemini', () => {
  const r = fusion(DEFAUT, {});
  assert.deepStrictEqual(r.ordre, ['claude', 'codex', 'gemini']);
  assert.strictEqual(r.fournisseur, 'claude');
});

test('ancien réglage à une seule IA : elle passe en tête', () => {
  const r = fusion(DEFAUT, { fournisseur: 'gemini' });
  assert.deepStrictEqual(r.ordre, ['gemini', 'claude', 'codex']);
  assert.strictEqual(r.fournisseur, 'gemini');
});

test('ordre enregistré : complété, sans doublons ni IA inconnue, fournisseur = première', () => {
  const r = fusion(DEFAUT, { ordre: ['codex', 'codex', 'mistral', 'gemini'] });
  assert.deepStrictEqual(r.ordre, ['codex', 'gemini', 'claude']);
  assert.strictEqual(r.fournisseur, 'codex');
});

test('choix fait dans un menu : l’IA monte en tête, les autres gardent leur rang', () => {
  const base = fusion(DEFAUT, { ordre: ['gemini', 'claude', 'codex'] });
  const r = fusion(base, { fournisseur: 'codex' });
  assert.deepStrictEqual(r.ordre, ['codex', 'gemini', 'claude']);
});

/* Bascule : les outils sont remplacés par des faux (cache de require), Claude Code est
   introuvable sur la machine de test. */
const path = require('node:path');
const lib = path.join(__dirname, '..', '..', '_outils', 'quiz', 'serveur', 'lib');
function faux(nom, comportement) {
  const fichier = path.join(lib, nom + '.js');
  require.cache[fichier] = {
    id: fichier,
    filename: fichier,
    loaded: true,
    exports: {
      trouver: () => ({ executable: '/faux/' + nom, version: '1.0' }),
      compte: async () => ({ connecte: true }),
      lancer: (options) => ({ promesse: comportement(options), arreter() {} }),
    },
  };
}

test('l’IA suivante prend le relais quand la première échoue avant de répondre', async () => {
  const reglages = require(path.join(lib, 'reglages.js'));
  const lire = reglages.lire;
  reglages.lire = () => fusion(DEFAUT, { ordre: ['codex', 'gemini', 'claude'] });
  faux('codex', async () => {
    throw new Error('quota atteint');
  });
  faux('gemini', async (o) => {
    o.surEvenement({ type: 'debut', modele: 'gemini-test' });
    o.surEvenement({ type: 'texte', texte: 'OK' });
    return { texte: 'OK', modele: 'gemini-test' };
  });
  try {
    const claude = require(path.join(lib, 'claude.js'));
    const evenements = [];
    const r = await claude.lancer({ usage: 'aide', message: 'test', surEvenement: (e) => evenements.push(e) }).promesse;
    assert.strictEqual(r.fournisseur, 'gemini');
    assert.deepStrictEqual(
      r.bascules.map((b) => b.de),
      ['codex'],
    );
    const b = evenements.find((e) => e.type === 'bascule');
    assert.ok(b && b.de === 'codex' && b.vers === 'gemini');
  } finally {
    reglages.lire = lire;
  }
});
