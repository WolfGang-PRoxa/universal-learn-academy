'use strict';
/* Raccourcis vers l'application : Bureau, menu Démarrer (menu des applications
   sous Linux) et dossiers choisis par l'utilisateur. Repris de CV Studio 0.3.0,
   avec les dossiers au choix et les fichiers .desktop de Linux.

   Le nom (« Universal Learn Academy.lnk ») et les emplacements du Bureau et du menu Démarrer sont
   ceux de l'installeur : la désinstallation les retire aussi. Avant chaque
   opération, l'emplacement est relu (raccourcis-regles.js) : l'interface ne
   transmet qu'un identifiant d'emplacement, jamais un chemin de fichier. */

const { app, dialog, shell } = require('electron');
const { t } = require('./i18n');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const regles = require('./raccourcis-regles');
const reglages = require('./reglages');
const { ID_APP } = require('./depot');

const DESCRIPTION = 'Cours, quiz et TD interactifs';
const WINDOWS = process.platform === 'win32';
const LINUX = process.platform === 'linux';
const FICHIER = regles.fichierRaccourci();
const ICONE = path.join(__dirname, 'assets', 'icone.png');

function emplacementsFixes() {
  return [
    { id: 'bureau', label: 'Bureau', dir: app.getPath('desktop'), depth: 0 },
    WINDOWS
      ? {
          id: 'menu',
          label: 'Menu Démarrer',
          dir: path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
          depth: 1,
        }
      : {
          id: 'menu',
          label: 'Menu des applications',
          dir: path.join(
            process.env.XDG_DATA_HOME || path.join(app.getPath('home'), '.local', 'share'),
            'applications',
          ),
          depth: 0,
        },
  ];
}

function idDossier(dossier) {
  return 'dossier:' + crypto.createHash('sha1').update(path.resolve(dossier).toLowerCase()).digest('hex').slice(0, 12);
}

function emplacements() {
  const choisis = (reglages.lire().raccourcis.dossiers || []).map((dir) => ({
    id: idDossier(dir),
    label: path.basename(dir) || dir,
    dir,
    depth: 0,
    choisi: true,
  }));
  return [...emplacementsFixes(), ...choisis];
}

/* -- Lecture et écriture des raccourcis ------------------------------------ */

const io = WINDOWS
  ? {
      lire: async (f) => shell.readShortcutLink(f),
      ecrire: async (f, options, operation) => shell.writeShortcutLink(f, operation, options),
      supprimer: (f) => shell.trashItem(f),
    }
  : {
      lire: async (f) => regles.lireDesktop(await fs.readFile(f, 'utf8')),
      ecrire: async (f, options) => {
        const icone = path.join(
          process.env.XDG_DATA_HOME || path.join(app.getPath('home'), '.local', 'share'),
          'icons',
          'universal-learn-academy.png',
        );
        await fs.mkdir(path.dirname(icone), { recursive: true });
        await fs.copyFile(ICONE, icone);
        await fs.writeFile(f, regles.ecrireDesktop(Object.assign({}, options, { icon: icone })), 'utf8');
        await fs.chmod(f, 0o755);
        return true;
      },
      supprimer: (f) => shell.trashItem(f),
    };

function prisEnCharge() {
  return WINDOWS || LINUX;
}

/** Ce que doit lancer le raccourci : l'exécutable installé (l'AppImage sous Linux),
    ou Electron et le projet en développement. */
function lancementAttendu() {
  const target = (LINUX && process.env.APPIMAGE) || process.execPath;
  const args = app.isPackaged ? '' : '"' + app.getAppPath() + '"';
  return { target, args };
}

function optionsRaccourci() {
  const { target, args } = lancementAttendu();
  return {
    target,
    args,
    cwd: path.dirname(target),
    description: DESCRIPTION,
    icon: target,
    iconIndex: 0,
    appUserModelId: ID_APP,
  };
}

async function lireLien(f) {
  try {
    return await io.lire(f);
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

async function existe(f) {
  if (!f) return false;
  try {
    await fs.access(f);
    return true;
  } catch (e) {
    return false;
  }
}

/** Raccourcis du dossier (et de ses sous-dossiers jusqu'à `depth`), sauf celui de l'application à la racine. */
async function listerLiens(dir, depth, prefixe = '') {
  let entrees;
  try {
    entrees = await fs.readdir(path.join(dir, prefixe), { withFileTypes: true });
  } catch (e) {
    return [];
  }
  const extension = WINDOWS ? /\.lnk$/i : /\.desktop$/i;
  const liste = [];
  for (const e of entrees) {
    const relatif = path.join(prefixe, e.name);
    if (e.isDirectory() && depth > 0) liste.push(...(await listerLiens(dir, depth - 1, relatif)));
    else if (e.isFile() && extension.test(e.name) && relatif.toLowerCase() !== FICHIER.toLowerCase())
      liste.push(relatif);
  }
  return liste;
}

/** État d'un emplacement, avec le raccourci trouvé. */
async function inspecter(lieu) {
  const attendu = lancementAttendu();
  const principal = path.join(lieu.dir, FICHIER);
  const primary = (await existe(principal)) ? await lireLien(principal) : null;

  const others = [];
  for (const relatif of await listerLiens(lieu.dir, lieu.depth)) {
    const lien = await lireLien(path.join(lieu.dir, relatif));
    if (regles.lanceApp(lien, attendu)) others.push(relatif);
  }

  const status = regles.classer(
    { primary, primaryTargetExists: await existe(primary && primary.target), others },
    attendu,
  );
  const file = primary ? principal : others.length ? path.join(lieu.dir, others[0]) : null;
  return {
    id: lieu.id,
    label: lieu.label,
    choisi: Boolean(lieu.choisi),
    dir: lieu.dir,
    dirExiste: await existe(lieu.dir),
    status,
    file,
    name: file ? path.relative(lieu.dir, file) : null,
    fichier: FICHIER,
    currentTarget: (primary && primary.target) || null,
    others: primary ? others : others.slice(1),
    action: regles.actionPrevue(status),
    removable: regles.supprimable(status),
  };
}

function trouver(id) {
  const lieu = emplacements().find((l) => l.id === id);
  if (!lieu) throw new Error(t('r.inconnu'));
  return lieu;
}

function verifierPriseEnCharge() {
  if (!prisEnCharge()) throw new Error(t('p.racc.nonPris'));
}

/* -- API utilisée par main.js --------------------------------------------- */

async function statut() {
  if (!prisEnCharge()) return { supported: false, packaged: app.isPackaged, locations: [] };
  return {
    supported: true,
    packaged: app.isPackaged,
    plateforme: process.platform,
    appImage: LINUX ? Boolean(process.env.APPIMAGE) : null,
    locations: await Promise.all(emplacements().map(inspecter)),
  };
}

/**
 * Crée le raccourci d'un emplacement, ou le répare s'il est périmé. Un fichier au
 * nom de l'application qui ouvre un autre programme n'est remplacé qu'avec `confirmReplace`.
 */
async function creer(id, { confirmReplace = false } = {}) {
  verifierPriseEnCharge();
  const lieu = trouver(id);
  const avant = await inspecter(lieu);
  if (avant.action === 'none') return { outcome: 'already', before: avant, location: avant };
  if (avant.action === 'replace' && !confirmReplace) return { outcome: 'conflict', before: avant, location: avant };

  const f = path.join(avant.dir, FICHIER);
  await fs.mkdir(avant.dir, { recursive: true });
  const operation = avant.action === 'create' ? 'create' : 'replace';
  const ecrit = await io.ecrire(f, optionsRaccourci(), operation);
  if (!ecrit) throw new Error(t('r.ecriture', { dossier: avant.dir }));

  const apres = await inspecter(lieu);
  if (apres.status !== 'ok') throw new Error(t('r.verification'));
  const outcome = { create: 'created', repair: 'repaired', replace: 'replaced' }[avant.action];
  return { outcome, before: avant, location: apres };
}

/** Met à la corbeille le raccourci de l'application trouvé dans un emplacement. */
async function supprimer(id) {
  verifierPriseEnCharge();
  const lieu = trouver(id);
  const avant = await inspecter(lieu);
  if (!avant.file || avant.status === 'missing') return { outcome: 'missing', before: avant, location: avant };
  if (!avant.removable) return { outcome: 'refused', before: avant, location: avant };
  await io.supprimer(avant.file);
  return { outcome: 'removed', before: avant, location: await inspecter(lieu) };
}

/** Affiche le raccourci (ou le dossier) dans l'explorateur de fichiers. */
async function afficher(id) {
  verifierPriseEnCharge();
  const courant = await inspecter(trouver(id));
  if (courant.file) shell.showItemInFolder(courant.file);
  else await shell.openPath(courant.dir);
  return true;
}

/** Demande un dossier, l'ajoute à la liste et y crée le raccourci. */
async function choisirDossier(fenetre) {
  verifierPriseEnCharge();
  const r = await dialog.showOpenDialog(fenetre, {
    title: t('r.choisirTitre'),
    defaultPath: app.getPath('home'),
    properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
  });
  if (r.canceled || !r.filePaths[0]) return { outcome: 'canceled' };
  const dossier = path.resolve(r.filePaths[0]);
  const deja = emplacements().find(
    (l) => l.id === idDossier(dossier) || (!l.choisi && path.resolve(l.dir).toLowerCase() === dossier.toLowerCase()),
  );
  if (!deja) {
    const dossiers = reglages.lire().raccourcis.dossiers || [];
    reglages.modifier({ raccourcis: { dossiers: [...dossiers, dossier] } });
  }
  return creer(deja ? deja.id : idDossier(dossier));
}

/** Retire un dossier choisi de la liste (le raccourci, s'il existe, reste en place). */
function oublierDossier(id) {
  const dossiers = (reglages.lire().raccourcis.dossiers || []).filter((d) => idDossier(d) !== id);
  reglages.modifier({ raccourcis: { dossiers } });
  return true;
}

module.exports = { statut, creer, supprimer, afficher, choisirDossier, oublierDossier, prisEnCharge };
