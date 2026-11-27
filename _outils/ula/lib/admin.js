'use strict';
/* Soumissions reçues, chez l'administrateur du catalogue (son installation, avec le
   jeton d'administration du service de soumission enregistré dans les paramètres).

   - lister / detail : les soumissions du service (cloudflare/, routes /v1/admin/…) ;
   - analyser : télécharge l'archive dans <racine>/soumissions-recues/<id>/, relance
     les contrôles et les trois vérificateurs sur les pages extraites, puis fait relire
     le cours par l'IA choisie (Claude, Codex ou Gemini, sans relais vers une autre),
     qui rend une recommandation (accepter, corriger, refuser) ; le verdict est rangé
     sur le poste et envoyé au service (état « en analyse »). Les analyses passent une
     à une, dans une file ;
   - decider : accepter (en mode dépôt, le cours entre dans explore/ par
     app/scripts/accepter-proposition.mjs) ou refuser, avec un message pour l'auteur ;
   - bloquer : refuse les prochaines soumissions de cette installation.

   Rien n'est jamais accepté sans une décision de l'administrateur. Le jeton vient de
   l'environnement (ULA_ADMIN_JETON, posé par l'application) ou de definirJeton(). */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { tr } = require('../../quiz/serveur/lib/langue');
const { OUTILS } = require('../../quiz/serveur/lib/chemins');
const envoi = require('./envoi');
const proposition = require('./proposition');
const soumission = require('./soumission');
const zip = require('./zip');

const DOSSIER = 'soumissions-recues';
const ID = /^[0-9]{8}-[0-9a-f]{8}$/;
const RECOMMANDATIONS = ['accepter', 'corriger', 'refuser'];

let jetonMemoire = null;
function definirJeton(j) {
  jetonMemoire = j ? String(j).trim() : '';
}
function jeton() {
  return jetonMemoire !== null ? jetonMemoire : process.env.ULA_ADMIN_JETON || '';
}
function configure() {
  return Boolean(jeton());
}

function verifierId(id) {
  if (!ID.test(String(id))) throw new Error(tr('Soumission inconnue.', 'Unknown submission.'));
  return String(id);
}

async function appel(route, options = {}) {
  if (!configure()) throw new Error(tr('Aucun jeton d’administration enregistré.', 'No administration token saved.'));
  const f = options.fetch || fetch;
  const r = await f(envoi.service() + '/v1/admin/' + route, {
    method: options.methode || 'GET',
    headers: Object.assign(
      { Authorization: 'Bearer ' + jeton() },
      options.corps ? { 'Content-Type': 'application/json' } : {},
    ),
    body: options.corps ? JSON.stringify(options.corps) : undefined,
    signal: AbortSignal.timeout(options.brut ? 120000 : 20000),
  });
  if (r.status === 401) throw new Error(tr('Jeton d’administration refusé.', 'Administration token refused.'));
  if (options.brut) {
    if (!r.ok) throw new Error(tr(`Le service a répondu ${r.status}.`, `The service answered ${r.status}.`));
    return Buffer.from(await r.arrayBuffer());
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erreur || tr(`Le service a répondu ${r.status}.`, `The service answered ${r.status}.`));
  return d;
}

/* Rangement sur le poste ------------------------------------------------------------- */

function dossierDe(racine, id) {
  return path.join(racine, DOSSIER, verifierId(id));
}
function lireLocal(racine, id) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dossierDe(racine, id), 'local.json'), 'utf8'));
  } catch (e) {
    return {};
  }
}
function ecrireLocal(racine, id, maj) {
  const d = dossierDe(racine, id);
  fs.mkdirSync(d, { recursive: true });
  const x = Object.assign(lireLocal(racine, id), maj);
  fs.writeFileSync(path.join(d, 'local.json'), JSON.stringify(x, null, 2) + '\n');
  return x;
}

/** Archive téléchargée (une fois) puis extraite dans <id>/cours/. */
async function telecharger(racine, id, options = {}) {
  const d = dossierDe(racine, id);
  const archive = path.join(d, 'cours.zip');
  const cours = path.join(d, 'cours');
  if (!fs.existsSync(archive)) {
    const octets = await appel(`soumissions/${id}/archive`, Object.assign({}, options, { brut: true }));
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(archive, octets);
  }
  if (!fs.existsSync(path.join(cours, 'ula-cours.json'))) {
    fs.rmSync(cours, { recursive: true, force: true });
    zip.extraire(archive, cours);
  }
  return { archive, cours };
}

/* Liste et détail -------------------------------------------------------------------- */

async function lister(racine, etat, options = {}) {
  const d = await appel('soumissions' + (etat ? '?etat=' + encodeURIComponent(etat) : ''), options);
  return (d.soumissions || []).map((s) => Object.assign(s, { local: resumeLocal(racine, s.id) }));
}

function resumeLocal(racine, id) {
  const l = lireLocal(racine, id);
  const f = file.find((x) => x.id === id);
  return {
    telechargee: fs.existsSync(path.join(racine, DOSSIER, id, 'cours.zip')),
    analyse: l.analyse || null,
    decision: l.decision || null,
    enCours: f ? f.etape : null,
  };
}

async function detail(racine, id, options = {}) {
  const s = await appel('soumissions/' + verifierId(id), options);
  return Object.assign(s, { local: Object.assign(lireLocal(racine, id), resumeLocal(racine, id)) });
}

/* Analyses --------------------------------------------------------------------------- */

const file = []; // { id, fournisseur, etape }
let enMarche = false;

function etatAnalyses() {
  return { file: file.map((x) => ({ id: x.id, fournisseur: x.fournisseur, etape: x.etape })) };
}

/** Met des soumissions dans la file d'analyse (sans doublon). */
function analyser(racine, ids, fournisseur, options = {}) {
  if (!['claude', 'codex', 'gemini'].includes(fournisseur)) throw new Error(tr('IA inconnue.', 'Unknown AI.'));
  let ajoutees = 0;
  for (const id of ids.map(verifierId)) {
    if (file.some((x) => x.id === id)) continue;
    file.push({ id, fournisseur, etape: 'attente' });
    ajoutees++;
  }
  if (!enMarche) {
    enMarche = true;
    (async () => {
      while (file.length) {
        const x = file[0];
        try {
          await analyserUne(racine, x, options);
        } catch (e) {
          ecrireLocal(racine, x.id, { erreur: { date: new Date().toISOString(), texte: e.message } });
        }
        file.shift();
      }
      enMarche = false;
    })();
  }
  return Object.assign(etatAnalyses(), { ajoutees });
}

async function verifications(racine, cours, options) {
  const resultats = [];
  const c = proposition.controler(cours, {});
  resultats.push({
    id: 'controle',
    etat: c.problemes.length ? 'echec' : c.avertissements.length ? 'avertissement' : 'ok',
    detail: c.problemes.concat(c.avertissements).slice(0, 40),
  });
  const dossiers = ['generated_courses', 'generated_quizzes']
    .map((d) => path.join(cours, d))
    .filter((d) => fs.existsSync(d));
  const executer = options.executer || require('../../quiz/serveur/lib/executer');
  const python = soumission.pythonDisponible(executer);
  const lancer = async (id, commande, script) => {
    if (!dossiers.length) return resultats.push({ id, etat: 'ok', detail: [] });
    if (!commande)
      return resultats.push({ id, etat: 'non_faite', detail: [tr('Python introuvable.', 'Python not found.')] });
    const r = await soumission.lancerScript(commande, [path.join(OUTILS, ...script), ...dossiers], racine, {
      ULA_RACINE: racine,
    });
    resultats.push({
      id,
      etat: r.code === 0 ? (soumission.avertissements(r.sortie) ? 'avertissement' : 'ok') : 'echec',
      detail: soumission.lignesUtiles(r.sortie, racine, path.relative(racine, cours).split(path.sep).join('/')),
    });
  };
  await lancer('charte', python, ['charte', 'outils', 'verifier.py']);
  await lancer('quiz', python, ['quiz', 'outils', 'verifier_quiz.py']);
  await lancer('atelier', process.execPath, ['atelier', 'outils', 'verifier.js']);
  return resultats;
}

function consigneRevue(s, verifs) {
  const m = s.manifeste || {};
  return [
    "Tu relis un cours soumis au catalogue d'Universal Learn Academy par un utilisateur. Le dossier courant",
    "contient le cours extrait de l'archive : ula-cours.json (fiche), ula-soumission.json (manifeste :",
    'informations de génération mesurées et déclarées, vérifications faites chez l’auteur) et les pages de',
    'generated_courses/ et generated_quizzes/. Ne modifie aucun fichier.',
    '',
    'Juge, en lisant les pages : la justesse du contenu (erreurs, approximations), sa clarté et sa progression',
    'pédagogique, sa cohérence avec la fiche (titre, domaine, niveau), le respect de la charte des cours',
    '(README de _outils/charte, _outils/quiz et _outils/atelier), la qualité des quiz et des ateliers, et',
    'l’absence de toute donnée personnelle, de contenu protégé copié ou de contenu inapproprié.',
    '',
    '# Vérifications automatiques refaites sur ce poste',
    ...verifs.map((v) => `- ${v.id} : ${v.etat}${v.detail.length ? ' — ' + v.detail.slice(0, 8).join(' | ') : ''}`),
    '',
    '# Fiche',
    JSON.stringify(m.fiche || s.fiche || {}, null, 2).slice(0, 4000),
    '',
    'Termine OBLIGATOIREMENT ta réponse par un bloc ```json, seul, de la forme :',
    '{"recommandation": "accepter" | "corriger" | "refuser", "resume": "deux ou trois phrases pour',
    'l’auteur, en français", "details": ["point précis (page : problème)", "..."], "note": 0 à 10}',
  ].join('\n');
}

/** Dernier objet JSON de la réponse qui porte une recommandation. */
function lireVerdict(texte) {
  const blocs = [...String(texte).matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map((m) => m[1]);
  const fin = String(texte).lastIndexOf('{');
  if (fin >= 0) blocs.push(String(texte).slice(fin));
  for (const b of blocs.reverse()) {
    try {
      const v = JSON.parse(b.trim());
      if (v && RECOMMANDATIONS.includes(v.recommandation))
        return {
          recommandation: v.recommandation,
          resume: String(v.resume || '').slice(0, 1500),
          details: (Array.isArray(v.details) ? v.details : []).map((d) => String(d).slice(0, 400)).slice(0, 40),
          note: Number.isFinite(Number(v.note)) ? Math.max(0, Math.min(10, Number(v.note))) : null,
        };
    } catch (e) {
      /* bloc suivant */
    }
  }
  return null;
}

async function analyserUne(racine, x, options = {}) {
  const id = x.id;
  x.etape = 'telechargement';
  const s = await detail(racine, id, options);
  const { cours } = await telecharger(racine, id, options);
  x.etape = 'verification';
  const verifs = await verifications(racine, cours, options);
  x.etape = 'ia';
  const claude = options.claude || require('../../quiz/serveur/lib/claude');
  let modele = null;
  const r = await claude.lancer({
    usage: 'generation',
    fournisseur: x.fournisseur,
    seul: true,
    systeme: null,
    message: consigneRevue(s, verifs),
    autorises: 'Read Grep Glob',
    cwd: cours,
    dossiers: [OUTILS],
    persistance: false,
    delai: 20 * 60 * 1000,
    surEvenement(e) {
      if (e.type === 'debut') modele = e.modele || null;
    },
  }).promesse;
  const verdict = lireVerdict(r.texte) || {
    recommandation: 'corriger',
    resume: tr(
      'L’IA n’a pas rendu de verdict lisible : relire à la main.',
      'The AI gave no readable verdict: review by hand.',
    ),
    details: [String(r.texte || '').slice(-1200)],
    note: null,
  };
  const analyse = Object.assign(verdict, {
    ia: r.fournisseur || x.fournisseur,
    modele: r.modele || modele,
    verifications: verifs,
    date: new Date().toISOString(),
  });
  ecrireLocal(racine, id, { analyse, erreur: null });
  x.etape = 'envoi';
  await appel('soumissions/' + id, {
    methode: 'POST',
    corps: {
      // Une soumission déjà décidée garde son état : seule l'analyse s'ajoute
      ...(['recue', 'analyse'].includes(s.etat) ? { etat: 'analyse' } : {}),
      analyse,
      note: tr(`Analyse terminée : ${verdict.recommandation}.`, `Review finished: ${verdict.recommandation}.`),
    },
    fetch: options.fetch,
  });
  return analyse;
}

/* Décision --------------------------------------------------------------------------- */

/**
 * decision 'accepter' : en mode dépôt (explore/ et app/scripts/ à la racine), le cours
 * entre dans le catalogue ; ailleurs, l'archive reste dans soumissions-recues/ à
 * intégrer plus tard. decision 'refuser' : message obligatoire pour l'auteur.
 */
async function decider(racine, id, b = {}, options = {}) {
  verifierId(id);
  const message = String(b.message || '').trim();
  if (b.decision === 'refuser') {
    if (!message)
      throw new Error(tr('Un message pour l’auteur est nécessaire.', 'A message for the author is needed.'));
    await appel('soumissions/' + id, {
      methode: 'POST',
      corps: { etat: 'refusee', message, note: tr('Soumission refusée.', 'Submission refused.') },
      fetch: options.fetch,
    });
    return ecrireLocal(racine, id, { decision: { decision: 'refuser', message, date: new Date().toISOString() } });
  }
  if (b.decision !== 'accepter') throw new Error(tr('Décision inconnue.', 'Unknown decision.'));
  const { archive } = await telecharger(racine, id, options);
  const script = path.join(racine, 'app', 'scripts', 'accepter-proposition.mjs');
  let integration;
  if (fs.existsSync(script) && fs.existsSync(path.join(racine, 'explore'))) {
    const args = [script, archive];
    for (const [o, v] of [
      ['--domaine', b.domaine],
      ['--id', b.id],
      ['--pack', b.pack],
    ])
      if (v) args.push(o, String(v));
    if (b.remplacer) args.push('--remplacer');
    const r = spawnSync(process.execPath, args, { cwd: racine, encoding: 'utf8', windowsHide: true, timeout: 600000 });
    const sortie = soumission.lignesUtiles((r.stdout || '') + (r.stderr || ''), racine, 'explore');
    if (r.status !== 0)
      throw Object.assign(new Error(tr('Intégration au catalogue refusée.', 'Adding to the catalogue was refused.')), {
        detail: sortie,
      });
    integration = { mode: 'depot', sortie };
  } else integration = { mode: 'archive', archive: path.relative(racine, archive).split(path.sep).join('/') };
  await appel('soumissions/' + id, {
    methode: 'POST',
    corps: {
      etat: 'acceptee',
      ...(message ? { message } : {}),
      note: tr('Soumission acceptée pour le catalogue.', 'Submission accepted for the catalogue.'),
    },
    fetch: options.fetch,
  });
  return ecrireLocal(racine, id, {
    decision: { decision: 'accepter', message, date: new Date().toISOString(), integration },
  });
}

async function bloquer(racine, id, raison, options = {}) {
  await appel('bloquer', {
    methode: 'POST',
    corps: { soumission: verifierId(id), raison: String(raison || '').slice(0, 300) },
    fetch: options.fetch,
  });
  return ecrireLocal(racine, id, { bloquee: new Date().toISOString() });
}

module.exports = {
  DOSSIER,
  configure,
  definirJeton,
  lister,
  detail,
  telecharger,
  analyser,
  etatAnalyses,
  decider,
  bloquer,
  dossierDe,
  lireVerdict,
};
