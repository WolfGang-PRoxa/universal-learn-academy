'use strict';
/* Contrôle d'un paquet construit : aucune donnée personnelle, aucun cours.

   Appelé par electron-builder après l'empaquetage (apres-empaquetage.cjs), avant
   la création de l'installeur ou de l'AppImage : une erreur arrête la construction.
   Aussi lancé par `npm run check -- --paquet` sur les dossiers dist/*-unpacked.

   Depuis la version 2.0.0, les cours ne sont plus livrés : ils se téléchargent
   depuis le catalogue. Le paquet ne contient que le programme (app.asar) et les
   outils (resources/outils/_outils/…), décrits par leur manifeste. On parcourt
   tout ce qui part chez l'utilisateur : outils, app.asar, app.asar.unpacked et
   les autres fichiers de resources. */

const fs = require('fs');
const path = require('path');
const regles = require('./contenu-regles.cjs');

function parcourir(dossier, base = dossier, liste = []) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const complet = path.join(dossier, e.name);
    if (e.isDirectory()) parcourir(complet, base, liste);
    else liste.push(path.relative(base, complet).split(path.sep).join('/'));
  }
  return liste;
}

function listerAsar(fichier) {
  const asar = require('@electron/asar');
  return asar.listPackage(fichier, { isPack: false }).map((c) => c.replace(/\\/g, '/').replace(/^\//, ''));
}

/**
 * @param {string} resources  dossier resources du paquet (…/win-unpacked/resources)
 * @returns {{ problemes: string[], fichiersOutils: number }}
 */
function verifier(resources) {
  const problemes = [];
  const signaler = (ou, chemin, regle) => problemes.push(`${ou}/${chemin} (${regle.raison})`);

  const outils = path.join(resources, 'outils');
  let fichiersOutils = 0;
  if (!fs.existsSync(outils)) {
    problemes.push('resources/outils est absent : lancer `npm run contenu` avant la construction.');
  } else {
    const liste = parcourir(outils);
    for (const chemin of liste) {
      if (chemin === regles.MANIFESTE) continue;
      fichiersOutils++;
      if (!chemin.startsWith('_outils/')) {
        problemes.push(`outils/${chemin} (hors des outils : les cours et les données ne sont jamais livrés)`);
        continue;
      }
      const r = regles.exclusion(chemin);
      if (r) signaler('outils', chemin, r);
    }
    // Le manifeste doit décrire exactement ce qui est livré
    try {
      const manifeste = JSON.parse(fs.readFileSync(path.join(outils, regles.MANIFESTE), 'utf8'));
      const declares = Object.keys(manifeste.fichiers);
      for (const chemin of declares) {
        const r = regles.exclusion(chemin);
        if (r) signaler('manifeste', chemin, r);
      }
      if (declares.length !== fichiersOutils) {
        problemes.push(`Le manifeste annonce ${declares.length} fichiers, le paquet en contient ${fichiersOutils}.`);
      }
    } catch (e) {
      problemes.push('Manifeste des outils illisible : ' + e.message);
    }
  }

  // Programme et autres ressources : ni données personnelles, ni contenu des cours
  for (const nom of fs.readdirSync(resources)) {
    const complet = path.join(resources, nom);
    if (nom === 'outils') continue;
    let liste;
    if (nom.endsWith('.asar') && fs.statSync(complet).isFile()) liste = listerAsar(complet);
    else if (fs.statSync(complet).isDirectory()) liste = parcourir(complet);
    else liste = [nom];
    for (const chemin of liste) {
      // Les dépendances (node_modules) ont leurs propres noms de fichiers : seules
      // les règles de dossiers d'ula s'appliquent au programme.
      if (/(^|\/)node_modules\//.test(chemin)) continue;
      if (/(^|\/)explore\//.test(chemin)) {
        problemes.push(`${nom}/${chemin} (cours du catalogue : jamais livré avec l'application)`);
        continue;
      }
      const r = regles.personnel(chemin, { racine: false });
      if (r) signaler(nom, chemin, r);
    }
  }
  return { problemes, fichiersOutils };
}

module.exports = { verifier };
