'use strict';
/* Déplacement du dossier des données, sans Electron (testé par test/deplacement.test.js).

   Le dossier n'est jamais déplacé d'un coup : il est copié dans un dossier
   temporaire voisin de la cible, la copie est vérifiée (même liste de fichiers et
   de dossiers, mêmes tailles), le dossier temporaire prend le nom de la cible,
   et l'ancien dossier n'est supprimé qu'en dernier. Si une étape échoue avant la
   suppression, la copie partielle est retirée et l'ancien dossier reste intact.

   Sert à deux choses :
   - la migration de la version 2.8.0 : Documents/ULA → dossier local de
     l'application (%LOCALAPPDATA%\Universal Learn Academy\donnees) ;
   - le bouton « Déplacer… » des paramètres, appliqué au démarrage suivant. */

const fs = require('fs');
const path = require('path');

/** Liste triée des entrées d'un dossier : « d chemin », « f chemin taille », « l chemin ». */
function inventaire(racine) {
  const lignes = [];
  const parcourir = (rel) => {
    const abs = path.join(racine, rel);
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isSymbolicLink()) lignes.push('l ' + r);
      else if (e.isDirectory()) {
        lignes.push('d ' + r);
        parcourir(r);
      } else if (e.isFile()) lignes.push('f ' + r + ' ' + fs.statSync(path.join(abs, e.name)).size);
    }
  };
  parcourir('');
  return lignes.sort();
}

/** Compare deux dossiers ; renvoie la première différence, ou null s'ils concordent. */
function difference(source, copie) {
  const a = inventaire(source);
  const b = new Set(inventaire(copie));
  for (const l of a) if (!b.has(l)) return l;
  if (b.size !== a.length) return 'entrées en trop dans la copie';
  return null;
}

function estVide(dossier) {
  try {
    return fs.readdirSync(dossier).length === 0;
  } catch (e) {
    return e.code === 'ENOENT';
  }
}

/** Le dossier est-il un dépôt Git (synchronisation Git) ou un dépôt d'ula (mode dépôt) ? */
function estDepotGit(dossier) {
  return (
    fs.existsSync(path.join(dossier, '.git')) || fs.existsSync(path.join(dossier, '_outils', 'app', 'principal.js'))
  );
}

/** b est-il a, ou un dossier à l'intérieur de a ? */
function dedans(a, b) {
  const r = path.relative(path.resolve(a), path.resolve(b));
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
}

/** Raison pour laquelle on ne peut pas déplacer source vers cible, ou null. */
function empechement(source, cible) {
  if (!source || !fs.existsSync(source)) return 'source-introuvable';
  if (!cible) return 'cible-manquante';
  if (dedans(source, cible)) return 'cible-dans-source';
  if (dedans(cible, source)) return 'source-dans-cible';
  if (!estVide(cible)) return 'cible-non-vide';
  return null;
}

/**
 * Copie source vers cible, vérifie, puis supprime source.
 * Renvoie { ok: true, ancienRestant? } ou { ok: false, raison, message }.
 * ancienRestant : la copie est en place mais l'ancien dossier n'a pas pu être
 * entièrement supprimé (fichier ouvert ailleurs, par exemple).
 */
async function deplacer(source, cible) {
  const raison = empechement(source, cible);
  if (raison) return { ok: false, raison, message: raison };
  const temporaire = cible + '.deplacement-' + process.pid;
  try {
    await fs.promises.rm(temporaire, { recursive: true, force: true });
    await fs.promises.mkdir(path.dirname(cible), { recursive: true });
    await fs.promises.cp(source, temporaire, {
      recursive: true,
      errorOnExist: true,
      force: false,
      preserveTimestamps: true,
      verbatimSymlinks: true,
    });
    const ecart = difference(source, temporaire);
    if (ecart) throw Object.assign(new Error('copie incomplète : ' + ecart), { raison: 'verification' });
    // La cible vide éventuelle (choisie dans les paramètres) laisse la place
    if (fs.existsSync(cible)) await fs.promises.rmdir(cible);
    await fs.promises.rename(temporaire, cible);
  } catch (e) {
    await fs.promises.rm(temporaire, { recursive: true, force: true }).catch(() => {});
    return { ok: false, raison: e.raison || 'copie', message: e.message };
  }
  try {
    await fs.promises.rm(source, { recursive: true, force: true, maxRetries: 3 });
  } catch (e) {
    return { ok: true, ancienRestant: source, message: e.message };
  }
  return { ok: true };
}

/**
 * Migration de la version 2.8.0 : que faire de l'ancien dossier par défaut ?
 *   reglages : { donnees: { dossier }, cours: { mode, dossier } }
 * Renvoie l'action : « rien », « noter » (dépôt Git laissé en place, à noter dans
 * donnees.dossier) ou « deplacer ».
 */
function migrationAFaire(reglages, ancien, nouveau) {
  const r = reglages || {};
  if (r.donnees && r.donnees.dossier) return 'rien';
  if (r.cours && r.cours.mode === 'dossier' && r.cours.dossier) return 'rien';
  if (!ancien || !fs.existsSync(ancien) || path.resolve(ancien) === path.resolve(nouveau)) return 'rien';
  if (estDepotGit(ancien)) return 'noter';
  return 'deplacer';
}

module.exports = { inventaire, difference, estVide, estDepotGit, empechement, deplacer, migrationAFaire };
