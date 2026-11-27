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
   et se termine par un objet { texte, session, structure, duree, cout, modele }.

   lancer() passe la demande à la première IA disponible dans l'ordre des préférences
   (réglage « ordre ») : Claude Code ici même, Codex CLI (lib/codex.js) ou Gemini CLI
   (lib/gemini.js), qui prennent les mêmes options et émettent les mêmes événements ;
   si elle ne répond pas, la suivante prend le relais (événement « bascule »). */

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
function lancerClaude(options) {
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

/* Assistant choisi --------------------------------------------------------------- */

const NOMS = { claude: 'Claude', codex: 'ChatGPT', gemini: 'Gemini' };
const OUTILS = { claude: 'Claude Code', codex: 'Codex CLI', gemini: 'Gemini CLI' };

function module_(f) {
  return f === 'codex' ? require('./codex') : f === 'gemini' ? require('./gemini') : null;
}

function fournisseur() {
  return reglages.lire().fournisseur || 'claude';
}

/** Outil d'un assistant : { executable, version } ou { erreur }. */
function trouverOutil(f, forcer) {
  const m = module_(f);
  return m ? m.trouver(forcer) : trouver(forcer);
}

/** L'assistant choisi : { fournisseur, nom, outil, disponible, version, executable, erreur }. */
function assistant(forcer) {
  const f = fournisseur();
  const c = trouverOutil(f, forcer);
  return {
    fournisseur: f,
    nom: NOMS[f],
    outil: OUTILS[f],
    disponible: Boolean(c.executable),
    version: c.version || null,
    executable: c.chemin || c.executable || null,
    erreur: c.executable ? null : c.erreur,
  };
}

/* IA préférées et bascule ------------------------------------------------------- */

// État de connexion de Codex et de Gemini, gardé quelques secondes : `codex login
// status` lance un processus, inutile de le refaire à chaque message.
const DUREE_CACHE_COMPTE = 20 * 1000;
const comptes = new Map();

/** Ordre d'essai des IA : celui des réglages, l'IA imposée (options.fournisseur) en tête. */
function ordre(impose) {
  const r = reglages.lire();
  const liste = (r.ordre && r.ordre.length ? r.ordre : [r.fournisseur || 'claude']).slice();
  if (impose && NOMS[impose]) return [impose].concat(liste.filter((f) => f !== impose));
  return liste;
}

/**
 * Disponibilité d'une IA, vérifiée avant chaque appel : outil trouvé sur le poste et,
 * pour Codex et Gemini, compte connecté (ou clé d'API). Renvoie { ok, raison }.
 */
async function disponible(f, forcer) {
  const t = trouverOutil(f, forcer);
  if (!t.executable) return { ok: false, raison: t.erreur || OUTILS[f] };
  const m = module_(f);
  if (!m) return { ok: true };
  const cle = f === 'codex' ? process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY;
  if (cle) return { ok: true };
  const c = comptes.get(f);
  if (c && !forcer && Date.now() - c.date < DUREE_CACHE_COMPTE) return c.etat;
  let etat;
  try {
    const compte = await m.compte();
    etat =
      compte && compte.connecte
        ? { ok: true }
        : { ok: false, raison: tr('compte non connecté', 'account not connected') };
  } catch (e) {
    etat = { ok: false, raison: e.message };
  }
  comptes.set(f, { date: Date.now(), etat });
  return etat;
}

/** Les IA connectées sur ce poste, dans l'ordre des préférences : [{ fournisseur, nom, ok, raison }]. */
async function connectees(forcer) {
  const res = [];
  for (const f of ordre())
    res.push(Object.assign({ fournisseur: f, nom: NOMS[f], outil: OUTILS[f] }, await disponible(f, forcer)));
  return res;
}

// Délai sans aucun signe de l'outil (même pas le modèle utilisé) au-delà duquel il est
// tenu pour muet et l'IA suivante prend le relais
const DELAI_SILENCE = 90 * 1000;

/*
  Lance la demande avec la première IA disponible dans l'ordre des préférences ; si elle
  échoue avant d'avoir commencé sa réponse (outil absent, compte déconnecté, quota,
  réseau, silence prolongé), la suivante prend le relais et un événement
  { type: "bascule", de, vers, raison } est émis. Chaque appel repart du haut de la liste :
  l'IA préférée reprend la main dès qu'elle répond de nouveau.

  Options en plus de celles de lancerClaude :
    fournisseur          IA à essayer en premier (choix explicite de l'utilisateur)
    fournisseurSession   IA qui a tenu la conversation « session » jusque-là
    messageSansReprise   message complet (contexte et historique) à envoyer à une autre
                         IA, qui ne peut pas reprendre la session d'une autre
    ecritureBloquante    true (génération) : pas de bascule une fois un fichier écrit
  La promesse renvoie le résultat de l'outil, plus { fournisseur, bascules: [{ de, raison }] }.
*/
function lancer(options) {
  // options.seul : l'IA choisie seulement, sans relais (analyses de l'administrateur)
  const liste = options.seul && NOMS[options.fournisseur] ? [options.fournisseur] : ordre(options.fournisseur);
  const emettre = (e) => options.surEvenement && options.surEvenement(e);
  let courant = null;
  let arrete = false;
  const promesse = (async () => {
    const bascules = [];
    let precedente = null;
    for (let i = 0; i < liste.length; i++) {
      const f = liste[i];
      if (arrete) throw new Error(tr('Demande annulée.', 'Request cancelled.'));
      const d = await disponible(f);
      if (!d.ok) {
        bascules.push({ de: f, raison: d.raison });
        if (!precedente) precedente = f;
        continue;
      }
      if (bascules.length)
        emettre({
          type: 'bascule',
          de: precedente || bascules[0].de,
          vers: f,
          raison: bascules[bascules.length - 1].raison,
        });
      const autre = options.reprendre && options.fournisseurSession && options.fournisseurSession !== f;
      const opts = Object.assign(
        {},
        options,
        autre ? { reprendre: false, message: options.messageSansReprise || options.message } : {},
      );
      let commence = false;
      let silence = false;
      let minuterie = null;
      const surveiller = () => {
        clearTimeout(minuterie);
        minuterie = null;
      };
      opts.surEvenement = (e) => {
        surveiller();
        if (
          options.ecritureBloquante
            ? e.type === 'outil' && /^(Write|Edit|MultiEdit|write_file|replace|apply_patch)/i.test(e.nom || '')
            : e.type === 'texte'
        )
          commence = true;
        emettre(e);
      };
      const m = module_(f);
      courant = m ? m.lancer(opts) : lancerClaude(opts);
      minuterie = setTimeout(() => {
        silence = true;
        courant.arreter();
      }, DELAI_SILENCE);
      try {
        const r = await courant.promesse;
        surveiller();
        return Object.assign(r, { fournisseur: f, bascules });
      } catch (e) {
        surveiller();
        if (arrete || commence || i === liste.length - 1) throw e;
        comptes.delete(f);
        bascules.push({
          de: f,
          raison: silence
            ? tr(`aucune réponse en ${DELAI_SILENCE / 1000} s`, `no response within ${DELAI_SILENCE / 1000} s`)
            : String(e.message).slice(0, 300),
        });
        precedente = f;
      }
    }
    const e = new Error(
      tr('Aucune IA disponible : ', 'No AI available: ') +
        bascules.map((b) => NOMS[b.de] + ' (' + b.raison + ')').join(' ; '),
    );
    e.bascules = bascules;
    throw e;
  })();
  return {
    promesse,
    arreter() {
      arrete = true;
      if (courant) courant.arreter();
    },
  };
}

module.exports = {
  trouver,
  lancer,
  lancerClaude,
  arreterArbre,
  assistant,
  trouverOutil,
  ordre,
  disponible,
  connectees,
  NOMS,
  OUTILS,
};
