'use strict';
/* Appels à Codex CLI en mode non interactif (codex exec --json), avec le compte
   ChatGPT connecté par l'utilisateur (`codex login`) ou une clé d'API OpenAI
   (variables CODEX_API_KEY et OPENAI_API_KEY, posées par l'application).

   lancer() prend les mêmes options que celui de Claude Code (lib/claude.js) et
   émet les mêmes événements (debut, texte, outil, etape), pour que l'aide, la
   correction, l'évaluation et la génération de quiz marchent avec l'un ou l'autre.
   Différences :
   - pas de prompt système : les consignes passent en tête du premier message ;
   - Codex choisit l'identifiant de sa conversation : il est associé à celui de la
     page dans sessions-codex.json (dossier local des conversations) ;
   - les outils sont réglés par le bac à sable : lecture seule, ou écriture dans le
     dossier de travail (et les dossiers ajoutés) pour la génération de quiz. */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { tr } = require('./langue');
const reglages = require('./reglages');
const cli = require('./cli');
const { dossierLocal } = require('./chemins');

let cache = null;

/** { executable, prefixe, version } ou { erreur }, gardé en cache. */
function trouver(forcer) {
  const configure = reglages.lire().codex.executable;
  if (cache && cache.cle === configure && !forcer) return cache;
  cache = Object.assign(
    { cle: configure },
    cli.trouver(
      'codex',
      configure,
      (sortie) => (/codex/i.test(sortie) && (sortie.match(/\d+\.\d+\.\d+/) || [])[0]) || null,
      tr(
        'Codex CLI est introuvable : l’installer (npm install -g @openai/codex), ou indiquer son chemin dans les réglages.',
        'Codex CLI not found: install it (npm install -g @openai/codex), or give its path in the settings.',
      ),
    ),
  );
  return cache;
}

/** État de connexion (`codex login status`), sans aucun secret. */
async function compte() {
  const info = trouver();
  if (!info.executable) return null;
  const env = Object.assign({}, process.env);
  delete env.OPENAI_API_KEY;
  delete env.CODEX_API_KEY;
  const r = await cli.lire(info, ['login', 'status'], { env });
  const texte = (r.stdout + '\n' + r.stderr).trim();
  if (/logged in using chatgpt/i.test(texte)) return { connecte: true, methode: 'chatgpt' };
  if (/logged in using an api key/i.test(texte)) return { connecte: true, methode: 'cle' };
  if (/logged in/i.test(texte) && !/not logged in/i.test(texte)) return { connecte: true, methode: null };
  return { connecte: false };
}

function connecter() {
  const info = trouver(true);
  if (!info.executable) throw new Error(info.erreur);
  cli.ouvrirTerminal(info, ['login'], {
    titre: tr('ULA - connexion à ChatGPT (Codex)', 'ULA - sign in to ChatGPT (Codex)'),
    sansVariables: ['OPENAI_API_KEY', 'CODEX_API_KEY'],
    messageSansTerminal: tr(
      'Aucun terminal trouvé : lancer « codex login » dans un terminal.',
      'No terminal found: run “codex login” in a terminal.',
    ),
  });
  return { ok: true };
}

async function deconnecter() {
  const info = trouver();
  if (!info.executable) throw new Error(info.erreur);
  const r = await cli.lire(info, ['logout']);
  if (r.status !== 0)
    throw new Error((r.stderr || r.stdout || tr('Déconnexion impossible.', 'Sign-out failed.')).trim().slice(0, 300));
  return { ok: true };
}

// Effort de Claude (low … max) → effort de raisonnement de Codex
const EFFORTS = { low: 'low', medium: 'medium', high: 'high', xhigh: 'high', max: 'high' };

function lancer(options) {
  const info = trouver();
  if (!info.executable) return { promesse: Promise.reject(new Error(info.erreur)), arreter() {} };
  const r = reglages.lire();
  const u = r.usages[options.usage] || {};
  const modele = r.codex.modele || '';
  const ecriture = options.permission === 'acceptEdits' || /\b(Write|Edit)\b/.test(options.autorises || '');
  const sessions = cli.memoireSessions(path.join(dossierLocal('conversations'), 'sessions-codex.json'));
  const reprise = options.reprendre && options.session ? sessions.lire(options.session) : null;
  if (options.reprendre && !reprise)
    return {
      promesse: Promise.reject(
        new Error(
          tr(
            'Cette conversation a été commencée avec un autre assistant : en ouvrir une nouvelle.',
            'This conversation was started with another assistant: open a new one.',
          ),
        ),
      ),
      arreter() {},
    };

  const args = ['exec', '--json', '--skip-git-repo-check', '--color', 'never'];
  args.push('-s', ecriture ? 'workspace-write' : 'read-only');
  args.push('-C', options.cwd || os.tmpdir());
  if (ecriture) for (const d of options.dossiers || []) args.push('--add-dir', d);
  if (modele) args.push('-m', modele);
  if (EFFORTS[u.effort]) args.push('-c', 'model_reasoning_effort="' + EFFORTS[u.effort] + '"');
  if (options.persistance === false) args.push('--ephemeral');
  let fichierSchema = null;
  if (options.schema) {
    fichierSchema = path.join(os.tmpdir(), 'ula-schema-' + process.pid + '-' + Date.now() + '.json');
    fs.writeFileSync(fichierSchema, JSON.stringify(cli.schemaStrict(options.schema)), 'utf8');
    args.push('--output-schema', fichierSchema);
  }
  if (reprise) args.push('resume', reprise);
  args.push('-');

  let message = options.message || '';
  if (options.systeme && !reprise) message = '# Consignes\n\n' + options.systeme + '\n\n# Message\n\n' + message;

  const emettre = options.surEvenement || (() => {});
  let enfant;
  let arrete = false;
  const promesse = new Promise((resolve, reject) => {
    enfant = spawn(info.executable, [...info.prefixe, ...args], {
      cwd: options.cwd || os.tmpdir(),
      windowsHide: true,
      env: Object.assign({}, process.env),
    });
    let tampon = '',
      erreurs = '',
      dernierMessage = '',
      derniereErreur = '',
      fil = reprise;
    const nettoyer = () => {
      if (fichierSchema) fs.rm(fichierSchema, { force: true }, () => {});
    };
    const minuteur = setTimeout(() => {
      cli.arreterArbre(enfant);
      reject(
        new Error(
          tr("ChatGPT n'a pas répondu à temps (", 'ChatGPT did not answer in time (') +
            Math.round((options.delai || 0) / 1000) +
            ' s).',
        ),
      );
    }, options.delai || 300000);
    emettre({ type: 'debut', modele: modele || 'codex' });

    function ligne(l) {
      if (!l.trim()) return;
      let d;
      try {
        d = JSON.parse(l);
      } catch (e) {
        return;
      }
      if (d.type === 'thread.started' && d.thread_id) fil = d.thread_id;
      else if (d.type === 'item.completed' && d.item) {
        const it = d.item;
        if (it.type === 'agent_message' && it.text) {
          if (dernierMessage && options.journalTexte) emettre({ type: 'etape', texte: dernierMessage });
          dernierMessage = it.text;
        } else if (it.type === 'command_execution')
          emettre({ type: 'outil', nom: 'Bash', detail: String(it.command || '').slice(0, 160) });
        else if (it.type === 'file_change')
          for (const c of it.changes || [])
            emettre({ type: 'outil', nom: 'Write', detail: String(c.path || '').replace(/\\/g, '/') });
        else if (it.type === 'error' && it.message) derniereErreur = it.message;
      } else if (d.type === 'turn.failed') derniereErreur = (d.error && d.error.message) || derniereErreur;
      else if (d.type === 'error' && d.message && !/^Reconnecting/i.test(d.message)) derniereErreur = d.message;
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
      nettoyer();
      reject(new Error(tr('Impossible de lancer Codex CLI : ', 'Cannot start Codex CLI: ') + e.message));
    });
    enfant.on('close', (code) => {
      clearTimeout(minuteur);
      nettoyer();
      if (tampon) ligne(tampon);
      if (arrete) return reject(new Error(tr('Demande annulée.', 'Request cancelled.')));
      if (code === 0 && dernierMessage) {
        if (options.session && fil && options.persistance !== false) sessions.ecrire(options.session, fil);
        emettre({ type: 'texte', texte: dernierMessage });
        return resolve({
          texte: dernierMessage,
          session: options.session || fil,
          structure: options.schema ? cli.extraireJson(dernierMessage) : null,
          modele: modele || 'codex',
        });
      }
      let message =
        derniereErreur ||
        erreurs.trim().split('\n').slice(-3).join(' ') ||
        tr('Codex CLI s’est arrêté (code ', 'Codex CLI stopped (code ') + code + ').';
      if (/401|unauthori[sz]ed|not logged in|missing bearer/i.test(message))
        message = tr(
          'ChatGPT (Codex) n’est pas connecté : se connecter dans les paramètres (Assistant IA), ou y enregistrer une clé d’API OpenAI.',
          'ChatGPT (Codex) is not signed in: sign in from the settings (AI assistant), or save an OpenAI API key there.',
        );
      else if (/usage limit|rate limit|quota/i.test(message))
        message = tr(
          'Limite d’utilisation du compte ChatGPT atteinte (« ' + message.trim() + ' »). Réessayer plus tard.',
          'ChatGPT account usage limit reached (“' + message.trim() + '”). Try again later.',
        );
      reject(new Error(String(message).slice(0, 1500)));
    });

    enfant.stdin.on('error', () => {
      /* Codex a pu se terminer avant la fin de l'écriture */
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
