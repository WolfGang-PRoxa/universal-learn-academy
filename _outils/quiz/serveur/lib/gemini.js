'use strict';
/* Appels à Gemini CLI en mode non interactif (message sur l'entrée standard,
   --output-format stream-json), avec le compte Google connecté par l'utilisateur
   dans Gemini CLI (« Sign in with Google ») ou une clé d'API Gemini (variable
   GEMINI_API_KEY, posée par l'application).

   lancer() prend les mêmes options que celui de Claude Code (lib/claude.js) et
   émet les mêmes événements. Différences :
   - les consignes passent en tête du premier message (pas de prompt système) ;
   - la conversation garde l'identifiant donné par la page (--session-id, puis
     --resume) ;
   - pas de schéma imposé : la réponse JSON attendue est décrite dans le message,
     puis relue ;
   - outils : lecture seule par défaut ; pour la génération de quiz, écriture de
     fichiers et commandes python ou node acceptées sans confirmation.

   La connexion se fait dans Gemini CLI lui-même : il n'a pas de commande de
   connexion, l'état est lu dans ~/.gemini (réglages et compte actif, jamais les
   jetons), et la déconnexion fait ce que fait Gemini CLI : elle efface le fichier
   des identifiants mis en cache. */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { tr } = require('./langue');
const reglages = require('./reglages');
const cli = require('./cli');

let cache = null;

function trouver(forcer) {
  const configure = reglages.lire().gemini.executable;
  if (cache && cache.cle === configure && !forcer) return cache;
  cache = Object.assign(
    { cle: configure },
    cli.trouver(
      'gemini',
      configure,
      (sortie) => (sortie.trim().match(/^v?(\d+\.\d+\.\d+)/m) || [])[1] || null,
      tr(
        'Gemini CLI est introuvable : l’installer (npm install -g @google/gemini-cli), ou indiquer son chemin dans les réglages.',
        'Gemini CLI not found: install it (npm install -g @google/gemini-cli), or give its path in the settings.',
      ),
    ),
  );
  return cache;
}

function dossierGemini() {
  return path.join(process.env.GEMINI_CLI_HOME || os.homedir(), '.gemini');
}

function lireJson(f) {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    return null;
  }
}

/** État de connexion d'après ~/.gemini, sans lire aucun jeton. */
async function compte() {
  const d = dossierGemini();
  const r = lireJson(path.join(d, 'settings.json')) || {};
  const type = (r.security && r.security.auth && r.security.auth.selectedType) || r.selectedAuthType || null;
  const comptes = lireJson(path.join(d, 'google_accounts.json')) || {};
  const identifiants = fs.existsSync(path.join(d, 'oauth_creds.json'));
  if (type === 'oauth-personal' && (identifiants || comptes.active))
    return { connecte: true, methode: 'google', email: comptes.active || null };
  if (type === 'gemini-api-key') return { connecte: Boolean(process.env.GEMINI_API_KEY), methode: 'cle' };
  if (type === 'vertex-ai') return { connecte: true, methode: 'vertex' };
  return { connecte: false };
}

function connecter() {
  const info = trouver(true);
  if (!info.executable) throw new Error(info.erreur);
  // Gemini CLI interactif : il propose « Sign in with Google » au premier lancement
  cli.ouvrirTerminal(info, [], {
    titre: tr('ULA - connexion à Gemini', 'ULA - sign in to Gemini'),
    sansVariables: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    messageSansTerminal: tr(
      'Aucun terminal trouvé : lancer « gemini » dans un terminal.',
      'No terminal found: run “gemini” in a terminal.',
    ),
  });
  return { ok: true };
}

async function deconnecter() {
  const d = dossierGemini();
  fs.rmSync(path.join(d, 'oauth_creds.json'), { force: true });
  const f = path.join(d, 'google_accounts.json');
  const comptes = lireJson(f);
  if (comptes && comptes.active) {
    const anciens = Array.isArray(comptes.old) ? comptes.old : [];
    if (!anciens.includes(comptes.active)) anciens.push(comptes.active);
    fs.writeFileSync(f, JSON.stringify({ active: null, old: anciens }, null, 2), 'utf8');
  }
  return { ok: true };
}

function lancer(options) {
  const info = trouver();
  if (!info.executable) return { promesse: Promise.reject(new Error(info.erreur)), arreter() {} };
  const modele = reglages.lire().gemini.modele || '';
  const ecriture = options.permission === 'acceptEdits' || /\b(Write|Edit)\b/.test(options.autorises || '');
  const args = ['--output-format', 'stream-json', '--skip-trust'];
  if (modele) args.push('-m', modele);
  if (ecriture)
    args.push(
      '--approval-mode',
      'auto_edit',
      '--allowed-tools',
      'run_shell_command(python),run_shell_command(py),run_shell_command(node)',
    );
  if ((options.dossiers || []).length) args.push('--include-directories', options.dossiers.join(','));
  if (options.session && options.persistance !== false)
    args.push(options.reprendre ? '--resume' : '--session-id', options.session);

  let message = options.message || '';
  if (options.systeme && !options.reprendre)
    message = '# Consignes\n\n' + options.systeme + '\n\n# Message\n\n' + message;
  if (options.schema)
    message +=
      tr(
        '\n\nRéponds uniquement par un objet JSON conforme à ce schéma, sans texte autour :\n',
        '\n\nAnswer only with a JSON object matching this schema, with no text around it:\n',
      ) + JSON.stringify(options.schema);

  const emettre = options.surEvenement || (() => {});
  let enfant;
  let arrete = false;
  const promesse = new Promise((resolve, reject) => {
    enfant = spawn(info.executable, [...info.prefixe, ...args], {
      cwd: options.cwd || os.tmpdir(),
      windowsHide: true,
      env: Object.assign({}, process.env, { NO_COLOR: '1' }),
    });
    let tampon = '',
      erreurs = '',
      texte = '',
      fin = null,
      derniereErreur = '',
      modeleReel = modele || 'gemini';
    const minuteur = setTimeout(() => {
      cli.arreterArbre(enfant);
      reject(
        new Error(
          tr("Gemini n'a pas répondu à temps (", 'Gemini did not answer in time (') +
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
      if (d.type === 'init') {
        if (d.model && d.model !== 'auto') modeleReel = d.model;
        emettre({ type: 'debut', modele: modeleReel });
      } else if (d.type === 'message' && d.role === 'assistant' && typeof d.content === 'string') {
        texte += d.content;
        emettre({ type: 'texte', texte: d.content });
      } else if (d.type === 'tool_use') {
        if (options.journalTexte && texte.trim()) emettre({ type: 'etape', texte: texte.trim() });
        texte = '';
        const p = d.parameters || {};
        const detail = p.file_path || p.absolute_path || p.path || p.pattern || p.command || p.dir_path || '';
        emettre({ type: 'outil', nom: d.tool_name, detail: String(detail).replace(/\\/g, '/').slice(0, 160) });
      } else if (d.type === 'error' && d.message) derniereErreur = d.message;
      else if (d.type === 'result') fin = d;
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
      reject(new Error(tr('Impossible de lancer Gemini CLI : ', 'Cannot start Gemini CLI: ') + e.message));
    });
    enfant.on('close', (code) => {
      clearTimeout(minuteur);
      if (tampon) ligne(tampon);
      if (arrete) return reject(new Error(tr('Demande annulée.', 'Request cancelled.')));
      if (fin && fin.status === 'success') {
        if (fin.stats && fin.stats.models) {
          const utilises = Object.keys(fin.stats.models);
          if (utilises.length === 1) modeleReel = utilises[0];
        }
        return resolve({
          texte: texte.trim(),
          session: options.session || null,
          structure: options.schema ? cli.extraireJson(texte) : null,
          duree: fin.stats && fin.stats.duration_ms,
          modele: modeleReel,
        });
      }
      let message =
        (fin && fin.error && fin.error.message) ||
        derniereErreur ||
        erreurs
          .trim()
          .split('\n')
          .filter((x) => !/^Warning:/.test(x))
          .slice(-3)
          .join(' ') ||
        tr('Gemini CLI s’est arrêté (code ', 'Gemini CLI stopped (code ') + code + ').';
      if (/set an auth method|api key not valid|unauthenticated|login required|401/i.test(message))
        message = tr(
          'Gemini n’est pas connecté : se connecter dans les paramètres (Assistant IA), ou y enregistrer une clé d’API Gemini (« ' +
            message.trim().slice(0, 200) +
            ' »).',
          'Gemini is not signed in: sign in from the settings (AI assistant), or save a Gemini API key there (“' +
            message.trim().slice(0, 200) +
            '”).',
        );
      else if (/quota|rate limit|resource_exhausted|429/i.test(message))
        message = tr(
          'Limite d’utilisation de Gemini atteinte (« ' + message.trim() + ' »). Réessayer plus tard.',
          'Gemini usage limit reached (“' + message.trim() + '”). Try again later.',
        );
      reject(new Error(String(message).slice(0, 1500)));
    });

    enfant.stdin.on('error', () => {
      /* Gemini a pu se terminer avant la fin de l'écriture */
    });
    enfant.stdin.end(message);
  });
  return {
    promesse,
    arreter() {
      arrete = true;
      cli.arreterArbre(enfant);
    },
  };
}

module.exports = { trouver, compte, connecter, deconnecter, lancer };
