// Fichiers de TP publiés dans le catalogue : uniquement les consignes et les fichiers
// d'origine (énoncés, données, fichiers fournis, environnements), jamais le travail
// de l'étudiant.
//
// Le dossier de TP de l'étudiant (romain/<cursus>/<cours>/TP/) mêle fichiers fournis et
// travail personnel, et un fichier fourni peut avoir été complété depuis. On ne publie
// donc jamais un fichier de TP tel qu'il est dans ce dossier : la liste blanche
// app/tp-fournis.json donne, pour chaque fichier publié dans explore/<d>/<cours>/TP/,
// le fichier de travail d'où il vient, le commit et le chemin d'où tirer sa **version
// d'origine** (son premier commit ; le dernier pour les lanceurs run.sh et run.bat),
// et son empreinte. Ce script écrit cette version dans explore/ (git add), et le
// contrôle du catalogue refuse tout fichier de TP absent de la liste ou différent.
//
//   node scripts/tp-fournis.mjs            met à jour explore/…/TP et app/tp-fournis.json d'après REGLES
//   node scripts/tp-fournis.mjs --resume   affiche ce qui est publié, TP par TP
//
// Avant le 12 novembre 2026, les TP étaient dans L1/, L2/, L3/ à la racine : la
// version d'origine d'un fichier de romain/<chemin> se cherche d'abord à <chemin>.
// Les entrées déjà dans la liste gardent leur version d'origine.

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const regles = require('./contenu-regles.cjs');
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const racine = path.resolve(app, '..');
export const FICHIER = path.join(app, 'tp-fournis.json');
const PROFIL = 'romain';

// (.gitignore ne sert à rien une fois publié)
const LANCEURS = /(^|\/)run\.(sh|bat)$/;

// dossier : préfixe du dossier de TP de l'étudiant ; inclure / exclure : expressions
// testées sur le chemin relatif au dossier. Un fichier doit être inclus et non exclu.
// En cas de doute, un fichier n'est PAS publié.
export const REGLES = [
  { dossier: 'romain/L1/prog_shell/TP/', inclure: [/./], raison: 'énoncés et archive d’instructions' },
  { dossier: 'romain/L2/BDD/TP/', inclure: [/\.pdf$/i, /\.sql$/i], raison: 'sujets et script de base du TP 4 (script*.txt à confirmer)' },
  { dossier: 'romain/L2/analyse_algebre/TP/', inclure: [/\.pdf$/i, /\.png$/i, /\.ipynb$/i], raison: 'énoncés, figures, notebooks d’énoncé aux cellules vides' },
  { dossier: 'romain/L2/probabilites_statistiques/TP/', inclure: [/\.csv$/i, /impots_Sarthe2013$/], raison: 'jeux de données (notebooks *_etu à confirmer)' },
  { dossier: 'romain/L2/security/TP/', inclure: [/\.pdf$/i, LANCEURS], exclure: [/__MACOSX\//], raison: 'sujets, corrections de l’enseignant, lanceurs (annexes à confirmer)' },
  { dossier: 'romain/L2/Algo3/TP/TP5/', inclure: [/^run\.(sh|bat)$/], raison: 'lanceurs (projet à confirmer)' },
  { dossier: 'romain/L2/Algo3/TP/TP6/', inclure: [/\.pdf$/i, /^run\.(sh|bat)$/, /\/Fichiers\//, /^classif_.*\.txt$/], raison: 'sujet, fichiers de données, lanceurs (code à confirmer)' },
  { dossier: 'romain/L3/BDD/TP/', inclure: [/\.pdf$/i, /Script_PlateformeJeux\.sql$/, /script_sw7\.sql$/, /^TP4\/script\.sql$/], raison: 'sujets et scripts d’origine' },
  { dossier: 'romain/L3/Codage/TP/', inclure: [/\.pdf$/i, /(^|\/)Makefile(\.\w+)?$/, LANCEURS], raison: 'énoncés, Makefile et lanceurs' },
  { dossier: 'romain/L3/Complexity_&_data_structure/TP/', inclure: [/./], raison: 'sources des notebooks (données, corrections de l’enseignant)' },
  { dossier: 'romain/L3/Genie_logiciel/TP/', inclure: [/./], raison: 'sujets et modèle de compte rendu' },
  { dossier: 'romain/L3/Graph_theory/TP/', inclure: [/./], exclure: [/\.ipynb$/i], raison: 'données et environnement (notebooks : ton travail)' },
  { dossier: 'romain/L3/POO/TP/', inclure: [/\.pdf$/i, /README\.md$/, /Monte-Carlo/], raison: 'sujets (script.txt à confirmer)' },
  { dossier: 'romain/L3/POO_Java/TP/', inclure: [/./], raison: 'sujets' },
  { dossier: 'romain/L3/SE_PS/TP/', inclure: [/^[^/]+\/Documentation\//, /^[^/]+\/(run\.(sh|bat)|Makefile(\.\w+)?)$/], raison: 'documentation de l’enseignant, Makefile et lanceurs (sources à confirmer)' },
];

function git(args, options = {}) {
  return execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: racine, maxBuffer: 1 << 28, ...options });
}

export function regle(chemin) {
  const r = REGLES.find((x) => chemin.startsWith(x.dossier));
  if (!r) return null;
  const rel = chemin.slice(r.dossier.length);
  if (!r.inclure.some((m) => m.test(rel))) return null;
  if ((r.exclure || []).some((m) => m.test(rel))) return null;
  return r;
}

/** Dossier du catalogue d'un dossier de cours de l'espace (d'après son ula-lien.json). */
const cacheLiens = new Map();
function coursDuLien(dossierCours) {
  if (cacheLiens.has(dossierCours)) return cacheLiens.get(dossierCours);
  let res = null;
  try {
    const lien = JSON.parse(fs.readFileSync(path.join(racine, dossierCours, 'ula-lien.json'), 'utf8'));
    const fiche = git(['ls-files', '--', `explore/*/${lien.cours}/ula-cours.json`]).toString('utf8').trim().split('\n')[0];
    if (fiche) res = path.posix.dirname(fiche);
  } catch (e) { /* pas un lien */ }
  cacheLiens.set(dossierCours, res);
  return res;
}

/** romain/L2/BDD/TP/TP1/x.pdf -> explore/informatique/bases-de-donnees-1/TP/TP1/x.pdf */
export function cible(chemin) {
  const m = /^(.+?)\/TP\/(.*)$/.exec(chemin);
  if (!m) return null;
  const c = coursDuLien(m[1]);
  return c ? `${c}/TP/${m[2]}` : null;
}

/** Premier commit où le fichier apparaît : d'abord à son ancien chemin (avant la
    réorganisation du 12 novembre 2026), sinon à son chemin actuel. On ne suit pas
    les renommages : `git log --follow` les devine par ressemblance et confond des
    fichiers voisins. */
function origine(chemin) {
  const premier = (c) => {
    const commits = git(['log', '--diff-filter=A', '--format=%H', '--', c]).toString('utf8').trim().split('\n').filter(Boolean);
    return commits.length ? { commit: commits[commits.length - 1], source: c } : null;
  };
  const ancien = chemin.startsWith(PROFIL + '/') ? chemin.slice(PROFIL.length + 1) : null;
  return (ancien && premier(ancien)) || premier(chemin);
}

export function generer() {
  const avant = fs.existsSync(FICHIER) ? JSON.parse(fs.readFileSync(FICHIER, 'utf8')).fichiers : {};
  const suivis = git(['ls-files', '-z', '--', PROFIL]).toString('utf8').split('\0').filter(Boolean);
  const fichiers = {};
  let ecrits = 0;
  for (const chemin of suivis) {
    if (!/\/TP\//.test(chemin) || !regle(chemin)) continue;
    const dest = cible(chemin);
    if (!dest) continue;
    // Les autres règles (nom de l'étudiant, fichiers système…) l'emportent toujours
    if (regles.exclusion(dest, { tp: false })) continue;
    let o = avant[dest];
    if (!o || LANCEURS.test(chemin)) {
      // Lanceurs préparés pour faire tourner le TP : ils ne contiennent aucun travail
      // de l'étudiant, et leur dernière version corrige les premières
      const ref = LANCEURS.test(chemin)
        ? { commit: git(['log', '-1', '--format=%H', '--', chemin]).toString().trim(), source: chemin }
        : origine(chemin);
      const blob = git(['cat-file', 'blob', `${ref.commit}:${ref.source}`]);
      o = { travail: chemin, commit: ref.commit, source: ref.source, empreinte: crypto.createHash('sha256').update(blob).digest('hex') };
    }
    fichiers[dest] = Object.assign({}, o, { travail: chemin });
  }
  // Écriture des versions d'origine dans explore/, retrait de celles qui ne sont plus publiées
  for (const [dest, o] of Object.entries(fichiers)) {
    const abs = path.join(racine, ...dest.split('/'));
    const blob = git(['cat-file', 'blob', `${o.commit}:${o.source}`]);
    if (crypto.createHash('sha256').update(blob).digest('hex') !== o.empreinte) throw new Error(`Empreinte inattendue pour ${dest}`);
    const actuel = fs.existsSync(abs) ? fs.readFileSync(abs) : null;
    if (!actuel || !actuel.equals(blob)) { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, blob); ecrits++; }
  }
  const publies = git(['ls-files', '-z', '--', 'explore']).toString('utf8').split('\0').filter((c) => c && regles.estTP(c));
  const retires = publies.filter((c) => !fichiers[c]);
  if (retires.length) git(['rm', '-q', '--', ...retires]);
  const nouveaux = Object.keys(fichiers);
  for (let i = 0; i < nouveaux.length; i += 200) git(['add', '-f', '--', ...nouveaux.slice(i, i + 200)]);
  const contenu = {
    _lisezmoi: 'Fichiers de TP publiés dans explore/, dans leur version d’origine : « travail » est le fichier du dossier de TP de l’étudiant, « commit » et « source » la version d’origine tirée de git. Généré par `node scripts/tp-fournis.mjs` d’après ses REGLES : ne pas modifier à la main.',
    fichiers: Object.fromEntries(Object.entries(fichiers).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
  fs.writeFileSync(FICHIER, JSON.stringify(contenu, null, 1) + '\n');
  if (ecrits || retires.length) console.log(`  ${ecrits} fichier(s) écrit(s) dans explore/, ${retires.length} retiré(s)`);
  return contenu;
}

function resume(liste) {
  const parTp = {};
  for (const c of Object.keys(liste.fichiers)) {
    const tp = c.split('/').slice(0, 5).join('/');
    parTp[tp] = (parTp[tp] || 0) + 1;
  }
  for (const [tp, n] of Object.entries(parTp)) console.log(`  ${String(n).padStart(4)}  ${tp}`);
  console.log(`✓ ${Object.keys(liste.fichiers).length} fichiers de TP publiés`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--resume')) resume(JSON.parse(fs.readFileSync(FICHIER, 'utf8')));
  else resume(generer());
}
