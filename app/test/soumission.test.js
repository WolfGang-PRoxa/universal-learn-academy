'use strict';
// Soumission d'un cours (_outils/ula/lib/soumission.js) : vérification locale étape par
// étape, suspension quand une vérification échoue ou ne peut pas tourner, choix de
// l'utilisateur, et ce qui part (rien de local).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const soumission = require('../../_outils/ula/lib/soumission.js');
const zip = require('../../_outils/ula/lib/zip.js');

const depot = path.resolve(__dirname, '..', '..');

function bac() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ula-soumission-'));
  test.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const ecrire = (c, t) => {
    const f = path.join(d, ...c.split('/'));
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, t);
  };
  ecrire('alice/ula-profil.json', JSON.stringify({ format: 'ula-profil-1', nom: 'alice' }));
  // Une vraie page du catalogue, liens réécrits depuis la racine comme dans un espace de profil
  const source = path.join(depot, 'explore', 'informatique');
  const cours = fs
    .readdirSync(source)
    .find((c) => fs.existsSync(path.join(source, c, 'generated_courses', 'index.html')));
  const base = `explore/informatique/${cours}/generated_courses`;
  const page = fs
    .readFileSync(path.join(depot, base, 'index.html'), 'utf8')
    .replace(
      /((?:href|src)=")(?![a-z]+:|#|\/)([^"]*)(")/gi,
      (m, a, u, b) => a + '/' + path.posix.normalize(base + '/' + u) + b,
    );
  ecrire('alice/Perso/Cours/generated_courses/index.html', page);
  return { racine: d, ecrire };
}

const sansPython = { disponibilite: () => ({ python: null }) };
const attendreFin = (racine, id) =>
  new Promise((resolve) => {
    const t = setInterval(() => {
      const s = soumission.lire(racine, id);
      if (!['verification', 'correction'].includes(s.etat)) {
        clearInterval(t);
        resolve(s);
      }
    }, 50);
  });

test('licence obligatoire', () => {
  const { racine } = bac();
  assert.throws(() => soumission.creer(racine, 'alice', { chemin: 'alice/Perso/Cours', licence: false }));
});

test('sans Python : suspendue (raison python), rien ne part, puis annulée', async () => {
  const { racine } = bac();
  const s = soumission.creer(
    racine,
    'alice',
    { chemin: 'alice/Perso/Cours', infos: { titre: 'Mon cours' }, declare: { outil: 'Claude' }, licence: true },
    { executer: sansPython },
  );
  const fin = await attendreFin(racine, s.id);
  assert.equal(fin.etat, 'suspendue');
  assert.equal(fin.suspension.raison, 'python');
  assert.equal(fin.etapes.find((e) => e.id === 'charte').etat, 'non_faite');
  assert.equal(fin.etapes.find((e) => e.id === 'controle').etat, 'ok');
  assert.ok(!fs.existsSync(path.join(soumission.dossierDe(racine, s.id), 'cours.zip')));
  assert.throws(() => soumission.agir(racine, s.id, 'corriger-ia', { claude: {} }), /Python/);
  const a = soumission.agir(racine, s.id, 'annuler');
  assert.equal(a.etat, 'annulee');
  assert.ok(a.historique.some((h) => h.type === 'suspendue') && a.historique.some((h) => h.type === 'annulee'));
});

test('page avec un chemin local : suspendue (échec), correction par l’IA puis revérification', async () => {
  const { racine, ecrire } = bac();
  ecrire('alice/Perso/Cours/generated_courses/note.html', '<p>Voir C:\\Users\\alice\\notes.txt</p>');
  const s = soumission.creer(racine, 'alice', { chemin: 'alice/Perso/Cours', licence: true }, { executer: sansPython });
  const fin = await attendreFin(racine, s.id);
  assert.equal(fin.suspension.raison, 'echec');
  assert.ok(fin.suspension.problemes.some((p) => /chemin local/.test(p)));
  // Fausse IA : retire le fichier fautif
  const claude = {
    lancer: (o) => {
      assert.match(o.message, /chemin local/);
      fs.rmSync(path.join(racine, 'alice/Perso/Cours/generated_courses/note.html'));
      return { promesse: Promise.resolve({ texte: 'corrigé', fournisseur: 'claude' }), arreter() {} };
    },
  };
  soumission.agir(racine, s.id, 'corriger-ia', { claude, executer: sansPython });
  await new Promise((r) => setTimeout(r, 100));
  const apres = await attendreFin(racine, s.id);
  assert.equal(apres.etapes.find((e) => e.id === 'controle').etat, 'ok');
  assert.ok(apres.historique.some((h) => h.type === 'correction'));
});

test('vérification complète avec Python : prête, archive sans rien de local', { skip: !python() }, async () => {
  const { racine } = bac();
  const s = soumission.creer(racine, 'alice', {
    chemin: 'alice/Perso/Cours',
    infos: { titre: 'Mon cours', domaine: 'informatique' },
    declare: { outil: 'Claude Code', modele: 'opus', duree: '2 h' },
    pseudonyme: 'Lea',
    licence: true,
  });
  const fin = await attendreFin(racine, s.id);
  assert.equal(fin.etat, 'prete', JSON.stringify(fin.etapes, null, 1));
  const archive = path.join(soumission.dossierDe(racine, s.id), 'cours.zip');
  const entrees = zip.lire(archive);
  const noms = entrees.map((e) => e.nom).sort();
  assert.deepEqual(noms, ['generated_courses/index.html', 'ula-cours.json', 'ula-soumission.json']);
  const m = soumission.manifeste(fin);
  const texte = JSON.stringify(m);
  assert.ok(!texte.includes('alice'), 'le nom du profil ne part pas');
  assert.ok(!texte.includes(racine), 'aucun chemin local ne part');
  assert.equal(m.declare.modele, 'opus');
  assert.equal(m.pseudonyme, 'Lea');
});

function python() {
  const { spawnSync } = require('node:child_process');
  return ['python3', 'python'].some((c) => spawnSync(c, ['--version']).status === 0);
}

/* Envoi au service de soumission (_outils/ula/lib/envoi.js), avec un faux service */
const envoi = require('../../_outils/ula/lib/envoi.js');

function prete(racine) {
  const s = soumission.creer(racine, 'alice', { chemin: 'alice/Perso/Cours', licence: true }, { executer: sansPython });
  return attendreFin(racine, s.id).then(() => {
    // Vérification forcée réussie, archive factice
    const x = soumission.lire(racine, s.id);
    x.etat = 'prete';
    soumission.ecrire(racine, x);
    fs.writeFileSync(path.join(soumission.dossierDe(racine, s.id), 'cours.zip'), 'PK');
    return s.id;
  });
}
const reponse = (statut, corps) => async () => new Response(JSON.stringify(corps), { status: statut });

test('envoi réussi : numéro et jeton de suivi gardés, puis état relu', async () => {
  const { racine } = bac();
  const id = await prete(racine);
  let recu = null;
  const s = await envoi.envoyer(racine, id, {
    fetch: async (url, init) => {
      recu = { url, cle: init.headers['X-ULA-Cle'], manifeste: JSON.parse(init.body.get('manifeste')) };
      return reponse(201, { id: '20261127-abcdef01', jeton: 'j', etat: 'recue', historique: [] })();
    },
  });
  assert.equal(s.etat, 'envoyee');
  assert.equal(s.distant.id, '20261127-abcdef01');
  assert.match(recu.cle, /^[0-9a-f]{32}$/);
  assert.ok(!JSON.stringify(recu.manifeste).includes('alice'));
  const a = await envoi.actualiser(racine, id, {
    fetch: reponse(200, {
      etat: 'acceptee',
      message: 'Merci',
      historique: [{ date: '2026-11-28T10:00:00Z', type: 'acceptee', texte: 'Acceptée.' }],
    }),
  });
  assert.equal(a.etat, 'acceptee');
  assert.equal(a.cadre, true);
  assert.ok(a.historique.some((h) => h.type === 'distant-acceptee'));
});

test('refus du contrôle du serveur : suspendue ; réseau coupé : reste prête', async () => {
  const { racine } = bac();
  const id = await prete(racine);
  const r = await envoi.envoyer(racine, id, {
    fetch: reponse(422, { erreur: 'refusée', problemes: ['x.pdf : type'] }),
  });
  assert.equal(r.etat, 'suspendue');
  assert.equal(r.suspension.raison, 'serveur');
  const { racine: r2 } = bac();
  const id3 = await prete(r2);
  const c = await envoi.envoyer(r2, id3, {
    fetch: async () => {
      throw new TypeError('fetch failed');
    },
  });
  assert.equal(c.etat, 'prete');
  assert.ok(c.erreurEnvoi);
});
