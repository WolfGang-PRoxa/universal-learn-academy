'use strict';
/* Exécution du code des questions : SQL (PostgreSQL via PGlite), Python,
   JavaScript (Node), C (gcc) et C POSIX (fork, sigaction… : gcc de WSL sous
   Windows). Le code vient de l'étudiant ou d'un quiz écrit par Claude, et
   tourne sur sa propre machine : on se contente de limites raisonnables
   (temps, taille de sortie, dossier temporaire). */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { tr } = require('./langue');
const { spawn, spawnSync } = require('child_process');
const { Worker } = require('worker_threads');
const { LOCAL, dossierLocal } = require('./chemins');

const DELAI = 8000; // ms par exécution
const SORTIE_MAX = 64 * 1024; // octets gardés par flux
const WINDOWS = process.platform === 'win32';

/* Disponibilité des langages ------------------------------------------------ */

let dispo = null;

function commande(noms, args) {
  for (const n of noms) {
    const r = spawnSync(n, args, { encoding: 'utf8', timeout: 10000, windowsHide: true });
    if (r.status === 0) return { commande: n, version: (r.stdout || r.stderr).trim().split('\n')[0] };
  }
  return null;
}

// L'environnement Python commun des notebooks (lancer-jupyter.bat ou .sh, voir
// _outils/environnements/python.html) a numpy, scipy, pandas… : on le préfère au Python du système.
function pythonCommun() {
  const py = WINDOWS
    ? path.join(
        process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
        'studies-python',
        'Scripts',
        'python.exe',
      )
    : path.join(
        process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'),
        'studies-python',
        'bin',
        'python',
      );
  return fs.existsSync(py) ? [py] : [];
}

// Le gcc de Windows (MinGW) n'a ni fork ni sigaction : le C POSIX passe par WSL. On ne
// lance pas WSL pour le vérifier, sa mise en route ralentirait le démarrage du serveur.
function cPosix() {
  if (!WINDOWS) return commande(['gcc'], ['--version']);
  const wsl = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wsl.exe');
  return fs.existsSync(wsl) ? { commande: wsl, version: 'gcc de WSL' } : null;
}

// Une commande sous Linux, depuis le dossier donné : directe, ou dans WSL sous Windows
function sousLinux(dossier, ligne) {
  return WINDOWS ? ['wsl', ['--cd', dossier, '-e', ...ligne]] : [ligne[0], ligne.slice(1)];
}

function modulePglite() {
  try {
    return require.resolve('@electric-sql/pglite', { paths: [LOCAL] });
  } catch (e) {
    return null;
  }
}

function disponibilite(forcer) {
  if (dispo && !forcer) return dispo;
  const pg = modulePglite();
  dispo = {
    sql: pg
      ? {
          commande: 'PGlite',
          version: require(path.join(LOCAL, 'node_modules', '@electric-sql', 'pglite', 'package.json')).version,
        }
      : null,
    javascript: { commande: process.execPath, version: 'Node ' + process.version },
    python: commande([...pythonCommun(), ...(WINDOWS ? ['python', 'py'] : ['python3', 'python'])], ['--version']),
    c: commande(['gcc'], ['--version']),
    'c-posix': cPosix(),
  };
  return dispo;
}

// Installe PGlite dans le dossier local (hors de Google Drive) si besoin
function installerPglite(journal) {
  if (modulePglite()) return true;
  dossierLocal();
  const pkg = path.join(LOCAL, 'package.json');
  if (!fs.existsSync(pkg))
    fs.writeFileSync(pkg, JSON.stringify({ name: 'studies-quiz-dependances', private: true }, null, 2));
  journal('Installation de PGlite (PostgreSQL pour les questions SQL) dans ' + LOCAL + '…');
  const r = spawnSync(WINDOWS ? 'npm.cmd' : 'npm', ['install', '@electric-sql/pglite@0.5', '--no-audit', '--no-fund'], {
    cwd: LOCAL,
    encoding: 'utf8',
    timeout: 300000,
    shell: WINDOWS,
    windowsHide: true,
  });
  if (r.status !== 0) {
    journal(
      "Échec de l'installation de PGlite : les questions SQL ne pourront pas être exécutées.\n" +
        (r.stderr || '').slice(-500),
    );
    return false;
  }
  disponibilite(true);
  return true;
}

/* SQL -------------------------------------------------------------------------- */

function executerSql(jeu, requetes) {
  const module = modulePglite();
  if (!module) return Promise.resolve({ erreur: "PGlite n'est pas installé : relancer le serveur pour l'installer." });
  return new Promise((resolve) => {
    const debut = Date.now();
    // Copie d'une base déjà initialisée (propre à la version de PGlite) : démarrage en 1 s au lieu de 6
    const version = (disponibilite().sql || {}).version || 'x';
    const base = path.join(LOCAL, 'pglite-base-' + version + '.tar');
    const w = new Worker(path.join(__dirname, 'sql-worker.js'), {
      workerData: { module, base, jeu: jeu || '', requetes },
    });
    const minuteur = setTimeout(() => {
      w.terminate();
      resolve({
        erreur: tr(
          'Temps dépassé (' + DELAI / 1000 + ' s) : la requête ne se termine pas.',
          'Time limit exceeded (' + DELAI / 1000 + ' s): the query does not finish.',
        ),
      });
    }, DELAI + 10000); // l'initialisation complète de PGlite (sans copie de base) peut prendre 8 s
    w.once('message', (m) => {
      clearTimeout(minuteur);
      w.terminate();
      if (m.fatal) resolve({ erreur: 'PGlite : ' + m.fatal });
      else resolve({ resultats: m.resultats, duree: Date.now() - debut });
    });
    w.once('error', (e) => {
      clearTimeout(minuteur);
      resolve({ erreur: 'PGlite : ' + e.message });
    });
  });
}

/* Programmes : Python, JavaScript, C ---------------------------------------------- */

function lancerProgramme(cmd, args, cwd, entree) {
  return new Promise((resolve) => {
    const debut = Date.now();
    let sortie = '',
      erreur = '',
      fini = false;
    let p;
    try {
      p = spawn(cmd, args, {
        cwd,
        windowsHide: true,
        env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }),
      });
    } catch (e) {
      // échec immédiat (antivirus, fichier verrouillé…) : une erreur d'exécution, pas un plantage
      resolve({ sortie: '', erreur: 'Lancement impossible : ' + e.message, code: -1, duree: Date.now() - debut });
      return;
    }
    const minuteur = setTimeout(() => {
      if (fini) return;
      if (WINDOWS) spawnSync('taskkill', ['/pid', String(p.pid), '/t', '/f'], { windowsHide: true });
      else p.kill('SIGKILL');
      erreur +=
        '\n' +
        tr(
          'Temps dépassé (' + DELAI / 1000 + ' s) : le programme a été arrêté.',
          'Time limit exceeded (' + DELAI / 1000 + ' s): the program was stopped.',
        );
    }, DELAI);
    p.stdout.setEncoding('utf8');
    p.stderr.setEncoding('utf8');
    p.stdout.on('data', (m) => {
      if (sortie.length < SORTIE_MAX) sortie += m;
    });
    p.stderr.on('data', (m) => {
      if (erreur.length < SORTIE_MAX) erreur += m;
    });
    p.on('error', (e) => {
      erreur += e.message;
    });
    p.on('close', (code) => {
      fini = true;
      clearTimeout(minuteur);
      // Retire les retours chariot des fins de ligne Windows, pour comparer les sorties
      // et les caractères nuls des messages de wsl.exe, écrits en UTF-16
      const net = (t) =>
        t.slice(0, SORTIE_MAX).split(String.fromCharCode(13)).join('').split(String.fromCharCode(0)).join('');
      resolve({ sortie: net(sortie), erreur: net(erreur), code, duree: Date.now() - debut });
    });
    p.stdin.on('error', () => {});
    p.stdin.end(entree || '');
  });
}

async function executerProgramme(langage, code, entrees) {
  const d = disponibilite();
  if (!d[langage])
    return {
      erreur:
        langage === 'python'
          ? tr('Python est introuvable.', 'Python cannot be found.')
          : langage === 'c'
            ? tr('gcc est introuvable.', 'gcc cannot be found.')
            : tr(
                'WSL est introuvable : il faut gcc dans WSL pour le C POSIX.',
                'WSL cannot be found: gcc in WSL is needed for POSIX C.',
              ),
    };
  const dossier = fs.mkdtempSync(path.join(dossierLocal('executions'), langage + '-'));
  try {
    let cmd, args;
    if (langage === 'python') {
      fs.writeFileSync(path.join(dossier, 'programme.py'), code, 'utf8');
      cmd = d.python.commande;
      args = ['-X', 'utf8', 'programme.py'];
    } else if (langage === 'javascript') {
      fs.writeFileSync(path.join(dossier, 'programme.js'), code, 'utf8');
      cmd = process.execPath;
      args = ['programme.js'];
    } else if (langage === 'c-posix') {
      fs.writeFileSync(path.join(dossier, 'programme.c'), code, 'utf8');
      const [cc, options] = sousLinux(dossier, [
        'gcc',
        '-std=gnu11',
        '-Wall',
        '-O0',
        '-o',
        'programme',
        'programme.c',
        '-lm',
      ]);
      const comp = await lancerProgramme(cc, options, dossier, '');
      if (comp.code !== 0)
        return {
          compilation: comp.erreur || comp.sortie,
          erreur: tr('La compilation a échoué.', 'Compilation failed.'),
        };
      // timeout tue aussi les fils du programme, que l'arrêt de wsl.exe laisserait tourner
      [cmd, args] = sousLinux(dossier, ['timeout', '-s', 'KILL', String(DELAI / 1000 - 1), './programme']);
      const execs = [];
      for (const e of entrees && entrees.length ? entrees : ['']) {
        const x = await lancerProgramme(cmd, args, dossier, e);
        if (x.code === 124 || x.code === 137)
          x.erreur +=
            '\n' +
            tr(
              'Temps dépassé (' + (DELAI / 1000 - 1) + ' s) : le programme a été arrêté.',
              'Time limit exceeded (' + (DELAI / 1000 - 1) + ' s): the program was stopped.',
            );
        execs.push(x);
      }
      return { executions: execs, avertissements: comp.erreur || '' };
    } else {
      fs.writeFileSync(path.join(dossier, 'programme.c'), code, 'utf8');
      const exe = WINDOWS ? 'programme.exe' : 'programme';
      const comp = await lancerProgramme(
        'gcc',
        ['-std=c11', '-Wall', '-O0', '-o', exe, 'programme.c', '-lm'],
        dossier,
        '',
      );
      if (comp.code !== 0)
        return {
          compilation: comp.erreur || comp.sortie,
          erreur: tr('La compilation a échoué.', 'Compilation failed.'),
        };
      cmd = path.join(dossier, exe);
      args = [];
      const liste = entrees && entrees.length ? entrees : [''];
      const execs = [];
      for (const e of liste) execs.push(await lancerProgramme(cmd, args, dossier, e));
      return { executions: execs, avertissements: comp.erreur || '' };
    }
    const liste = entrees && entrees.length ? entrees : [''];
    const execs = [];
    for (const e of liste) execs.push(await lancerProgramme(cmd, args, dossier, e));
    return { executions: execs };
  } finally {
    fs.rm(dossier, { recursive: true, force: true }, () => {});
  }
}

/*
  demande : { langage, code, jeu?, requetes? (SQL : plusieurs requêtes sur le même jeu),
              entrees? (programmes : une exécution par entrée standard) }
*/
async function executer(demande) {
  const langage = String(demande.langage || '').toLowerCase();
  const code = String(demande.code || '');
  if (code.length > 100000) return { erreur: 'Code trop long.' };
  if (langage === 'sql') {
    const requetes = Array.isArray(demande.requetes) && demande.requetes.length ? demande.requetes.map(String) : [code];
    return executerSql(String(demande.jeu || ''), requetes);
  }
  if (['python', 'javascript', 'c', 'c-posix'].includes(langage)) {
    const entrees = Array.isArray(demande.entrees) ? demande.entrees.slice(0, 20).map(String) : null;
    return executerProgramme(langage, code, entrees);
  }
  return { erreur: 'Langage non pris en charge : « ' + langage + ' ».' };
}

// Nettoie les dossiers d'exécution restés d'une session précédente
function nettoyer() {
  try {
    fs.rmSync(path.join(LOCAL, 'executions'), { recursive: true, force: true });
  } catch (e) {
    /* fichier verrouillé */
  }
}

module.exports = { executer, disponibilite, installerPglite, nettoyer };
