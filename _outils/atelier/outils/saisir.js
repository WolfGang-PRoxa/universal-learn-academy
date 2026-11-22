#!/usr/bin/env node
'use strict';
/* Enregistre le travail fait sur papier dans l'espace du profil actif (_outils/atelier).

   Usage :
     node _outils/atelier/outils/saisir.js [--forcer] [--essai] PAGE.html [PAGE.html ...]

   Pour chaque atelier de la page qui a un champ « papier » (la réponse écrite
   sur papier, saisie dans la syntaxe texte de l'éditeur), écrit son état dans
   <profil>/<cursus>/<cours>/td_results/<page>.json, au format des enregistrements du
   serveur local : le TD s'ouvre alors avec ce travail, comme s'il avait été
   fait sur le PC, le portail le compte, et Claude le lit.

   Un atelier déjà enregistré n'est pas écrasé s'il a été modifié depuis la
   saisie (travail repris dans la page) : --forcer le remplace quand même.
   --essai montre ce qui serait écrit, sans rien écrire.

   Code de sortie : 1 si une saisie est illisible, 0 sinon. */

const fs = require('fs');
const path = require('path');
const { charger, ATELIER } = require('./charger');

const RACINE = process.env.ULA_RACINE ? path.resolve(process.env.ULA_RACINE) : path.resolve(ATELIER, '..', '..');
const espace = require(path.join(ATELIER, '..', 'ula', 'lib', 'espace.js'));
const A = charger();
const N = A.noyau;

function attribut(attrs, nom) {
  const m = attrs.match(new RegExp('\\b' + nom + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')'));
  return m ? (m[2] != null ? m[2] : m[3]) : null;
}

// Ateliers de la page : [{ id, editeur, config }]
function ateliers(source) {
  const res = [];
  const re = /<div\b([^>]*)>\s*<script\s+type="application\/json"\s*>([\s\S]*?)<\/script>\s*<\/div>/g;
  let m;
  while ((m = re.exec(source))) {
    if (!/(^|\s)atelier(\s|$)/.test(attribut(m[1], 'class') || '')) continue;
    const config = JSON.parse(m[2]);
    res.push({
      id: config.id || attribut(m[1], 'id'),
      editeur: config.editeur || attribut(m[1], 'data-editeur'),
      config,
    });
  }
  return res;
}

// Même emplacement que le serveur (_outils/atelier/serveur/extension.js) : le dossier
// du cours dans l'espace du profil actif (lien ajouté au cursus au besoin)
function fichierTravail(page) {
  const t = espace.travailDePage(RACINE, path.resolve(page), { creer: true });
  if (!t.dossier) throw new Error(t.raison || 'Aucun profil choisi.');
  return path.join(t.dossier, 'td_results', path.basename(page, '.html') + '.json');
}

function titrePage(source, page) {
  const h1 = source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return h1
    ? h1[1]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    : path.basename(page);
}

function memeTravail(a, b) {
  return JSON.stringify(a.modele) === JSON.stringify(b.modele) && (a.texte || null) === (b.texte || null);
}

function saisir(page, forcer, essai) {
  const source = fs.readFileSync(page, 'utf8');
  const fichier = fichierTravail(page);
  let travail;
  try {
    travail = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  } catch (e) {
    travail = { format: 'studies-atelier/travail-1', ateliers: {} };
  }
  let erreurs = 0,
    ecrits = 0;
  for (const a of ateliers(source)) {
    if (a.config.papier == null) continue;
    const ed = A.editeurs[a.editeur];
    if (!ed) {
      console.log('  ✗ ' + a.id + ' : éditeur inconnu « ' + a.editeur + ' »');
      erreurs++;
      continue;
    }
    const r = N.travailPapier(ed, a.config.papier, a.config.options || {});
    if (r.erreurs.length) {
      r.erreurs.forEach((e) => console.log('  ✗ ' + a.id + ', ligne ' + (e.ligne || '?') + ' : ' + e.message));
      erreurs++;
      continue;
    }
    const avant = travail.ateliers[a.id];
    if (avant && memeTravail(avant, r.etat)) {
      console.log('  = ' + a.id + ' : déjà saisi');
      continue;
    }
    if (avant && !forcer) {
      console.log('  ! ' + a.id + ' : modifié depuis la saisie, conservé (--forcer pour le remplacer)');
      continue;
    }
    travail.ateliers[a.id] = Object.assign({}, r.etat, { maj: r.etat.maj || new Date().toISOString() });
    console.log('  ✓ ' + a.id + ' (' + a.editeur + (r.etat.resume === 'vide' ? ', vide' : '') + ')');
    ecrits++;
  }
  if (ecrits && !essai) {
    travail.page = path.relative(RACINE, page).split(path.sep).join('/');
    travail.titre = titrePage(source, page);
    travail.maj = new Date().toISOString();
    fs.mkdirSync(path.dirname(fichier), { recursive: true });
    fs.writeFileSync(fichier, JSON.stringify(travail, null, 2) + '\n', 'utf8');
  }
  console.log(
    '  → ' +
      path.relative(RACINE, fichier) +
      ' : ' +
      N.pluriel(ecrits, 'atelier saisi', 'ateliers saisis') +
      (essai ? " (essai : rien d'écrit)" : ''),
  );
  return erreurs;
}

function principal(argv) {
  const forcer = argv.includes('--forcer'),
    essai = argv.includes('--essai');
  const pages = argv.filter((x) => !x.startsWith('--'));
  if (!pages.length) {
    console.log(
      fs
        .readFileSync(__filename, 'utf8')
        .match(/\/\* ([\s\S]*?)\*\//)[1]
        .replace(/^ {3}/gm, ''),
    );
    return 2;
  }
  let erreurs = 0;
  for (const p of pages) {
    const abs = path.resolve(p);
    if (!fs.existsSync(abs) || !abs.endsWith('.html')) {
      console.log('introuvable ou pas un .html : ' + p);
      erreurs++;
      continue;
    }
    console.log(path.relative(RACINE, abs));
    erreurs += saisir(abs, forcer, essai);
  }
  return erreurs ? 1 : 0;
}

process.exit(principal(process.argv.slice(2)));
