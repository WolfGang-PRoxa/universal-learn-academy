// Vérifications de l'application sans la lancer : `npm run check`.
// - syntaxe de tous les fichiers JavaScript (app/ et _outils/app/) ;
// - règles de contenu : les données personnelles sont écartées, les cours gardés ;
// - contrôle du paquet : un paquet qui contient une donnée personnelle est refusé ;
// - mise à jour de la copie locale des cours (travail de l'utilisateur préservé) ;
// - règles des raccourcis (Windows et .desktop de Linux).
//
// Options :
//   --paquet              contrôle aussi le paquet construit (dist/win-unpacked)
//   --lister-personnels   liste les fichiers suivis par git que les règles tiennent
//                         pour personnels (à retirer avant de rendre le dépôt public)

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const racine = path.resolve(app, '..');
const regles = require('./contenu-regles.cjs');
const echecs = [];
const verifier = (condition, message) => { if (!condition) echecs.push(message); };
const args = new Set(process.argv.slice(2));

/* -- Liste des fichiers personnels suivis par git ------------------------------ */
if (args.has('--lister-personnels')) {
  const suivis = execFileSync('git', ['ls-files', '-z'], { cwd: racine, maxBuffer: 1 << 28 }).toString('utf8').split('\0').filter(Boolean);
  const parRaison = {};
  for (const c of suivis) {
    const r = regles.personnel(c);
    if (r) (parRaison[r.raison] ||= []).push(c);
  }
  for (const [raison, liste] of Object.entries(parRaison)) {
    console.log(`\n# ${raison} (${liste.length})`);
    for (const c of liste) console.log(c);
  }
  process.exit(0);
}

/* -- Syntaxe -------------------------------------------------------------------- */
const fichiersJs = [];
const parcourir = (dossier) => {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const complet = path.join(dossier, e.name);
    if (e.isDirectory()) parcourir(complet);
    else if (/\.(c?m?js)$/.test(e.name)) fichiersJs.push(complet);
  }
};
for (const d of ['src', 'scripts']) parcourir(path.join(app, d));
parcourir(path.join(racine, '_outils', 'app'));
for (const f of fichiersJs) {
  const module = f.endsWith('.mjs') || f.includes(`${path.sep}parametres${path.sep}`) && f.endsWith('.js');
  try {
    if (module) execFileSync(process.execPath, ['--input-type=module', '--check'], { input: fs.readFileSync(f), stdio: ['pipe', 'pipe', 'pipe'] });
    else execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    echecs.push(`Syntaxe : ${path.relative(racine, f)}\n${e.stderr}`);
  }
}

/* -- Règles de contenu -------------------------------------------------------------- */
const personnels = [
  'L3/BDD/quiz_results/bd-cours-01/2026-10-01.json',
  'L3/Codage/td_results/td-02.json',
  'TODO.md',
  'L3/SE_PS/TP/TP1_route/Coord/coord.c',
  'L2/Algo2/TP/Tp1/main.c',
  'administratif/certificat.pdf',
  'Hop3x/hop3xEtudiant/data/trace/x.log',
  'L1/Web_statique/Site Portfolio/index.html',
  'L3/BDD/rendu/TP1_PiauRomain.txt',
  '_outils/quiz/reglages.json',
  'CLAUDE.md',
  '.claude/settings.json',
  '_outils/numerisation/scans/L3/x.pdf',
];
for (const c of personnels) verifier(regles.personnel(c) && regles.exclusion(c), `Donnée personnelle non écartée : ${c}`);
const gardes = [
  'index.html',
  'L3/BDD/generated_courses/cours-01.html',
  'L3/BDD/generated_quizzes/quiz-bd-cours-01.html',
  'L3/BDD/TD/TD1/enonce.pdf',
  'L3/SE_PS/generated_courses/tp-01-route.html',
  '_outils/quiz/serveur/serveur.js',
  '_outils/app/principal.js',
  '_outils/todo/index.html',
  'L2/probabilites_statistiques/cours/cours.pdf',
];
for (const c of gardes) verifier(!regles.exclusion(c), `Fichier de cours écarté à tort : ${c} (${regles.exclusion(c)?.raison})`);
for (const c of ['app/src/main.js', '.gitignore', 'lancer.bat', 'L1/x/.DS_Store']) verifier(regles.exclusion(c) && !regles.personnel(c), `Règle « inutile » attendue : ${c}`);

/* -- Contrôle du paquet --------------------------------------------------------------- */
const { verifier: verifierPaquet } = require('./verifier-paquet.cjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'studies-check-'));
function fauxPaquet(nom, fichiers) {
  const res = path.join(temp, nom, 'resources');
  const manifeste = { version: 'x', fichiers: {} };
  for (const c of fichiers) {
    const f = path.join(res, 'cours', ...c.split('/'));
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, c);
    manifeste.fichiers[c] = { taille: c.length, empreinte: 'x' };
  }
  fs.writeFileSync(path.join(res, 'cours', regles.MANIFESTE), JSON.stringify(manifeste));
  fs.mkdirSync(path.join(res, 'app.asar.unpacked', 'node_modules', 'x'), { recursive: true });
  return res;
}
const propre = verifierPaquet(fauxPaquet('propre', gardes));
verifier(propre.problemes.length === 0, `Paquet propre refusé : ${propre.problemes.join(' ; ')}`);
for (const c of ['L3/BDD/quiz_results/a/1.json', 'L3/POO/td_results/td-01.json', 'TODO.md', 'L3/SE_PS/TP/TP2/main.c']) {
  const sale = verifierPaquet(fauxPaquet('sale-' + c.replace(/\W/g, '_'), [...gardes, c]));
  verifier(sale.problemes.some((p) => p.includes(c)), `Paquet avec ${c} accepté par le contrôle.`);
}
// Fichiers de TP : seulement ceux de la liste blanche, identiques à leur version d'origine
{
  const crypto = await import('node:crypto');
  const sujet = 'L3/SE_PS/TP/TP9/sujet.pdf';
  const liste = { [sujet]: { commit: 'x', source: sujet, empreinte: crypto.createHash('sha256').update(sujet).digest('hex') } };
  const ok = verifierPaquet(fauxPaquet('tp-ok', [...gardes, sujet]), liste);
  verifier(!ok.problemes.length, `Fichier de TP de la liste blanche refusé : ${ok.problemes.join(' ; ')}`);
  const resModifie = fauxPaquet('tp-modifie', [...gardes, sujet]);
  fs.writeFileSync(path.join(resModifie, 'cours', ...sujet.split('/')), 'complété par l’étudiant');
  verifier(verifierPaquet(resModifie, liste).problemes.some((p) => p.includes('version d\'origine')), 'Fichier de TP modifié accepté.');
  verifier(verifierPaquet(fauxPaquet('tp-hors-liste', [...gardes, 'L3/SE_PS/TP/TP9/main.c']), liste).problemes.some((p) => p.includes('absent de tp-fournis')), 'Fichier de TP hors liste accepté.');
  const nominatif = 'L3/BDD/TP/TP9/TP9_PiauRomain.txt';
  const listeNom = { ...liste, [nominatif]: { commit: 'x', source: nominatif, empreinte: crypto.createHash('sha256').update(nominatif).digest('hex') } };
  verifier(verifierPaquet(fauxPaquet('tp-nom', [...gardes, nominatif]), listeNom).problemes.length > 0, 'Fichier de TP à ton nom accepté parce qu’il était dans la liste.');
}
// La liste blanche réelle ne contient aucun fichier personnel hors règle des TP
{
  const tp = JSON.parse(fs.readFileSync(path.join(app, 'tp-fournis.json'), 'utf8')).fichiers;
  for (const c of Object.keys(tp)) {
    const r = regles.exclusion(c, { tp: false });
    verifier(!r && regles.estTP(c), `tp-fournis.json contient ${c} (${r ? r.raison : 'hors des dossiers de TP'})`);
  }
}

const sansManifeste = path.join(temp, 'vide', 'resources');
fs.mkdirSync(sansManifeste, { recursive: true });
verifier(verifierPaquet(sansManifeste).problemes.length > 0, 'Paquet sans cours accepté.');

if (args.has('--paquet')) {
  const res = path.join(app, 'dist', 'win-unpacked', 'resources');
  if (!fs.existsSync(res)) echecs.push('Aucun paquet construit (dist/win-unpacked) : lancer npm run dist.');
  else {
    const r = verifierPaquet(res);
    verifier(!r.problemes.length, `Paquet construit refusé :\n  ${r.problemes.join('\n  ')}`);
    if (!r.problemes.length) console.log(`✓ dist/win-unpacked : ${r.fichiersCours} fichiers de cours, aucune donnée personnelle`);
  }
}

/* -- Mise à jour de la copie locale des cours ---------------------------------------- */
const cours = require('../src/cours.js');
{
  const livre = path.join(temp, 'livre');
  const local = path.join(temp, 'local');
  const crypto = await import('node:crypto');
  const livrer = (fichiers, version) => {
    fs.rmSync(livre, { recursive: true, force: true });
    const manifeste = { version, commit: 'x', cree: '', fichiers: {} };
    for (const [c, contenu] of Object.entries(fichiers)) {
      const f = path.join(livre, ...c.split('/'));
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, contenu);
      manifeste.fichiers[c] = { taille: contenu.length, empreinte: crypto.createHash('sha256').update(contenu).digest('hex') };
    }
    fs.writeFileSync(path.join(livre, regles.MANIFESTE), JSON.stringify(manifeste));
  };
  const lire = (c) => { try { return fs.readFileSync(path.join(local, ...c.split('/')), 'utf8'); } catch { return null; } };
  const ecrire = (c, t) => { const f = path.join(local, ...c.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };

  livrer({ 'index.html': 'v1', 'L3/BDD/index.html': 'accueil v1', 'L3/BDD/cours.html': 'cours v1', 'vieux.html': 'v1' }, 'v1');
  let r = cours.synchroniser(livre, local);
  verifier(r.copies === 4 && lire('index.html') === 'v1', 'Première copie des cours incomplète.');
  verifier(cours.synchroniser(livre, local).aJour, 'Copie à jour recopiée inutilement.');

  // Travail de l'utilisateur : tentative, accueil modifié (quiz généré ajouté)
  ecrire('L3/BDD/quiz_results/q/1.json', 'tentative');
  await new Promise((res) => setTimeout(res, 20));
  ecrire('L3/BDD/index.html', 'accueil modifié');

  livrer({ 'index.html': 'v2', 'L3/BDD/index.html': 'accueil v2', 'L3/BDD/cours.html': 'cours v1', 'nouveau.html': 'v2' }, 'v2');
  r = cours.synchroniser(livre, local);
  verifier(lire('index.html') === 'v2', 'Fichier livré non mis à jour.');
  verifier(lire('nouveau.html') === 'v2', 'Nouveau fichier non copié.');
  verifier(lire('vieux.html') === null, 'Fichier retiré des cours non supprimé.');
  verifier(lire('L3/BDD/index.html') === 'accueil modifié' && r.conserves.includes('L3/BDD/index.html'), 'Fichier modifié par l’utilisateur écrasé.');
  verifier(lire('L3/BDD/quiz_results/q/1.json') === 'tentative', 'Tentative de l’utilisateur touchée.');
}

/* -- Raccourcis ------------------------------------------------------------------------ */
const sc = require('../src/raccourcis-regles.js');
{
  const appli = { target: 'C:\\Users\\r\\AppData\\Local\\Programs\\studies\\Studies.exe', args: '' };
  const classer = (primary, extra = {}) => sc.classer({ primary, ...extra }, appli, 'win32');
  verifier(classer(null) === 'missing', 'Raccourci absent mal détecté.');
  verifier(classer(null, { others: ['Mes cours.lnk'] }) === 'other-name', 'Raccourci sous un autre nom non détecté.');
  verifier(classer({ target: appli.target.toUpperCase().replace(/\\/g, '/') }) === 'ok', 'Raccourci valide non reconnu (casse, séparateurs).');
  verifier(classer({ target: 'C:\\Users\\r\\AppData\\Local\\studies-quiz\\app\\Studies-win32-x64\\Studies.exe' }) === 'outdated', 'Ancienne application (lancer-app.bat) non reconnue comme copie.');
  verifier(classer({ target: 'D:\\Ancien\\Studies.exe' }, { primaryTargetExists: false }) === 'broken', 'Raccourci cassé non détecté.');
  verifier(classer({ target: 'C:\\Windows\\notepad.exe' }) === 'foreign', 'Raccourci vers un autre programme non détecté.');
  verifier(classer({ error: 'illisible' }) === 'foreign', 'Fichier illisible non signalé.');
  verifier(['missing', 'outdated', 'broken', 'foreign', 'ok'].map(sc.actionPrevue).join() === 'create,repair,repair,replace,none', 'Actions prévues incorrectes.');
  verifier(!sc.supprimable('foreign') && sc.supprimable('broken'), 'Règle de suppression incorrecte.');

  // Linux : .desktop écrit puis relu, AppImage d'une autre version reconnue comme copie
  const image = '/home/r/Applications/Studies-1.2.0.AppImage';
  const texte = sc.ecrireDesktop({ target: image, args: '', icon: '/home/r/.local/share/icons/studies.png', description: 'Cours' });
  const relu = sc.lireDesktop(texte);
  verifier(relu.target === image && relu.args === '', `.desktop relu incorrectement : ${JSON.stringify(relu)}`);
  verifier(sc.classer({ primary: relu }, { target: image, args: '' }, 'linux') === 'ok', '.desktop valide non reconnu.');
  verifier(sc.classer({ primary: { target: '/home/r/Studies-1.0.0.AppImage' } }, { target: image }, 'linux') === 'outdated', 'Ancienne AppImage non reconnue.');
  const espaces = sc.lireDesktop(sc.ecrireDesktop({ target: '/home/r/Mes apps/Studies.AppImage', args: '', icon: 'x', description: 'x' }));
  verifier(espaces.target === '/home/r/Mes apps/Studies.AppImage', 'Chemin avec espaces mal relu dans le .desktop.');
  verifier(sc.lireDesktop('pas un raccourci').error, 'Fichier .desktop invalide non signalé.');
}

fs.rmSync(temp, { recursive: true, force: true });

if (echecs.length) {
  console.error(`✗ ${echecs.length} problème(s) :\n- ${echecs.join('\n- ')}`);
  process.exit(1);
}
console.log(`✓ ${fichiersJs.length} fichiers JavaScript, règles de contenu, contrôle du paquet, copie des cours et raccourcis vérifiés.`);
