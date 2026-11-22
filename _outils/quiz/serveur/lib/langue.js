'use strict';
/* Langue des messages du serveur local (erreurs renvoyées aux pages).
   L'application installée annonce sa langue dans l'agent utilisateur des pages
   (« ULA-langue/en ») et, pour ses propres appels, dans l'en-tête X-ULA-Langue.
   Chaque requête s'exécute dans sa langue (AsyncLocalStorage : elle suit les
   await et les travaux lancés par la requête) ; sans l'application (lancer.bat,
   navigateur, scripts), tout reste en français.

   Usage dans une bibliothèque : tr("Texte français.", "English text."). */

const { AsyncLocalStorage } = require('async_hooks');

const LANGUES = ['fr', 'en'];
const stockage = new AsyncLocalStorage();

function depuisRequete(req) {
  const h = (req && req.headers) || {};
  const l = String(
    h['x-ula-langue'] || (String(h['user-agent'] || '').match(/\bULA-langue\/(\w+)/) || [])[1] || '',
  ).toLowerCase();
  return LANGUES.includes(l) ? l : 'fr';
}

/** Exécute fn dans la langue donnée. */
function executer(code, fn) {
  return stockage.run(LANGUES.includes(code) ? code : 'fr', fn);
}

/** Langue en cours : celle de la requête traitée, sinon le français. */
function langue() {
  return stockage.getStore() || 'fr';
}

/** Le texte dans la langue en cours (français par défaut). */
function tr(fr, en) {
  return langue() === 'en' && en !== undefined ? en : fr;
}

module.exports = { LANGUES, depuisRequete, executer, langue, tr };
