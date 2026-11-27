'use strict';
// Soumissions reçues, chez l'administrateur (_outils/ula/lib/admin.js) : analyse par l'IA
// choisie (sans relais), verdict envoyé au service, décisions et blocage. Le service de
// soumission est simulé (fetch), comme l'IA.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const admin = require('../../_outils/ula/lib/admin.js');
const zip = require('../../_outils/ula/lib/zip.js');

const ID = '20261127-0a1b2c3d';
process.env.ULA_SOUMISSIONS_URL = 'https://service.essai';

function bac() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ula-admin-'));
  test.after(() => fs.rmSync(d, { recursive: true, force: true }));
  const archive = path.join(d, 'source.zip');
  const fiche = { id: 'cours-essai', titre: 'Cours essai', domaine: 'informatique' };
  zip.ecrire(archive, [
    { nom: 'ula-cours.json', donnees: Buffer.from(JSON.stringify(fiche)) },
    { nom: 'ula-soumission.json', donnees: Buffer.from(JSON.stringify({ format: 'ula-soumission-1', fiche })) },
    { nom: 'generated_courses/index.html', donnees: Buffer.from('<!doctype html><title>Essai</title><p>Bonjour</p>') },
  ]);
  return { racine: d, octets: fs.readFileSync(archive), fiche };
}

// Service simulé : routes d'administration, appels notés
function service(octets, fiche) {
  const appels = [];
  const etat = { etat: 'recue' };
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const corps = init.body ? JSON.parse(init.body) : null;
    appels.push({ methode: init.method || 'GET', chemin: u.pathname, corps, auth: init.headers.Authorization });
    const json = (x, status = 200) => new Response(JSON.stringify(x), { status });
    if (init.headers.Authorization !== 'Bearer jeton-essai') return json({ erreur: 'accès refusé' }, 401);
    if (u.pathname === '/v1/admin/soumissions')
      return json({ soumissions: [{ id: ID, titre: fiche.titre, domaine: fiche.domaine, etat: etat.etat }] });
    if (u.pathname === `/v1/admin/soumissions/${ID}/archive`) return new Response(octets);
    if (u.pathname === `/v1/admin/soumissions/${ID}` && !corps)
      return json({ id: ID, etat: etat.etat, manifeste: { fiche }, historique: [] });
    if (u.pathname === `/v1/admin/soumissions/${ID}`) {
      if (corps.etat) etat.etat = corps.etat;
      return json({ ok: true, etat: etat.etat });
    }
    if (u.pathname === '/v1/admin/bloquer') return json({ ok: true });
    return json({ erreur: 'route inconnue' }, 404);
  };
  return { fetch, appels, etat };
}

const sansPython = { disponibilite: () => ({ python: null }) };
const attendre = async (fn) => {
  for (let i = 0; i < 200 && !fn(); i++) await new Promise((r) => setTimeout(r, 25));
};

test('sans jeton : rien ne part', async () => {
  admin.definirJeton('');
  assert.equal(admin.configure(), false);
  await assert.rejects(admin.lister(os.tmpdir(), ''), /jeton/i);
});

test('jeton refusé par le service', async () => {
  const { racine, octets, fiche } = bac();
  admin.definirJeton('mauvais');
  await assert.rejects(admin.lister(racine, '', { fetch: service(octets, fiche).fetch }), /refusé/);
});

test('analyse : téléchargement, vérifications, IA choisie seule, verdict envoyé', async () => {
  const { racine, octets, fiche } = bac();
  admin.definirJeton('jeton-essai');
  const s = service(octets, fiche);
  let demande = null;
  const claude = {
    lancer(o) {
      demande = o;
      return {
        promesse: Promise.resolve({
          fournisseur: o.fournisseur,
          modele: 'modele-essai',
          texte:
            'Lecture faite.\n```json\n{"recommandation": "corriger", "resume": "Bon début, quiz absents.", "details": ["index.html : pas de quiz"], "note": 6}\n```',
        }),
        arreter() {},
      };
    },
  };
  const r = admin.analyser(racine, [ID], 'gemini', { fetch: s.fetch, claude, executer: sansPython });
  assert.equal(r.ajoutees, 1);
  await attendre(() => !admin.etatAnalyses().file.length);

  assert.equal(demande.fournisseur, 'gemini');
  assert.equal(demande.seul, true, 'pas de relais vers une autre IA');
  assert.equal(demande.autorises, 'Read Grep Glob', 'lecture seule');
  assert.ok(fs.existsSync(path.join(racine, 'soumissions-recues', ID, 'cours', 'generated_courses', 'index.html')));

  const d = await admin.detail(racine, ID, { fetch: s.fetch });
  assert.equal(d.local.analyse.recommandation, 'corriger');
  assert.equal(d.local.analyse.ia, 'gemini');
  assert.equal(d.local.analyse.note, 6);
  assert.equal(d.local.analyse.verifications.find((v) => v.id === 'controle').etat, 'ok');
  assert.equal(d.local.analyse.verifications.find((v) => v.id === 'charte').etat, 'non_faite');

  const envois = s.appels.filter((a) => a.methode === 'POST');
  assert.equal(envois[0].corps.etat, 'analyse');
  assert.equal(envois.at(-1).corps.analyse.recommandation, 'corriger');
});

test('refus : message obligatoire, puis état refusée', async () => {
  const { racine, octets, fiche } = bac();
  admin.definirJeton('jeton-essai');
  const s = service(octets, fiche);
  await assert.rejects(admin.decider(racine, ID, { decision: 'refuser', message: ' ' }, { fetch: s.fetch }), /message/);
  const x = await admin.decider(racine, ID, { decision: 'refuser', message: 'Hors sujet.' }, { fetch: s.fetch });
  assert.equal(x.decision.decision, 'refuser');
  assert.equal(s.etat.etat, 'refusee');
  assert.equal(s.appels.at(-1).corps.message, 'Hors sujet.');
});

test('acceptation hors du dépôt : archive gardée, état acceptée ; blocage', async () => {
  const { racine, octets, fiche } = bac();
  admin.definirJeton('jeton-essai');
  const s = service(octets, fiche);
  const x = await admin.decider(racine, ID, { decision: 'accepter' }, { fetch: s.fetch });
  assert.equal(x.decision.integration.mode, 'archive');
  assert.equal(x.decision.integration.archive, `soumissions-recues/${ID}/cours.zip`);
  assert.equal(s.etat.etat, 'acceptee');
  assert.ok(!('message' in s.appels.at(-1).corps), 'pas de message vide envoyé');
  await admin.bloquer(racine, ID, 'essai', { fetch: s.fetch });
  assert.deepEqual(s.appels.at(-1).corps, { soumission: ID, raison: 'essai' });
  assert.throws(() => admin.dossierDe(racine, '../x'), /inconnue/);
});

test('lecture du verdict de l’IA', () => {
  assert.equal(admin.lireVerdict('rien de lisible'), null);
  assert.equal(admin.lireVerdict('fin : {"recommandation": "accepter", "resume": "ok"}').recommandation, 'accepter');
  assert.equal(admin.lireVerdict('{"recommandation": "publier"}'), null);
});
