// Publie une version d’Universal Learn Academy : `npm run release` (depuis app/, sur le PC Windows).
//
// Sur le modèle de CV Studio :
// 1. Vérifie le dépôt : branche main, aucune modification, à jour avec GitHub, GitHub
//    CLI connectée, version pas encore publiée (sinon : augmenter `version` dans
//    app/package.json). Si la release existe mais qu'il lui manque des fichiers, elle
//    est réparée.
// 2. Construit (construire.mjs) : outils préparés sans les données personnelles,
//    installeur Windows et AppImage Linux (dans WSL), chacun avec sa carte de blocs
//    et son latest*.yml. Le contrôle du paquet fait échouer la construction si une
//    donnée personnelle s'y trouve.
// Les releases sont publiées dans le dépôt public (build.publish), dont main doit
// d’abord être à jour : npm run public -- --pousser.
// 3. Publie avec la GitHub CLI : release créée en brouillon, les six fichiers y sont
//    envoyés, puis elle est publiée et marquée « Latest » ; les applications
//    installées ne voient donc jamais une release incomplète.
// 4. Relit la release et vérifie la présence et la taille de chaque fichier.
//
// Option : --brouillon (laisse la release en brouillon, invisible des mises à jour).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { construire, fichiersAttendus } from './construire.mjs';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const racine = path.resolve(app, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
const version = pkg.version;
const tag = `v${version}`;
const { owner, repo } = pkg.build.publish[0];
const depot = `${owner}/${repo}`;
const brouillon = process.argv.includes('--brouillon');
const fichiers = fichiersAttendus(version);

function echec(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function lancer(commande, args, { capture = false, toleree = false, cwd = app } = {}) {
  const r = spawnSync(commande, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (r.error) echec(`Impossible de lancer « ${commande} » : ${r.error.message}`);
  if (r.status !== 0 && !toleree)
    echec(`« ${commande} ${args.join(' ')} » a échoué.${capture && r.stderr ? `\n${r.stderr.trim()}` : ''}`);
  return { ok: r.status === 0, sortie: (r.stdout || '').trim() };
}

console.log(`Universal Learn Academy ${version} → ${depot} (${tag})`);

/* 1. Vérifications ---------------------------------------------------------- */
console.log('\n▸ Vérification du dépôt');
if (process.platform !== 'win32')
  echec('La publication se fait depuis Windows (installeur NSIS, puis AppImage dans WSL).');
if (!lancer('gh', ['auth', 'status'], { capture: true, toleree: true }).ok)
  echec('GitHub CLI n’est pas connectée : lancer `gh auth login`.');
const branche = lancer('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { capture: true, cwd: racine }).sortie;
if (branche !== 'main') echec(`Branche actuelle : ${branche}. Publier depuis main.`);
const modifs = lancer('git', ['status', '--porcelain'], { capture: true, cwd: racine }).sortie;
if (modifs)
  echec(
    `Modifications non enregistrées :\n${modifs}\nLes committer (ou les annuler) avant de publier : les outils livrés sont ceux du dernier commit.`,
  );
lancer('git', ['fetch', 'origin', 'main', '--quiet'], { cwd: racine });
const tete = lancer('git', ['rev-parse', 'HEAD'], { capture: true, cwd: racine }).sortie;
const distante = lancer('git', ['rev-parse', 'origin/main'], { capture: true, cwd: racine }).sortie;
if (tete !== distante) {
  const retard = lancer('git', ['rev-list', '--count', 'HEAD..origin/main'], { capture: true, cwd: racine }).sortie;
  const avance = lancer('git', ['rev-list', '--count', 'origin/main..HEAD'], { capture: true, cwd: racine }).sortie;
  if (Number(retard)) echec(`main a ${retard} commit(s) de retard sur GitHub : git pull, puis relancer.`);
  if (Number(avance)) echec(`main a ${avance} commit(s) non envoyé(s) sur GitHub : git push, puis relancer.`);
}

const existante = lancer('gh', ['release', 'view', tag, '--repo', depot, '--json', 'assets,isDraft'], {
  capture: true,
  toleree: true,
});
let reparation = false;
if (existante.ok) {
  const noms = JSON.parse(existante.sortie).assets.map((a) => a.name);
  const manquants = fichiers.filter((n) => !noms.includes(n));
  if (!manquants.length)
    echec(`La version ${version} est déjà publiée et complète. Augmenter \`version\` dans app/package.json.`);
  reparation = true;
  console.log(`La release ${tag} existe mais il lui manque : ${manquants.join(', ')}. Elle va être réparée.`);
}

/* 2. Construction ----------------------------------------------------------- */
let chemins;
try {
  ({ chemins } = construire());
} catch (e) {
  echec(e.message);
}

/* 3. Publication ------------------------------------------------------------ */
const notes = [
  `Universal Learn Academy ${version} : cours, quiz et TD interactifs ; les cours se téléchargent depuis le catalogue, à l’accueil de l’application.`,
  '',
  `- **Windows** : \`Universal-Learn-Academy-Setup-${version}.exe\`. Installation pour l’utilisateur courant, sans droits administrateur. L’application n’est pas signée : SmartScreen demande « Informations complémentaires », puis « Exécuter quand même ».`,
  `- **Linux** : \`Universal-Learn-Academy-${version}.AppImage\`. Le rendre exécutable (\`chmod +x\`), puis le lancer.`,
  '',
  'Les versions suivantes se téléchargent d’elles-mêmes (au démarrage, puis toutes les 6 heures, même fenêtre fermée : l’application reste dans la zone de notification) et s’installent en quittant l’application ; désactivable dans les paramètres. Les fichiers `.blockmap` et `latest*.yml` servent à ces mises à jour.',
].join('\n');

if (reparation) {
  console.log(`\n▸ Envoi des fichiers dans la release existante ${tag}`);
  lancer('gh', ['release', 'upload', tag, ...chemins, '--repo', depot, '--clobber']);
} else {
  console.log(`\n▸ Création de la release ${tag} (brouillon le temps de l’envoi)`);
  lancer('gh', [
    'release',
    'create',
    tag,
    '--repo',
    depot,
    '--target',
    'main',
    '--title',
    `Universal Learn Academy ${version}`,
    '--notes',
    notes,
    '--draft',
  ]);
  lancer('gh', ['release', 'upload', tag, ...chemins, '--repo', depot, '--clobber']);
}
if (!brouillon) lancer('gh', ['release', 'edit', tag, '--repo', depot, '--draft=false', '--latest']);

/* 4. Vérification ----------------------------------------------------------- */
console.log('\n▸ Vérification de la release sur GitHub');
const publiee = JSON.parse(
  lancer('gh', ['release', 'view', tag, '--repo', depot, '--json', 'assets,isDraft,url'], { capture: true }).sortie,
);
const problemes = [];
if (publiee.isDraft && !brouillon) problemes.push('la release est encore un brouillon');
for (const [i, n] of fichiers.entries()) {
  const a = publiee.assets.find((x) => x.name === n);
  const taille = fs.statSync(chemins[i]).size;
  if (!a) problemes.push(`${n} absent`);
  else if (a.size !== taille) problemes.push(`${n} incomplet (${a.size} octets sur ${taille})`);
  else console.log(`  ✓ ${n}`);
}
if (problemes.length)
  echec(`Release incomplète : ${problemes.join(', ')}.\nRelancer \`npm run release\` : elle sera réparée.`);
console.log(`\n✓ Universal Learn Academy ${version} publiée : ${publiee.url}`);
