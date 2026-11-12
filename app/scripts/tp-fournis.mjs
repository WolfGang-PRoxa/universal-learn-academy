// Fichiers de TP livrés avec l'application : uniquement les consignes et les fichiers
// d'origine (énoncés, données, fichiers fournis, environnements), jamais le travail
// de l'étudiant.
//
// Les dossiers TP/ mêlent fichiers fournis et travail personnel, et un fichier fourni
// peut avoir été complété depuis. On ne prend donc jamais un fichier de TP dans le
// dossier de travail : la liste blanche app/tp-fournis.json donne, pour chaque
// fichier livré, le commit et le chemin d'où tirer sa **version d'origine** (celle de
// son premier commit ; la dernière pour les lanceurs run.sh et run.bat), avec son
// empreinte. preparer-contenu.mjs l'extrait de git, et
// le contrôle du paquet refuse tout fichier de TP absent de la liste ou différent.
//
//   node scripts/tp-fournis.mjs            régénère app/tp-fournis.json d'après REGLES
//   node scripts/tp-fournis.mjs --resume   affiche ce qui est livré, TP par TP
//
// Les règles ci-dessous disent, TP par TP, ce qui est fourni par l'enseignant (ou
// préparé pour faire tourner le TP). En cas de doute, un fichier n'est PAS livré.

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

// (.gitignore ne sert à rien une fois installé, et electron-builder l'écarterait)
const LANCEURS = /(^|\/)run\.(sh|bat)$/;

// dossier : préfixe (relatif à studies/) ; inclure / exclure : expressions testées sur
// le chemin relatif au dossier. Un fichier doit être inclus et non exclu.
export const REGLES = [
  { dossier: 'L1/prog_shell/TP/', inclure: [/./], raison: 'énoncés et archive d’instructions' },
  { dossier: 'L2/BDD/TP/', inclure: [/\.pdf$/i, /\.sql$/i], raison: 'sujets et script de base du TP 4 (script*.txt à confirmer)' },
  { dossier: 'L2/analyse_algebre/TP/', inclure: [/\.pdf$/i, /\.png$/i, /\.ipynb$/i], raison: 'énoncés, figures, notebooks d’énoncé aux cellules vides' },
  { dossier: 'L2/probabilites_statistiques/TP/', inclure: [/\.csv$/i, /impots_Sarthe2013$/], raison: 'jeux de données (notebooks *_etu à confirmer)' },
  { dossier: 'L2/security/TP/', inclure: [/\.pdf$/i, LANCEURS], exclure: [/__MACOSX\//], raison: 'sujets, corrections de l’enseignant, lanceurs (annexes à confirmer)' },
  { dossier: 'L2/Algo3/TP/TP5/', inclure: [/^run\.(sh|bat)$/], raison: 'lanceurs (projet à confirmer)' },
  { dossier: 'L2/Algo3/TP/TP6/', inclure: [/\.pdf$/i, /^run\.(sh|bat)$/, /\/Fichiers\//, /^classif_.*\.txt$/], raison: 'sujet, fichiers de données, lanceurs (code à confirmer)' },
  { dossier: 'L3/BDD/TP/', inclure: [/\.pdf$/i, /Script_PlateformeJeux\.sql$/, /script_sw7\.sql$/, /^TP4\/script\.sql$/], raison: 'sujets et scripts d’origine' },
  { dossier: 'L3/Codage/TP/', inclure: [/\.pdf$/i, /(^|\/)Makefile(\.\w+)?$/, LANCEURS], raison: 'énoncés, Makefile et lanceurs' },
  { dossier: 'L3/Complexity_&_data_structure/TP/', inclure: [/./], raison: 'sources des notebooks (données, corrections de l’enseignant)' },
  { dossier: 'L3/Genie_logiciel/TP/', inclure: [/./], raison: 'sujets et modèle de compte rendu' },
  { dossier: 'L3/Graph_theory/TP/', inclure: [/./], exclure: [/\.ipynb$/i], raison: 'données et environnement (notebooks : ton travail)' },
  { dossier: 'L3/POO/TP/', inclure: [/\.pdf$/i, /README\.md$/, /Monte-Carlo/], raison: 'sujets (script.txt à confirmer)' },
  { dossier: 'L3/POO_Java/TP/', inclure: [/./], raison: 'sujets' },
  { dossier: 'L3/SE_PS/TP/', inclure: [/^[^/]+\/Documentation\//, /^[^/]+\/(run\.(sh|bat)|Makefile(\.\w+)?)$/], raison: 'documentation de l’enseignant, Makefile et lanceurs (sources à confirmer)' },
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

/** Premier commit où le fichier apparaît à ce chemin. On ne suit pas les renommages :
    `git log --follow` les devine par ressemblance et confond des fichiers voisins
    (un run.bat d'un TP pris pour celui d'un autre). Après un vrai renommage de
    dossier, la version d'origine est donc celle du renommage. */
function origine(chemin) {
  const commits = git(['log', '--diff-filter=A', '--format=%H', '--', chemin]).toString('utf8').trim().split('\n').filter(Boolean);
  return { commit: commits[commits.length - 1], source: chemin };
}

export function generer() {
  const suivis = git(['ls-files', '-z']).toString('utf8').split('\0').filter(Boolean);
  const fichiers = {};
  for (const chemin of suivis) {
    if (!regles.estTP(chemin) || !regle(chemin)) continue;
    // Les autres règles (nom de l'étudiant, fichiers système…) l'emportent toujours
    const autre = regles.exclusion(chemin, { tp: false });
    if (autre) continue;
    // Lanceurs préparés pour faire tourner le TP (run.sh, run.bat, .gitignore) : ils
    // ne contiennent aucun travail de l'étudiant, et leur dernière version corrige
    // les premières ; on livre donc celle du dernier commit.
    const { commit, source } = LANCEURS.test(chemin)
      ? { commit: git(['log', '-1', '--format=%H', '--', chemin]).toString().trim(), source: chemin }
      : origine(chemin);
    const blob = git(['cat-file', 'blob', `${commit}:${source}`]);
    fichiers[chemin] = { commit, source, empreinte: crypto.createHash('sha256').update(blob).digest('hex') };
  }
  const contenu = {
    _lisezmoi: 'Fichiers de TP livrés avec l’application, dans leur version d’origine (commit et chemin d’alors). Généré par `node scripts/tp-fournis.mjs` d’après ses REGLES : ne pas modifier à la main.',
    fichiers,
  };
  fs.writeFileSync(FICHIER, JSON.stringify(contenu, null, 1) + '\n');
  return contenu;
}

function resume(liste) {
  const parTp = {};
  for (const c of Object.keys(liste.fichiers)) {
    const tp = c.split('/').slice(0, 4).join('/');
    parTp[tp] = (parTp[tp] || 0) + 1;
  }
  for (const [tp, n] of Object.entries(parTp)) console.log(`  ${String(n).padStart(4)}  ${tp}`);
  console.log(`✓ ${Object.keys(liste.fichiers).length} fichiers de TP livrés`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--resume')) resume(JSON.parse(fs.readFileSync(FICHIER, 'utf8')));
  else resume(generer());
}
