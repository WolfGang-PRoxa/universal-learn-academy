'use strict';
/* Appels à Claude Code en mode non interactif (claude -p), avec le compte
   claude.ai connecté : l'usage est décompté de l'abonnement, pas facturé à
   l'API.

   lancer() démarre un appel et relaie son flux (option --output-format
   stream-json) sous forme d'événements simples :
     { type: "debut", modele }            le modèle réellement utilisé
     { type: "texte", texte }             un morceau de réponse
     { type: "outil", nom, detail }       Claude consulte un fichier, lance une commande…
     { type: "quota", info }              utilisation de l'abonnement (fenêtres de 5 h et 7 jours)
   et se termine par un objet { texte, session, structure, duree, cout, modele }. */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { tr } = require('./langue');
const { spawn, spawnSync } = require('child_process');
const reglages = require('./reglages');

const WINDOWS = process.platform === 'win32';
let cache = null; // { executable, version, erreur, cle }

/* Recherche de l'exécutable ---------------------------------------------- */

function candidats(configure) {
  const liste = [];
  if (configure) liste.push(configure);
  const noms = WINDOWS ? ['claude.exe', 'claude.cmd'] : ['claude'];
  for (const dossier of (process.env.PATH || '').split(path.delimiter)) {
    for (const n of noms) if (dossier) liste.push(path.join(dossier, n));
  }
  const maison = os.homedir();
  liste.push(path.join(maison, '.local', 'bin', WINDOWS ? 'claude.exe' : 'claude'));
  liste.push(path.join(maison, '.claude', 'local', WINDOWS ? 'claude.exe' : 'claude'));
  // Binaire fourni par l'extension VS Code (ou Cursor), version la plus récente
  for (const racine of ['.vscode', '.vscode-insiders', '.cursor', '.windsurf']) {
    const ext = path.join(maison, racine, 'extensions');
    let dossiers;
    try {
      dossiers = fs.readdirSync(ext).filter((d) => d.startsWith('anthropic.claude-code-'));
    } catch (e) {
      continue;
    }
    dossiers.sort(comparerVersions).reverse();
    for (const d of dossiers)
      liste.push(path.join(ext, d, 'resources', 'native-binary', WINDOWS ? 'claude.exe' : 'claude'));
  }
  return liste;
}

function comparerVersions(a, b) {
  const va = (a.match(/\d+/g) || []).map(Number),
    vb = (b.match(/\d+/g) || []).map(Number);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    if ((va[i] || 0) !== (vb[i] || 0)) return (va[i] || 0) - (vb[i] || 0);
  }
  return 0;
}

// Renvoie { executable, version } ou { erreur }. Le résultat est mis en cache.
// Le chemin des réglages prime ; sinon, la version la plus récente : celle du PATH
// peut être très en retard sur l'extension VS Code, et refuser les options de lancer().
function trouver(forcer) {
  const configure = reglages.lire().claude.executable;
  if (cache && cache.cle === configure && !forcer) return cache;
  cache = { cle: configure, erreur: 'Claude Code est introuvable. Indiquer son chemin dans les réglages.' };
  for (const c of candidats(configure)) {
    if (!c || !fs.existsSync(c) || c.endsWith('.cmd')) continue;
    const r = spawnSync(c, ['--version'], { encoding: 'utf8', timeout: 20000, windowsHide: true });
    if (r.status === 0 && /Claude Code/i.test(r.stdout)) {
      const version = r.stdout.trim().split(/\s+/)[0];
      if (!cache.executable || comparerVersions(version, cache.version) > 0)
        cache = { cle: configure, executable: c, version };
      if (c === configure) break;
    }
  }
  return cache;
}

/* Lancement ---------------------------------------------------------------- */

function arreterArbre(enfant) {
  if (!enfant || enfant.exitCode !== null) return;
  if (WINDOWS) spawnSync('taskkill', ['/pid', String(enfant.pid), '/t', '/f'], { windowsHide: true });
  else enfant.kill('SIGTERM');
}

function detailOutil(nom, entree) {
  if (!entree || typeof entree !== 'object') return '';
  const v = entree.file_path || entree.path || entree.pattern || entree.command || entree.description || '';
  return String(v).replace(/\\/g, '/').slice(0, 160);
}

/*
  options : {
    usage        clé de reglages.USAGES (modèle et effort)
    message      texte envoyé à Claude (entrée standard)
    systeme      prompt système (remplace celui de Claude Code) ; null : prompt par défaut
    session      identifiant (UUID) de la conversation
    reprendre    true : poursuivre la conversation « session »
    persistance  false : conversation jetable (non reprenable)
    outils       liste --tools ("" : aucun) ; undefined : outils par défaut
    autorises    liste --allowedTools
    permission   --permission-mode
    dossiers     dossiers accessibles en plus du dossier de travail (--add-dir)
    schema       schéma JSON de la réponse (--json-schema)
    cwd          dossier de travail
    delai        durée maximale en ms
    surEvenement fonction appelée pour chaque événement
  }
  Renvoie { promesse, arreter }.
*/
function lancer(options) {
  const info = trouver();
  if (!info.executable) {
    return { promesse: Promise.reject(new Error(info.erreur)), arreter() {} };
  }
  const u = reglages.lire().usages[options.usage] || {};
  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--strict-mcp-config',
    '--permission-prompts',
    'none',
  ];
  if (u.modele) args.push('--model', u.modele);
  if (u.effort) args.push('--effort', u.effort);
  if (options.systeme != null) args.push('--system-prompt', options.systeme);
  if (options.outils !== undefined) args.push('--tools', options.outils);
  if (options.autorises) args.push('--allowedTools', options.autorises);
  if (options.permission) args.push('--permission-mode', options.permission);
  for (const d of options.dossiers || []) args.push('--add-dir', d);
  if (options.schema) args.push('--json-schema', JSON.stringify(options.schema));
  if (options.persistance === false) args.push('--no-session-persistence');
  else if (options.session) args.push(options.reprendre ? '--resume' : '--session-id', options.session);

  const emettre = options.surEvenement || (() => {});
  let enfant;
  let arrete = false;
  const promesse = new Promise((resolve, reject) => {
    enfant = spawn(info.executable, args, {
      cwd: options.cwd || os.tmpdir(),
      windowsHide: true,
      env: Object.assign({}, process.env, { CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' }),
    });
    let tampon = '',
      erreurs = '',
      fin = null,
      modele = null,
      texte = '';
    const minuteur = setTimeout(() => {
      arreterArbre(enfant);
      reject(
        new Error(
          tr("Claude n'a pas répondu à temps (", 'Claude did not answer in time (') +
            Math.round((options.delai || 0) / 1000) +
            ' s).',
        ),
      );
    }, options.delai || 300000);

    function ligne(l) {
      if (!l.trim()) return;
      let d;
      try {
        d = JSON.parse(l);
      } catch (e) {
        return;
      }
      if (d.type === 'system' && d.subtype === 'init') {
        modele = d.model;
        emettre({ type: 'debut', modele });
      } else if (
        d.type === 'stream_event' &&
        d.event &&
        d.event.type === 'content_block_delta' &&
        d.event.delta &&
        d.event.delta.type === 'text_delta' &&
        !d.parent_tool_use_id
      ) {
        texte += d.event.delta.text;
        emettre({ type: 'texte', texte: d.event.delta.text });
      } else if (d.type === 'assistant' && d.message && Array.isArray(d.message.content)) {
        for (const c of d.message.content) {
          if (c.type === 'tool_use') emettre({ type: 'outil', nom: c.name, detail: detailOutil(c.name, c.input) });
          else if (c.type === 'text' && options.journalTexte) emettre({ type: 'etape', texte: c.text });
        }
      } else if (d.type === 'rate_limit_event' && d.rate_limit_info) {
        emettre({ type: 'quota', info: d.rate_limit_info });
      } else if (d.type === 'result') {
        fin = d;
      }
    }

    enfant.stdout.setEncoding('utf8');
    enfant.stdout.on('data', (morceau) => {
      tampon += morceau;
      let i;
      while ((i = tampon.indexOf('\n')) >= 0) {
        ligne(tampon.slice(0, i));
        tampon = tampon.slice(i + 1);
      }
    });
    enfant.stderr.setEncoding('utf8');
    enfant.stderr.on('data', (m) => {
      erreurs = (erreurs + m).slice(-4000);
    });
    enfant.on('error', (e) => {
      clearTimeout(minuteur);
      reject(new Error(tr('Impossible de lancer Claude Code : ', 'Cannot start Claude Code: ') + e.message));
    });
    enfant.on('close', (code) => {
      clearTimeout(minuteur);
      if (tampon) ligne(tampon);
      if (arrete) return reject(new Error(tr('Demande annulée.', 'Request cancelled.')));
      if (fin && !fin.is_error) {
        return resolve({
          texte: typeof fin.result === 'string' ? fin.result : texte,
          session: fin.session_id,
          structure: fin.structured_output || null,
          duree: fin.duration_ms,
          cout: fin.total_cost_usd,
          modele: modele,
        });
      }
      let message = String(
        (fin && (fin.result || (fin.errors || []).join(' '))) ||
          erreurs.trim() ||
          tr("Claude Code s'est arrêté (code ", 'Claude Code stopped (code ') + code + ').',
      );
      if (/(session|usage|weekly|rate) limit|limite/i.test(message)) {
        message = tr(
          "Limite d'utilisation de l'abonnement atteinte (« " +
            message.trim() +
            ' »). Réessayer après le renouvellement, ou choisir un modèle plus économe (Haiku, Sonnet) dans les réglages.',
          'Subscription usage limit reached (“' +
            message.trim() +
            '”). Try again after the reset, or choose a more economical model (Haiku, Sonnet) in the settings.',
        );
      } else if (/requires usage credits|credits/i.test(message)) {
        message = tr(
          "Ce modèle demande des crédits en plus de l'abonnement (« " +
            message.trim() +
            ' »). En choisir un autre dans les réglages.',
          'This model needs credits on top of the subscription (“' +
            message.trim() +
            '”). Choose another one in the settings.',
        );
      }
      reject(new Error(message.slice(0, 1500)));
    });

    enfant.stdin.on('error', () => {
      /* Claude a pu se terminer avant la fin de l'écriture */
    });
    enfant.stdin.end(options.message || '');
  });
  return {
    promesse,
    arreter() {
      arrete = true;
      arreterArbre(enfant);
    },
  };
}

module.exports = { trouver, lancer, arreterArbre };
