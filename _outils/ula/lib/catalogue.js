"use strict";
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

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const espace = require("./espace");
const zip = require("./zip");

const DEPOT = { proprietaire: "WolfGang-PRoxa", nom: "universal-learn-academy" };
const TAG = "catalogue";
const VERSION_INSTALLEE = ".ula-version.json";

let jeton = null;          // jeton de gh, le temps d'une série de requêtes
let infosRelease = null;   // release du catalogue (accès par l'API)

function jetonGh() {
  if (jeton) return jeton;
  const candidats = ["gh"];
  if (process.platform === "win32") candidats.push(path.join(process.env.ProgramFiles || "C:\\Program Files", "GitHub CLI", "gh.exe"));
  for (const c of candidats) {
    try {
      const r = spawnSync(c, ["auth", "token"], { encoding: "utf8", windowsHide: true, timeout: 15000 });
      const t = (r.stdout || "").trim();
      if (r.status === 0 && t) { jeton = t; setTimeout(() => { jeton = null; infosRelease = null; }, 10 * 60 * 1000).unref(); return t; }
    } catch (e) { /* suivant */ }
  }
  return null;
}

async function obtenir(url, entetes = {}, delai = 30000) {
  const r = await fetch(url, { headers: Object.assign({ "User-Agent": "universal-learn-academy" }, entetes), redirect: "follow", signal: AbortSignal.timeout(delai) });
  return r;
}

/** Contenu d'un fichier de la release du catalogue (Buffer). */
async function telecharger(nom, delai = 10 * 60 * 1000) {
  const local = process.env.ULA_CATALOGUE;
  if (local) return fs.readFileSync(path.join(local, nom));
  const publique = `https://github.com/${DEPOT.proprietaire}/${DEPOT.nom}/releases/download/${TAG}/${encodeURIComponent(nom)}`;
  let r;
  try { r = await obtenir(publique, {}, delai); } catch (e) { throw new Error("Pas de connexion à GitHub (" + e.message + ")."); }
  if (r.ok) return Buffer.from(await r.arrayBuffer());
  if (r.status !== 404) throw new Error(`GitHub a répondu ${r.status} pour ${nom}.`);
  // Dépôt privé : API de GitHub avec le jeton de gh
  const t = jetonGh();
  if (!t) throw new Error("Le catalogue n'est pas encore public : il faut la GitHub CLI connectée sur ce poste (gh auth login).");
  const auth = { Authorization: "Bearer " + t, "X-GitHub-Api-Version": "2022-11-28" };
  if (!infosRelease) {
    const rr = await obtenir(`https://api.github.com/repos/${DEPOT.proprietaire}/${DEPOT.nom}/releases/tags/${TAG}`, Object.assign({ Accept: "application/vnd.github+json" }, auth));
    if (!rr.ok) throw new Error(`Release « ${TAG} » introuvable (${rr.status}).`);
    infosRelease = await rr.json();
  }
  const asset = (infosRelease.assets || []).find((a) => a.name === nom);
  if (!asset) throw new Error(`${nom} est absent de la release « ${TAG} ».`);
  const ra = await obtenir(asset.url, Object.assign({ Accept: "application/octet-stream" }, auth), delai);
  if (!ra.ok) throw new Error(`Téléchargement de ${nom} refusé (${ra.status}).`);
  return Buffer.from(await ra.arrayBuffer());
}

/** La racine est-elle le dépôt source du catalogue (explore/ y est versionné) ? */
function estSource(racine) {
  return fs.existsSync(path.join(racine, ".git")) && fs.existsSync(path.join(racine, "_outils", "app"));
}

function versionInstallee(racine, c) {
  return espace.lireJson(path.join(racine, "explore", c.domaine, c.id, VERSION_INSTALLEE));
}

/** Catalogue distant, avec l'état de chaque cours sur ce poste. */
async function lister(racine) {
  infosRelease = null;
  const cat = JSON.parse((await telecharger("catalogue.json", 60000)).toString("utf8"));
  if (cat.format !== "ula-catalogue-1" || !Array.isArray(cat.cours)) throw new Error("catalogue.json : format inconnu.");
  const presents = espace.cours(racine);
  const source = estSource(racine);
  const cours = cat.cours.map((c) => {
    const ici = presents.find((p) => p.id === c.id);
    let etat = "absent";
    if (ici) {
      const v = versionInstallee(racine, ici);
      etat = !v ? (source ? "source" : "installe") : v.version === c.version ? "installe" : "maj";
    }
    return Object.assign({}, c, { etat });
  });
  return { genere: cat.genere, source, cours };
}

function verifierId(c) {
  if (!c || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(String(c.id)) || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(String(c.domaine))) throw new Error("Entrée du catalogue invalide.");
}

function remplacer(ancien, nouveau) {
  // Windows : un fichier ouvert peut retarder le renommage ; quelques essais
  for (let i = 0; ; i++) {
    try { fs.renameSync(nouveau, ancien); return; }
    catch (e) {
      if (i >= 8) throw e;
      const t = Date.now() + 250; while (Date.now() < t) { /* attente courte */ }
    }
  }
}

/** Installe ou met à jour un cours du catalogue. */
async function installer(racine, id, journal = () => {}) {
  if (estSource(racine)) throw new Error("Ce dossier est la source du catalogue (dépôt git) : ses cours se modifient dans explore/, pas par téléchargement.");
  const { cours } = await lister(racine);
  const c = cours.find((x) => x.id === id);
  if (!c) throw new Error(`Cours inconnu du catalogue : ${id}`);
  verifierId(c);
  journal(`Téléchargement de ${c.archive} (${(c.taille / 1e6).toFixed(1)} Mo)…`);
  const archive = await telecharger(c.archive);
  const e = crypto.createHash("sha256").update(archive).digest("hex");
  if (e !== c.empreinte) throw new Error(`Empreinte inattendue pour ${c.archive} : téléchargement abîmé ou archive modifiée.`);
  const dossierDomaine = path.join(racine, "explore", c.domaine);
  const cible = path.join(dossierDomaine, c.id);
  const tmp = path.join(dossierDomaine, `.${c.id}.telechargement`);
  fs.rmSync(tmp, { recursive: true, force: true });
  journal("Extraction…");
  zip.extraire(archive, tmp);
  const fiche = espace.lireJson(path.join(tmp, espace.FICHE_COURS));
  if (!fiche || fiche.id !== c.id) { fs.rmSync(tmp, { recursive: true, force: true }); throw new Error("Archive invalide : ula-cours.json absent ou d'un autre cours."); }
  espace.ecrireJson(path.join(tmp, VERSION_INSTALLEE), { version: c.version, empreinte: c.empreinte, installe: new Date().toISOString() });
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
  journal("Cours installé.");
  return { id: c.id, domaine: c.domaine, version: c.version };
}

/** Supprime un cours téléchargé (le travail de l'utilisateur, dans son espace, reste). */
function supprimer(racine, id) {
  if (estSource(racine)) throw new Error("Ce dossier est la source du catalogue (dépôt git) : un cours ne s'y supprime pas d'ici.");
  const c = espace.coursParId(racine, id);
  if (!c) throw new Error(`Cours non installé : ${id}`);
  fs.rmSync(path.join(racine, c.chemin), { recursive: true, force: true });
  espace.oublierCache();
  return { id };
}

module.exports = { DEPOT, TAG, VERSION_INSTALLEE, telecharger, lister, installer, supprimer, estSource };
