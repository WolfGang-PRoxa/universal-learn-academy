'use strict';
/* Charge la logique de l'atelier dans Node (vérificateur, tests).
   Lit la liste LOGIQUE de assets/atelier.js et exécute ces modules dans un
   contexte isolé où window.Atelier existe : ils ne touchent pas au DOM. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ATELIER = path.resolve(__dirname, '..');

function modulesLogique() {
  const source = fs.readFileSync(path.join(ATELIER, 'assets', 'atelier.js'), 'utf8');
  const m = source.match(/var LOGIQUE = \[([\s\S]*?)\];/);
  if (!m) throw new Error('Liste LOGIQUE introuvable dans assets/atelier.js');
  return [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
}

function charger() {
  const Atelier = { version: 'node', editeurs: {}, vues: {} };
  const contexte = vm.createContext({
    window: { Atelier },
    console,
    Set,
    Map,
    Math,
    JSON,
    Number,
    String,
    Array,
    Object,
    RegExp,
    Infinity,
    isNaN,
  });
  for (const m of modulesLogique()) {
    const fichier = path.join(ATELIER, 'assets', 'js', m + '.js');
    vm.runInContext(fs.readFileSync(fichier, 'utf8'), contexte, { filename: fichier });
  }
  return Atelier;
}

module.exports = { charger, modulesLogique, ATELIER };
