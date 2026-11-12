// Accepte une proposition de cours (« Proposer ce cours » de l'application) et
// l'ajoute au catalogue : `npm run accepter-proposition -- <archive.zip> [options]`.
//
//   --domaine <d>    domaine du catalogue (sinon celui de la fiche du cours)
//   --id <id>        identifiant du cours (sinon celui de la fiche)
//   --remplacer      remplace un cours existant du même identifiant
//   --essai          vérifie seulement, sans rien écrire
//
// L'archive est vérifiée avec les mêmes contrôles que dans l'application
// (_outils/ula/lib/proposition.js) et que le catalogue : seulement des pages
// générées (generated_courses/, generated_quizzes/) et la fiche ula-cours.json, aucun
// fichier personnel, aucun chemin local. Les liens écrits depuis la racine du serveur
// (/_outils/…, /explore/…, /index.html), propres aux pages de l'espace d'un profil,
// deviennent relatifs, comme dans le reste du catalogue. Puis les vérificateurs des
// pages tournent, et les accueils de domaine sont refaits (index_niveau.py).
// Ensuite : relire, committer, puis `npm run catalogue -- --publier`.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const zip = require('../../_outils/ula/lib/zip.js');
const proposition = require('../../_outils/ula/lib/proposition.js');

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const racine = path.resolve(app, '..');
const args = process.argv.slice(2);
const option = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : null; };
const archive = args.find((a, i) => !a.startsWith('--') && !['--domaine', '--id'].includes(args[i - 1]));
function echec(m) { console.error(`\n✗ ${m}`); process.exit(1); }

if (!archive || !fs.existsSync(archive)) echec('Usage : npm run accepter-proposition -- <archive.zip> [--domaine d] [--id id] [--remplacer] [--essai]');

// 1. Extraction dans un dossier temporaire, puis les contrôles de l'application
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ula-proposition-'));
try {
  zip.extraire(archive, temp);
  const fiche = JSON.parse(fs.readFileSync(path.join(temp, 'ula-cours.json'), 'utf8'));
  const autres = fs.readdirSync(temp).filter((n) => !['ula-cours.json', 'generated_courses', 'generated_quizzes'].includes(n));
  if (autres.length) echec(`L'archive contient autre chose que les pages générées : ${autres.join(', ')}`);
  const { problemes, avertissements, fichiers } = proposition.controler(temp, {});
  if (problemes.length) echec(`Proposition refusée :\n- ${problemes.join('\n- ')}`);
  for (const a of avertissements) console.log(`  ! ${a}`);

  const id = option('--id') || fiche.id;
  const domaine = option('--domaine') || fiche.domaine;
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(id)) echec(`Identifiant invalide : ${id}`);
  if (!proposition.DOMAINES.includes(domaine)) echec(`Domaine inconnu : ${domaine} (${proposition.DOMAINES.join(', ')})`);
  const cible = path.join(racine, 'explore', domaine, id);
  const ailleurs = fs.readdirSync(path.join(racine, 'explore')).find((d) => d !== domaine && fs.existsSync(path.join(racine, 'explore', d, id)));
  if (ailleurs) echec(`Un cours « ${id} » existe déjà dans le domaine ${ailleurs} : choisir un autre --id.`);
  if (fs.existsSync(cible) && !args.includes('--remplacer')) echec(`explore/${domaine}/${id} existe déjà : --remplacer pour le remplacer, ou --id pour un autre nom.`);
  console.log(`✓ ${fichiers.length} fichiers contrôlés : « ${fiche.titre} » → explore/${domaine}/${id}`);
  if (args.includes('--essai')) process.exit(0);

  // 2. Liens depuis la racine du serveur -> liens relatifs
  const versRelatif = (fichierRel, lien) => {
    const [chemin, ...suite] = lien.split(/(?=[?#])/);
    const cibleRel = chemin.slice(1);
    const depuis = path.posix.dirname(`explore/${domaine}/${id}/${fichierRel}`);
    return path.posix.relative(depuis, cibleRel) + suite.join('');
  };
  if (fs.existsSync(cible)) fs.rmSync(cible, { recursive: true });
  for (const f of fichiers) {
    const dest = path.join(cible, ...f.nom.split('/'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (/\.html?$/i.test(f.nom)) {
      const t = fs.readFileSync(f.fichier, 'utf8').replace(/(\b(?:href|src)=")(\/(?!\/)[^"]*)(")/g, (m, a, u, b) => a + versRelatif(f.nom, u) + b);
      fs.writeFileSync(dest, t);
    } else fs.copyFileSync(f.fichier, dest);
  }
  fs.writeFileSync(path.join(cible, 'ula-cours.json'), JSON.stringify(Object.assign({}, fiche, { id, domaine }), null, 2) + '\n');

  // 3. Vérificateurs et accueils de domaine
  const lancer = (cmd, a) => spawnSync(cmd, a, { cwd: racine, stdio: 'inherit' }).status === 0;
  const ok = lancer('python', ['_outils/charte/outils/verifier.py', `explore/${domaine}/${id}`])
    & lancer('python', ['_outils/quiz/outils/verifier_quiz.py', `explore/${domaine}/${id}`])
    & lancer(process.execPath, ['_outils/atelier/outils/verifier.js', `explore/${domaine}/${id}`]);
  lancer('python', ['_outils/charte/outils/index_niveau.py']);
  console.log(ok ? `\n✓ Cours ajouté dans explore/${domaine}/${id}. Relire, committer, puis npm run catalogue -- --publier.`
    : `\n! Cours ajouté dans explore/${domaine}/${id}, mais les vérificateurs signalent des erreurs : les corriger avant de committer.`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
