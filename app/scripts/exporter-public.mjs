// Met à jour le dépôt public (WolfGang-PRoxa/universal-learn-academy) à partir de ce
// dépôt de travail privé : `npm run public` (aperçu), puis `npm run public -- --pousser`.
//
// Le dépôt public ne reçoit que le contenu publiable :
// - le catalogue explore/ (mêmes fichiers que les archives du catalogue : fichiers
//   suivis par git, sans les données personnelles, fichiers de TP de la liste blanche
//   dans leur version d'origine) et ses accueils de domaine ;
// - les outils (_outils/, sans les scans ni les réglages locaux), l'accueil index.html,
//   les lanceurs de la racine ;
// - le code de l'application (app/), sans tp-fournis.json (qui renvoie aux commits
//   privés) ; app/public/README.md comme page d'accueil.
// Jamais les espaces des profils (romain/…). Le contenu est contrôlé (règles
// personnelles, empreinte des fichiers de TP, adresse électronique de l'étudiant)
// avant tout commit.
//
// Le clone du dépôt public est dans ../universal-learn-academy (à côté de ce dépôt) ;
// il est créé au besoin. Options :
//   --pousser        committe et pousse sur main
//   --reinitialiser  premier envoi : un seul commit, sans l'historique précédent du
//                    dépôt public (push forcé) ; à n'utiliser qu'une fois

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { coursDuDepot, fichiersDuCours, controler, motifsInterdits } from './catalogue.mjs';

const require = createRequire(import.meta.url);
const regles = require('./contenu-regles.cjs');
const { DEPOT_PUBLIC } = require('../src/depot.js');

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const racine = path.resolve(app, '..');
const clone = path.resolve(racine, '..', DEPOT_PUBLIC.nom);
const url = `https://github.com/${DEPOT_PUBLIC.proprietaire}/${DEPOT_PUBLIC.nom}.git`;
const options = new Set(process.argv.slice(2));

const RACINE_PUBLIQUE = ['index.html', 'lancer.bat', 'lancer.sh', 'lancer-app.bat', 'lancer-app.sh', 'lancer-jupyter.bat', 'lancer-jupyter.sh', '.gitattributes', '.gitignore'];
const APP_PRIVE = [/^app\/tp-fournis\.json$/, /^app\/public\//];

function git(cwd, args, entree) {
  return execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd, maxBuffer: 1 << 28, input: entree }).toString('utf8');
}
function echec(m) { console.error(`\n✗ ${m}`); process.exit(1); }

/* 1. Contenu publiable --------------------------------------------------------- */
console.log('▸ Préparation du contenu publiable');
const tp = JSON.parse(fs.readFileSync(path.join(app, 'tp-fournis.json'), 'utf8')).fichiers;
const fichiers = new Map();   // chemin public -> Buffer
const suivis = git(racine, ['ls-files', '-z']).split('\0').filter(Boolean);
for (const c of coursDuDepot()) for (const f of fichiersDuCours(c.dossier, tp)) fichiers.set(f.chemin, f.donnees);
for (const c of suivis) {
  const garder = /^explore\/[^/]+\/index\.html$/.test(c) || /^explore\/packs\/[^/]+\.json$/.test(c) || (c.startsWith('_outils/') && !regles.exclusion(c)) || RACINE_PUBLIQUE.includes(c)
    || (c.startsWith('app/') && !APP_PRIVE.some((m) => m.test(c)));
  const abs = path.join(racine, ...c.split('/'));
  if (garder && fs.existsSync(abs)) fichiers.set(c, fs.readFileSync(abs));
}
fichiers.set('README.md', fs.readFileSync(path.join(app, 'public', 'README.md')));

/* 2. Contrôle ------------------------------------------------------------------- */
console.log('▸ Contrôle des données personnelles');
const aControler = [...fichiers].filter(([c]) => !c.startsWith('app/') && !RACINE_PUBLIQUE.includes(c) && c !== 'README.md').map(([chemin, donnees]) => ({ chemin, donnees }));
const problemes = controler(aControler, tp);
const interdits = motifsInterdits();
for (const [c, d] of fichiers) {
  if (!/\.(html|md|js|cjs|mjs|json|txt|css|py|c|h|sh|bat|sql|ipynb|yml)$/i.test(c) || !(c.startsWith('app/') || RACINE_PUBLIQUE.includes(c) || c === 'README.md')) continue;
  for (const m of interdits) if (m.test(d.toString('utf8'))) problemes.push(`${c} : contient ${m}`);
  if (!c.startsWith('app/') && regles.personnel(c, { tp: false, racine: false })) problemes.push(`${c} : ${regles.personnel(c, { tp: false, racine: false }).raison}`);
}
if (problemes.length) echec(`Contenu refusé :\n- ${problemes.join('\n- ')}`);
console.log(`  ✓ ${fichiers.size} fichiers, aucune donnée personnelle`);

/* 3. Copie dans le clone du dépôt public ------------------------------------------ */
if (!fs.existsSync(path.join(clone, '.git'))) {
  console.log(`▸ Clone de ${url} dans ${clone}`);
  execFileSync('git', ['clone', '-q', url, clone], { stdio: 'inherit' });
}
const distant = git(clone, ['remote', 'get-url', 'origin']).trim();
if (distant.replace(/\.git$/, '') !== url.replace(/\.git$/, '')) echec(`${clone} ne pointe pas vers ${url} (${distant}).`);

const reinitialiser = options.has('--reinitialiser');
if (reinitialiser) {
  git(clone, ['checkout', '-q', '--orphan', 'publication']);
} else {
  git(clone, ['fetch', '-q', 'origin']);
  git(clone, ['checkout', '-q', 'main']);
  git(clone, ['reset', '-q', '--hard', 'origin/main']);
}
// Le clone est vidé (sauf .git), puis rempli : un fichier retiré ici disparaît du dépôt public
for (const e of fs.readdirSync(clone)) if (e !== '.git') fs.rmSync(path.join(clone, e), { recursive: true, force: true });
for (const [c, donnees] of fichiers) {
  const cible = path.join(clone, ...c.split('/'));
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, donnees);
}
git(clone, ['add', '-A']);
const etat = git(clone, ['status', '--porcelain']).split('\n').filter(Boolean);
console.log(`▸ ${etat.length} changement(s) dans le dépôt public`);

if (!options.has('--pousser')) {
  console.log('  Aperçu seulement : relancer avec --pousser pour committer et envoyer.');
  process.exit(0);
}
if (!etat.length && !reinitialiser) { console.log('✓ Dépôt public déjà à jour.'); process.exit(0); }

/* 4. Commit et envoi ------------------------------------------------------------- */
const nom = git(racine, ['config', 'user.name']).trim();
const courriel = git(racine, ['config', 'user.email']).trim();
const tete = git(racine, ['rev-parse', '--short', 'HEAD']).trim();
const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
git(clone, ['-c', `user.name=${nom}`, '-c', `user.email=${courriel}`, 'commit', '-q', '-m', `Contenu publiable d’ula au ${date}`]);
if (reinitialiser) {
  git(clone, ['branch', '-M', 'main']);
  execFileSync('git', ['push', '--force', '-u', 'origin', 'main'], { cwd: clone, stdio: 'inherit' });
  // Les anciennes branches et étiquettes du dépôt public disparaissent aussi
  for (const ref of git(clone, ['ls-remote', '--heads', '--tags', 'origin']).split('\n').filter(Boolean).map((l) => l.split('\t')[1])) {
    if (ref !== 'refs/heads/main' && !ref.endsWith('^{}')) execFileSync('git', ['push', 'origin', '--delete', ref], { cwd: clone, stdio: 'inherit' });
  }
} else {
  execFileSync('git', ['push', 'origin', 'main'], { cwd: clone, stdio: 'inherit' });
}
console.log(`✓ Dépôt public à jour (${url}), d'après le commit ${tete} du dépôt de travail.`);
