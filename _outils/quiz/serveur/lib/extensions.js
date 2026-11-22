'use strict';
/* Extensions du serveur local : les autres outils de _outils/ peuvent
   ajouter leurs routes à l'API sans modifier le serveur. Au démarrage,
   chaque fichier _outils/<outil>/serveur/extension.js est chargé. Il exporte :

     module.exports = {
       nom: "atelier",                 // les routes /api/atelier/… lui sont confiées
       api: async (route, req, res, outils) => { … }   // route sans le préfixe ;
                                        // renvoie false si elle n'est pas traitée
     };

   outils donne accès à ce que le serveur sait faire : envoyerJson, erreur,
   lireCorps, relayer (flux de Claude), et aux modules chemins, reglages,
   claude, catalogue, archives, assistant. */

const fs = require('fs');
const path = require('path');
const { OUTILS } = require('./chemins');

let liste = null;

function charger(journal) {
  liste = [];
  let dossiers;

  try {
    dossiers = fs.readdirSync(OUTILS, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch (e) {
    return liste;
  }
  for (const d of dossiers) {
    const f = path.join(OUTILS, d.name, 'serveur', 'extension.js');
    if (!fs.existsSync(f)) continue;
    try {
      const x = require(f);
      if (!x || !x.nom || typeof x.api !== 'function') throw new Error('nom ou api manquant');
      liste.push(x);
      if (journal) journal('Extension chargée : ' + x.nom + ' (' + d.name + ')');
    } catch (e) {
      if (journal) journal('Extension ignorée (' + d.name + ') : ' + e.message);
    }
  }
  return liste;
}

function lister() {
  return liste || charger();
}

// Confie la route à l'extension dont le nom est son premier segment ; true si traitée
async function traiter(route, req, res, outils) {
  const i = route.indexOf('/');
  const nom = i < 0 ? route : route.slice(0, i);
  const x = lister().find((e) => e.nom === nom);
  if (!x) return false;
  const r = await x.api(i < 0 ? '' : route.slice(i + 1), req, res, outils);
  return r !== false;
}

module.exports = { charger, lister, traiter };
