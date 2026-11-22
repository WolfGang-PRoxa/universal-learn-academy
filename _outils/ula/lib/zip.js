'use strict';
/* Archives zip, sans dépendance (Node seul) : écriture (catalogue, propositions de
   cours) et lecture (installation d'un cours téléchargé).

   Sous-ensemble du format : méthodes « stockée » (0) et « deflate » (8), noms en
   UTF-8 (bit 11), sans zip64 (moins de 4 Go et de 65 535 fichiers par archive),
   sans chiffrement. Les archives produites s'ouvrent avec l'explorateur de
   Windows, unzip, 7-Zip. */

const fs = require('fs');
const path = require('path');
const { tr } = require('../../quiz/serveur/lib/langue');
const zlib = require('zlib');

// CRC-32 (zlib.crc32 n'existe qu'à partir de Node 22.2)
const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Fichiers déjà compressés : stockés tels quels
const DEJA_COMPRESSES =
  /\.(zip|gz|tgz|bz2|xz|7z|rar|jpe?g|png|gif|webp|mp3|m4a|ogg|mp4|webm|mkv|avi|mov|woff2?|docx|pptx|xlsx|odt|odp|ods|jar|epub)$/i;

function dateDos(d) {
  const annee = Math.max(1980, d.getFullYear());
  return {
    heure: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((annee - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function nomSur(nom) {
  const n = String(nom).replace(/\\/g, '/');
  if (!n || n.startsWith('/') || /^[a-z]:/i.test(n)) return null;
  if (n.split('/').some((s, i, t) => s === '..' || (s === '' && i < t.length - 1))) return null;
  return n;
}

/**
 * Écrit une archive zip.
 * @param {string} sortie  fichier .zip
 * @param {Array<{nom: string, donnees?: Buffer, fichier?: string}>} entrees
 * @returns {{ fichiers: number, octets: number }}
 */
function ecrire(sortie, entrees) {
  if (entrees.length > 65535)
    throw new Error(
      tr(
        'Trop de fichiers pour une archive zip simple (65 535 au plus).',
        'Too many files for a simple zip archive (65,535 at most).',
      ),
    );
  fs.mkdirSync(path.dirname(sortie), { recursive: true });
  const tmp = sortie + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  const centrale = [];
  let position = 0;
  const { heure, date } = dateDos(new Date());
  try {
    for (const e of entrees) {
      const nom = nomSur(e.nom);
      if (!nom) throw new Error(tr("Nom invalide dans l'archive : ", 'Invalid name in the archive: ') + e.nom);
      const brut = e.donnees || fs.readFileSync(e.fichier);
      const crc = crc32(brut);
      let methode = 0,
        donnees = brut;
      if (!DEJA_COMPRESSES.test(nom) && brut.length > 64) {
        const d = zlib.deflateRawSync(brut, { level: 6 });
        if (d.length < brut.length) {
          methode = 8;
          donnees = d;
        }
      }
      if (position + donnees.length > 0xffffffff)
        throw new Error(tr('Archive trop grande (4 Go au plus).', 'Archive too large (4 GB at most).'));
      const n = Buffer.from(nom, 'utf8');
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0x0800, 6);
      local.writeUInt16LE(methode, 8);
      local.writeUInt16LE(heure, 10);
      local.writeUInt16LE(date, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(donnees.length, 18);
      local.writeUInt32LE(brut.length, 22);
      local.writeUInt16LE(n.length, 26);
      local.writeUInt16LE(0, 28);
      fs.writeSync(fd, local);
      fs.writeSync(fd, n);
      fs.writeSync(fd, donnees);
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0);
      c.writeUInt16LE(0x031e, 4); // créé par : Unix, version 3.0
      c.writeUInt16LE(20, 6);
      c.writeUInt16LE(0x0800, 8);
      c.writeUInt16LE(methode, 10);
      c.writeUInt16LE(heure, 12);
      c.writeUInt16LE(date, 14);
      c.writeUInt32LE(crc, 16);
      c.writeUInt32LE(donnees.length, 20);
      c.writeUInt32LE(brut.length, 24);
      c.writeUInt16LE(n.length, 28);
      c.writeUInt32LE(((/\.(sh|py)$/.test(nom) ? 0o100755 : 0o100644) << 16) >>> 0, 38);
      c.writeUInt32LE(position, 42);
      centrale.push(Buffer.concat([c, n]));
      position += local.length + n.length + donnees.length;
    }
    const cd = Buffer.concat(centrale);
    const fin = Buffer.alloc(22);
    fin.writeUInt32LE(0x06054b50, 0);
    fin.writeUInt16LE(entrees.length, 8);
    fin.writeUInt16LE(entrees.length, 10);
    fin.writeUInt32LE(cd.length, 12);
    fin.writeUInt32LE(position, 16);
    fs.writeSync(fd, cd);
    fs.writeSync(fd, fin);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, sortie);
  return { fichiers: entrees.length, octets: fs.statSync(sortie).size };
}

/**
 * Liste et lit une archive zip.
 * @returns {Array<{ nom: string, taille: number, lire: () => Buffer }>}
 */
function lire(archive) {
  const buf = Buffer.isBuffer(archive) ? archive : fs.readFileSync(archive);
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      fin = i;
      break;
    }
  }
  if (fin < 0)
    throw new Error(
      tr(
        'Archive zip illisible (fin de répertoire introuvable).',
        'Unreadable zip archive (end of central directory not found).',
      ),
    );
  const nombre = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  const res = [];
  for (let k = 0; k < nombre; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50)
      throw new Error(tr('Archive zip illisible (répertoire central).', 'Unreadable zip archive (central directory).'));
    const drapeaux = buf.readUInt16LE(p + 8);
    const methode = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const ln = buf.readUInt16LE(p + 28),
      le = buf.readUInt16LE(p + 30),
      lc = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nom = buf.slice(p + 46, p + 46 + ln).toString(drapeaux & 0x0800 ? 'utf8' : 'latin1');
    p += 46 + ln + le + lc;
    if (drapeaux & 1) throw new Error(tr('Archive chiffrée : refusée.', 'Encrypted archive: refused.'));
    if (buf.readUInt32LE(local) !== 0x04034b50)
      throw new Error(tr('Archive zip illisible (en-tête local).', 'Unreadable zip archive (local header).'));
    const debut = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    res.push({
      nom,
      taille: usize,
      dossier: nom.endsWith('/'),
      lire() {
        const brut = buf.slice(debut, debut + csize);
        let d;
        if (methode === 0) d = Buffer.from(brut);
        else if (methode === 8) d = zlib.inflateRawSync(brut);
        else
          throw new Error(
            tr(
              `Méthode de compression non prise en charge (${methode}) : ${nom}`,
              `Unsupported compression method (${methode}): ${nom}`,
            ),
          );
        if (d.length !== usize || crc32(d) !== crc)
          throw new Error(tr("Fichier abîmé dans l'archive : ", 'Damaged file in the archive: ') + nom);
        return d;
      },
    });
  }
  return res;
}

/** Extrait une archive dans un dossier (qui doit être vide ou absent) ; refuse tout chemin qui en sortirait. */
function extraire(archive, cible) {
  const entrees = lire(archive);
  fs.mkdirSync(cible, { recursive: true });
  const base = path.resolve(cible);
  let n = 0;
  for (const e of entrees) {
    const nom = String(e.nom).replace(/\\/g, '/');
    if (nom.split('/').some((s) => s === '..') || nom.startsWith('/') || /^[a-z]:/i.test(nom))
      throw new Error(tr("Chemin refusé dans l'archive : ", 'Path refused in the archive: ') + nom);
    const f = path.resolve(base, ...nom.split('/').filter(Boolean));
    if (!f.startsWith(base + path.sep) && f !== base)
      throw new Error(tr("Chemin refusé dans l'archive : ", 'Path refused in the archive: ') + nom);
    if (e.dossier) {
      fs.mkdirSync(f, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, e.lire());
    n++;
  }
  return n;
}

module.exports = { ecrire, lire, extraire, crc32 };
