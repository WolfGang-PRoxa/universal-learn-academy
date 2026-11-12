// Carte de blocs de l'AppImage en fichier à part (Studies-<version>.AppImage.blockmap).
//
// Pour une AppImage, electron-builder intègre la carte de blocs à la fin du fichier :
// le JSON compressé (deflate brut, « blockMapSize » octets dans latest-linux.yml),
// puis sa taille sur 4 octets. C'est elle qu'electron-updater lit pour les mises à
// jour différentielles. On en publie aussi une copie à part, au même format que
// celle de l'installeur Windows (JSON compressé en gzip).
//
//   node scripts/carte-appimage.mjs dist/Studies-1.0.0.AppImage dist/latest-linux.yml

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

export function extraireCarte(appImage, yml) {
  const texte = fs.readFileSync(yml, 'utf8');
  const taille = Number((texte.match(/blockMapSize:\s*(\d+)/) || [])[1]);
  if (!taille) throw new Error(`${path.basename(yml)} n'indique pas de carte de blocs intégrée (blockMapSize).`);
  const total = fs.statSync(appImage).size;
  const tampon = Buffer.alloc(taille + 4);
  const fd = fs.openSync(appImage, 'r');
  try { fs.readSync(fd, tampon, 0, taille + 4, total - taille - 4); } finally { fs.closeSync(fd); }
  if (tampon.readUInt32BE(taille) !== taille) throw new Error('Taille de la carte de blocs intégrée incohérente.');
  const json = zlib.inflateRawSync(tampon.subarray(0, taille));
  const carte = JSON.parse(json.toString('utf8'));
  if (!Array.isArray(carte.files) || !carte.files.length) throw new Error('Carte de blocs intégrée illisible.');
  const sortie = appImage + '.blockmap';
  const gz = zlib.gzipSync(json, { level: 9 });
  fs.writeFileSync(sortie, gz);
  return { sortie, octets: gz.length, blocs: carte.files.reduce((n, f) => n + f.checksums.length, 0) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [appImage, yml] = process.argv.slice(2);
  const r = extraireCarte(appImage, yml);
  console.log(`✓ ${path.basename(r.sortie)} : ${r.octets} octets, ${r.blocs} blocs`);
}
