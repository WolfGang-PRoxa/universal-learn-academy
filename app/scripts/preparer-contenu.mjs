// Prépare les outils livrés avec l'application : `npm run contenu`.
//
// Depuis la version 2.0.0, les cours ne sont plus dans l'installeur : ils se
// téléchargent depuis le catalogue (scripts/catalogue.mjs). L'application ne livre
// que les outils : les fichiers suivis par git sous _outils/, moins ceux
// qu'écartent les règles (scans, réglages locaux…), copiés dans app/.outils/ avec
// leur chemin (.outils/_outils/…). electron-builder les place dans
// resources/outils/. Un manifeste (.ula-outils.json) donne la taille et
// l'empreinte de chaque fichier : l'application s'en sert pour mettre à jour sa
// copie locale des outils.
//
// Seuls les fichiers suivis par git entrent : un fichier oublié dans le dossier
// (brouillon, export, sauvegarde) ne peut pas se retrouver dans un exécutable.

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
const sortie = path.join(app, '.outils');

function empreinte(fichier) {
  return crypto.createHash('sha256').update(fs.readFileSync(fichier)).digest('hex');
}

// Lien physique quand c'est possible (même disque : instantané, sans place en plus),
// copie sinon.
function placer(source, cible) {
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  try {
    fs.linkSync(source, cible);
  } catch {
    fs.copyFileSync(source, cible);
  }
}

export function preparer({ silencieux = false } = {}) {
  const suivis = execFileSync('git', ['-c', 'core.quotepath=false', 'ls-files', '-z', '--', '_outils'], {
    cwd: racine,
    maxBuffer: 1 << 28,
  })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);

  fs.rmSync(sortie, { recursive: true, force: true });
  fs.rmSync(path.join(app, '.contenu'), { recursive: true, force: true }); // ancien dossier (versions 1.x)
  fs.mkdirSync(sortie, { recursive: true });

  const fichiers = {};
  const ecartes = {};
  let octets = 0;
  for (const chemin of suivis) {
    const regle = regles.exclusion(chemin);
    if (regle) {
      ecartes[regle.raison] = (ecartes[regle.raison] || 0) + 1;
      continue;
    }
    const source = path.join(racine, ...chemin.split('/'));
    if (!fs.existsSync(source)) continue; // supprimé mais pas encore committé
    const taille = fs.statSync(source).size;
    placer(source, path.join(sortie, ...chemin.split('/')));
    fichiers[chemin] = { taille, empreinte: empreinte(source) };
    octets += taille;
  }

  const empreinteOutils = crypto
    .createHash('sha256')
    .update(JSON.stringify(Object.entries(fichiers).sort(([a], [b]) => (a < b ? -1 : 1))))
    .digest('hex');
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: racine }).toString().trim();
  const manifeste = { version: empreinteOutils, commit, cree: new Date().toISOString(), fichiers };
  fs.writeFileSync(path.join(sortie, regles.MANIFESTE), JSON.stringify(manifeste));

  if (!silencieux) {
    console.log(
      `✓ ${Object.keys(fichiers).length} fichiers d’outils (${(octets / 1e6).toFixed(1)} Mo) dans app/.outils`,
    );
    for (const [raison, n] of Object.entries(ecartes)) console.log(`  écartés : ${n} × ${raison}`);
  }
  return manifeste;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) preparer();
