"use strict";
/* Contrôle d'un paquet construit : aucune donnée personnelle ne doit s'y trouver.

   Appelé par electron-builder après l'empaquetage (apres-empaquetage.cjs), avant
   la création de l'installeur ou de l'AppImage : une erreur arrête la construction.
   Aussi lancé par `npm run check -- --paquet` sur les dossiers dist/*-unpacked.

   On parcourt tout ce qui part chez l'utilisateur : resources/cours (les cours),
   app.asar (le programme), app.asar.unpacked, et les autres fichiers de resources. */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const regles = require("./contenu-regles.cjs");

function parcourir(dossier, base = dossier, liste = []) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const complet = path.join(dossier, e.name);
    if (e.isDirectory()) parcourir(complet, base, liste);
    else liste.push(path.relative(base, complet).split(path.sep).join("/"));
  }
  return liste;
}

function listerAsar(fichier) {
  const asar = require("@electron/asar");
  return asar.listPackage(fichier, { isPack: false }).map((c) => c.replace(/\\/g, "/").replace(/^\//, ""));
}

function empreinte(fichier) {
  return crypto.createHash("sha256").update(fs.readFileSync(fichier)).digest("hex");
}

/**
 * @param {string} resources  dossier resources du paquet (…/win-unpacked/resources)
 * @param {object} [tpFournis]  liste blanche des fichiers de TP (par défaut app/tp-fournis.json)
 * @returns {{ problemes: string[], fichiersCours: number }}
 */
function verifier(resources, tpFournis = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "tp-fournis.json"), "utf8")).fichiers) {
  const problemes = [];
  const signaler = (ou, chemin, regle) => problemes.push(`${ou}/${chemin} (${regle.raison})`);

  const cours = path.join(resources, "cours");
  let fichiersCours = 0;
  if (!fs.existsSync(cours)) {
    problemes.push("resources/cours est absent : lancer `npm run contenu` avant la construction.");
  } else {
    const liste = parcourir(cours);
    for (const chemin of liste) {
      if (chemin === regles.MANIFESTE) continue;
      fichiersCours++;
      if (regles.estTP(chemin)) {
        // Fichier de TP : seulement s'il est dans la liste blanche, identique à sa
        // version d'origine (sinon, il a pu être complété par l'étudiant)
        const o = tpFournis[chemin];
        const autre = regles.personnel(chemin, { tp: false });
        if (autre) signaler("cours", chemin, autre);
        else if (!o) problemes.push(`cours/${chemin} (fichier de TP absent de tp-fournis.json)`);
        else if (empreinte(path.join(cours, ...chemin.split("/"))) !== o.empreinte) problemes.push(`cours/${chemin} (fichier de TP différent de sa version d'origine)`);
        continue;
      }
      const r = regles.personnel(chemin);
      if (r) signaler("cours", chemin, r);
    }
    // Le manifeste doit décrire exactement ce qui est livré
    try {
      const manifeste = JSON.parse(fs.readFileSync(path.join(cours, regles.MANIFESTE), "utf8"));
      const declares = Object.keys(manifeste.fichiers);
      for (const chemin of declares) {
        if (regles.estTP(chemin) && tpFournis[chemin]) continue;
        const r = regles.personnel(chemin);
        if (r) signaler("manifeste", chemin, r);
      }
      if (declares.length !== fichiersCours) {
        problemes.push(`Le manifeste annonce ${declares.length} fichiers, le paquet en contient ${fichiersCours}.`);
      }
    } catch (e) {
      problemes.push("Manifeste des cours illisible : " + e.message);
    }
  }

  // Programme et autres ressources : ni données personnelles, ni contenu des cours
  for (const nom of fs.readdirSync(resources)) {
    const complet = path.join(resources, nom);
    if (nom === "cours") continue;
    let liste = [];
    if (nom.endsWith(".asar") && fs.statSync(complet).isFile()) liste = listerAsar(complet);
    else if (fs.statSync(complet).isDirectory()) liste = parcourir(complet);
    else liste = [nom];
    for (const chemin of liste) {
      // Les dépendances (node_modules) ont leurs propres noms de fichiers : seules
      // les règles de dossiers de studies s'appliquent au programme.
      if (/(^|\/)node_modules\//.test(chemin)) continue;
      const r = regles.personnel(chemin);
      if (r) signaler(nom, chemin, r);
    }
  }
  return { problemes, fichiersCours };
}

module.exports = { verifier };
