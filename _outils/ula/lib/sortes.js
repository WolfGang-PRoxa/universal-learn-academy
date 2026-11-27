'use strict';
/* Sortes de soumissions autres qu'un cours généré (soumission.js) :
   --------------------------------------------------------------------------
   pack     un dossier du cursus proposé comme pack du catalogue : les cours du
            catalogue qu'il contient (liens), avec un titre et le dossier proposé ;
   cursus   un dossier dont chaque sous-dossier devient un pack (L1, L2, L3…) ;
   sources  des cours de profs bruts (PDF, diaporamas, documents, textes, images,
            code) envoyés à l'administrateur pour qu'il en génère une alternative.

   Un pack ou un cursus ne reprend que des cours du catalogue : les cours personnels
   du dossier sont signalés (« à soumettre d'abord ») et laissés de côté. Le service
   de soumission (cloudflare/src/controle.ts) refait les mêmes contrôles. */

const fs = require('fs');
const path = require('path');
const { tr } = require('../../quiz/serveur/lib/langue');

const SORTES = ['cours', 'pack', 'cursus', 'sources'];
// Mêmes types que le service ; rien d'exécutable, aucune archive imbriquée
const PERMIS_SOURCES =
  /\.(pdf|pptx?|ppsx?|docx?|odt|odp|ods|xlsx?|csv|rtf|txt|md|tex|png|jpe?g|gif|webp|svg|c|h|cpp|hpp|java|py|ipynb|js|ts|sql|sh|html?|css|json|xml|ya?ml)$/i;
const TAILLE_MAX_SOURCES = 50 * 1024 * 1024;
const MAX_SOURCES = 300;

const ETAPES_LISTE = [
  { id: 'contenu', fr: 'Contenu', en: 'Contents' },
  { id: 'catalogue', fr: 'Cours du catalogue', en: 'Catalogue courses' },
  { id: 'archive', fr: 'Archive', en: 'Archive' },
];
const ETAPES_SOURCES = [
  { id: 'fichiers', fr: 'Fichiers', en: 'Files' },
  { id: 'declarations', fr: 'Déclarations', en: 'Declarations' },
  { id: 'archive', fr: 'Archive', en: 'Archive' },
];

const texte = (v, n) =>
  String(v || '')
    .trim()
    .slice(0, n);

/** Nœud de l'arbre du cursus à ce chemin, ou null. */
function noeud(arbre, chemin) {
  if (!arbre) return null;
  if (arbre.chemin === chemin) return arbre;
  for (const e of arbre.enfants || []) {
    const n = noeud(e, chemin);
    if (n) return n;
  }
  return null;
}

// Liens vers des cours du catalogue et cours personnels sous un nœud (récursif)
function parcourir(n, liens = [], persos = []) {
  for (const e of n.enfants || []) {
    if (e.type === 'lien') liens.push(e);
    else if (e.type === 'perso') persos.push(e);
    else parcourir(e, liens, persos);
  }
  return { liens, persos };
}
const uniques = (liens) => [...new Set(liens.map((l) => l.cours))];

/**
 * Pack ou cursus composé à partir d'un dossier du cursus :
 * { contenu (ula-pack.json ou ula-cursus.json), ignores: [noms], problemes, avertissements }.
 * infos : { titre, description, origine, dossier }.
 */
function composer(n, type, infos = {}) {
  const problemes = [];
  const avertissements = [];
  if (!n || n.type !== 'dossier') {
    problemes.push(tr('Dossier du cursus introuvable.', 'Curriculum folder not found.'));
    return { contenu: null, ignores: [], problemes, avertissements };
  }
  const base = {
    titre: texte(infos.titre, 120) || n.nom,
    description: texte(infos.description, 2000),
    origine: texte(infos.origine, 120),
  };
  let contenu;
  const ignores = [];
  if (type === 'pack') {
    const { liens, persos } = parcourir(n);
    persos.forEach((p) => ignores.push(p.nom));
    contenu = Object.assign({ format: 'ula-pack-1' }, base, {
      dossier: texte(infos.dossier, 60) || n.nom,
      cours: uniques(liens),
    });
    if (contenu.cours.length < 2)
      problemes.push(
        tr(
          'Un pack réunit au moins deux cours du catalogue : en ajouter au dossier.',
          'A pack holds at least two catalogue courses: add some to the folder.',
        ),
      );
  } else {
    const packs = [];
    for (const e of n.enfants || []) {
      if (e.type === 'perso') ignores.push(e.nom);
      else if (e.type === 'lien')
        avertissements.push(
          tr(
            `« ${e.nom} » est rangé à la racine du dossier, hors des packs : laissé de côté.`,
            `“${e.nom}” sits at the root of the folder, outside the packs: left out.`,
          ),
        );
      else {
        const { liens, persos } = parcourir(e);
        persos.forEach((p) => ignores.push(p.nom));
        if (liens.length) packs.push({ titre: e.nom, dossier: e.nom, cours: uniques(liens) });
      }
    }
    contenu = Object.assign({ format: 'ula-cursus-1' }, base, { packs });
    if (packs.length < 2)
      problemes.push(
        tr(
          'Un cursus réunit au moins deux sous-dossiers de cours (par exemple L1 et L2) : sinon, proposer le dossier comme pack.',
          'A curriculum holds at least two sub-folders of courses (for example L1 and L2): otherwise, propose the folder as a pack.',
        ),
      );
  }
  for (const nom of ignores)
    avertissements.push(
      tr(
        `Cours personnel « ${nom} » laissé de côté : le soumettre d'abord comme cours.`,
        `Personal course “${nom}” left out: submit it as a course first.`,
      ),
    );
  return { contenu, ignores, problemes, avertissements };
}

/** Identifiants de cours d'un pack ou d'un cursus. */
function idsCours(contenu) {
  if (!contenu) return [];
  if (Array.isArray(contenu.cours)) return contenu.cours;
  return [...new Set((contenu.packs || []).flatMap((p) => p.cours))];
}

/* Cours de profs ------------------------------------------------------------------ */

/** Nom de fichier sûr (sans dossier, ni caractère interdit sous Windows), ou ''. */
function nomFichierSur(nom) {
  const base = String(nom || '')
    .split(/[\\/]/)
    .pop()
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>:"|?*]/g, '_')
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .slice(0, 120);
  return base;
}

/** Fichiers rangés dans un dossier de sources : [{ nom, taille }]. */
function fichiersSources(dossier) {
  let noms;
  try {
    noms = fs.readdirSync(dossier, { withFileTypes: true });
  } catch (e) {
    return [];
  }
  return noms
    .filter((e) => e.isFile())
    .map((e) => ({ nom: e.name, taille: fs.statSync(path.join(dossier, e.name)).size }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
}

/** Contrôle des fichiers de sources : { problemes, total }. */
function controlerSources(fichiers) {
  const problemes = [];
  if (!fichiers.length) problemes.push(tr('Aucun fichier.', 'No file.'));
  if (fichiers.length > MAX_SOURCES)
    problemes.push(tr(`Trop de fichiers (${MAX_SOURCES} au plus).`, `Too many files (${MAX_SOURCES} at most).`));
  for (const f of fichiers)
    if (!PERMIS_SOURCES.test(f.nom))
      problemes.push(tr(`${f.nom} : type de fichier non accepté.`, `${f.nom}: file type not accepted.`));
  const total = fichiers.reduce((t, f) => t + f.taille, 0);
  if (total > TAILLE_MAX_SOURCES)
    problemes.push(
      tr(
        `${Math.round(total / 1048576)} Mo de fichiers : 50 Mo au plus.`,
        `${Math.round(total / 1048576)} MB of files: 50 MB at most.`,
      ),
    );
  return { problemes, total };
}

module.exports = {
  SORTES,
  PERMIS_SOURCES,
  TAILLE_MAX_SOURCES,
  MAX_SOURCES,
  ETAPES_LISTE,
  ETAPES_SOURCES,
  noeud,
  composer,
  idsCours,
  nomFichierSur,
  fichiersSources,
  controlerSources,
};
