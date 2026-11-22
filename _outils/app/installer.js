#!/usr/bin/env node
'use strict';
/* Installe l'application Studies, puis la lance (appelé par lancer-app.bat et
   lancer-app.sh).

   Electron pèse plus de 300 Mo : il va dans le dossier local de l'outil
   (%LOCALAPPDATA%\studies-quiz\app), hors de Google Drive, comme PGlite. Seule
   l'amorce (amorce/) entre dans l'exécutable ; le programme reste dans le dépôt.
   On ne réinstalle donc que si les versions de package.json changent, ou avec
   --reinstaller. */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const { RACINE, dossierLocal } = require('../quiz/serveur/lib/chemins');
const paquet = require('./package.json');

const WINDOWS = process.platform === 'win32';
const DOSSIER = dossierLocal('app');
const SORTIE = path.join(DOSSIER, 'Studies-' + process.platform + '-' + process.arch);
const EXECUTABLE = path.join(SORTIE, WINDOWS ? 'Studies.exe' : 'Studies');
const NOUVELLE = path.join(DOSSIER, 'nouvelle');
const INSTALLATION = path.join(DOSSIER, 'installation.json');
const VERSIONS = { app: paquet.version, electron: paquet.dependancesLocales.electron };

function aJour() {
  try {
    const v = JSON.parse(fs.readFileSync(INSTALLATION, 'utf8'));
    return v.app === VERSIONS.app && v.electron === VERSIONS.electron && fs.existsSync(EXECUTABLE);
  } catch (e) {
    return false;
  }
}

async function installer() {
  console.log("Installation de l'application Studies dans " + DOSSIER + ' (Electron, environ 100 Mo à télécharger)…');
  const pkg = path.join(DOSSIER, 'package.json');
  if (!fs.existsSync(pkg))
    fs.writeFileSync(pkg, JSON.stringify({ name: 'studies-app-dependances', private: true }, null, 2));
  const outil = '@electron/packager@' + paquet.dependancesLocales['@electron/packager'];
  const r = spawnSync('npm install ' + outil + ' --no-audit --no-fund', {
    cwd: DOSSIER,
    stdio: 'inherit',
    shell: true,
    windowsHide: true,
  });
  if (r.status !== 0) throw new Error('npm install a échoué.');

  const { packager } = await import(
    pathToFileURL(path.join(DOSSIER, 'node_modules', '@electron', 'packager', 'dist', 'index.js'))
  );
  fs.rmSync(NOUVELLE, { recursive: true, force: true });
  await packager({
    dir: path.join(__dirname, 'amorce'),
    out: NOUVELLE,
    name: 'Studies',
    appVersion: VERSIONS.app,
    electronVersion: VERSIONS.electron,
    platform: process.platform,
    arch: process.arch,
    icon: path.join(__dirname, 'assets', 'icone.ico'),
    prune: false,
    asar: false,
    quiet: true,
    win32metadata: { CompanyName: 'Studies', FileDescription: 'Studies', ProductName: 'Studies' },
  });
  remplacer();
  fs.writeFileSync(INSTALLATION, JSON.stringify(VERSIONS, null, 2));
}

// L'ancienne version ne part qu'une fois la nouvelle prête. Windows refuse de
// renommer le dossier d'un programme ouvert : on s'arrête alors sans rien abîmer.
function remplacer() {
  const ancienne = SORTIE + '.ancienne';
  fs.rmSync(ancienne, { recursive: true, force: true });
  if (fs.existsSync(SORTIE)) {
    try {
      fs.renameSync(SORTIE, ancienne);
    } catch (e) {
      fs.rmSync(NOUVELLE, { recursive: true, force: true });
      throw new Error('Studies est ouvert : le fermer, puis relancer.', { cause: e });
    }
  }
  fs.renameSync(path.join(NOUVELLE, path.basename(SORTIE)), SORTIE);
  fs.rmSync(NOUVELLE, { recursive: true, force: true });
  fs.rmSync(ancienne, { recursive: true, force: true });
}

function lancer(args) {
  fs.writeFileSync(path.join(SORTIE, 'racine.json'), JSON.stringify({ racine: RACINE }, null, 2));
  const env = Object.assign({}, process.env);
  delete env.ELECTRON_RUN_AS_NODE; // posée par un terminal de VS Code : Studies.exe se prendrait pour Node
  spawn(EXECUTABLE, args, { cwd: DOSSIER, env, detached: true, stdio: 'ignore' }).unref();
}

async function principal() {
  const neuve = process.argv.includes('--reinstaller') || !aJour();
  if (neuve) await installer();
  lancer(neuve ? ['--raccourcis'] : []);
}

principal().catch((e) => {
  console.error('Installation impossible : ' + e.message);
  process.exitCode = 1;
});
