'use strict';
/* Le serveur local vu par l'application : le même programme que lancer.bat,
   sur la racine des données (ULA_RACINE si l'hôte l'a posée, sinon le dossier
   qui contient _outils),
   dans un processus à part pour que les lectures sur Google Drive ne figent pas
   la fenêtre. Il tourne avec le Node embarqué dans Electron
   (ELECTRON_RUN_AS_NODE) : process.execPath y reste un Node utilisable, et
   executer.js n'a rien à savoir de l'application. Si un serveur tourne déjà
   (lancer.bat), on s'y raccorde sans y toucher. */

const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');
const { RACINE, QUIZ, dossierLocal } = require('../quiz/serveur/lib/chemins');
const reglages = require('../quiz/serveur/lib/reglages');
const { t } = require('./textes');

const JOURNAL = path.join(dossierLocal('app'), 'serveur.log');
const ATTENTE_MAX = 6 * 60 * 1000; // le premier lancement installe PGlite
const PERIODE_TACHES = 10000;

let port = null;
let enfant = null;
let pret = false;
let arretDemande = false;
let surveillance = null;

function adresse() {
  return 'http://127.0.0.1:' + port + '/';
}

// true si le serveur de ce port est celui de notre racine ; une erreur si le port est
// pris par le serveur d'un autre dossier de données (lancer.bat d'un autre dossier)
async function repond() {
  let d;
  try {
    const r = await fetch(adresse() + 'api/ping', { signal: AbortSignal.timeout(1500) });
    d = await r.json();
  } catch (e) {
    return false;
  }
  if (d.app !== 'studies-quiz') return false;
  const meme = (a, b) => path.resolve(a || '').toLowerCase() === path.resolve(b || '').toLowerCase();
  if (d.racine && !meme(d.racine, RACINE)) {
    throw new Error(t('serveur.portPris', { port, racine: d.racine }));
  }
  return true;
}

function lancer(journal, surArret) {
  const trace = fs.createWriteStream(JOURNAL);
  enfant = fork(path.join(QUIZ, 'serveur', 'serveur.js'), ['--port', String(port)], {
    cwd: RACINE,
    silent: true,
    windowsHide: true,
    env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }),
  });
  const lire = (morceau) => {
    trace.write(morceau);
    for (const l of morceau.split('\n')) if (l.trim()) journal(l.trim());
  };
  enfant.stdout.setEncoding('utf8').on('data', lire);
  enfant.stderr.setEncoding('utf8').on('data', lire);
  enfant.on('exit', (code) => {
    const enService = pret;
    enfant = null;
    pret = false;
    if (enService && !arretDemande) surArret(code);
  });
}

// Démarre le serveur (ou se raccorde à celui qui tourne) et renvoie son adresse ;
// null si l'application se ferme entre-temps
async function demarrer({ journal, surArret }) {
  port = reglages.lire().port;
  if (await repond()) return adresse();
  lancer(journal, surArret);
  const limite = Date.now() + ATTENTE_MAX;
  while (Date.now() < limite) {
    if (arretDemande) return null;
    if (!enfant) throw new Error(t('serveur.arreteDemarrage'));
    if (await repond()) {
      pret = true;
      return adresse();
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(t('serveur.muet'));
}

function arreter() {
  arretDemande = true;
  if (surveillance) clearInterval(surveillance);
  return new Promise((resolve) => {
    if (!enfant) return resolve();
    const lance = enfant;
    lance.once('exit', resolve);
    lance.send('arreter');
    setTimeout(() => {
      lance.kill();
      resolve();
    }, 3000);
  });
}

async function taches() {
  const r = await fetch(adresse() + 'api/taches', { signal: AbortSignal.timeout(3000) });
  return (await r.json()).taches;
}

// Générations en cours que la fermeture de l'application arrêterait
async function tachesMenacees() {
  if (!enfant) return 0;
  try {
    return (await taches()).filter((t) => t.etat === 'en_cours').length;
  } catch (e) {
    return 0;
  }
}

// Appelle surFin pour chaque tâche qui se termine à partir de maintenant
function surveillerTaches(surFin) {
  if (surveillance) return;
  const vues = new Set();
  let premier = true;
  const verifier = async () => {
    let liste;
    try {
      liste = await taches();
    } catch (e) {
      return;
    }
    for (const t of liste) {
      if (t.etat === 'en_cours' || vues.has(t.id)) continue;
      vues.add(t.id);
      if (!premier) surFin(t);
    }
    premier = false;
  };
  verifier();
  surveillance = setInterval(verifier, PERIODE_TACHES);
}

module.exports = { JOURNAL, adresse, demarrer, arreter, tachesMenacees, surveillerTaches };
