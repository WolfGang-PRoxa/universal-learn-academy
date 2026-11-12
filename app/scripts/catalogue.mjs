// Catalogue des cours à la demande : `npm run catalogue` (aperçu dans app/.catalogue),
// puis `npm run catalogue -- --publier`.
//
// Les packs par niveau d'étude (explore/packs/<id>.json : titre, origine, dossier proposé,
// liste ordonnée des cours) sont publiés dans catalogue.json, sans archive à part :
// l'application télécharge les archives des cours du pack.
//
// Chaque cours de explore/<domaine>/<cours>/ devient une archive <cours>.zip, décrite
// dans catalogue.json (id, domaine, titre, niveau, origine, version, taille, nombre de
// fichiers, empreinte SHA-256 de l'archive). Le tout est publié dans la release
// « catalogue » du dépôt public, en préversion : elle n'est jamais « Latest », et les
// mises à jour de l'application (electron-updater) ne la voient pas.
//
// Contenu d'une archive : les fichiers suivis par git du cours, moins ceux qu'écartent
// les règles (_outils/ula/lib/regles.js) ; les fichiers de TP seulement s'ils sont dans
// la liste blanche (tp-fournis.json), tirés de git dans leur version d'origine. Le
// contrôle est bloquant : règles personnelles, empreintes des fichiers de TP, adresse
// électronique de l'identité git dans les fichiers texte.
//
// Packs et cursus se gèrent en ligne de commande : npm run catalogue -- cursus-ajouter,
// pack-ajouter, cursus-ajouter-pack, pack-ajouter-cours, verifier (manifestes.mjs).
//
// Une archive n'est reconstruite et renvoyée que si le contenu du cours a changé
// (« version » : empreinte du contenu) ; catalogue.json est envoyé en dernier.

import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const regles = require('./contenu-regles.cjs');
const zip = require('../../_outils/ula/lib/zip.js');
const { verifierPack, verifierCursus } = require('../../_outils/ula/lib/catalogue.js');
const { DEPOT_PUBLIC } = require('../src/depot.js');

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const racine = path.resolve(app, '..');
const sortie = path.join(app, '.catalogue');
const TAG = 'catalogue';
const depot = `${DEPOT_PUBLIC.proprietaire}/${DEPOT_PUBLIC.nom}`;

function git(args, options = {}) {
  return execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: racine, maxBuffer: 1 << 30, ...options });
}
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TEXTE = /\.(html?|md|js|cjs|mjs|json|txt|css|py|c|h|sh|bat|sql|ipynb|yml|csv|svg)$/i;

/** Adresses et textes qui ne doivent apparaître dans aucun fichier publié. */
export function motifsInterdits() {
  const courriel = (() => { try { return git(['config', 'user.email']).toString().trim(); } catch { return ''; } })();
  return courriel ? [new RegExp(echapper(courriel), 'i')] : [];
}

/**
 * Contrôle d'une liste de fichiers à publier : [{ chemin, donnees }] (chemins relatifs à la
 * racine). Renvoie la liste des problèmes (vide si tout va bien).
 */
export function controler(fichiers, tpFournis, interdits = motifsInterdits()) {
  const problemes = [];
  for (const { chemin, donnees } of fichiers) {
    if (regles.estTP(chemin)) {
      const o = tpFournis[chemin];
      if (!o) problemes.push(`${chemin} : fichier de TP absent de la liste blanche`);
      else if (sha(donnees) !== o.empreinte) problemes.push(`${chemin} : fichier de TP différent de sa version d'origine`);
    }
    const r = regles.exclusion(chemin, { tp: false });
    if (r) problemes.push(`${chemin} : ${r.raison}`);
    if (TEXTE.test(chemin)) {
      const t = donnees.toString('utf8');
      for (const m of interdits) if (m.test(t)) problemes.push(`${chemin} : contient ${m}`);
    }
  }
  return problemes;
}

/** Fichiers publiables d'un cours, avec leur contenu (Buffer). */
export function fichiersDuCours(dossierCours, tpFournis) {
  const suivis = git(['ls-files', '-z', '--', dossierCours]).toString('utf8').split('\0').filter(Boolean);
  const res = [];
  for (const chemin of suivis) {
    if (regles.estTP(chemin)) {
      // Version d'origine tirée de git (liste blanche) ; sinon, écarté avant même le contrôle
      const o = tpFournis[chemin];
      if (!o) continue;
      res.push({ chemin, donnees: git(['cat-file', 'blob', `${o.commit}:${o.source}`]) });
      continue;
    }
    if (regles.exclusion(chemin)) continue;
    const abs = path.join(racine, ...chemin.split('/'));
    if (!fs.existsSync(abs)) continue;
    res.push({ chemin, donnees: fs.readFileSync(abs) });
  }
  return res;
}

/** Cours du catalogue (explore/<d>/<id>/ula-cours.json suivis par git). */
export function coursDuDepot() {
  return git(['ls-files', '--', 'explore/*/*/ula-cours.json']).toString('utf8').trim().split('\n').filter(Boolean).map((f) => {
    const dossier = path.posix.dirname(f);
    const [, domaine, id] = dossier.split('/');
    const fiche = JSON.parse(fs.readFileSync(path.join(racine, f), 'utf8'));
    if (fiche.id !== id) throw new Error(`${f} : id « ${fiche.id} » différent du dossier « ${id} ».`);
    return { dossier, domaine, id, fiche };
  });
}

/** Packs par niveau (explore/packs/<id>.json suivis par git), vérifiés contre les cours. */
export function packsDuDepot(idsCours) {
  const fichiers = git(['ls-files', '--', 'explore/packs/*.json']).toString('utf8').trim().split('\n').filter(Boolean);
  const problemes = [];
  const packs = fichiers.map((f) => {
    const p = JSON.parse(fs.readFileSync(path.join(racine, f), 'utf8'));
    if (path.posix.basename(f, '.json') !== p.id) problemes.push(`${f} : id « ${p.id} » différent du nom du fichier`);
    for (const pb of verifierPack(p, idsCours)) problemes.push(`${f} : ${pb}`);
    return { id: p.id, titre: p.titre, origine: p.origine || '', dossier: p.dossier || '', description: p.description || '', cours: p.cours };
  });
  if (problemes.length) throw new Error(`Packs invalides :\n- ${problemes.join('\n- ')}`);
  return packs;
}

/** Cursus exemples (explore/cursus/<id>.json suivis par git), vérifiés contre les packs. */
export function cursusDuDepot(idsPacks) {
  const fichiers = git(['ls-files', '--', 'explore/cursus/*.json']).toString('utf8').trim().split('\n').filter(Boolean);
  const problemes = [];
  const liste = fichiers.map((f) => {
    const c = JSON.parse(fs.readFileSync(path.join(racine, f), 'utf8'));
    if (path.posix.basename(f, '.json') !== c.id) problemes.push(`${f} : id « ${c.id} » différent du nom du fichier`);
    for (const pb of verifierCursus(c, idsPacks)) problemes.push(`${f} : ${pb}`);
    return { id: c.id, titre: c.titre, origine: c.origine || '', description: c.description || '', packs: c.packs.map((x) => ({ pack: x.pack, dossier: x.dossier })) };
  });
  if (problemes.length) throw new Error(`Cursus invalides :\n- ${problemes.join('\n- ')}`);
  return liste;
}

function catalogueEnLigne() {
  const r = spawnSync('gh', ['release', 'download', TAG, '--repo', depot, '--pattern', 'catalogue.json', '--output', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
}

export function construire({ publier = false } = {}) {
  const modifs = git(['status', '--porcelain', '--', 'explore', 'app/tp-fournis.json']).toString('utf8').trim();
  if (modifs) throw new Error(`Modifications non enregistrées dans explore/ :\n${modifs.split('\n').slice(0, 10).join('\n')}\nLes committer avant de construire le catalogue.`);
  const tpFournis = JSON.parse(fs.readFileSync(path.join(app, 'tp-fournis.json'), 'utf8')).fichiers;
  const interdits = motifsInterdits();
  const enLigne = catalogueEnLigne();
  const publies = new Map(((enLigne && enLigne.cours) || []).map((c) => [c.id, c]));
  fs.mkdirSync(sortie, { recursive: true });

  const entrees = [];
  const aEnvoyer = [];
  const problemes = [];
  for (const c of coursDuDepot()) {
    const fichiers = fichiersDuCours(c.dossier, tpFournis);
    problemes.push(...controler(fichiers, tpFournis, interdits));
    const version = sha(JSON.stringify(fichiers.map((f) => [f.chemin, sha(f.donnees)]).sort())).slice(0, 16);
    const base = {
      id: c.id, domaine: c.domaine, titre: c.fiche.titre, niveau: c.fiche.niveau || '', origine: c.fiche.origine || '',
      teinte: c.fiche.teinte || '', description: c.fiche.description || '', version, fichiers: fichiers.length, archive: `${c.id}.zip`
    };
    const ancien = publies.get(c.id);
    if (ancien && ancien.version === version) {
      entrees.push(Object.assign(base, { taille: ancien.taille, empreinte: ancien.empreinte }));
      console.log(`  = ${c.id} (inchangé)`);
      continue;
    }
    const fichierZip = path.join(sortie, `${c.id}.zip`);
    const prefixe = c.dossier + '/';
    zip.ecrire(fichierZip, fichiers.map((f) => ({ nom: f.chemin.slice(prefixe.length), donnees: f.donnees })));
    const octets = fs.readFileSync(fichierZip);
    entrees.push(Object.assign(base, { taille: octets.length, empreinte: sha(octets) }));
    aEnvoyer.push(fichierZip);
    console.log(`  + ${c.id} : ${fichiers.length} fichiers, ${(octets.length / 1e6).toFixed(1)} Mo${ancien ? ' (nouvelle version)' : ' (nouveau)'}`);
  }
  if (problemes.length) throw new Error(`Catalogue refusé :\n- ${problemes.slice(0, 40).join('\n- ')}${problemes.length > 40 ? `\n… et ${problemes.length - 40} autres` : ''}`);

  const catalogue = {
    format: 'ula-catalogue-1',
    genere: new Date().toISOString(),
    commit: git(['rev-parse', 'HEAD']).toString().trim(),
    cours: entrees.sort((a, b) => a.domaine.localeCompare(b.domaine) || a.id.localeCompare(b.id)),
    packs: packsDuDepot(new Set(entrees.map((e) => e.id))),
  };
  catalogue.cursus = cursusDuDepot(new Set(catalogue.packs.map((p) => p.id)));
  const fichierCatalogue = path.join(sortie, 'catalogue.json');
  fs.writeFileSync(fichierCatalogue, JSON.stringify(catalogue, null, 1) + '\n');
  const total = entrees.reduce((s, e) => s + e.taille, 0);
  console.log(`✓ ${entrees.length} cours (${(total / 1e6).toFixed(0)} Mo), ${catalogue.packs.length} pack(s), ${catalogue.cursus.length} cursus, ${aEnvoyer.length} archive(s) à envoyer, contrôle des données personnelles passé`);

  if (!publier) { console.log('  Aperçu seulement (app/.catalogue) : relancer avec --publier pour envoyer.'); return catalogue; }

  const lancer = (args) => { const r = spawnSync('gh', args, { stdio: 'inherit' }); if (r.status !== 0) throw new Error(`gh ${args.join(' ')} a échoué.`); };
  const existe = spawnSync('gh', ['release', 'view', TAG, '--repo', depot], { stdio: 'ignore' }).status === 0;
  if (!existe) {
    console.log(`▸ Création de la release « ${TAG} » (préversion : jamais « Latest »)`);
    lancer(['release', 'create', TAG, '--repo', depot, '--target', 'main', '--prerelease', '--latest=false', '--title', 'Catalogue des cours',
      '--notes', 'Catalogue des cours d’Universal Learn Academy : `catalogue.json` et une archive par cours, téléchargés à la demande par l’application (accueil › Catalogue en ligne). Mis à jour par `npm run catalogue -- --publier`.']);
  }
  for (let i = 0; i < aEnvoyer.length; i += 5) {
    console.log(`▸ Envoi de ${aEnvoyer.slice(i, i + 5).map((f) => path.basename(f)).join(', ')}`);
    lancer(['release', 'upload', TAG, ...aEnvoyer.slice(i, i + 5), '--repo', depot, '--clobber']);
  }
  // Archives des cours retirés du catalogue
  const ids = new Set(entrees.map((e) => e.archive));
  const assets = JSON.parse(execFileSync('gh', ['release', 'view', TAG, '--repo', depot, '--json', 'assets'], { encoding: 'utf8' })).assets;
  for (const a of assets) if (a.name.endsWith('.zip') && !ids.has(a.name)) lancer(['release', 'delete-asset', TAG, a.name, '--repo', depot, '--yes']);
  console.log('▸ Envoi de catalogue.json');
  lancer(['release', 'upload', TAG, fichierCatalogue, '--repo', depot, '--clobber']);
  // Vérification : chaque archive annoncée est présente, à la bonne taille
  const final = JSON.parse(execFileSync('gh', ['release', 'view', TAG, '--repo', depot, '--json', 'assets,isPrerelease'], { encoding: 'utf8' }));
  const manquants = entrees.filter((e) => !final.assets.some((a) => a.name === e.archive && a.size === e.taille));
  if (manquants.length) throw new Error(`Archives absentes ou incomplètes : ${manquants.map((e) => e.archive).join(', ')}`);
  if (!final.isPrerelease) lancer(['release', 'edit', TAG, '--repo', depot, '--prerelease', '--latest=false']);
  console.log(`✓ Catalogue publié : https://github.com/${depot}/releases/tag/${TAG}`);
  return catalogue;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Packs et cursus exemples : npm run catalogue -- <commande> (voir manifestes.mjs)
  const { COMMANDES, executer } = await import('./manifestes.mjs');
  if (COMMANDES.includes(process.argv[2])) {
    try { process.exit(executer(process.argv[2], process.argv.slice(3))); }
    catch (e) { console.error(`✗ ${e.message}`); process.exit(1); }
  }
  try { construire({ publier: process.argv.includes('--publier') }); }
  catch (e) { console.error(`\n✗ ${e.message}`); process.exit(1); }
}
