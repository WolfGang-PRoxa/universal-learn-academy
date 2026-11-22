'use strict';
/* Catalogue à la demande (studies/_outils/ula)
   --------------------------------------------------------------------------
   Les cours ne sont plus livrés avec l'application : ils sont publiés dans la
   release « catalogue » du dépôt public (WolfGang-PRoxa/universal-learn-academy),
   un fichier catalogue.json et une archive zip par cours :

     catalogue.json   { format: "ula-catalogue-1", genere, cours: [ { id, domaine,
                        titre, niveau, origine, description, teinte, version,
                        taille, fichiers, empreinte, archive } ] }
     <id>.zip         le dossier du cours (ula-cours.json à la racine de l'archive)

   Un cours s'installe dans explore/<domaine>/<id>/ ; l'empreinte SHA-256 de
   l'archive est vérifiée avant l'extraction, et la version installée notée dans
   explore/<domaine>/<id>/.ula-version.json. Mettre à jour ou supprimer un cours
   ne touche jamais l'espace des profils.

   Accès : d'abord l'adresse publique de la release ; si le dépôt est privé
   (404), le jeton de la GitHub CLI déjà connectée sur le poste (`gh auth token`),
   gardé en mémoire le temps de la requête : aucun jeton n'est écrit nulle part.
   ULA_CATALOGUE=<dossier> lit un catalogue local (essais, script de publication). */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { tr } = require('../../quiz/serveur/lib/langue');
const { spawnSync } = require('child_process');
const espace = require('./espace');
const zip = require('./zip');

const DEPOT = { proprietaire: 'WolfGang-PRoxa', nom: 'universal-learn-academy' };
const TAG = 'catalogue';
const VERSION_INSTALLEE = '.ula-version.json';

let jeton = null; // jeton de gh, le temps d'une série de requêtes
let infosRelease = null; // release du catalogue (accès par l'API)

function jetonGh() {
  if (jeton) return jeton;
  const candidats = ['gh'];
  if (process.platform === 'win32')
    candidats.push(path.join(process.env.ProgramFiles || 'C:\\Program Files', 'GitHub CLI', 'gh.exe'));
  for (const c of candidats) {
    try {
      const r = spawnSync(c, ['auth', 'token'], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
      const t = (r.stdout || '').trim();
      if (r.status === 0 && t) {
        jeton = t;
        setTimeout(
          () => {
            jeton = null;
            infosRelease = null;
          },
          10 * 60 * 1000,
        ).unref();
        return t;
      }
    } catch (e) {
      /* suivant */
    }
  }
  return null;
}

async function obtenir(url, entetes = {}, delai = 30000) {
  const r = await fetch(url, {
    headers: Object.assign({ 'User-Agent': 'universal-learn-academy' }, entetes),
    redirect: 'follow',
    signal: AbortSignal.timeout(delai),
  });
  return r;
}

/** Contenu d'un fichier de la release du catalogue (Buffer). */
async function telecharger(nom, delai = 10 * 60 * 1000) {
  const local = process.env.ULA_CATALOGUE;
  if (local) return fs.readFileSync(path.join(local, nom));
  const publique = `https://github.com/${DEPOT.proprietaire}/${DEPOT.nom}/releases/download/${TAG}/${encodeURIComponent(nom)}`;
  let r;
  try {
    r = await obtenir(publique, {}, delai);
  } catch (e) {
    throw new Error(tr('Pas de connexion à GitHub (', 'No connection to GitHub (') + e.message + ').', { cause: e });
  }
  if (r.ok) return Buffer.from(await r.arrayBuffer());
  if (r.status !== 404)
    throw new Error(tr(`GitHub a répondu ${r.status} pour ${nom}.`, `GitHub answered ${r.status} for ${nom}.`));
  // Dépôt privé : API de GitHub avec le jeton de gh
  const t = jetonGh();
  if (!t)
    throw new Error(
      tr(
        "Le catalogue n'est pas encore public : il faut la GitHub CLI connectée sur ce poste (gh auth login).",
        'The catalogue is not public yet: the GitHub CLI must be signed in on this computer (gh auth login).',
      ),
    );
  const auth = { Authorization: 'Bearer ' + t, 'X-GitHub-Api-Version': '2022-11-28' };
  if (!infosRelease) {
    const rr = await obtenir(
      `https://api.github.com/repos/${DEPOT.proprietaire}/${DEPOT.nom}/releases/tags/${TAG}`,
      Object.assign({ Accept: 'application/vnd.github+json' }, auth),
    );
    if (!rr.ok)
      throw new Error(
        tr(`Release « ${TAG} » introuvable (${rr.status}).`, `Release “${TAG}” not found (${rr.status}).`),
      );
    infosRelease = await rr.json();
  }
  const asset = (infosRelease.assets || []).find((a) => a.name === nom);
  if (!asset)
    throw new Error(tr(`${nom} est absent de la release « ${TAG} ».`, `${nom} is missing from the release “${TAG}”.`));
  const ra = await obtenir(asset.url, Object.assign({ Accept: 'application/octet-stream' }, auth), delai);
  if (!ra.ok)
    throw new Error(
      tr(`Téléchargement de ${nom} refusé (${ra.status}).`, `Download of ${nom} refused (${ra.status}).`),
    );
  return Buffer.from(await ra.arrayBuffer());
}

/** La racine est-elle le dépôt source du catalogue (explore/ y est versionné) ? */
function estSource(racine) {
  return fs.existsSync(path.join(racine, '.git')) && fs.existsSync(path.join(racine, '_outils', 'app'));
}

function versionInstallee(racine, c) {
  return espace.lireJson(path.join(racine, 'explore', c.domaine, c.id, VERSION_INSTALLEE));
}

/** Catalogue distant, avec l'état de chaque cours sur ce poste. */
async function lister(racine) {
  infosRelease = null;
  const cat = JSON.parse((await telecharger('catalogue.json', 60000)).toString('utf8'));
  if (cat.format !== 'ula-catalogue-1' || !Array.isArray(cat.cours))
    throw new Error(tr('catalogue.json : format inconnu.', 'catalogue.json: unknown format.'));
  const presents = espace.cours(racine);
  const source = estSource(racine);
  const cours = cat.cours.map((c) => {
    const ici = presents.find((p) => p.id === c.id);
    let etat = 'absent';
    if (ici) {
      const v = versionInstallee(racine, ici);
      etat = !v ? (source ? 'source' : 'installe') : v.version === c.version ? 'installe' : 'maj';
    }
    return Object.assign({}, c, { etat });
  });
  const packs = (Array.isArray(cat.packs) ? cat.packs : packsDuCatalogue(cat.cours)).map((p) => {
    const membres = cours.filter((c) => p.cours.includes(c.id));
    const etats = membres.map((c) => c.etat);
    const etat = etats.every((e) => e === 'installe' || e === 'source')
      ? 'installe'
      : etats.some((e) => e === 'maj')
        ? 'maj'
        : etats.some((e) => e !== 'absent')
          ? 'partiel'
          : 'absent';
    return Object.assign({}, p, {
      court: p.dossier || p.court || niveauCourt(p.niveau || p.titre),
      etat,
      taille: membres.reduce((t, c) => t + (c.taille || 0), 0),
      nombre: membres.length,
    });
  });
  // Cursus exemples : des packs rangés chacun dans un dossier (L1, L2, L3…)
  const cursus = (Array.isArray(cat.cursus) ? cat.cursus : []).map((c) => {
    const lignes = c.packs.map((x) => ({
      pack: x.pack,
      dossier: x.dossier,
      cours: (packs.find((p) => p.id === x.pack) || { cours: [] }).cours,
    }));
    const ids = [...new Set(lignes.flatMap((l) => l.cours))];
    return Object.assign({}, c, {
      packs: lignes,
      nombre: ids.length,
      taille: cours.filter((x) => ids.includes(x.id)).reduce((t, x) => t + (x.taille || 0), 0),
    });
  });
  return { genere: cat.genere, source, cours, packs, cursus };
}

/** Vérifie un manifeste de cursus exemple (explore/cursus/<id>.json) ; renvoie les problèmes. */
function verifierCursus(c, idsPacks) {
  const pb = [];
  if (!c || c.format !== 'ula-cursus-1') pb.push('format ula-cursus-1 attendu');
  if (!c || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(String(c.id || ''))) pb.push('id invalide');
  if (!c || !c.titre) pb.push('titre manquant');
  if (!c || !Array.isArray(c.packs) || !c.packs.length) pb.push('liste de packs vide');
  else
    for (const x of c.packs) {
      if (!x || !x.pack || (idsPacks && !idsPacks.has(x.pack))) pb.push(`pack inconnu : ${x && x.pack}`);
      if (!x || !x.dossier || /[\\/:*?"<>|]/.test(x.dossier)) pb.push(`dossier invalide pour ${x && x.pack}`);
    }
  return pb;
}

/** « Licence 1 informatique » -> « L1 » ; sinon le niveau tel quel. */
function niveauCourt(niveau) {
  const m = /^Licence (\d)/.exec(String(niveau || ''));
  return m ? 'L' + m[1] : String(niveau || '').trim();
}

/** Packs par niveau d'étude : tous les cours d'un même niveau (« Pack Licence 1 informatique »). */
function packsDuCatalogue(cours) {
  const parNiveau = new Map();
  for (const c of cours) {
    const n = String(c.niveau || '').trim();
    if (!n) continue;
    if (!parNiveau.has(n)) parNiveau.set(n, []);
    parNiveau.get(n).push(c.id);
  }
  return [...parNiveau]
    .filter(([, ids]) => ids.length > 1)
    .map(([n, ids]) => ({
      id: n
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
      titre: 'Pack ' + n,
      niveau: n,
      court: niveauCourt(n),
      cours: ids.sort(),
    }))
    .sort((a, b) => a.niveau.localeCompare(b.niveau, 'fr'));
}

/** Vérifie un manifeste de pack (explore/packs/<id>.json) ; renvoie la liste des problèmes. */
function verifierPack(p, idsConnus) {
  const pb = [];
  if (!p || p.format !== 'ula-pack-1') pb.push('format ula-pack-1 attendu');
  if (!p || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(String(p.id || ''))) pb.push('id invalide');
  if (!p || !p.titre) pb.push('titre manquant');
  if (!p || !Array.isArray(p.cours) || !p.cours.length) pb.push('liste de cours vide');
  else {
    if (new Set(p.cours).size !== p.cours.length) pb.push('cours en double');
    for (const id of p.cours) if (idsConnus && !idsConnus.has(id)) pb.push(`cours inconnu : ${id}`);
  }
  if (p && p.dossier && /[\\/:*?"<>|]/.test(p.dossier)) pb.push('nom de dossier proposé invalide');
  return pb;
}

/** Installe (ou met à jour) tous les cours d'un pack ; un cours en échec n'arrête pas les autres
    (relancer le pack reprend les seuls cours manquants). */
async function installerPack(racine, id, journal = () => {}) {
  if (estSource(racine))
    throw new Error(
      tr(
        'Ce dossier est la source du catalogue (dépôt git) : ses cours se modifient dans explore/, pas par téléchargement.',
        'This folder is the source of the catalogue (git repository): its courses are edited in explore/, not downloaded.',
      ),
    );
  const { packs, cours } = await lister(racine);
  const p = packs.find((x) => x.id === id);
  if (!p) throw new Error(tr(`Pack inconnu du catalogue : ${id}`, `Pack not in the catalogue: ${id}`));
  const faits = [],
    erreurs = [];
  const aFaire = cours.filter((x) => p.cours.includes(x.id) && (x.etat === 'absent' || x.etat === 'maj'));
  for (const [i, c] of aFaire.entries()) {
    journal(`${i + 1}/${aFaire.length} · ${c.titre}…`);
    try {
      faits.push((await installer(racine, c.id, journal)).id);
    } catch (e) {
      erreurs.push({ id: c.id, erreur: e.message });
    }
  }
  return { pack: p.id, court: p.court, cours: p.cours, installes: faits, erreurs };
}

function verifierId(c) {
  if (!c || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(String(c.id)) || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(String(c.domaine)))
    throw new Error(tr('Entrée du catalogue invalide.', 'Invalid catalogue entry.'));
}

function remplacer(ancien, nouveau) {
  // Windows : un fichier ouvert peut retarder le renommage ; quelques essais
  for (let i = 0; ; i++) {
    try {
      fs.renameSync(nouveau, ancien);
      return;
    } catch (e) {
      if (i >= 8) throw e;
      const t = Date.now() + 250;
      while (Date.now() < t) {
        /* attente courte */
      }
    }
  }
}

/** Installe ou met à jour un cours du catalogue. */
async function installer(racine, id, journal = () => {}) {
  if (estSource(racine))
    throw new Error(
      tr(
        'Ce dossier est la source du catalogue (dépôt git) : ses cours se modifient dans explore/, pas par téléchargement.',
        'This folder is the source of the catalogue (git repository): its courses are edited in explore/, not downloaded.',
      ),
    );
  const { cours } = await lister(racine);
  const c = cours.find((x) => x.id === id);
  if (!c) throw new Error(tr(`Cours inconnu du catalogue : ${id}`, `Course not in the catalogue: ${id}`));
  verifierId(c);
  journal(
    tr(
      `Téléchargement de ${c.archive} (${(c.taille / 1e6).toFixed(1)} Mo)…`,
      `Downloading ${c.archive} (${(c.taille / 1e6).toFixed(1)} MB)…`,
    ),
  );
  const archive = await telecharger(c.archive);
  const e = crypto.createHash('sha256').update(archive).digest('hex');
  if (e !== c.empreinte)
    throw new Error(
      tr(
        `Empreinte inattendue pour ${c.archive} : téléchargement abîmé ou archive modifiée.`,
        `Unexpected checksum for ${c.archive}: damaged download or modified archive.`,
      ),
    );
  const dossierDomaine = path.join(racine, 'explore', c.domaine);
  const cible = path.join(dossierDomaine, c.id);
  const tmp = path.join(dossierDomaine, `.${c.id}.telechargement`);
  fs.rmSync(tmp, { recursive: true, force: true });
  journal(tr('Extraction…', 'Extracting…'));
  zip.extraire(archive, tmp);
  const fiche = espace.lireJson(path.join(tmp, espace.FICHE_COURS));
  if (!fiche || fiche.id !== c.id) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error(
      tr(
        "Archive invalide : ula-cours.json absent ou d'un autre cours.",
        'Invalid archive: ula-cours.json missing or from another course.',
      ),
    );
  }
  espace.ecrireJson(path.join(tmp, VERSION_INSTALLEE), {
    version: c.version,
    empreinte: c.empreinte,
    installe: new Date().toISOString(),
  });
  if (fs.existsSync(cible)) {
    const vieux = path.join(dossierDomaine, `.${c.id}.ancien`);
    fs.rmSync(vieux, { recursive: true, force: true });
    remplacer(vieux, cible);
    remplacer(cible, tmp);
    fs.rmSync(vieux, { recursive: true, force: true });
  } else {
    remplacer(cible, tmp);
  }
  espace.oublierCache();
  journal(tr('Cours installé.', 'Course installed.'));
  return { id: c.id, domaine: c.domaine, version: c.version };
}

/** Supprime un cours téléchargé (le travail de l'utilisateur, dans son espace, reste). */
function supprimer(racine, id) {
  if (estSource(racine))
    throw new Error(
      tr(
        "Ce dossier est la source du catalogue (dépôt git) : un cours ne s'y supprime pas d'ici.",
        'This folder is the source of the catalogue (git repository): a course cannot be deleted from here.',
      ),
    );
  const c = espace.coursParId(racine, id);
  if (!c) throw new Error(tr(`Cours non installé : ${id}`, `Course not installed: ${id}`));
  fs.rmSync(path.join(racine, c.chemin), { recursive: true, force: true });
  espace.oublierCache();
  return { id };
}

module.exports = {
  DEPOT,
  TAG,
  VERSION_INSTALLEE,
  telecharger,
  lister,
  installer,
  installerPack,
  supprimer,
  estSource,
  packsDuCatalogue,
  niveauCourt,
  verifierPack,
  verifierCursus,
};
