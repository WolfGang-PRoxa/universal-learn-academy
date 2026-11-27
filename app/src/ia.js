'use strict';
/* Connexion à ChatGPT (par Codex CLI) et à Gemini (par Gemini CLI), sur le modèle de
   la connexion à Claude (claude.js) : deux modes au choix pour chacun.
   - « compte » : l'outil, installé sur le poste, est connecté par l'utilisateur
     lui-même, dans un terminal (`codex login`, ou `gemini` et « Sign in with
     Google ») : l'application ne voit jamais les identifiants ;
   - « cle » : clé d'API personnelle (OpenAI ou Gemini), chiffrée par le système
     (safeStorage), jamais renvoyée à l'interface, transmise à l'outil par
     l'environnement du serveur local (CODEX_API_KEY et OPENAI_API_KEY, ou
     GEMINI_API_KEY).

   L'outil lui-même (recherche, état du compte, connexion, déconnexion) est géré par
   le serveur local des quiz (_outils/quiz/serveur/lib/codex.js et gemini.js), qui
   le lance aussi pour chaque demande. */

const { safeStorage, shell } = require('electron');
const { t } = require('./i18n');
const reglages = require('./reglages');
const { chiffrementDisponible } = require('./claude');

const FOURNISSEURS = {
  codex: {
    variables: ['CODEX_API_KEY', 'OPENAI_API_KEY'],
    forme: /^sk-[\w-]{20,}$/,
    editeur: 'OpenAI',
    liens: {
      installation: 'https://developers.openai.com/codex/cli',
      cles: 'https://platform.openai.com/api-keys',
    },
    tester: (cle) =>
      fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: 'Bearer ' + cle },
        signal: AbortSignal.timeout(15000),
      }),
  },
  gemini: {
    variables: ['GEMINI_API_KEY'],
    forme: /^[\w-]{30,}$/,
    editeur: 'Google',
    liens: {
      installation: 'https://github.com/google-gemini/gemini-cli#-installation',
      cles: 'https://aistudio.google.com/apikey',
    },
    tester: (cle) =>
      fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
        headers: { 'x-goog-api-key': cle },
        signal: AbortSignal.timeout(15000),
      }),
  },
};

function verifier(f) {
  if (!FOURNISSEURS[f]) throw new Error(t('ia.inconnu'));
  return FOURNISSEURS[f];
}

function cle(f) {
  const enregistree = reglages.lire()[f].cle;
  if (!enregistree || !enregistree.startsWith('enc:')) return '';
  try {
    return safeStorage.decryptString(Buffer.from(enregistree.slice(4), 'base64'));
  } catch (e) {
    return '';
  }
}

async function testerCle(f, valeur) {
  const d = verifier(f);
  try {
    const r = await d.tester(valeur);
    if (r.ok) return { valide: true };
    if (r.status === 400 || r.status === 401 || r.status === 403)
      return { valide: false, message: t('ia.cleRefusee', { editeur: d.editeur }) };
    return { valide: null, message: t('ia.verificationStatut', { statut: r.status, editeur: d.editeur }) };
  } catch (e) {
    return { valide: null, message: t('ia.verificationReseau', { editeur: d.editeur }) };
  }
}

async function enregistrerCle(f, valeur) {
  const d = verifier(f);
  const texte = String(valeur || '').trim();
  if (!texte) {
    reglages.modifier({ [f]: { cle: '' } });
    return { ok: true, supprimee: true };
  }
  if (!d.forme.test(texte)) throw new Error(t('ia.pasUneCle.' + f));
  if (!chiffrementDisponible()) throw new Error(t('c.sansTrousseau'));
  const test = await testerCle(f, texte);
  if (test.valide === false) throw new Error(test.message);
  reglages.modifier({ [f]: { cle: 'enc:' + safeStorage.encryptString(texte).toString('base64') } });
  return { ok: true, avertissement: test.valide === null ? test.message : null };
}

/** État complet : outil et compte (serveur local), mode et clé (application). */
async function statut(f, apiQuiz) {
  verifier(f);
  const r = reglages.lire()[f];
  const base = {
    fournisseur: f,
    mode: r.mode,
    cleEnregistree: Boolean(r.cle),
    cleLisible: Boolean(r.cle) && Boolean(cle(f)),
    chiffrementDisponible: chiffrementDisponible(),
    cleActive: process.env['ULA_CLE_' + f.toUpperCase()] === '1',
  };
  try {
    const s = await apiQuiz('GET', 'ia/statut?f=' + f);
    return Object.assign(base, { outil: s.outil, erreur: s.erreur, compte: s.compte });
  } catch (e) {
    return Object.assign(base, { outil: null, serveur: e.message });
  }
}

/** À appeler avant de démarrer le serveur : les clés passent par l'environnement. */
function appliquer() {
  const r = reglages.lire();
  for (const [f, d] of Object.entries(FOURNISSEURS)) {
    if (r[f].mode !== 'cle') continue;
    const valeur = cle(f);
    if (!valeur) continue;
    for (const v of d.variables) process.env[v] = valeur;
    process.env['ULA_CLE_' + f.toUpperCase()] = '1';
  }
}

function ouvrirLien(f, nom) {
  const url = verifier(f).liens[nom];
  if (url) shell.openExternal(url);
}

module.exports = { FOURNISSEURS, statut, enregistrerCle, appliquer, ouvrirLien };
