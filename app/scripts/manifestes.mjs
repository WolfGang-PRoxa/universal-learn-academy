// Packs et cursus exemples du catalogue : outil du développeur, en ligne de commande.
// L'application ne fait que lire ces manifestes dans catalogue.json : aucune interface ne
// les modifie. Un nouveau pack ou cursus apparaît chez les utilisateurs dès la publication
// du catalogue (`npm run catalogue -- --publier`), sans nouvelle version de l'application.
//
//   npm run catalogue -- cursus-ajouter <id> "<titre>" [--origine "…"] [--description "…"]
//   npm run catalogue -- pack-ajouter <id> "<titre>" [--dossier L1] [--origine "…"] [--description "…"]
//   npm run catalogue -- cursus-ajouter-pack <cursus> <pack> [dossier]
//   npm run catalogue -- pack-ajouter-cours <pack> <cours> [<cours>…]
//   npm run catalogue -- verifier
//
// Manifestes : explore/packs/<id>.json (ula-pack-1) et explore/cursus/<id>.json
// (ula-cursus-1). Chaque commande vérifie les identifiants (cours et packs existants, pas
// de doublon), écrit le manifeste, puis revérifie tout ; le contrôle de publication
// (catalogue.mjs) refait les mêmes vérifications. Ensuite : committer, puis publier.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { verifierPack, verifierCursus } = require('../../_outils/ula/lib/catalogue.js');

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const racine = path.resolve(app, '..');
const EXPLORE = path.join(racine, 'explore');
const ID = /^[a-z0-9][a-z0-9-]{0,80}$/;

export const COMMANDES = ['cursus-ajouter', 'pack-ajouter', 'cursus-ajouter-pack', 'pack-ajouter-cours', 'verifier'];

function lireDossier(nom) {
  const d = path.join(EXPLORE, nom);
  if (!fs.existsSync(d)) return new Map();
  return new Map(
    fs
      .readdirSync(d)
      .filter((n) => n.endsWith('.json'))
      .map((n) => [n.slice(0, -5), JSON.parse(fs.readFileSync(path.join(d, n), 'utf8'))]),
  );
}
function ecrire(nom, objet) {
  const f = path.join(EXPLORE, nom, `${objet.id}.json`);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(objet, null, 2) + '\n');
  return path.relative(racine, f).split(path.sep).join('/');
}
function idsCours() {
  const ids = new Set();
  for (const d of fs.readdirSync(EXPLORE, { withFileTypes: true })) {
    if (!d.isDirectory() || ['packs', 'cursus'].includes(d.name)) continue;
    for (const c of fs.readdirSync(path.join(EXPLORE, d.name), { withFileTypes: true })) {
      if (c.isDirectory() && fs.existsSync(path.join(EXPLORE, d.name, c.name, 'ula-cours.json'))) ids.add(c.name);
    }
  }
  return ids;
}

/** Vérifie tous les manifestes ; renvoie la liste des problèmes. */
export function verifierTout() {
  const cours = idsCours();
  const packs = lireDossier('packs');
  const cursus = lireDossier('cursus');
  const pb = [];
  for (const [n, p] of packs) {
    if (p.id !== n) pb.push(`explore/packs/${n}.json : id « ${p.id} » différent du nom du fichier`);
    for (const x of verifierPack(p, cours)) pb.push(`explore/packs/${n}.json : ${x}`);
  }
  for (const [n, c] of cursus) {
    if (c.id !== n) pb.push(`explore/cursus/${n}.json : id « ${c.id} » différent du nom du fichier`);
    for (const x of verifierCursus(c, new Set(packs.keys()))) pb.push(`explore/cursus/${n}.json : ${x}`);
    const vus = c.packs.map((x) => x.pack);
    if (new Set(vus).size !== vus.length) pb.push(`explore/cursus/${n}.json : pack en double`);
  }
  return pb;
}

function options(args) {
  const o = {},
    reste = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) o[args[i].slice(2)] = args[++i];
    else reste.push(args[i]);
  }
  return { o, reste };
}

export function executer(commande, args) {
  const { o, reste } = options(args);
  const echec = (m) => {
    throw new Error(m);
  };
  let ecrit = null;
  if (commande === 'cursus-ajouter') {
    const [id, titre] = reste;
    if (!ID.test(id || '') || !titre)
      echec('Usage : cursus-ajouter <id> "<titre>" [--origine "…"] [--description "…"]');
    if (lireDossier('cursus').has(id)) echec(`Le cursus ${id} existe déjà.`);
    if (!lireDossier('packs').size) echec('Aucun pack : en créer un d’abord (pack-ajouter).');
    // Un cursus a au moins un pack : il est créé vide puis rempli par cursus-ajouter-pack ;
    // la vérification refuse donc un cursus sans pack à la publication.
    ecrit = ecrire('cursus', {
      format: 'ula-cursus-1',
      id,
      titre,
      origine: o.origine || '',
      description: o.description || '',
      packs: [],
    });
  } else if (commande === 'pack-ajouter') {
    const [id, titre] = reste;
    if (!ID.test(id || '') || !titre)
      echec('Usage : pack-ajouter <id> "<titre>" [--dossier L1] [--origine "…"] [--description "…"]');
    if (lireDossier('packs').has(id)) echec(`Le pack ${id} existe déjà.`);
    ecrit = ecrire('packs', {
      format: 'ula-pack-1',
      id,
      titre,
      origine: o.origine || '',
      dossier: o.dossier || '',
      description: o.description || '',
      cours: [],
    });
  } else if (commande === 'cursus-ajouter-pack') {
    const [idCursus, idPack, dossier] = reste;
    const c = lireDossier('cursus').get(idCursus);
    const p = lireDossier('packs').get(idPack);
    if (!c) echec(`Cursus inconnu : ${idCursus}`);
    if (!p) echec(`Pack inconnu : ${idPack}`);
    if (c.packs.some((x) => x.pack === idPack)) echec(`Le pack ${idPack} est déjà dans le cursus ${idCursus}.`);
    const d = dossier || p.dossier;
    if (!d) echec('Dossier du pack dans le cursus manquant (troisième argument, ou « dossier » du pack).');
    c.packs.push({ pack: idPack, dossier: d });
    ecrit = ecrire('cursus', c);
  } else if (commande === 'pack-ajouter-cours') {
    const [idPack, ...ids] = reste;
    const p = lireDossier('packs').get(idPack);
    if (!p) echec(`Pack inconnu : ${idPack}`);
    if (!ids.length) echec('Usage : pack-ajouter-cours <pack> <cours> [<cours>…]');
    const connus = idsCours();
    for (const id of ids) {
      if (!connus.has(id)) echec(`Cours inconnu : ${id} (aucun explore/<domaine>/${id}/ula-cours.json)`);
      if (p.cours.includes(id)) echec(`Le cours ${id} est déjà dans le pack ${idPack}.`);
    }
    p.cours.push(...ids);
    ecrit = ecrire('packs', p);
  } else if (commande !== 'verifier') {
    echec(`Commande inconnue : ${commande} (${COMMANDES.join(', ')})`);
  }
  if (ecrit) console.log(`✓ ${ecrit}`);
  const pb = verifierTout();
  if (pb.length) {
    console.log(`! ${pb.length} problème(s) à corriger avant de publier :\n- ${pb.join('\n- ')}`);
    return commande === 'verifier' ? 1 : 0;
  }
  console.log(`✓ packs et cursus valides (${lireDossier('packs').size} pack(s), ${lireDossier('cursus').size} cursus)`);
  return 0;
}
