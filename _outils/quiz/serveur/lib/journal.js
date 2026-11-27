'use strict';
/* Journal de génération d'un cours : <cours>/ula-generation.json, dans l'espace du
   profil (jamais dans explore/). Chaque génération faite par une IA depuis
   l'application y laisse une entrée, reprise telle quelle par la soumission du cours
   (_outils/ula/lib/soumission.js) :

     { format: "ula-generation-1",
       generations: [{ fichier, date, fournisseur, modele, effort, dureeMs, cout,
                       demande, ressources: [chemins relatifs à la racine], bascules,
                       outils }] }

   Rien de personnel : aucun chemin absolu (les chemins sont relatifs à la racine des
   données ou au dossier des outils), ni nom de profil, ni conversation. */

const fs = require('fs');
const path = require('path');
const { RACINE, OUTILS, VERSION } = require('./chemins');

const FICHIER = 'ula-generation.json';
const MAX_GENERATIONS = 200;

function lire(dossierCours) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dossierCours, FICHIER), 'utf8'));
    if (j && Array.isArray(j.generations)) return j;
  } catch (e) {
    /* absent ou illisible */
  }
  return { format: 'ula-generation-1', generations: [] };
}

// Chemin lu par l'IA, rendu relatif (outils : « _outils/… ») ; null s'il sort des deux
function relatif(chemin) {
  if (!chemin) return null;
  const brut = String(chemin).replace(/\\/g, '/');
  const abs = path.isAbsolute(brut) ? path.resolve(brut) : path.resolve(RACINE, brut);
  for (const [base, prefixe] of [
    [OUTILS, '_outils/'],
    [RACINE, ''],
  ]) {
    const r = path.relative(base, abs);
    if (r && !r.startsWith('..') && !path.isAbsolute(r)) return prefixe + r.split(path.sep).join('/');
  }
  return null;
}

// Les pages d'un profil sont rangées sous <profil>/… : on garde le chemin depuis le
// cours (sans le nom du profil), ou celui du catalogue
function sansProfil(rel, dossierCours) {
  if (!rel) return null;
  if (rel.startsWith('_outils/') || rel.startsWith('explore/')) return rel;
  const cours = relatif(dossierCours);
  if (cours && (rel === cours || rel.startsWith(cours + '/'))) return rel.slice(cours.length + 1) || '.';
  return null;
}

/** Ressources lues pendant une génération (événements « outil » de lecture). */
function ressources(evenements, dossierCours) {
  const vues = new Set();
  for (const e of evenements) {
    if (!/^(Read|Grep|Glob|read_file|read_many_files|glob|search_file_content|list_directory)$/i.test(e.nom || ''))
      continue;
    const r = sansProfil(relatif(e.detail), dossierCours);
    if (r) vues.add(r);
  }
  return [...vues].sort();
}

function ajouter(dossierCours, entree) {
  const j = lire(dossierCours);
  j.generations.push(Object.assign({ date: new Date().toISOString(), outils: VERSION }, entree));
  if (j.generations.length > MAX_GENERATIONS) j.generations.splice(0, j.generations.length - MAX_GENERATIONS);
  fs.writeFileSync(path.join(dossierCours, FICHIER), JSON.stringify(j, null, 2) + '\n', 'utf8');
  return j;
}

module.exports = { FICHIER, lire, ajouter, ressources, relatif };
