'use strict';
/* Soumission d'un cours de l'espace d'un profil (« Soumettre ce cours ») :
   --------------------------------------------------------------------------
   1. la fiche du cours (ula-cours.json) et ses métadonnées : journal de génération
      mesuré par l'application (ula-generation.json) et informations déclarées par
      l'utilisateur (outil, modèle, effort, temps passé, ressources) ;
   2. la vérification locale, étape par étape : contrôle des fichiers (proposition.js),
      métadonnées, charte (verifier.py), quiz (verifier_quiz.py), ateliers
      (verifier.js), archive. Son avancement est suivi par le cadre en bas à droite
      (cadre-soumission.html) et par la page « Mes soumissions » de l'accueil ;
   3. une vérification qui échoue, ou qui ne peut pas tourner (Python absent), SUSPEND
      la soumission : rien ne part, et l'utilisateur choisit de la faire corriger par
      son IA, de corriger lui-même puis de relancer la vérification, ou d'annuler ;
   4. une soumission vérifiée est « prête » : elle part vers le service de soumission
      (envoi.js), puis son état distant (reçue, en analyse, acceptée, refusée) est suivi.

   Quatre sortes (champ type) : cours (ci-dessus), pack et cursus (un dossier du cursus
   proposé au catalogue), sources (cours de profs bruts) ; leurs contrôles sont dans
   sortes.js. Une soumission de sources commence « brouillon » : ses fichiers arrivent
   un par un (ajouterFichier), puis la vérification est lancée.

   Tout est rangé dans <racine>/soumissions/<id>/ (soumission.json, cours.zip), hors
   des espaces des profils et jamais publié (règles de regles.js). Le fichier garde
   l'historique complet, daté, de chaque soumission. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { tr, langue } = require('../../quiz/serveur/lib/langue');
const { OUTILS, VERSION } = require('../../quiz/serveur/lib/chemins');
const journal = require('../../quiz/serveur/lib/journal');
const espace = require('./espace');
const proposition = require('./proposition');
const sortes = require('./sortes');
const zip = require('./zip');

const DOSSIER = 'soumissions';
const TAILLE_MAX = 25 * 1024 * 1024;
const DELAI_SCRIPT = 5 * 60 * 1000;
const ETATS_ACTIFS = new Set(['verification', 'correction', 'envoi']);

// Étapes de la vérification locale, dans l'ordre
const ETAPES = [
  { id: 'controle', fr: 'Fichiers du cours', en: 'Course files' },
  { id: 'metadonnees', fr: 'Informations de génération', en: 'Generation details' },
  { id: 'charte', fr: 'Charte des pages', en: 'Page guidelines' },
  { id: 'quiz', fr: 'Quiz', en: 'Quizzes' },
  { id: 'atelier', fr: 'Ateliers', en: 'Workshops' },
  { id: 'archive', fr: 'Archive', en: 'Archive' },
];

function etapesDe(type) {
  if (type === 'pack' || type === 'cursus') return sortes.ETAPES_LISTE;
  if (type === 'sources') return sortes.ETAPES_SOURCES;
  return ETAPES;
}

/* Rangement ----------------------------------------------------------------------- */

function dossierRacine(racine) {
  return path.join(racine, DOSSIER);
}
function dossierDe(racine, id) {
  if (!/^[0-9]{8}-[0-9]{6}-[0-9a-f]{6}$/.test(String(id)))
    throw new Error(tr('Soumission inconnue.', 'Unknown submission.'));
  return path.join(dossierRacine(racine), id);
}
function lire(racine, id) {
  const s = espace.lireJson(path.join(dossierDe(racine, id), 'soumission.json'));
  if (!s) throw new Error(tr('Soumission inconnue.', 'Unknown submission.'));
  return s;
}
function ecrire(racine, s) {
  s.maj = new Date().toISOString();
  const d = dossierDe(racine, s.id);
  fs.mkdirSync(d, { recursive: true });
  const f = path.join(d, 'soumission.json');
  fs.writeFileSync(f + '.tmp', JSON.stringify(s, null, 2) + '\n', 'utf8');
  fs.renameSync(f + '.tmp', f);
  return s;
}
function noter(s, type, texte, detail) {
  s.historique.push(
    Object.assign(
      { date: new Date().toISOString(), type, texte: String(texte).slice(0, 600) },
      detail ? { detail } : {},
    ),
  );
}
function nouvelId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-` +
    crypto.randomBytes(3).toString('hex')
  );
}

/** Toutes les soumissions du poste, les plus récentes d'abord. */
function lister(racine) {
  let noms;
  try {
    noms = fs.readdirSync(dossierRacine(racine));
  } catch (e) {
    return [];
  }
  const res = [];
  for (const n of noms) {
    try {
      res.push(lire(racine, n));
    } catch (e) {
      /* dossier étranger ou abîmé */
    }
  }
  return res.sort((a, b) => (a.cree < b.cree ? 1 : -1));
}

/** Celles que le cadre en bas à droite doit montrer : en cours, ou finies et pas encore vues. */
function actives(racine) {
  return lister(racine).filter((s) => s.cadre);
}

// Une vérification interrompue par l'arrêt du serveur reprend comme suspendue
function reprendreInterrompues(racine) {
  for (const s of lister(racine)) {
    if (s.etat === 'envoi') {
      s.etat = 'prete';
      s.erreurEnvoi = tr('envoi interrompu', 'sending interrupted');
      noter(
        s,
        'erreur-envoi',
        tr('Envoi interrompu (application fermée).', 'Sending interrupted (application closed).'),
      );
      ecrire(racine, s);
      continue;
    }
    if (s.etat !== 'verification' && s.etat !== 'correction') continue;
    s.etat = 'suspendue';
    s.suspension = {
      raison: 'interrompue',
      problemes: [
        tr(
          'La vérification a été interrompue (application fermée) : la relancer.',
          'The check was interrupted (application closed): run it again.',
        ),
      ],
    };
    for (const e of s.etapes) if (e.etat === 'en_cours') e.etat = 'attente';
    noter(s, 'suspendue', tr('Vérification interrompue.', 'Check interrupted.'));
    ecrire(racine, s);
  }
}

/* Métadonnées ---------------------------------------------------------------------- */

const texte = (v, n) =>
  String(v || '')
    .trim()
    .slice(0, n);

function declare(d = {}) {
  return {
    outil: texte(d.outil, 80),
    modele: texte(d.modele, 80),
    effort: texte(d.effort, 40),
    duree: texte(d.duree, 80),
    ressources: texte(d.ressources, 2000),
    notes: texte(d.notes, 2000),
  };
}

// Journal de génération : seulement les entrées des fichiers encore présents
function mesure(dossier) {
  const j = journal.lire(dossier);
  return j.generations.filter((g) => !g.fichier || fs.existsSync(path.join(dossier, ...String(g.fichier).split('/'))));
}

/** Ce que le formulaire préremplit pour un cours : fiche et générations mesurées. */
function apercu(racine, nomProfil, chemin) {
  const { dossier, fiche } = proposition.fiche(racine, nomProfil, chemin, {});
  return { fiche, generations: mesure(dossier), domaines: proposition.DOMAINES };
}

/* Création -------------------------------------------------------------------------- */

/**
 * Crée une soumission et lance sa vérification.
 * @param {object} b { chemin, infos: {titre, domaine, niveau, origine, description},
 *                     declare: {outil, modele, effort, duree, ressources, notes},
 *                     pseudonyme, licence }
 */
function creer(racine, nomProfil, b, options = {}) {
  if (b.type === 'pack' || b.type === 'cursus') return creerListe(racine, nomProfil, b, options);
  if (b.type === 'sources') return creerSources(racine, nomProfil, b);
  if (b.type && b.type !== 'cours') throw new Error(tr('Sorte de soumission inconnue.', 'Unknown kind of submission.'));
  if (b.licence !== true)
    throw new Error(
      tr(
        'Accepter la licence CC BY-NC-ND 4.0 pour soumettre le cours.',
        'Accept the CC BY-NC-ND 4.0 licence to submit the course.',
      ),
    );
  const { fiche } = proposition.fiche(racine, nomProfil, b.chemin, b.infos || {});
  const enCours = lister(racine).find((s) => s.chemin === b.chemin && ETATS_ACTIFS.has(s.etat));
  if (enCours)
    throw new Error(tr('Ce cours est déjà en cours de vérification.', 'This course is already being checked.'));
  const id = nouvelId();
  const s = {
    format: 'ula-soumission-1',
    type: 'cours',
    id,
    cree: new Date().toISOString(),
    maj: null,
    // Local seulement, jamais envoyés : profil et chemin du cours
    profil: nomProfil,
    chemin: String(b.chemin),
    fiche,
    pseudonyme: texte(b.pseudonyme, 40),
    licence: 'CC-BY-NC-ND-4.0',
    metadonnees: { declare: declare(b.declare), generations: [] },
    etat: 'verification',
    etapes: [],
    suspension: null,
    distant: null,
    cadre: true,
    historique: [],
  };
  noter(s, 'creee', tr(`Soumission de « ${fiche.titre} » créée.`, `Submission of “${fiche.titre}” created.`));
  ecrire(racine, s);
  verifier(racine, id, options);
  return s;
}

const LICENCE_OBLIGATOIRE = () =>
  tr('Accepter la licence CC BY-NC-ND 4.0 pour soumettre.', 'Accept the CC BY-NC-ND 4.0 licence to submit.');

function base(type, nomProfil, chemin, fiche, b) {
  return {
    format: 'ula-soumission-1',
    type,
    id: nouvelId(),
    cree: new Date().toISOString(),
    maj: null,
    profil: nomProfil,
    chemin,
    fiche,
    pseudonyme: texte(b.pseudonyme, 40),
    licence: type === 'sources' ? null : 'CC-BY-NC-ND-4.0',
    metadonnees: { declare: declare({}), generations: [] },
    etat: 'verification',
    etapes: [],
    suspension: null,
    distant: null,
    cadre: true,
    historique: [],
  };
}

/** Pack ou cursus tiré d'un dossier du cursus : ce que montre le formulaire avant l'envoi. */
function apercuListe(racine, nomProfil, chemin, type, infos = {}) {
  if (type !== 'pack' && type !== 'cursus') throw new Error(tr('Sorte inconnue.', 'Unknown kind.'));
  const n = sortes.noeud(espace.arbre(racine, nomProfil), String(chemin));
  return sortes.composer(n, type, infos);
}

/**
 * Pack ou cursus : b { type, chemin (dossier du cursus), infos: { titre, description,
 * origine, dossier }, pseudonyme, licence }. Le contenu est recomposé à chaque
 * vérification, si bien qu'un dossier complété se revérifie simplement.
 */
function creerListe(racine, nomProfil, b, options = {}) {
  if (b.licence !== true) throw new Error(LICENCE_OBLIGATOIRE());
  const chemin = String(b.chemin || '');
  const a = apercuListe(racine, nomProfil, chemin, b.type, b.infos || {});
  if (!a.contenu) throw new Error(a.problemes[0]);
  const enCours = lister(racine).find((x) => x.chemin === chemin && x.type === b.type && ETATS_ACTIFS.has(x.etat));
  if (enCours)
    throw new Error(tr('Ce dossier est déjà en cours de vérification.', 'This folder is already being checked.'));
  const i = b.infos || {};
  const fiche = {
    titre: a.contenu.titre,
    description: texte(i.description, 2000),
    origine: texte(i.origine, 120),
    ...(b.type === 'pack' ? { dossier: a.contenu.dossier } : {}),
  };
  const s = base(b.type, nomProfil, chemin, fiche, b);
  s.contenu = a.contenu;
  noter(
    s,
    'creee',
    b.type === 'pack'
      ? tr(`Proposition du pack « ${fiche.titre} » créée.`, `Proposal of the pack “${fiche.titre}” created.`)
      : tr(`Proposition du cursus « ${fiche.titre} » créée.`, `Proposal of the curriculum “${fiche.titre}” created.`),
  );
  ecrire(racine, s);
  verifier(racine, s.id, options);
  return s;
}

/**
 * Cours de profs : b { type: 'sources', infos: { titre (matière), domaine, niveau,
 * etablissement, attentes }, pseudonyme, declarations: { droits, personnel } }. La
 * soumission naît « brouillon » ; les fichiers s'ajoutent ensuite (ajouterFichier), puis
 * l'action « verifier » la lance.
 */
function creerSources(racine, nomProfil, b) {
  const d = b.declarations || {};
  if (d.droits !== true || d.personnel !== true)
    throw new Error(
      tr(
        'Cocher les deux déclarations : droit de transmettre les documents, informations personnelles retirées.',
        'Tick both declarations: right to share the documents, personal information removed.',
      ),
    );
  const i = b.infos || {};
  const titre = texte(i.titre, 120);
  if (!titre) throw new Error(tr('Indiquer la matière.', 'State the subject.'));
  const domaine = proposition.DOMAINES.includes(i.domaine) ? i.domaine : 'autres';
  const fiche = {
    titre,
    domaine,
    niveau: texte(i.niveau, 60),
    etablissement: texte(i.etablissement, 120),
    attentes: texte(i.attentes, 2000),
  };
  const s = base('sources', nomProfil, null, fiche, b);
  s.etat = 'brouillon';
  s.cadre = false;
  s.declarations = { droits: true, personnel: true };
  s.fichiers = [];
  noter(s, 'creee', tr(`Envoi de cours de profs « ${titre} » préparé.`, `Teacher materials “${titre}” prepared.`));
  ecrire(racine, s);
  fs.mkdirSync(path.join(dossierDe(racine, s.id), 'sources'), { recursive: true });
  return s;
}

/** Ajoute un fichier (contenu en base64) à une soumission de sources encore brouillon. */
function ajouterFichier(racine, id, nom, base64) {
  const s = lire(racine, id);
  if (s.type !== 'sources' || s.etat !== 'brouillon')
    throw new Error(tr('Cette soumission ne reçoit plus de fichiers.', 'This submission takes no more files.'));
  let n = sortes.nomFichierSur(nom);
  if (!n || !sortes.PERMIS_SOURCES.test(n))
    throw new Error(tr(`${nom} : type de fichier non accepté.`, `${nom}: file type not accepted.`));
  const donnees = Buffer.from(String(base64 || ''), 'base64');
  const dossier = path.join(dossierDe(racine, id), 'sources');
  const presents = sortes.fichiersSources(dossier);
  if (presents.length >= sortes.MAX_SOURCES)
    throw new Error(tr(`${sortes.MAX_SOURCES} fichiers au plus.`, `${sortes.MAX_SOURCES} files at most.`));
  if (presents.reduce((t, f) => t + f.taille, 0) + donnees.length > sortes.TAILLE_MAX_SOURCES)
    throw new Error(tr('50 Mo de fichiers au plus.', '50 MB of files at most.'));
  // Deux fichiers du même nom : le second prend un suffixe
  const ext = path.extname(n);
  for (let k = 2; presents.some((f) => f.nom.toLowerCase() === n.toLowerCase()); k++)
    n = n.slice(0, n.length - ext.length).replace(/ \(\d+\)$/, '') + ` (${k})` + ext;
  fs.mkdirSync(dossier, { recursive: true });
  fs.writeFileSync(path.join(dossier, n), donnees);
  s.fichiers = sortes.fichiersSources(dossier);
  return ecrire(racine, s);
}

/* Vérification ----------------------------------------------------------------------- */

function lancerScript(commande, args, cwd, env) {
  return new Promise((resolve) => {
    let sortie = '';
    let fini = false;
    const enfant = spawn(commande, args, {
      cwd,
      env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' }, env),
      windowsHide: true,
    });
    const minuterie = setTimeout(() => {
      if (!fini) enfant.kill();
      sortie += '\n' + tr('Délai dépassé.', 'Timed out.');
    }, DELAI_SCRIPT);
    enfant.stdout.on('data', (d) => (sortie += d));
    enfant.stderr.on('data', (d) => (sortie += d));
    enfant.on('error', (e) => {
      fini = true;
      clearTimeout(minuterie);
      resolve({ code: -1, sortie: e.message });
    });
    enfant.on('close', (code) => {
      fini = true;
      clearTimeout(minuterie);
      resolve({ code, sortie });
    });
  });
}

// Lignes utiles d'une sortie de vérificateur : erreurs et avertissements, puis le bilan
function lignesUtiles(sortie, racine, chemin) {
  // Chemins rendus relatifs au cours : ni la racine des données ni le nom du profil
  const sans = [racine + path.sep, racine, chemin + '/', chemin.split('/').join(path.sep) + path.sep, chemin];
  const lignes = String(sortie)
    .split(/\r?\n/)
    .map((l) => sans.reduce((x, m) => x.split(m).join(''), l).trimEnd())
    .filter((l) => l.trim());
  const marquees = lignes.filter((l) => /✗|!|erreur|error|attention|warning/i.test(l));
  return (marquees.length ? marquees : lignes).slice(-40);
}

function avertissements(sortie) {
  const m = String(sortie).match(/(\d+)\s+avertissement/);
  return m ? Number(m[1]) : 0;
}

function pythonDisponible(executer) {
  try {
    const d = executer.disponibilite(true).python;
    return d && d.commande ? d.commande : null;
  } catch (e) {
    return null;
  }
}

/**
 * Lance (ou relance) la vérification locale d'une soumission, en arrière-plan.
 * options.executer : module d'exécution du serveur (détection de Python), remplaçable
 * dans les tests.
 */
function verifier(racine, id, options = {}) {
  const s = lire(racine, id);
  const executer = options.executer || require('../../quiz/serveur/lib/executer');
  s.etat = 'verification';
  s.suspension = null;
  s.cadre = true;
  s.etapes = etapesDe(s.type).map((e) => ({
    id: e.id,
    libelle: tr(e.fr, e.en),
    etat: 'attente',
    detail: [],
    debut: null,
    fin: null,
  }));
  noter(s, 'verification', tr('Vérification locale lancée.', 'Local check started.'));
  ecrire(racine, s);

  const dossier = path.resolve(racine, s.chemin || '.');
  const dossiersPages = ['generated_courses', 'generated_quizzes']
    .map((d) => path.join(dossier, d))
    .filter((d) => fs.existsSync(d));
  const etape = (eid) => s.etapes.find((e) => e.id === eid);
  const commencer = (eid) => {
    const e = etape(eid);
    e.etat = 'en_cours';
    e.debut = new Date().toISOString();
    ecrire(racine, s);
    return e;
  };
  const finir = (e, etat, detail = []) => {
    e.etat = etat;
    e.detail = detail.slice(0, 60);
    e.fin = new Date().toISOString();
    noter(s, 'etape', `${e.libelle} : ${libelleEtat(etat)}`, e.detail.length ? e.detail.slice(0, 10) : null);
    ecrire(racine, s);
  };

  const promesse = (async () => {
    if (s.type === 'pack' || s.type === 'cursus') await etapesListe(racine, s, commencer, finir, options);
    else if (s.type === 'sources') etapesSources(racine, s, commencer, finir);
    else await etapesCours();

    // Bilan : suspendue, ou prête à partir
    const bloquantes = s.etapes.filter((x) => x.etat === 'echec' || x.etat === 'non_faite');
    if (bloquantes.length) {
      s.etat = 'suspendue';
      s.suspension = {
        raison: bloquantes.every((x) => x.etat === 'non_faite')
          ? s.type === 'pack' || s.type === 'cursus'
            ? 'reseau'
            : 'python'
          : 'echec',
        problemes: bloquantes.flatMap((x) => x.detail.map((l) => `${x.libelle} : ${l}`)).slice(0, 80),
      };
      noter(
        s,
        'suspendue',
        s.type && s.type !== 'cours'
          ? tr(
              'Soumission suspendue : à corriger puis revérifier, ou à annuler.',
              'Submission suspended: fix it then check again, or cancel it.',
            )
          : tr(
              'Soumission suspendue : à corriger avec votre IA, à corriger vous-même, ou à annuler.',
              'Submission suspended: fix it with your AI, fix it yourself, or cancel it.',
            ),
      );
      ecrire(racine, s);
      return s;
    }
    s.etat = 'prete';
    noter(s, 'prete', tr('Vérification réussie : prête à envoyer.', 'Check passed: ready to send.'));
    ecrire(racine, s);
    if (options.apresVerification) await options.apresVerification(s);
    return s;
  })().catch((err) => {
    const x = lire(racine, id);
    x.etat = 'suspendue';
    x.suspension = { raison: 'erreur', problemes: [err.message] };
    noter(x, 'suspendue', err.message);
    ecrire(racine, x);
    return x;
  });
  if (options.surFin) promesse.then(options.surFin);
  return promesse;

  async function etapesCours() {
    // 1. Fichiers : mêmes contrôles que « Proposer ce cours » et que le catalogue
    let e = commencer('controle');
    let fichiers = [];
    let interdits = [];
    try {
      const f = proposition.fiche(racine, s.profil, s.chemin, s.fiche);
      interdits = f.interdits;
      const c = proposition.controler(dossier, { interdits });
      fichiers = c.fichiers;
      if (c.problemes.length) finir(e, 'echec', c.problemes);
      else finir(e, c.avertissements.length ? 'avertissement' : 'ok', c.avertissements);
    } catch (err) {
      finir(e, 'echec', [err.message]);
    }

    // 2. Métadonnées : journal mesuré, et déclaration pour ce qui ne l'est pas
    e = commencer('metadonnees');
    s.metadonnees.generations = mesure(dossier);
    const d = s.metadonnees.declare;
    const pages = fichiers.filter((f) => /\.html?$/i.test(f.nom));
    const mesurees = new Set(s.metadonnees.generations.map((g) => g.fichier));
    const nonMesurees = pages.filter((f) => !mesurees.has(f.nom));
    const remarques = [
      tr(
        `${s.metadonnees.generations.length} génération(s) mesurée(s) par l'application, ${nonMesurees.length} page(s) sans mesure.`,
        `${s.metadonnees.generations.length} generation(s) measured by the application, ${nonMesurees.length} page(s) without measurement.`,
      ),
    ];
    let etatMeta = 'ok';
    if (nonMesurees.length && !d.outil && !d.modele) {
      etatMeta = 'avertissement';
      remarques.push(
        tr(
          'Pages faites hors de l’application : préciser l’IA et le modèle utilisés aide à l’analyse.',
          'Pages made outside the application: stating the AI and model used helps the review.',
        ),
      );
    }
    const textesMeta = JSON.stringify(s.metadonnees);
    const fuite = interdits.filter(Boolean).find((m) => textesMeta.toLowerCase().includes(String(m).toLowerCase()));
    if (fuite || /[A-Za-z]:\\\\Users\\\\|\/home\/[a-z_]/i.test(textesMeta)) {
      etatMeta = 'echec';
      remarques.push(
        tr(
          'Les informations contiennent un chemin local ou le nom du profil : les retirer.',
          'The details contain a local path or the profile name: remove them.',
        ),
      );
    }
    finir(e, etatMeta, remarques);

    // 3 à 5. Vérificateurs des pages, depuis la racine des données (liens /_outils/…)
    const python = pythonDisponible(executer);
    const env = { ULA_RACINE: racine };
    const lancerVerif = async (eid, commande, script) => {
      const et = commencer(eid);
      if (!dossiersPages.length) return finir(et, 'ok', [tr('Rien à vérifier.', 'Nothing to check.')]);
      if (!commande)
        return finir(et, 'non_faite', [
          tr(
            'Python est introuvable sur ce poste : cette vérification ne peut pas tourner.',
            'Python was not found on this computer: this check cannot run.',
          ),
        ]);
      const r = await lancerScript(commande, [path.join(OUTILS, ...script), ...dossiersPages], racine, env);
      const lignes = lignesUtiles(r.sortie, racine, s.chemin);
      finir(et, r.code === 0 ? (avertissements(r.sortie) ? 'avertissement' : 'ok') : 'echec', lignes);
    };
    await lancerVerif('charte', python, ['charte', 'outils', 'verifier.py']);
    await lancerVerif('quiz', python, ['quiz', 'outils', 'verifier_quiz.py']);
    await lancerVerif('atelier', process.execPath, ['atelier', 'outils', 'verifier.js']);

    // 6. Archive : fiche, pages, métadonnées ; taille plafonnée
    e = commencer('archive');
    if (s.etapes.some((x) => x.etat === 'echec' || x.etat === 'non_faite')) finir(e, 'attente');
    else {
      try {
        const archive = path.join(dossierDe(racine, id), 'cours.zip');
        zip.ecrire(archive, [
          { nom: espace.FICHE_COURS, donnees: Buffer.from(JSON.stringify(s.fiche, null, 2) + '\n') },
          { nom: 'ula-soumission.json', donnees: Buffer.from(JSON.stringify(manifeste(s), null, 2) + '\n') },
          ...fichiers,
        ]);
        const taille = fs.statSync(archive).size;
        s.archive = { taille, fichiers: fichiers.length, sha256: empreinte(archive) };
        if (taille > TAILLE_MAX)
          finir(e, 'echec', [
            tr(
              `Archive de ${Math.round(taille / 1048576)} Mo : 25 Mo au plus.`,
              `Archive of ${Math.round(taille / 1048576)} MB: 25 MB at most.`,
            ),
          ]);
        else
          finir(e, 'ok', [
            tr(
              `${fichiers.length} fichiers, ${Math.max(1, Math.round(taille / 1024))} Ko.`,
              `${fichiers.length} files, ${Math.max(1, Math.round(taille / 1024))} KB.`,
            ),
          ]);
      } catch (err) {
        finir(e, 'echec', [err.message]);
      }
    }
  }
}

// Archive d'une soumission : cours.zip (même nom pour toutes les sortes), taille plafonnée
function ecrireArchive(racine, s, entrees, max) {
  const archive = path.join(dossierDe(racine, s.id), 'cours.zip');
  zip.ecrire(archive, [
    { nom: 'ula-soumission.json', donnees: Buffer.from(JSON.stringify(manifeste(s), null, 2) + '\n') },
    ...entrees,
  ]);
  const taille = fs.statSync(archive).size;
  s.archive = { taille, fichiers: entrees.length, sha256: empreinte(archive) };
  if (taille > max)
    return [
      'echec',
      [
        tr(
          `Archive de ${Math.round(taille / 1048576)} Mo : ${Math.round(max / 1048576)} Mo au plus.`,
          `Archive of ${Math.round(taille / 1048576)} MB: ${Math.round(max / 1048576)} MB at most.`,
        ),
      ],
    ];
  return [
    'ok',
    [
      tr(
        `${entrees.length} fichier(s), ${Math.max(1, Math.round(taille / 1024))} Ko.`,
        `${entrees.length} file(s), ${Math.max(1, Math.round(taille / 1024))} KB.`,
      ),
    ],
  ];
}

// Pack ou cursus : contenu recomposé depuis le dossier, cours du catalogue en ligne, archive
async function etapesListe(racine, s, commencer, finir, options) {
  let e = commencer('contenu');
  const a = apercuListe(racine, s.profil, s.chemin, s.type, {
    titre: s.fiche.titre,
    description: s.fiche.description,
    origine: s.fiche.origine,
    dossier: s.fiche.dossier,
  });
  if (a.contenu) s.contenu = a.contenu;
  const resume = tr(
    `${sortes.idsCours(s.contenu).length} cours du catalogue` +
      (s.type === 'cursus' ? `, ${(s.contenu.packs || []).length} pack(s).` : '.'),
    `${sortes.idsCours(s.contenu).length} catalogue course(s)` +
      (s.type === 'cursus' ? `, ${(s.contenu.packs || []).length} pack(s).` : '.'),
  );
  finir(e, a.problemes.length ? 'echec' : a.avertissements.length ? 'avertissement' : 'ok', [
    resume,
    ...a.problemes,
    ...a.avertissements,
  ]);

  e = commencer('catalogue');
  let connus;
  try {
    const c = options.catalogue ? await options.catalogue() : await require('./catalogue').lister(racine);
    connus = new Map(c.cours.map((x) => [x.id, x.titre]));
  } catch (err) {
    finir(e, 'non_faite', [
      tr(
        'Catalogue en ligne injoignable : relancer la vérification une fois connecté.',
        'Online catalogue unreachable: run the check again once connected.',
      ),
    ]);
  }
  if (connus) {
    const inconnus = sortes.idsCours(s.contenu).filter((id) => !connus.has(id));
    s.titres = Object.fromEntries(sortes.idsCours(s.contenu).map((id) => [id, connus.get(id) || id]));
    if (inconnus.length)
      finir(
        e,
        'echec',
        inconnus.map((id) => tr(`Cours absent du catalogue : ${id}.`, `Course not in the catalogue: ${id}.`)),
      );
    else finir(e, 'ok', [tr('Tous les cours sont au catalogue.', 'All courses are in the catalogue.')]);
  }

  e = commencer('archive');
  if (s.etapes.some((x) => x.etat === 'echec' || x.etat === 'non_faite')) return finir(e, 'attente');
  const nom = s.type === 'pack' ? 'ula-pack.json' : 'ula-cursus.json';
  const [etat, detail] = ecrireArchive(
    racine,
    s,
    [{ nom, donnees: Buffer.from(JSON.stringify(s.contenu, null, 2) + '\n') }],
    TAILLE_MAX,
  );
  finir(e, etat, detail);
}

// Cours de profs : types et taille des fichiers, déclarations, archive
function etapesSources(racine, s, commencer, finir) {
  const dossier = path.join(dossierDe(racine, s.id), 'sources');
  let e = commencer('fichiers');
  s.fichiers = sortes.fichiersSources(dossier);
  const c = sortes.controlerSources(s.fichiers);
  finir(
    e,
    c.problemes.length ? 'echec' : 'ok',
    c.problemes.length
      ? c.problemes
      : [
          tr(
            `${s.fichiers.length} fichier(s), ${Math.max(1, Math.round(c.total / 1024))} Ko.`,
            `${s.fichiers.length} file(s), ${Math.max(1, Math.round(c.total / 1024))} KB.`,
          ),
        ],
  );

  e = commencer('declarations');
  const pb = [];
  if (!s.declarations || s.declarations.droits !== true || s.declarations.personnel !== true)
    pb.push(tr('Déclarations manquantes.', 'Missing declarations.'));
  const textes = JSON.stringify(s.fiche);
  if (
    (s.profil && textes.toLowerCase().includes(String(s.profil).toLowerCase())) ||
    /[A-Za-z]:\\\\Users\\\\|\/home\/[a-z_]/i.test(textes)
  )
    pb.push(
      tr(
        'Les informations contiennent un chemin local ou le nom du profil : les retirer.',
        'The details contain a local path or the profile name: remove them.',
      ),
    );
  finir(e, pb.length ? 'echec' : 'ok', pb.length ? pb : [tr('Déclarations faites.', 'Declarations made.')]);

  e = commencer('archive');
  if (s.etapes.some((x) => x.etat === 'echec')) return finir(e, 'attente');
  const [etat, detail] = ecrireArchive(
    racine,
    s,
    s.fichiers.map((f) => ({ nom: 'sources/' + f.nom, fichier: path.join(dossier, f.nom) })),
    sortes.TAILLE_MAX_SOURCES,
  );
  finir(e, etat, detail);
}

function empreinte(fichier) {
  return crypto.createHash('sha256').update(fs.readFileSync(fichier)).digest('hex');
}

function libelleEtat(etat) {
  return {
    attente: tr('en attente', 'waiting'),
    en_cours: tr('en cours', 'running'),
    ok: tr('réussie', 'passed'),
    avertissement: tr('réussie avec avertissements', 'passed with warnings'),
    echec: tr('échouée', 'failed'),
    non_faite: tr('non faite', 'not run'),
  }[etat];
}

/**
 * Ce qui part avec la soumission (ula-soumission.json de l'archive, et fiche envoyée) :
 * rien de local (ni profil, ni chemin), seulement le cours et sa génération.
 */
function manifeste(s) {
  const type = s.type || 'cours';
  const commun = {
    format: 'ula-soumission-1',
    type,
    soumission: s.id,
    cree: s.cree,
    fiche: s.fiche,
    pseudonyme: s.pseudonyme || null,
    langue: langue(),
    outils: VERSION,
    verification: (s.etapes || []).map((e) => ({ id: e.id, etat: e.etat, detail: e.detail.slice(0, 20) })),
  };
  if (type === 'pack' || type === 'cursus')
    return Object.assign(commun, { licence: s.licence, contenu: s.contenu || null, titres: s.titres || {} });
  if (type === 'sources') return Object.assign(commun, { declarations: s.declarations, fichiers: s.fichiers || [] });
  return Object.assign(commun, {
    licence: s.licence,
    generations: s.metadonnees.generations,
    declare: s.metadonnees.declare,
  });
}

/* Choix sur une soumission suspendue -------------------------------------------------- */

function consigneCorrection(s) {
  return [
    "Tu corriges un cours d'Universal Learn Academy avant sa soumission au catalogue. La vérification",
    'automatique a signalé les problèmes ci-dessous. Corrige-les dans les pages du cours, sans rien changer',
    "d'autre que le nécessaire, en suivant la charte des cours (README de _outils/charte, de _outils/quiz et",
    "de _outils/atelier). Ne touche qu'aux fichiers des dossiers generated_courses/ et generated_quizzes/ du",
    `cours « ${s.chemin} ». N'écris aucun chemin local ni nom de personne. Tu peux relancer les vérificateurs`,
    '(python _outils/charte/outils/verifier.py, python _outils/quiz/outils/verifier_quiz.py, node',
    '_outils/atelier/outils/verifier.js) sur ces dossiers. Termine par un court résumé de ce que tu as corrigé.',
    '',
    '# Problèmes signalés',
    ...(s.suspension ? s.suspension.problemes : []).map((p) => '- ' + p),
  ].join('\n');
}

/**
 * Action de l'utilisateur sur une soumission :
 *   reverifier   (suspendue) relance la vérification après correction à la main
 *   corriger-ia  (suspendue) l'IA corrige les problèmes signalés, puis revérification
 *   annuler      (suspendue, prête) abandonne la soumission
 *   vue          le cadre en bas à droite n'a plus à la montrer
 */
function agir(racine, id, action, options = {}) {
  const s = lire(racine, id);
  if (action === 'vue') {
    s.cadre = false;
    return ecrire(racine, s);
  }
  if (action === 'verifier') {
    if (s.etat !== 'brouillon')
      throw new Error(tr('Cette soumission est déjà vérifiée.', 'This submission has already been checked.'));
    verifier(racine, id, options);
    return lire(racine, id);
  }
  if (action === 'annuler') {
    if (!['suspendue', 'prete', 'brouillon'].includes(s.etat))
      throw new Error(tr('Cette soumission ne peut plus être annulée.', 'This submission can no longer be cancelled.'));
    s.etat = 'annulee';
    s.cadre = false;
    noter(s, 'annulee', tr('Soumission annulée.', 'Submission cancelled.'));
    try {
      fs.rmSync(path.join(dossierDe(racine, id), 'cours.zip'), { force: true });
      fs.rmSync(path.join(dossierDe(racine, id), 'sources'), { recursive: true, force: true });
    } catch (e) {
      /* déjà absente */
    }
    return ecrire(racine, s);
  }
  if (action === 'reverifier') {
    if (s.etat !== 'suspendue')
      throw new Error(
        tr('Seule une soumission suspendue se revérifie.', 'Only a suspended submission can be rechecked.'),
      );
    noter(s, 'choix', tr('Corrigée à la main : nouvelle vérification.', 'Fixed by hand: new check.'));
    ecrire(racine, s);
    verifier(racine, id, options);
    return lire(racine, id);
  }
  if (action === 'corriger-ia') {
    if (s.type && s.type !== 'cours')
      throw new Error(tr('Seul un cours se corrige par l’IA.', 'Only a course can be fixed by the AI.'));
    if (s.etat !== 'suspendue')
      throw new Error(tr('Seule une soumission suspendue se corrige.', 'Only a suspended submission can be fixed.'));
    if (s.suspension && s.suspension.raison === 'python')
      throw new Error(
        tr(
          'Il ne manque que Python : l’installer (python.org), puis relancer la vérification.',
          'Only Python is missing: install it (python.org), then run the check again.',
        ),
      );
    const claude = options.claude || require('../../quiz/serveur/lib/claude');
    s.etat = 'correction';
    s.cadre = true;
    s.correction = { debut: new Date().toISOString(), journal: [] };
    noter(s, 'choix', tr('Correction confiée à votre IA.', 'Fix handed to your AI.'));
    ecrire(racine, s);
    const appel = claude.lancer({
      usage: 'generation',
      systeme: null,
      message: consigneCorrection(s),
      autorises:
        'Read Grep Glob Write Edit Bash(python:*) Bash(py:*) Bash(node:*) PowerShell(python:*) PowerShell(node:*)',
      permission: 'acceptEdits',
      cwd: racine,
      dossiers: [OUTILS],
      persistance: false,
      ecritureBloquante: true,
      delai: 30 * 60 * 1000,
      surEvenement(e) {
        const x = lire(racine, id);
        if (!x.correction) return;
        if (e.type === 'outil')
          x.correction.journal.push(`${e.nom}${e.detail ? ' · ' + e.detail.replace(racine, '') : ''}`);
        else if (e.type === 'bascule') noter(x, 'bascule', `${e.de} → ${e.vers} (${e.raison})`);
        else if (e.type === 'debut') x.correction.modele = e.modele;
        else return;
        x.correction.journal = x.correction.journal.slice(-30);
        ecrire(racine, x);
      },
    });
    appel.promesse
      .then((r) => {
        const x = lire(racine, id);
        x.correction.fin = new Date().toISOString();
        x.correction.fournisseur = r.fournisseur || null;
        x.etat = 'suspendue';
        noter(
          x,
          'correction',
          tr('Correction par l’IA terminée : ', 'AI fix finished: ') + String(r.texte || '').slice(-400),
        );
        ecrire(racine, x);
        verifier(racine, id, options);
      })
      .catch((err) => {
        const x = lire(racine, id);
        x.etat = 'suspendue';
        noter(x, 'correction', tr('La correction par l’IA a échoué : ', 'The AI fix failed: ') + err.message);
        ecrire(racine, x);
      });
    return lire(racine, id);
  }
  throw new Error(tr('Action inconnue.', 'Unknown action.'));
}

/** Vue d'une soumission pour l'interface : tout, sauf le profil et le chemin local. */
function publique(s) {
  const { profil, ...reste } = s;
  return Object.assign({}, reste, { manifeste: manifeste(s) });
}

module.exports = {
  DOSSIER,
  ETAPES,
  TAILLE_MAX,
  apercu,
  apercuListe,
  creer,
  ajouterFichier,
  verifier,
  agir,
  lister,
  actives,
  lire,
  ecrire,
  noter,
  dossierDe,
  manifeste,
  publique,
  reprendreInterrompues,
  // Pour les analyses de l'administrateur (admin.js)
  lancerScript,
  lignesUtiles,
  avertissements,
  pythonDisponible,
};
