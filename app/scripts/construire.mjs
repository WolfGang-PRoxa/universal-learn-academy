// Construit les exécutables sans les publier : `npm run dist` (Windows et Linux),
// `npm run dist -- --win` ou `-- --linux` pour un seul.
//
// 1. Prépare les outils (preparer-contenu.mjs) : les cours ne sont plus livrés (catalogue.mjs).
// 2. Windows : installeur NSIS x64, sa carte de blocs (.blockmap) et latest.yml.
// 3. Linux : AppImage x64, latest-linux.yml, et sa carte de blocs mise à part
//    (carte-appimage.mjs). Depuis Windows, l'AppImage se construit dans WSL
//    (construire-linux.sh) ; sous Linux, directement.
// Le contrôle du paquet (apres-empaquetage.cjs) arrête tout si une donnée
// personnelle se trouve dans un paquet.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { preparer } from './preparer-contenu.mjs';
import { extraireCarte } from './carte-appimage.mjs';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(app, 'dist');
const require = createRequire(import.meta.url);

export function fichiersAttendus(version, { win = true, linux = true } = {}) {
  return [
    ...(win ? [`Universal-Learn-Academy-Setup-${version}.exe`, `Universal-Learn-Academy-Setup-${version}.exe.blockmap`, 'latest.yml'] : []),
    ...(linux ? [`Universal-Learn-Academy-${version}.AppImage`, `Universal-Learn-Academy-${version}.AppImage.blockmap`, 'latest-linux.yml'] : []),
  ];
}

function lancer(commande, args, options = {}) {
  const r = spawnSync(commande, args, { cwd: app, stdio: 'inherit', ...options });
  if (r.error) throw new Error(`Impossible de lancer « ${commande} » : ${r.error.message}`);
  if (r.status !== 0) throw new Error(`« ${commande} ${args.join(' ')} » a échoué (code ${r.status}).`);
}

export function construire({ win = true, linux = true } = {}) {
  const version = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8')).version;
  const fichiers = fichiersAttendus(version, { win, linux });
  for (const n of fichiers) fs.rmSync(path.join(dist, n), { force: true });

  console.log('\n▸ Préparation des outils');
  preparer();

  if (win) {
    console.log('\n▸ Installeur Windows');
    if (process.platform !== 'win32') throw new Error('L’installeur Windows se construit sous Windows.');
    lancer(process.execPath, [require.resolve('electron-builder/cli.js'), '--win', '--publish', 'never']);
  }

  if (linux) {
    if (process.platform === 'linux') {
      console.log('\n▸ AppImage Linux');
      lancer(process.execPath, [require.resolve('electron-builder/cli.js'), '--linux', '--publish', 'never']);
    } else if (process.platform === 'win32') {
      console.log('\n▸ AppImage Linux (dans WSL)');
      const chemin = spawnSync('wsl.exe', ['-e', 'wslpath', '-a', app.replace(/\\/g, '/')], { encoding: 'utf8' });
      const appWsl = (chemin.stdout || '').trim();
      if (chemin.status !== 0 || !appWsl) throw new Error('WSL ne répond pas : l’AppImage se construit dans WSL (wsl --install).');
      lancer('wsl.exe', ['-e', 'sh', `${appWsl}/scripts/construire-linux.sh`, appWsl]);
    } else {
      throw new Error('L’AppImage se construit sous Linux ou dans WSL.');
    }
    const carte = extraireCarte(path.join(dist, `Universal-Learn-Academy-${version}.AppImage`), path.join(dist, 'latest-linux.yml'));
    console.log(`  • carte de blocs de l’AppImage  ${path.basename(carte.sortie)}`);
  }

  for (const n of fichiers) {
    if (!fs.existsSync(path.join(dist, n))) throw new Error(`Fichier attendu absent après la construction : dist/${n}`);
  }
  for (const yml of fichiers.filter((n) => n.endsWith('.yml'))) {
    if (!fs.readFileSync(path.join(dist, yml), 'utf8').includes(`version: ${version}`)) throw new Error(`dist/${yml} ne correspond pas à la version ${version}.`);
  }
  console.log(`\n✓ ${fichiers.length} fichiers dans app/dist :\n  ${fichiers.join('\n  ')}`);
  return { version, fichiers, chemins: fichiers.map((n) => path.join(dist, n)) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Set(process.argv.slice(2));
  const seul = args.has('--win') || args.has('--linux');
  try {
    construire({ win: !seul || args.has('--win'), linux: !seul || args.has('--linux') });
  } catch (e) {
    console.error(`\n✗ ${e.message}`);
    process.exit(1);
  }
}
