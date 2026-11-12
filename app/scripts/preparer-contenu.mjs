// Prépare les cours livrés avec l'application : `npm run contenu`.
//
// Copie dans app/.contenu/ les fichiers suivis par git dans studies/, moins ceux
// qu'écartent les règles de contenu-regles.cjs (données personnelles, programme de
// l'application, fichiers de git). electron-builder les place ensuite dans
// resources/cours/. Un manifeste (.studies-contenu.json) donne la taille et
// l'empreinte de chaque fichier : l'application s'en sert pour mettre à jour la
// copie locale des cours sans toucher au travail de l'utilisateur.
//
// Seuls les fichiers suivis par git entrent : un fichier oublié dans le dossier
// (brouillon, export, sauvegarde) ne peut pas se retrouver dans un exécutable.
// Les dossiers de TP ne sont jamais copiés du dossier de travail : les fichiers
// fournis listés dans tp-fournis.json sont extraits de git dans leur version d'origine.

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
const sortie = path.join(app, '.contenu');

function empreinte(fichier) {
  return crypto.createHash('sha256').update(fs.readFileSync(fichier)).digest('hex');
}

// Lien physique quand c'est possible (même disque : instantané, sans place en plus),
// copie sinon.
function placer(source, cible) {
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  try { fs.linkSync(source, cible); } catch { fs.copyFileSync(source, cible); }
}

export function preparer({ silencieux = false } = {}) {
  const suivis = execFileSync('git', ['ls-files', '-z'], { cwd: racine, maxBuffer: 1 << 28 })
    .toString('utf8').split('\0').filter(Boolean);

  fs.rmSync(sortie, { recursive: true, force: true });
  fs.mkdirSync(sortie, { recursive: true });

  const fichiers = {};
  const ecartes = {};
  let octets = 0;
  for (const chemin of suivis) {
    const regle = regles.exclusion(chemin);
    if (regle) { ecartes[regle.raison] = (ecartes[regle.raison] || 0) + 1; continue; }
    const source = path.join(racine, ...chemin.split('/'));
    if (!fs.existsSync(source)) continue;   // supprimé mais pas encore committé
    const taille = fs.statSync(source).size;
    placer(source, path.join(sortie, ...chemin.split('/')));
    fichiers[chemin] = { taille, empreinte: empreinte(source) };
    octets += taille;
  }

  // Fichiers de TP : version d'origine tirée de git, d'après la liste blanche
  const tp = JSON.parse(fs.readFileSync(path.join(app, 'tp-fournis.json'), 'utf8')).fichiers;
  for (const [chemin, o] of Object.entries(tp)) {
    const contenu = execFileSync('git', ['cat-file', 'blob', `${o.commit}:${o.source}`], { cwd: racine, maxBuffer: 1 << 28 });
    const e = crypto.createHash('sha256').update(contenu).digest('hex');
    if (e !== o.empreinte) throw new Error(`tp-fournis.json : empreinte inattendue pour ${chemin}`);
    const cible = path.join(sortie, ...chemin.split('/'));
    fs.mkdirSync(path.dirname(cible), { recursive: true });
    fs.writeFileSync(cible, contenu);
    fichiers[chemin] = { taille: contenu.length, empreinte: e };
    octets += contenu.length;
  }
  if (!silencieux) console.log(`  dont ${Object.keys(tp).length} fichiers de TP fournis, dans leur version d’origine (tp-fournis.json)`);

  const empreinteContenu = crypto.createHash('sha256')
    .update(JSON.stringify(Object.entries(fichiers).sort(([a], [b]) => (a < b ? -1 : 1))))
    .digest('hex');
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: racine }).toString().trim();
  const manifeste = { version: empreinteContenu, commit, cree: new Date().toISOString(), fichiers };
  fs.writeFileSync(path.join(sortie, regles.MANIFESTE), JSON.stringify(manifeste));

  if (!silencieux) {
    console.log(`✓ ${Object.keys(fichiers).length} fichiers de cours (${(octets / 1e6).toFixed(0)} Mo) dans app/.contenu`);
    for (const [raison, n] of Object.entries(ecartes)) console.log(`  écartés : ${n} × ${raison}`);
  }
  return manifeste;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) preparer();
