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

/* Packs, cursus et cours de profs (sortes.js) ------------------------------------------ */

function lienVers(ecrire, chemin, cours) {
  ecrire(chemin + '/ula-lien.json', JSON.stringify({ format: 'ula-lien-1', cours }));
}
const catalogue = (ids) => () => Promise.resolve({ cours: ids.map((id) => ({ id, titre: 'Cours ' + id })) });

test('pack : cours du catalogue repris, cours personnel signalé, archive avec ula-pack.json', async () => {
  const { racine, ecrire } = bac();
  lienVers(ecrire, 'alice/L2/Unix', 'unix');
  lienVers(ecrire, 'alice/L2/Web', 'web-statique');
  ecrire('alice/L2/Mon cours/generated_courses/index.html', '<html></html>');
  const a = soumission.apercuListe(racine, 'alice', 'alice/L2', 'pack');
  assert.deepEqual(a.contenu.cours, ['unix', 'web-statique']);
  assert.deepEqual(a.ignores, ['Mon cours']);
  assert.throws(() => soumission.creer(racine, 'alice', { type: 'pack', chemin: 'alice/L2', licence: false }));
  const s = soumission.creer(
    racine,
    'alice',
    { type: 'pack', chemin: 'alice/L2', infos: { titre: 'Ma L2', dossier: 'L2' }, licence: true },
    { catalogue: catalogue(['unix', 'web-statique']) },
  );
  const fin = await attendreFin(racine, s.id);
  assert.equal(fin.etat, 'prete', JSON.stringify(fin.etapes));
  assert.equal(fin.etapes.find((e) => e.id === 'contenu').etat, 'avertissement');
  const noms = zip.lire(path.join(soumission.dossierDe(racine, s.id), 'cours.zip')).map((e) => e.nom);
  assert.deepEqual(noms.sort(), ['ula-pack.json', 'ula-soumission.json']);
  const m = soumission.manifeste(fin);
  assert.equal(m.type, 'pack');
  assert.equal(m.titres.unix, 'Cours unix');
  assert.ok(!JSON.stringify(m).includes('alice'));
});

test('cursus : un pack par sous-dossier ; cours inconnu du catalogue ou réseau coupé : suspendu', async () => {
  const { racine, ecrire } = bac();
  lienVers(ecrire, 'alice/Info/L1/Unix', 'unix');
  lienVers(ecrire, 'alice/Info/L2/Web', 'web-statique');
  const s = soumission.creer(
    racine,
    'alice',
    { type: 'cursus', chemin: 'alice/Info', licence: true },
    { catalogue: catalogue(['unix']) },
  );
  const fin = await attendreFin(racine, s.id);
  assert.equal(fin.contenu.packs.length, 2);
  assert.equal(fin.etat, 'suspendue');
  assert.equal(fin.suspension.raison, 'echec');
  assert.throws(() => soumission.agir(racine, s.id, 'corriger-ia', { claude: {} }));
  soumission.agir(racine, s.id, 'reverifier', { catalogue: () => Promise.reject(new Error('hors ligne')) });
  const encore = await attendreFin(racine, s.id);
  assert.equal(encore.suspension.raison, 'reseau');
});

test('cours de profs : déclarations, brouillon, fichiers filtrés, archive sous sources/', async () => {
  const { racine } = bac();
  const infos = { titre: 'Réseaux', domaine: 'informatique' };
  assert.throws(() => soumission.creer(racine, 'alice', { type: 'sources', infos, declarations: { droits: true } }));
  const s = soumission.creer(racine, 'alice', {
    type: 'sources',
    infos,
    declarations: { droits: true, personnel: true },
  });
  assert.equal(s.etat, 'brouillon');
  const b64 = (t) => Buffer.from(t).toString('base64');
  assert.throws(() => soumission.ajouterFichier(racine, s.id, 'virus.exe', b64('MZ')), /type/);
  soumission.ajouterFichier(racine, s.id, 'CM 1.pdf', b64('%PDF-1.4'));
  const x = soumission.ajouterFichier(racine, s.id, '../CM 1.pdf', b64('%PDF-1.5'));
  assert.deepEqual(
    x.fichiers.map((f) => f.nom),
    ['CM 1 (2).pdf', 'CM 1.pdf'],
  );
  soumission.agir(racine, s.id, 'verifier');
  const fin = await attendreFin(racine, s.id);
  assert.equal(fin.etat, 'prete', JSON.stringify(fin.etapes));
  const noms = zip.lire(path.join(soumission.dossierDe(racine, s.id), 'cours.zip')).map((e) => e.nom);
  assert.deepEqual(noms.sort(), ['sources/CM 1 (2).pdf', 'sources/CM 1.pdf', 'ula-soumission.json']);
  const m = soumission.manifeste(fin);
  assert.equal(m.type, 'sources');
  assert.deepEqual(m.declarations, { droits: true, personnel: true });
  assert.equal(m.licence, undefined);
  assert.throws(() => soumission.ajouterFichier(racine, s.id, 'b.pdf', b64('x')));
});
