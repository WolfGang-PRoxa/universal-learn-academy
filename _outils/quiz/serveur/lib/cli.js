'use strict';
/* Outils communs aux assistants en ligne de commande autres que Claude Code :
   Codex CLI (compte ChatGPT ou clé d'API OpenAI) et Gemini CLI (compte Google ou
   clé d'API Gemini).

   - trouver() cherche l'exécutable : chemin des réglages, PATH, dossiers usuels
     des installations npm. Sous Windows, npm installe un lanceur « .cmd » que Node
     ne peut pas lancer sans shell : le script JavaScript qu'il désigne est alors
     lancé directement avec Node.
   - ouvrirTerminal() ouvre un terminal du système sur une commande (connexion) :
     la connexion se fait chez l'éditeur de l'outil, l'application ne voit jamais
     les identifiants.
   - lire() lance une commande courte et rend { status, stdout, stderr }. */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync, execFile } = require('child_process');

const WINDOWS = process.platform === 'win32';

function comparerVersions(a, b) {
  const va = (String(a).match(/\d+/g) || []).map(Number),
    vb = (String(b).match(/\d+/g) || []).map(Number);
  for (let i = 0; i < Math.max(va.length, vb.length); i++)
    if ((va[i] || 0) !== (vb[i] || 0)) return (va[i] || 0) - (vb[i] || 0);
  return 0;
}

function dossiersUsuels() {
  const maison = os.homedir();
  const d = [];
  if (WINDOWS) {
    if (process.env.APPDATA) d.push(path.join(process.env.APPDATA, 'npm'));
    if (process.env.LOCALAPPDATA) d.push(path.join(process.env.LOCALAPPDATA, 'Programs'));
  } else {
    d.push(
      path.join(maison, '.local', 'bin'),
      path.join(maison, '.npm-global', 'bin'),
      path.join(maison, '.volta', 'bin'),
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/usr/bin',
    );
  }
  return d;
}

function nodeDuSysteme(dossierLanceur) {
  const local = path.join(dossierLanceur, WINDOWS ? 'node.exe' : 'node');
  if (fs.existsSync(local)) return local;
  for (const d of (process.env.PATH || '').split(path.delimiter)) {
    const n = d && path.join(d, WINDOWS ? 'node.exe' : 'node');
    if (n && fs.existsSync(n)) return n;
  }
  return null;
}

// Lanceur npm pour Windows (« codex.cmd ») : renvoie { executable: node, prefixe: [script] }
function depuisLanceurCmd(fichier) {
  let texte;
  try {
    texte = fs.readFileSync(fichier, 'utf8');
  } catch (e) {
    return null;
  }
  const m = texte.match(/%~?dp0%?\\([^"\r\n]+?\.(?:c|m)?js)/i);
  if (!m) return null;
  const script = path.join(path.dirname(fichier), m[1]);
  const node = nodeDuSysteme(path.dirname(fichier));
  if (!node || !fs.existsSync(script)) return null;
  return { executable: node, prefixe: [script] };
}

/*
  Recherche d'un outil en ligne de commande.
  nom        nom de l'exécutable (« codex », « gemini »)
  configure  chemin indiqué dans les réglages (prioritaire), ou ''
  reconnaitre(sortie de --version) → version (texte) ou null
  Renvoie { executable, prefixe, version } ou { erreur }.
*/
function trouver(nom, configure, reconnaitre, erreur) {
  const candidats = [];
  if (configure) candidats.push(configure);
  const noms = WINDOWS ? [nom + '.exe', nom + '.cmd'] : [nom];
  for (const d of [...(process.env.PATH || '').split(path.delimiter), ...dossiersUsuels()])
    for (const n of noms) if (d) candidats.push(path.join(d, n));
  let meilleur = null;
  for (const c of [...new Set(candidats)]) {
    if (!c || !fs.existsSync(c)) continue;
    const lancement = /\.cmd$/i.test(c) ? depuisLanceurCmd(c) : { executable: c, prefixe: [] };
    if (!lancement) continue;
    const r = spawnSync(lancement.executable, [...lancement.prefixe, '--version'], {
      encoding: 'utf8',
      timeout: 20000,
      windowsHide: true,
    });
    const version = r.status === 0 ? reconnaitre(String(r.stdout || '') + String(r.stderr || '')) : null;
    if (!version) continue;
    if (!meilleur || comparerVersions(version, meilleur.version) > 0)
      meilleur = Object.assign({ chemin: c, version }, lancement);
    if (c === configure) break;
  }
  return meilleur || { erreur };
}

function lire(lancement, args, options = {}) {
  return new Promise((resolve) => {
    execFile(
      lancement.executable,
      [...lancement.prefixe, ...args],
      Object.assign({ encoding: 'utf8', windowsHide: true, timeout: 20000 }, options),
      (err, stdout, stderr) =>
        resolve({
          status: err ? (typeof err.code === 'number' ? err.code : 1) : 0,
          stdout: stdout || '',
          stderr: stderr || '',
        }),
    );
  });
}

function arreterArbre(enfant) {
  if (!enfant || enfant.exitCode !== null) return;
  if (WINDOWS) spawnSync('taskkill', ['/pid', String(enfant.pid), '/t', '/f'], { windowsHide: true });
  else enfant.kill('SIGTERM');
}

function guillemetsSh(x) {
  return "'" + String(x).replace(/'/g, "'\\''") + "'";
}

/* Ouvre un terminal du système sur « lancement + args » ; titre de la fenêtre sous
   Windows. Les clés d'API éventuelles sont retirées de l'environnement : la connexion
   vise le compte, pas la clé. Renvoie true, ou lève une erreur. */
function ouvrirTerminal(lancement, args, { titre, sansVariables = [], messageSansTerminal } = {}) {
  const env = Object.assign({}, process.env);
  for (const v of sansVariables) delete env[v];
  delete env.ELECTRON_RUN_AS_NODE;
  const morceaux = [lancement.executable, ...lancement.prefixe, ...args];
  if (WINDOWS) {
    // Chaque morceau entre guillemets : cmd /k retire alors la seule paire extérieure,
    // et la ligne est écrite telle quelle
    const ligne = morceaux.map((m) => '"' + m + '"').join(' ');
    spawn('cmd.exe', ['/d /c start "' + (titre || 'ULA') + '" cmd.exe /k "' + ligne + '"'], {
      env,
      detached: true,
      stdio: 'ignore',
      windowsVerbatimArguments: true,
      windowsHide: false,
    }).unref();
    return true;
  }
  const commande = morceaux.map(guillemetsSh).join(' ') + "; echo; read -p 'Entrée pour fermer…' x";
  const terminaux = [
    ['x-terminal-emulator', ['-e', 'bash', '-c', commande]],
    ['gnome-terminal', ['--', 'bash', '-c', commande]],
    ['konsole', ['-e', 'bash', '-c', commande]],
    ['xfce4-terminal', ['-x', 'bash', '-c', commande]],
    ['xterm', ['-e', 'bash', '-c', commande]],
  ];
  if (process.platform === 'darwin') {
    const script = 'tell application "Terminal" to do script ' + JSON.stringify(commande);
    spawn('osascript', ['-e', script, '-e', 'tell application "Terminal" to activate'], {
      env,
      detached: true,
      stdio: 'ignore',
    }).unref();
    return true;
  }
  for (const [t, a] of terminaux) {
    if (spawnSync('sh', ['-c', 'command -v ' + t], { timeout: 5000 }).status === 0) {
      spawn(t, a, { env, detached: true, stdio: 'ignore' }).unref();
      return true;
    }
  }
  throw new Error(messageSansTerminal || 'No terminal found.');
}

/* Correspondance entre l'identifiant de conversation de l'application (UUID donné par
   la page) et celui de l'outil, quand l'outil choisit le sien (Codex) : gardée dans un
   petit fichier JSON du dossier local des conversations. */
function memoireSessions(fichier) {
  function lireTout() {
    try {
      return JSON.parse(fs.readFileSync(fichier, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {
    lire(cle) {
      return lireTout()[cle] || null;
    },
    ecrire(cle, valeur) {
      const tout = lireTout();
      tout[cle] = valeur;
      // Au plus 500 conversations retenues : les plus anciennes sont oubliées
      const cles = Object.keys(tout);
      for (const k of cles.slice(0, Math.max(0, cles.length - 500))) delete tout[k];
      try {
        fs.mkdirSync(path.dirname(fichier), { recursive: true });
        fs.writeFileSync(fichier, JSON.stringify(tout), 'utf8');
      } catch (e) {
        /* conversation non reprenable, sans plus */
      }
    },
  };
}

/* Schéma JSON au format strict d'OpenAI : tous les champs obligatoires, aucun champ
   en plus. Les schémas des quiz respectent déjà la première règle. */
function schemaStrict(s) {
  if (!s || typeof s !== 'object') return s;
  if (Array.isArray(s)) return s.map(schemaStrict);
  const r = {};
  for (const [k, v] of Object.entries(s)) r[k] = k === 'properties' ? null : schemaStrict(v);
  if (s.properties) {
    r.properties = {};
    for (const [k, v] of Object.entries(s.properties)) r.properties[k] = schemaStrict(v);
    r.required = Object.keys(s.properties);
    r.additionalProperties = false;
  }
  return r;
}

// Premier objet JSON d'un texte (réponse entourée de ```json … ``` ou de phrases)
function extraireJson(texte) {
  const t = String(texte || '').trim();
  try {
    return JSON.parse(t);
  } catch (e) {
    /* on cherche plus loin */
  }
  const bloc = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (bloc) {
    try {
      return JSON.parse(bloc[1]);
    } catch (e) {
      /* idem */
    }
  }
  const debut = t.indexOf('{'),
    fin = t.lastIndexOf('}');
  if (debut >= 0 && fin > debut) {
    try {
      return JSON.parse(t.slice(debut, fin + 1));
    } catch (e) {
      /* rien */
    }
  }
  return null;
}

module.exports = {
  WINDOWS,
  trouver,
  lire,
  arreterArbre,
  ouvrirTerminal,
  memoireSessions,
  schemaStrict,
  extraireJson,
  comparerVersions,
};
