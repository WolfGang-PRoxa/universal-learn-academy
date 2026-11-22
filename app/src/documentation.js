'use strict';
/* ==========================================================================
   Documentation intégrée (version 2.6.0) : lecture des pages
   --------------------------------------------------------------------------
   Les pages sont des fichiers Markdown rangés par langue :
     doc/contenu/sommaire.json        ordre et groupe de chaque page
     doc/contenu/<langue>/<id>.md     une page (titre : son premier « # »)
   La fenêtre de la documentation (doc/) les demande par ses canaux doc:… et les
   met en forme elle-même (doc/markdown.js). Une page absente d'une langue est
   prise en français. Seuls les ids du sommaire sont lisibles.
   ========================================================================== */

const fs = require('fs');
const path = require('path');

const DOSSIER = path.join(__dirname, 'doc', 'contenu');
let sommaireBrut = null;
const cache = new Map();

function lireSommaire() {
  if (!sommaireBrut) sommaireBrut = JSON.parse(fs.readFileSync(path.join(DOSSIER, 'sommaire.json'), 'utf8'));
  return sommaireBrut;
}

function fichier(langue, id) {
  const propre = path.join(DOSSIER, langue, id + '.md');
  return fs.existsSync(propre) ? propre : path.join(DOSSIER, 'fr', id + '.md');
}

function texte(langue, id) {
  const cle = langue + '/' + id;
  if (!cache.has(cle)) cache.set(cle, fs.readFileSync(fichier(langue, id), 'utf8').replace(/\r\n/g, '\n'));
  return cache.get(cle);
}

function titre(md) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : '';
}

/** Groupes et pages, titres dans la langue demandée. */
function sommaire(langue) {
  const s = lireSommaire();
  return s.groupes.map((g) => ({
    id: g.id,
    titre: g.titre[langue] || g.titre.fr,
    pages: g.pages.map((id) => ({ id, titre: titre(texte(langue, id)) })),
  }));
}

function connue(id) {
  return lireSommaire().groupes.some((g) => g.pages.includes(id));
}

function page(langue, id) {
  if (!connue(id)) throw new Error('Page inconnue : ' + id);
  return { id, markdown: texte(langue, id) };
}

// Texte sans balisage Markdown, pour la recherche
function brut(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(^|[^\w])_([^_\n]+)_(?![\w])/g, '$1$2')
    .replace(/[#>*|]|^-{3,}$/gm, ' ')
    .replace(/\s+/g, ' ');
}

const sansAccents = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Pages qui contiennent tous les mots cherchés, avec un extrait autour du premier. */
function chercher(langue, requete) {
  const mots = sansAccents(requete)
    .split(/\s+/)
    .filter((m) => m.length > 1);
  if (!mots.length) return [];
  const resultats = [];
  for (const g of sommaire(langue)) {
    for (const p of g.pages) {
      const contenu = brut(texte(langue, p.id));
      const plat = sansAccents(contenu);
      if (!mots.every((m) => plat.includes(m))) continue;
      const i = plat.indexOf(mots[0]);
      const debut = Math.max(0, i - 60);
      const extrait = (debut > 0 ? '…' : '') + contenu.slice(debut, i + 140).trim() + '…';
      // Les titres qui contiennent les mots passent devant
      const score =
        mots.filter((m) => sansAccents(p.titre).includes(m)).length * 100 +
        mots.reduce((n, m) => n + plat.split(m).length - 1, 0);
      resultats.push({ id: p.id, titre: p.titre, groupe: g.titre, extrait, score });
    }
  }
  return resultats.sort((a, b) => b.score - a.score).slice(0, 20);
}

module.exports = { sommaire, page, chercher, DOSSIER };
