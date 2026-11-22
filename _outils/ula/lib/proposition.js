'use strict';
/* « Proposer ce cours » (studies/_outils/ula)
   --------------------------------------------------------------------------
   Prépare l'archive d'un cours de l'espace d'un utilisateur pour le catalogue :
   seulement les pages générées (generated_courses/, generated_quizzes/) et la
   fiche du cours, sans les sources des enseignants (PDF, diapositives, sujets),
   sans le travail ni les données personnelles. Le contrôle est bloquant, comme
   celui des builds (mêmes règles, regles.js), avec en plus :
   - des types de fichiers limités aux pages, styles, scripts, données et images ;
   - aucun chemin local (C:\Users\…, /home/…) ni le nom du profil dans les pages.
   L'archive est écrite dans <racine>/propositions/ ; une issue préremplie du dépôt
   public sert à l'envoyer (l'utilisateur y joint l'archive). Côté catalogue,
   app/scripts/accepter-proposition.mjs la relit avec les mêmes contrôles. */

const fs = require('fs');
const path = require('path');
const { tr } = require('../../quiz/serveur/lib/langue');
const espace = require('./espace');
const regles = require('./regles');
const zip = require('./zip');
const { DEPOT } = require('./catalogue');

const PERMIS = /\.(html?|css|js|mjs|json|svg|png|jpe?g|gif|webp|txt|md)$/i;
const TEXTE = /\.(html?|css|js|mjs|json|svg|txt|md)$/i;
const DOSSIERS = ['generated_courses', 'generated_quizzes'];
const DOMAINES = ['informatique', 'mathematiques', 'langues', 'communication', 'sciences', 'lettres', 'autres'];

function parcourir(dossier, base = dossier, liste = []) {
  let entrees;
  try {
    entrees = fs.readdirSync(dossier, { withFileTypes: true });
  } catch (e) {
    return liste;
  }
  for (const e of entrees) {
    const f = path.join(dossier, e.name);
    if (e.isDirectory()) parcourir(f, base, liste);
    else liste.push(path.relative(base, f).split(path.sep).join('/'));
  }
  return liste;
}

function slugId(t) {
  return (
    String(t)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'cours'
  );
}

/**
 * Contrôle un dossier de cours et renvoie { fichiers, problemes, avertissements }.
 * `interdits` : textes qui ne doivent apparaître dans aucune page (nom du profil…).
 */
function controler(dossier, { interdits = [] } = {}) {
  const fichiers = [];
  const problemes = [];
  const avertissements = [];
  const motifsLocaux = [/[A-Za-z]:\\Users\\[^\\\s"'<]+/, /\/home\/[a-z_][\w.-]*\//i, /\/Users\/[^/\s"'<]+\//];
  for (const d of DOSSIERS) {
    for (const r of parcourir(path.join(dossier, d))) {
      const c = `${d}/${r}`;
      const regle = regles.exclusion(c, { racine: false });
      if (regle) {
        problemes.push(`${c} : ${regle.raison}`);
        continue;
      }
      if (!PERMIS.test(c)) {
        problemes.push(
          tr(
            `${c} : type de fichier non accepté (pages, styles, scripts, données et images seulement : pas de sources d'enseignants)`,
            `${c}: file type not accepted (pages, styles, scripts, data and images only: no teachers' sources)`,
          ),
        );
        continue;
      }
      const abs = path.join(dossier, ...c.split('/'));
      if (TEXTE.test(c)) {
        const t = fs.readFileSync(abs, 'utf8');
        for (const m of motifsLocaux) {
          const x = m.exec(t);
          if (x) problemes.push(tr(`${c} : chemin local « ${x[0]} »`, `${c}: local path “${x[0]}”`));
        }
        for (const mot of interdits.filter(Boolean))
          if (new RegExp(`(^|[^\\p{L}\\d])${mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\d]|$)`, 'iu').test(t))
            problemes.push(tr(`${c} : contient « ${mot} »`, `${c}: contains “${mot}”`));
        if (/\.html?$/i.test(c)) {
          for (const m of t.matchAll(/(?:href|src)="(\.\.\/(?!\.\.\/\.\.\/\.\.\/_outils)[^"#?]*)"/g)) {
            const cible = path.posix.normalize(path.posix.join(path.posix.dirname(c), m[1]));
            if (!cible.startsWith('..') && !DOSSIERS.some((x) => cible.startsWith(x + '/')))
              avertissements.push(
                tr(
                  `${c} : lien vers ${cible}, qui ne sera pas dans l'archive`,
                  `${c}: link to ${cible}, which will not be in the archive`,
                ),
              );
          }
        }
      }
      fichiers.push({ nom: c, fichier: abs });
    }
  }
  if (!fichiers.some((f) => /\.html?$/i.test(f.nom)))
    problemes.push(
      tr(
        'Aucune page dans generated_courses/ ni generated_quizzes/ : rien à proposer.',
        'No page in generated_courses/ or generated_quizzes/: nothing to propose.',
      ),
    );
  return { fichiers, problemes, avertissements };
}

/**
 * Prépare la proposition d'un cours de l'espace du profil.
 * @param {object} infos  { titre, domaine, niveau, origine, description } (complètent ula-cours.json)
 * @returns {{ archive, nom, url, fichiers, avertissements }}
 */
function preparer(racine, nomProfil, cheminCours, infos = {}) {
  const p = espace.profil(racine, nomProfil);
  if (!p) throw new Error(tr('Aucun profil choisi.', 'No profile selected.'));
  const dossier = path.resolve(racine, String(cheminCours));
  if (!dossier.startsWith(p.dossier + path.sep))
    throw new Error(
      tr(
        'Seul un cours de l’espace du profil peut être proposé.',
        'Only a course from the profile’s space can be proposed.',
      ),
    );
  if (fs.existsSync(path.join(dossier, espace.FICHE_LIEN)))
    throw new Error(tr('Ce cours vient déjà du catalogue.', 'This course already comes from the catalogue.'));
  const ancienne = espace.lireJson(path.join(dossier, espace.FICHE_COURS)) || {};
  const titre = String(infos.titre || ancienne.titre || path.basename(dossier))
    .trim()
    .slice(0, 120);
  const domaine = DOMAINES.includes(infos.domaine)
    ? infos.domaine
    : DOMAINES.includes(ancienne.domaine)
      ? ancienne.domaine
      : 'autres';
  const fiche = {
    format: 'ula-cours-1',
    id: /^[a-z0-9][a-z0-9-]{0,80}$/.test(ancienne.id || '') ? ancienne.id : slugId(titre),
    titre,
    domaine,
    niveau: String(infos.niveau || ancienne.niveau || '').slice(0, 80),
    origine: String(infos.origine || ancienne.origine || '').slice(0, 120),
    teinte: ancienne.teinte || '',
    description: String(infos.description || ancienne.description || '').slice(0, 600),
  };
  const { fichiers, problemes, avertissements } = controler(dossier, { interdits: [nomProfil, espace.nomSession()] });
  if (problemes.length) {
    const e = new Error(
      tr(
        'Proposition refusée : ' + problemes.length + ' problème(s).',
        'Proposal refused: ' + problemes.length + ' problem(s).',
      ),
    );
    e.problemes = problemes;
    throw e;
  }
  const date = new Date().toISOString().slice(0, 10);
  const nom = `${fiche.id}-${date}.zip`;
  const archive = path.join(racine, 'propositions', nom);
  zip.ecrire(archive, [
    { nom: espace.FICHE_COURS, donnees: Buffer.from(JSON.stringify(fiche, null, 2) + '\n') },
    ...fichiers,
  ]);
  const corps = [
    "Proposition d'un cours pour le catalogue d'Universal Learn Academy.",
    '',
    `- Titre : ${fiche.titre}`,
    `- Domaine : ${fiche.domaine}`,
    fiche.niveau ? `- Niveau : ${fiche.niveau}` : null,
    fiche.origine ? `- Origine : ${fiche.origine}` : null,
    `- Pages : ${fichiers.filter((f) => /\.html?$/i.test(f.nom)).length} (${fichiers.length} fichiers)`,
    '',
    fiche.description,
    '',
    `**Archive à joindre** : faire glisser \`${nom}\` (dossier \`propositions\` de ULA) dans ce message.`,
    '',
    "L'archive ne contient que les pages générées : ni sources d'enseignants, ni travail personnel (contrôle fait par l'application).",
  ]
    .filter((l) => l !== null)
    .join('\n');
  const url =
    `https://github.com/${DEPOT.proprietaire}/${DEPOT.nom}/issues/new?` +
    new URLSearchParams({ title: `Proposition de cours : ${fiche.titre}`, body: corps }).toString();
  return { archive, nom, url, fichiers: fichiers.length, avertissements };
}

module.exports = { controler, preparer, DOMAINES, slugId };
