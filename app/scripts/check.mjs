// Vérifications de l'application sans la lancer : `npm run check`.
// - syntaxe de tous les fichiers JavaScript (app/, _outils/app/, _outils/ula/) ;
// - langues : mêmes clés et mêmes variables en français et en anglais, aucune clé
//   utilisée manquante ; documentation : pages du sommaire dans chaque langue, liens valides ;
// - règles de contenu : les données personnelles sont écartées, le catalogue et les outils gardés ;
// - contrôle du paquet : un paquet qui contient un cours ou une donnée personnelle est refusé ;
// - contrôle du catalogue : une archive de cours piégée (tentatives, TP hors liste ou
//   modifié, adresse électronique, espace d'un profil) est refusée ;
// - « Proposer ce cours » : une proposition piégée (sources d'enseignants, chemin local,
//   nom du profil) est refusée, une propre est acceptée ;
// - espaces des profils : le travail s'écrit dans l'espace du profil, jamais dans explore/ ;
// - mise à jour de la copie locale des outils (fichiers modifiés préservés) ;
// - synchronisation Git (deux clones d'un même dépôt : progression, fusion, conflits) ;
// - règles des raccourcis (Windows et .desktop de Linux).
//
// Options :
//   --paquet              contrôle aussi le paquet construit (dist/win-unpacked)
//   --lister-personnels   liste les fichiers suivis par git que les règles tiennent
//                         pour personnels (à ne jamais publier)

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { controler as controlerCatalogue } from './catalogue.mjs';

const require = createRequire(import.meta.url);
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const racine = path.resolve(app, '..');
const regles = require('./contenu-regles.cjs');
const echecs = [];
const verifier = (condition, message) => { if (!condition) echecs.push(message); };
const args = new Set(process.argv.slice(2));
const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');

/* -- Liste des fichiers personnels suivis par git ------------------------------ */
if (args.has('--lister-personnels')) {
  const suivis = execFileSync('git', ['-c', 'core.quotepath=false', 'ls-files', '-z'], { cwd: racine, maxBuffer: 1 << 28 }).toString('utf8').split('\0').filter(Boolean);
  const parRaison = {};
  for (const c of suivis) {
    const r = regles.personnel(c);
    if (r) (parRaison[r.raison] ||= []).push(c);
  }
  for (const [raison, liste] of Object.entries(parRaison)) {
    console.log(`\n# ${raison} (${liste.length})`);
    for (const c of liste.slice(0, 200)) console.log(c);
    if (liste.length > 200) console.log(`… et ${liste.length - 200} autres`);
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
parcourir(path.join(racine, '_outils', 'ula'));
for (const f of fichiersJs) {
  // Pages des fenêtres annexes écrites en modules ES (paramètres, documentation, guide)
  const module = f.endsWith('.mjs') || /[\\/](parametres|doc|guide)[\\/][^\\/]+\.js$/.test(f);
  try {
    if (module) execFileSync(process.execPath, ['--input-type=module', '--check'], { input: fs.readFileSync(f), stdio: ['pipe', 'pipe', 'pipe'] });
    else execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    echecs.push(`Syntaxe : ${path.relative(racine, f)}\n${e.stderr}`);
  }
}

/* -- Règles de contenu -------------------------------------------------------------- */
const personnels = [
  'romain/L3/BDD/quiz_results/bd-cours-01/2026-10-01.json',
  'romain/L3/Codage/td_results/td-02.json',
  'romain/TODO.md',
  'romain/L3/SE_PS/TP/TP1_route/Coord/coord.c',
  'romain/administratif/certificat.pdf',
  'romain/Hop3x/hop3xEtudiant/data/trace/x.log',
  'alice/Prépa/maths/ula-lien.json',
  'alice/ula-profil.json',
  'TODO.md',
  'explore/informatique/codage/quiz_results/q/1.json',
  'explore/informatique/codage/td_results/td-01.json',
  'explore/informatique/programmation-systeme/TP/TP1_route/Coord/coord.c',
  'explore/langues/anglais-l1/LESSON 1 STUDENT.docx',
  'explore/mathematiques/mathematiques-ia/DM/script.ipynb',
  'explore/informatique/bases-de-donnees-3/TP9_PiauRomain.txt',
  '_outils/quiz/reglages.json',
  'CLAUDE.md',
  '.claude/settings.json',
  '_outils/numerisation/scans/explore/x.pdf',
  '_outils/todo/index.html',
  '_outils/todo/serveur/extension.js',
];
for (const c of personnels) verifier(regles.personnel(c) && regles.exclusion(c), `Donnée personnelle non écartée : ${c}`);
const gardes = [
  'index.html',
  'explore/informatique/index.html',
  'explore/informatique/bases-de-donnees-3/ula-cours.json',
  'explore/informatique/bases-de-donnees-3/generated_courses/cours-01.html',
  'explore/informatique/bases-de-donnees-3/generated_quizzes/quiz-bd-cours-01.html',
  'explore/informatique/bases-de-donnees-3/TD/TD1/enonce.pdf',
  'explore/mathematiques/probabilites-statistiques/cours/cours.pdf',
  '_outils/quiz/serveur/serveur.js',
  '_outils/app/principal.js',
  '_outils/ula/lib/espace.js',
];
for (const c of gardes) verifier(!regles.exclusion(c), `Fichier écarté à tort : ${c} (${regles.exclusion(c)?.raison})`);
for (const c of ['app/src/main.js', '.gitignore', 'lancer.bat', 'explore/x/.DS_Store', 'explore/informatique/codage/.ula-version.json']) verifier(regles.exclusion(c) && !regles.personnel(c), `Règle « inutile » attendue : ${c}`);

/* -- Contrôle du paquet (outils seuls, ni cours ni données) ---------------------------- */
const { verifier: verifierPaquet } = require('./verifier-paquet.cjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ula-check-'));
const outilsGardes = gardes.filter((c) => c.startsWith('_outils/'));
function fauxPaquet(nom, fichiers, { asar = [] } = {}) {
  const res = path.join(temp, nom, 'resources');
  const manifeste = { version: 'x', fichiers: {} };
  for (const c of fichiers) {
    const f = path.join(res, 'outils', ...c.split('/'));
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, c);
    manifeste.fichiers[c] = { taille: c.length, empreinte: 'x' };
  }
  fs.writeFileSync(path.join(res, 'outils', regles.MANIFESTE), JSON.stringify(manifeste));
  fs.mkdirSync(path.join(res, 'app.asar.unpacked', 'node_modules', 'x'), { recursive: true });
  for (const c of asar) { const f = path.join(res, 'app.asar.unpacked', ...c.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, c); }
  return res;
}
const propre = verifierPaquet(fauxPaquet('propre', outilsGardes));
verifier(propre.problemes.length === 0, `Paquet propre refusé : ${propre.problemes.join(' ; ')}`);
for (const c of ['_outils/quiz/reglages.json', '_outils/numerisation/scans/x.pdf', '_outils/quiz/quiz_results/demo/1.json', 'explore/informatique/codage/generated_courses/cours-01.html', 'romain/L3/Codage/td_results/td-01.json', 'TODO.md', '_outils/todo/index.html']) {
  const sale = verifierPaquet(fauxPaquet('sale-' + c.replace(/\W/g, '_'), [...outilsGardes, c]));
  verifier(sale.problemes.some((p) => p.includes(c)), `Paquet piégé avec ${c} accepté par le contrôle.`);
}
verifier(verifierPaquet(fauxPaquet('sale-asar', outilsGardes, { asar: ['explore/informatique/codage/x.html'] })).problemes.length > 0, 'Cours caché dans app.asar.unpacked accepté.');
const sansManifeste = path.join(temp, 'vide', 'resources');
fs.mkdirSync(sansManifeste, { recursive: true });
verifier(verifierPaquet(sansManifeste).problemes.length > 0, 'Paquet sans outils accepté.');

if (args.has('--paquet')) {
  const res = path.join(app, 'dist', 'win-unpacked', 'resources');
  if (!fs.existsSync(res)) echecs.push('Aucun paquet construit (dist/win-unpacked) : lancer npm run dist.');
  else {
    const r = verifierPaquet(res);
    verifier(!r.problemes.length, `Paquet construit refusé :\n  ${r.problemes.join('\n  ')}`);
    if (!r.problemes.length) console.log(`✓ dist/win-unpacked : ${r.fichiersOutils} fichiers d’outils, aucun cours ni donnée personnelle`);
  }
}

/* -- Contrôle du catalogue (archives de cours) ------------------------------------------ */
{
  const sujet = 'explore/informatique/programmation-systeme/TP/TP9/sujet.pdf';
  const liste = { [sujet]: { commit: 'x', source: sujet, empreinte: sha(sujet) } };
  const f = (chemin, texte = chemin) => ({ chemin, donnees: Buffer.from(texte) });
  const base = [f('explore/informatique/programmation-systeme/generated_courses/cours-01.html'), f(sujet)];
  const motif = [/eleve@exemple\.fr/i];
  verifier(controlerCatalogue(base, liste, motif).length === 0, `Cours propre refusé : ${controlerCatalogue(base, liste, motif).join(' ; ')}`);
  const pieges = [
    f('explore/informatique/programmation-systeme/quiz_results/q/1.json'),
    f('explore/informatique/programmation-systeme/TP/TP9/main.c'),
    f(sujet, 'complété par l’étudiant'),
    f('explore/informatique/programmation-systeme/generated_courses/contact.html', 'Écrire à eleve@exemple.fr'),
    f('romain/L3/SE_PS/td_results/td-01.json'),
    f('explore/informatique/programmation-systeme/TD/rendu_PiauRomain.pdf'),
  ];
  for (const p of pieges) {
    const r = controlerCatalogue([...base.filter((b) => b.chemin !== p.chemin), p], liste, motif);
    verifier(r.length > 0, `Archive de cours piégée acceptée : ${p.chemin}`);
  }
  // La liste blanche réelle : uniquement des fichiers de TP du catalogue, sans autre donnée personnelle
  const tp = JSON.parse(fs.readFileSync(path.join(app, 'tp-fournis.json'), 'utf8')).fichiers;
  for (const c of Object.keys(tp)) {
    const r = regles.exclusion(c, { tp: false });
    verifier(!r && regles.estTP(c), `tp-fournis.json contient ${c} (${r ? r.raison : 'hors des dossiers de TP du catalogue'})`);
  }
}

/* -- « Proposer ce cours » --------------------------------------------------------------- */
const espace = require('../../_outils/ula/lib/espace.js');
const proposition = require('../../_outils/ula/lib/proposition.js');
const zip = require('../../_outils/ula/lib/zip.js');
{
  const r = path.join(temp, 'ula-proposition');
  const ecrire = (c, t) => { const f = path.join(r, ...c.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
  ecrire('alice/ula-profil.json', JSON.stringify({ format: 'ula-profil-1', nom: 'alice' }));
  const page = '<!DOCTYPE html><html lang="fr"><head><link rel="stylesheet" href="/_outils/charte/assets/cours.css"></head><body><h1>Suites</h1></body></html>';
  ecrire('alice/Perso/Suites/generated_courses/index.html', page);
  ecrire('alice/Perso/Suites/generated_quizzes/quiz-suites.html', page);
  ecrire('alice/Perso/Suites/quiz_results/q/1.json', '{}');                 // jamais dans l'archive
  const ok = proposition.preparer(r, 'alice', 'alice/Perso/Suites', { titre: 'Suites numériques', domaine: 'mathematiques' });
  const noms = zip.lire(ok.archive).map((e) => e.nom).sort();
  verifier(noms.join() === 'generated_courses/index.html,generated_quizzes/quiz-suites.html,ula-cours.json', `Archive de proposition inattendue : ${noms.join(', ')}`);
  verifier(/issues\/new\?title=/.test(ok.url), 'Adresse de l’issue préremplie absente.');
  const pieges = [
    ['alice/Perso/Suites/generated_courses/CM1 enseignant.pdf', '%PDF'],
    ['alice/Perso/Suites/generated_courses/chemin.html', 'Voir C:\\Users\\alice\\Documents\\notes.txt'],
    ['alice/Perso/Suites/generated_courses/signature.html', '<p>Rédigé par alice</p>'],
    ['alice/Perso/Suites/generated_quizzes/td_results/x.json', '{}'],
  ];
  for (const [c, t] of pieges) {
    ecrire(c, t);
    let refus = null;
    try { proposition.preparer(r, 'alice', 'alice/Perso/Suites', {}); } catch (e) { refus = e; }
    verifier(refus && refus.problemes && refus.problemes.length, `Proposition piégée acceptée : ${c}`);
    fs.rmSync(path.join(r, ...c.split('/')));
  }
}

/* -- Espaces des profils ---------------------------------------------------------------- */
{
  const r = path.join(temp, 'ula');
  const ecrire = (c, t) => { const f = path.join(r, ...c.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
  ecrire('explore/mathematiques/suites/ula-cours.json', JSON.stringify({ format: 'ula-cours-1', id: 'suites', titre: 'Suites', domaine: 'mathematiques' }));
  ecrire('explore/mathematiques/suites/generated_quizzes/quiz.html', '<html></html>');
  const ancien = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = path.join(temp, 'local');   // mémoire du profil actif, isolée
  try {
    verifier(espace.profilActif(r) === null, 'Profil actif sans profil.');
    espace.creerProfil(r, 'Bob');
    verifier(espace.profilActif(r) === 'Bob', 'Seul profil non choisi d’office.');
    let erreur = null;
    try { espace.creerProfil(r, 'explore'); } catch (e) { erreur = e; }
    verifier(erreur, 'Profil « explore » accepté.');
    espace.creerDossier(r, 'Bob', 'Bob', 'Réorientation');
    espace.ajouterCours(r, 'Bob', 'suites', 'Bob/Réorientation');
    const page = path.join(r, 'explore', 'mathematiques', 'suites', 'generated_quizzes', 'quiz.html');
    const t = espace.travailDePage(r, page);
    verifier(t.dossier && t.dossier.includes(path.join('Bob', 'Réorientation')), `Travail ailleurs que dans le cursus : ${t.dossier}`);
    espace.creerProfil(r, 'Chloé');
    espace.choisirProfil(r, 'Chloé');
    const t2 = espace.travailDePage(r, page, { creer: true });
    verifier(t2.dossier && t2.dossier.startsWith(path.join(r, 'Chloé')) && fs.existsSync(path.join(t2.dossier, 'ula-lien.json')), 'Lien non créé dans l’espace du profil actif.');
    fs.mkdirSync(path.join(t2.dossier, 'quiz_results'), { recursive: true });
    fs.writeFileSync(path.join(t2.dossier, 'quiz_results', 'x.json'), '{}');
    erreur = null;
    try { espace.retirer(r, 'Chloé', path.relative(r, t2.dossier)); } catch (e) { erreur = e; }
    verifier(erreur && fs.existsSync(path.join(t2.dossier, 'quiz_results', 'x.json')), 'Un cours avec du travail a été retiré.');
    const deplace = espace.deplacer(r, 'Chloé', path.relative(r, t2.dossier).split(path.sep).join('/'), espace.creerDossier(r, 'Chloé', 'Chloé', 'Prépa'));
    verifier(espace.lienDuCours(r, 'Chloé', 'suites') === path.resolve(r, deplace), 'Lien introuvable après déplacement.');
    espace.renommerProfil(r, 'Chloé', 'Chloe');
    verifier(espace.profilActif(r) === 'Chloe' && fs.existsSync(path.join(r, 'Chloe', 'Prépa')), 'Renommage du profil incomplet.');
    const explore = fs.readdirSync(path.join(r, 'explore', 'mathematiques', 'suites')).sort().join();
    verifier(explore === 'generated_quizzes,ula-cours.json', `explore/ modifié : ${explore}`);
  } finally {
    if (ancien === undefined) delete process.env.LOCALAPPDATA; else process.env.LOCALAPPDATA = ancien;
  }
}

/* -- Packs par niveau ----------------------------------------------------------------------- */
{
  const cat = require('../../_outils/ula/lib/catalogue.js');
  const ids = new Set(execFileSync('git', ['ls-files', '--', 'explore/*/*/ula-cours.json'], { cwd: racine }).toString('utf8').trim().split('\n').filter(Boolean).map((f) => f.split('/')[2]));
  const packs = fs.readdirSync(path.join(racine, 'explore', 'packs')).filter((n) => n.endsWith('.json'));
  verifier(packs.length >= 3, 'Packs L1, L2, L3 absents de explore/packs.');
  for (const n of packs) {
    const p = JSON.parse(fs.readFileSync(path.join(racine, 'explore', 'packs', n), 'utf8'));
    const pb = cat.verifierPack(p, ids);
    verifier(!pb.length && n === p.id + '.json', `explore/packs/${n} invalide : ${pb.join(', ')}`);
  }
  verifier(cat.verifierPack({ format: 'ula-pack-1', id: 'x', titre: 'X', cours: ['inconnu', 'inconnu'] }, ids).length >= 2, 'Pack avec cours inconnu ou en double accepté.');
  // Cursus exemples : uniquement des packs existants, un dossier valide pour chacun
  const idsPacks = new Set(packs.map((n) => n.replace(/\.json$/, '')));
  for (const n of fs.readdirSync(path.join(racine, 'explore', 'cursus')).filter((x) => x.endsWith('.json'))) {
    const c = JSON.parse(fs.readFileSync(path.join(racine, 'explore', 'cursus', n), 'utf8'));
    const pb = cat.verifierCursus(c, idsPacks);
    verifier(!pb.length && n === c.id + '.json', `explore/cursus/${n} invalide : ${pb.join(', ')}`);
  }
  verifier(cat.verifierCursus({ format: 'ula-cursus-1', id: 'x', titre: 'X', packs: [{ pack: 'inconnu', dossier: 'a/b' }] }, idsPacks).length >= 2, 'Cursus avec pack inconnu accepté.');
  const { verifierTout } = await import('./manifestes.mjs');
  const pbManifestes = verifierTout();
  verifier(!pbManifestes.length, `Packs ou cursus invalides : ${pbManifestes.join(' ; ')}`);
  // Ranger un pack dans le cursus : dossier créé, cours déjà présents laissés à leur place
  const r = path.join(temp, 'ula-packs');
  const ecrire = (c, t) => { const f = path.join(r, ...c.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };
  for (const id of ['a', 'b', 'c']) ecrire(`explore/informatique/${id}/ula-cours.json`, JSON.stringify({ format: 'ula-cours-1', id, titre: id.toUpperCase(), domaine: 'informatique' }));
  ecrire('zoe/ula-profil.json', JSON.stringify({ format: 'ula-profil-1', nom: 'zoe' }));
  espace.ajouterCours(r, 'zoe', 'b', 'zoe', 'Mon B');
  const x = espace.ajouterPack(r, 'zoe', ['a', 'b', 'c'], 'L1');
  verifier(x.ajoutes.join() === 'a,c' && x.presents.join() === 'b', `Pack rangé incorrectement : ${JSON.stringify(x)}`);
  verifier(fs.existsSync(path.join(r, 'zoe', 'Mon B', 'ula-lien.json')) && fs.readdirSync(path.join(r, 'zoe', 'L1')).length === 2, 'Cours déjà au cursus déplacé ou dupliqué.');
  const y = espace.ajouterPack(r, 'zoe', ['a', 'b', 'c'], 'L1');
  verifier(!y.ajoutes.length, 'Pack rangé deux fois en double.');
}

/* -- Mise à jour de la copie locale des outils ---------------------------------------- */
const donnees = require('../src/donnees.js');
{
  const livre = path.join(temp, 'livre');
  const local = path.join(temp, 'local-outils');
  const livrer = (fichiers, version) => {
    fs.rmSync(livre, { recursive: true, force: true });
    const manifeste = { version, commit: 'x', cree: '', fichiers: {} };
    for (const [c, contenu] of Object.entries(fichiers)) {
      const f = path.join(livre, ...c.split('/'));
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, contenu);
      manifeste.fichiers[c] = { taille: contenu.length, empreinte: sha(contenu) };
    }
    fs.writeFileSync(path.join(livre, donnees.MANIFESTE), JSON.stringify(manifeste));
  };
  const lire = (c) => { try { return fs.readFileSync(path.join(local, ...c.split('/')), 'utf8'); } catch { return null; } };
  const ecrire = (c, t) => { const f = path.join(local, ...c.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t); };

  livrer({ '_outils/quiz/serveur/serveur.js': 'v1', '_outils/quiz/reglages.exemple.json': 'v1', '_outils/vieux.js': 'v1' }, 'v1');
  let r = donnees.synchroniser(livre, local);
  verifier(r.copies === 3 && lire('_outils/quiz/serveur/serveur.js') === 'v1', 'Première copie des outils incomplète.');
  verifier(donnees.synchroniser(livre, local).aJour, 'Copie à jour recopiée inutilement.');
  ecrire('_outils/quiz/reglages.json', 'réglages de l’utilisateur');
  await new Promise((res) => setTimeout(res, 20));
  ecrire('_outils/quiz/reglages.exemple.json', 'modifié');
  livrer({ '_outils/quiz/serveur/serveur.js': 'v2', '_outils/quiz/reglages.exemple.json': 'v2', '_outils/nouveau.js': 'v2' }, 'v2');
  r = donnees.synchroniser(livre, local);
  verifier(lire('_outils/quiz/serveur/serveur.js') === 'v2', 'Outil livré non mis à jour.');
  verifier(lire('_outils/nouveau.js') === 'v2', 'Nouvel outil non copié.');
  verifier(lire('_outils/vieux.js') === null, 'Outil retiré non supprimé.');
  verifier(lire('_outils/quiz/reglages.exemple.json') === 'modifié' && r.conserves.includes('_outils/quiz/reglages.exemple.json'), 'Fichier modifié par l’utilisateur écrasé.');
  verifier(lire('_outils/quiz/reglages.json') === 'réglages de l’utilisateur', 'Réglages de l’utilisateur touchés.');
}

// Installation de Studies 1.x en « dossier studies » : le dépôt renommé « ula » est retrouvé
{
  const prog = path.join(temp, 'Prog');
  for (const f of ['_outils/app/principal.js', '_outils/quiz/serveur/serveur.js', 'explore/informatique/x/ula-cours.json']) {
    const abs = path.join(prog, 'ula', ...f.split('/'));
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, '');
  }
  const r = donnees.resoudre({ cours: { mode: 'dossier', dossier: path.join(prog, 'studies') }, donnees: { dossier: '' } });
  verifier(r.racine === path.join(prog, 'ula') && r.mode === 'depot', `Dépôt renommé non retrouvé : ${JSON.stringify(r)}`);
}

/* -- Synchronisation Git (synchro-git.js) ----------------------------------------------- */
// Deux clones d'un même dépôt distant : la progression part seule, les ateliers d'un TD
// modifié sur les deux postes sont fusionnés, le travail en cours est préservé, un conflit
// hors progression arrête la fusion (mode « progression ») ou garde les deux versions
// (mode « tout »), une opération Git en cours ou un dépôt injoignable sont signalés.
const sg = require('../src/synchro-git.js');
if (await sg.versionGit()) {
  const t = path.join(temp, 'synchro');
  fs.mkdirSync(t, { recursive: true });
  const g = (cwd, ...a) => execFileSync('git', a, { cwd, stdio: 'pipe' }).toString();
  const w = (r, c, x) => { const f = path.join(r, ...c.split('/')); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof x === 'string' ? x : JSON.stringify(x, null, 2)); };
  // Fins de ligne ramenées à \n : Git for Windows (core.autocrlf=true) réécrit en \r\n les fichiers qu'il remet en place
  const lis = (r, c) => { try { return fs.readFileSync(path.join(r, ...c.split('/')), 'utf8').replace(/\r\n/g, '\n'); } catch { return null; } };
  const td = (q1, q2) => ({ format: 'studies-atelier/travail-1', ateliers: { q1: { v: q1[0], maj: q1[1] }, q2: { v: q2[0], maj: q2[1] } }, maj: q1[1] > q2[1] ? q1[1] : q2[1] });
  const TD = 'moi/L3/BDD/td_results/td1.json';
  const A = path.join(t, 'A'), B = path.join(t, 'B');
  g(t, 'init', '-q', '--bare', '--initial-branch=main', 'distant.git');
  g(t, 'clone', '-q', 'distant.git', 'A');
  for (const [k, v] of [['user.name', 'Essai'], ['user.email', 'essai@example.org']]) g(A, 'config', k, v);
  g(A, 'checkout', '-q', '-B', 'main');
  w(A, '_outils/app/principal.js', ''); w(A, 'explore/x/ula-cours.json', '{}');
  w(A, TD, td(['a0', '2026-11-16T10:00:00Z'], ['b0', '2026-11-16T10:00:00Z']));
  w(A, 'moi/TODO.md', 'v0\n');
  g(A, 'add', '-A'); g(A, 'commit', '-qm', 'départ'); g(A, 'push', '-q', '-u', 'origin', 'main');
  g(t, 'clone', '-q', 'distant.git', 'B');
  for (const [k, v] of [['user.name', 'Essai'], ['user.email', 'essai@example.org']]) g(B, 'config', k, v);

  w(A, TD, td(['a1', '2026-11-16T11:00:00Z'], ['b0', '2026-11-16T10:00:00Z']));
  w(A, 'moi/L3/BDD/quiz_results/qz/t1.json', { id: 't1', enregistre: '2026-11-16T11:00:00Z' });
  w(A, 'moi/TODO.md', 'travail en cours A\n');
  w(A, 'explore/x/nouveau.html', '');
  let r = await sg.cycle(A, { poste: 'PC-A' });
  verifier(r.etat === 'synchronise' && r.commits === 1 && r.envoyes === 1, `Synchro : progression non envoyée (${JSON.stringify(r)}).`);
  const restant = g(A, 'status', '--porcelain').split('\n').filter(Boolean).sort().join('|');
  verifier(restant === ' M moi/TODO.md|?? explore/x/nouveau.html', `Synchro : fichier hors progression committé (${restant}).`);

  w(B, TD, td(['a0', '2026-11-16T10:00:00Z'], ['b2', '2026-11-16T12:00:00Z']));
  w(B, 'moi/TODO.md', 'travail en cours B\n');
  r = await sg.cycle(B, { poste: 'PC-B' });
  const fusion = JSON.parse(lis(B, TD) || '{}').ateliers || {};
  verifier(r.etat === 'synchronise' && r.conflits.length === 1 && fusion.q1?.v === 'a1' && fusion.q2?.v === 'b2', `Synchro : ateliers mal fusionnés (${JSON.stringify(r.conflits)}, ${JSON.stringify(fusion)}).`);
  verifier(lis(B, 'moi/TODO.md') === 'travail en cours B\n' && lis(B, 'moi/L3/BDD/quiz_results/qz/t1.json'), 'Synchro : travail en cours perdu ou tentative non reçue.');
  r = await sg.cycle(A, { poste: 'PC-A' });
  verifier(r.recus.includes(TD) && JSON.parse(lis(A, TD)).ateliers.q2.v === 'b2', 'Synchro : fusion non reçue par l’autre poste.');

  g(A, 'commit', '-qam', 'TODO A'); g(B, 'commit', '-qam', 'TODO B');
  await sg.cycle(A, {});
  r = await sg.cycle(B, {});
  verifier(r.etat === 'manuel' && !fs.existsSync(path.join(B, '.git', 'MERGE_HEAD')), `Synchro : conflit hors progression non arrêté (${r.etat}).`);
  r = await sg.cycle(B, { mode: 'tout' });
  const copie = r.conflits[0] && r.conflits[0].copie;
  verifier(r.etat === 'synchronise' && copie && lis(B, copie) === 'travail en cours A\n' && lis(B, 'moi/TODO.md') === 'travail en cours B\n', `Synchro : conflit sans copie des deux versions (${JSON.stringify(r.conflits)}).`);
  verifier((await sg.cycle(B, {})).etat === 'a-jour', 'Synchro : dépôt à jour mal reconnu.');

  fs.writeFileSync(path.join(B, '.git', 'index.lock'), '');
  verifier((await sg.cycle(B, {})).etat === 'bloque', 'Synchro : opération Git en cours ignorée.');
  fs.rmSync(path.join(B, '.git', 'index.lock'));
  g(B, 'remote', 'set-url', 'origin', path.join(t, 'absent.git'));
  verifier(['hors-ligne', 'erreur'].includes((await sg.cycle(B, {})).etat), 'Synchro : dépôt injoignable non signalé.');
  verifier((await sg.cycle(path.join(t, 'distant.git'), {})).etat === 'indisponible', 'Synchro : dossier sans dépôt suivi non reconnu.');

  verifier(sg.dansPerimetre('moi/L1/Algo/quiz_results/q/1.json', 'progression') && !sg.dansPerimetre('moi/L1/Algo/TP/main.c', 'progression')
    && !sg.dansPerimetre('explore/a/td_results/x.json', 'tout') && sg.dansPerimetre('moi/TP/main.c', 'tout') && !sg.dansPerimetre('moi/x.json.tmp', 'tout'), 'Synchro : périmètre incorrect.');
  verifier(sg.adresseSure('https://ghu_secret@github.com/a/b.git') === 'https://github.com/a/b.git', 'Synchro : identifiants de l’adresse du dépôt affichés.');
} else {
  console.warn('Git introuvable : synchronisation non vérifiée.');
}

/* -- Raccourcis ------------------------------------------------------------------------ */
const sc = require('../src/raccourcis-regles.js');
{
  verifier(sc.fichierRaccourci('win32') === 'Universal Learn Academy.lnk' && sc.fichierRaccourci('linux') === 'universal-learn-academy.desktop', 'Nom des raccourcis inattendu.');
  const appli = { target: 'C:\\Users\\r\\AppData\\Local\\Programs\\studies\\Universal Learn Academy.exe', args: '' };
  const classer = (primary, extra = {}) => sc.classer({ primary, ...extra }, appli, 'win32');
  verifier(classer(null) === 'missing', 'Raccourci absent mal détecté.');
  verifier(classer(null, { others: ['Mes cours.lnk'] }) === 'other-name', 'Raccourci sous un autre nom non détecté.');
  verifier(classer({ target: appli.target.toUpperCase().replace(/\\/g, '/') }) === 'ok', 'Raccourci valide non reconnu (casse, séparateurs).');
  verifier(classer({ target: 'D:\\Ancien\\Universal Learn Academy.exe' }, { primaryTargetExists: false }) === 'broken', 'Raccourci cassé non détecté.');
  verifier(classer({ target: 'C:\\Windows\\notepad.exe' }) === 'foreign', 'Raccourci vers un autre programme non détecté.');
  verifier(classer({ error: 'illisible' }) === 'foreign', 'Fichier illisible non signalé.');
  verifier(['missing', 'outdated', 'broken', 'foreign', 'ok'].map(sc.actionPrevue).join() === 'create,repair,repair,replace,none', 'Actions prévues incorrectes.');
  verifier(!sc.supprimable('foreign') && sc.supprimable('broken'), 'Règle de suppression incorrecte.');

  // Linux : .desktop écrit puis relu, AppImage d'une autre version reconnue comme copie
  const image = '/home/r/Applications/Universal-Learn-Academy-2.1.0.AppImage';
  const texte = sc.ecrireDesktop({ target: image, args: '', icon: '/home/r/.local/share/icons/universal-learn-academy.png', description: 'Cours' });
  const relu = sc.lireDesktop(texte);
  verifier(relu.target === image && relu.args === '', `.desktop relu incorrectement : ${JSON.stringify(relu)}`);
  verifier(sc.classer({ primary: relu }, { target: image, args: '' }, 'linux') === 'ok', '.desktop valide non reconnu.');
  verifier(sc.classer({ primary: { target: '/home/r/Universal-Learn-Academy-2.0.0.AppImage' } }, { target: image }, 'linux') === 'outdated', 'Ancienne AppImage non reconnue.');
  const espaces = sc.lireDesktop(sc.ecrireDesktop({ target: '/home/r/Mes apps/ULA.AppImage', args: '', icon: 'x', description: 'x' }));
  verifier(espaces.target === '/home/r/Mes apps/ULA.AppImage', 'Chemin avec espaces mal relu dans le .desktop.');
  verifier(sc.lireDesktop('pas un raccourci').error, 'Fichier .desktop invalide non signalé.');
}

/* -- Langues et documentation ----------------------------------------------------------- */
// Chaque dictionnaire a les mêmes clés et les mêmes {variables} en français et en
// anglais ; toute clé utilisée existe ; chaque page du sommaire de la documentation
// existe dans les deux langues, et ses liens (page:, parametres:) mènent quelque part.
{
  const vm = await import('node:vm');
  const variables = (x) => (String(x).match(/\{\w+\}/g) || []).sort().join(',');
  const comparer = (nom, dicos) => {
    const fr = dicos.fr;
    for (const [langue, d] of Object.entries(dicos)) {
      if (langue === 'fr') continue;
      for (const k of Object.keys(fr)) {
        if (!(k in d)) echecs.push(`${nom} : clé « ${k} » absente en ${langue}`);
        else if (variables(fr[k]) !== variables(d[k])) echecs.push(`${nom} : variables différentes pour « ${k} » (${langue})`);
      }
      for (const k of Object.keys(d)) if (!(k in fr)) echecs.push(`${nom} : clé « ${k} » absente en français`);
    }
  };
  const lire = (rel) => fs.readFileSync(path.join(racine, rel), 'utf8');
  const tousLesJs = (dossier, exclure) => {
    const r = [];
    (function p(d) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const c = path.join(d, e.name);
        if (e.isDirectory()) { if (!exclure || !exclure.test(c)) p(c); } else if (/\.c?js$/.test(e.name)) r.push(c);
      }
    })(dossier);
    return r;
  };

  // Hôte : app/src/i18n
  const { DICTIONNAIRES } = require('../src/i18n/index.js');
  comparer('app/src/i18n', DICTIONNAIRES);
  const utilisees = new Set();
  for (const f of tousLesJs(path.join(app, 'src'), /[\\/]i18n$/)) {
    const x = fs.readFileSync(f, 'utf8');
    for (const m of x.matchAll(/["'`]((?:commun|p|g|d|l|m|s|c|r|u)\.[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*)["'`]/g)) utilisees.add(m[1]);
    for (const m of x.matchAll(/\btn\(\s*["']([\w.]+)["']/g)) { utilisees.delete(m[1]); utilisees.add(m[1] + '.un'); utilisees.add(m[1] + '.plusieurs'); }
  }
  for (const k of utilisees) if (!(k in DICTIONNAIRES.fr)) echecs.push(`app/src : clé « ${k} » utilisée mais absente de i18n/fr.js`);

  // Programme des outils : _outils/app/textes.js
  const textesApp = require('../../_outils/app/textes.js').TEXTES;
  comparer('_outils/app/textes.js', textesApp);
  for (const f of tousLesJs(path.join(racine, '_outils', 'app'))) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/\bt\(\s*"([\w.]+)"/g)) if (!(m[1] in textesApp.fr)) echecs.push(`${path.relative(racine, f)} : clé « ${m[1]} » absente de textes.js`);
  }

  // Barre du haut : TEXTES_BARRE de cours.js
  const coursJs = lire('_outils/charte/assets/cours.js');
  const barre = coursJs.match(/var TEXTES_BARRE = (\{[\s\S]*?\n  \});/);
  if (!barre) echecs.push('cours.js : TEXTES_BARRE introuvable');
  else {
    const dicos = vm.runInNewContext('(' + barre[1] + ')');
    comparer('TEXTES_BARRE (cours.js)', dicos);
    for (const m of coursJs.matchAll(/\btb\(\s*"(\w+)"/g)) if (!(m[1] in dicos.fr)) echecs.push(`cours.js : clé « ${m[1]} » absente de TEXTES_BARRE`);
  }

  // Accueil : _outils/ula/assets/textes.js
  const bac = { window: {} };
  vm.runInNewContext(lire('_outils/ula/assets/textes.js'), bac);
  const accueil = bac.window.ULA_TEXTES;
  comparer('_outils/ula/assets/textes.js', accueil);
  const accueilJs = lire('_outils/ula/assets/accueil.js');
  for (const m of accueilJs.matchAll(/\bTn?\(\s*"([\w.]*\w)"/g)) if (!(m[1] in accueil.fr)) echecs.push(`accueil.js : clé « ${m[1]} » absente de textes.js`);
  for (const m of accueilJs.matchAll(/"(outils\.\w+)"\]/g)) for (const k of [m[1], m[1] + 'Aide']) if (!(k in accueil.fr)) echecs.push(`accueil.js : clé « ${k} » absente de textes.js`);
  for (const d of (accueilJs.match(/var DOMAINES = \[([^\]]*)\]/) || [, ''])[1].match(/\w+/g) || []) if (!(`domaine.${d}` in accueil.fr)) echecs.push(`accueil.js : domaine « ${d} » sans nom dans textes.js`);

  // Documentation
  // markdown.js est un module ES dans un paquet CommonJS : importé depuis son texte
  const { ancre } = await import('data:text/javascript,' + encodeURIComponent(fs.readFileSync(path.join(app, 'src', 'doc', 'markdown.js'), 'utf8')));
  const contenu = path.join(app, 'src', 'doc', 'contenu');
  const sommaire = JSON.parse(fs.readFileSync(path.join(contenu, 'sommaire.json'), 'utf8'));
  const ids = sommaire.groupes.flatMap((g) => g.pages);
  const sections = new Set([...fs.readFileSync(path.join(app, 'src', 'parametres', 'parametres.js'), 'utf8').matchAll(/\['([a-z-]+)', 'p\.nav\./g)].map((m) => m[1]));
  for (const langue of Object.keys(DICTIONNAIRES)) {
    for (const g of sommaire.groupes) if (!g.titre[langue]) echecs.push(`Documentation : groupe « ${g.id} » sans titre en ${langue}`);
    const ancres = {};
    const textes = {};
    for (const id of ids) {
      const f = path.join(contenu, langue, id + '.md');
      if (!fs.existsSync(f)) { echecs.push(`Documentation : page ${langue}/${id}.md absente`); continue; }
      textes[id] = fs.readFileSync(f, 'utf8');
      if (!/^#\s+\S/m.test(textes[id])) echecs.push(`Documentation : ${langue}/${id}.md sans titre « # »`);
      ancres[id] = new Set([...textes[id].matchAll(/^#{1,4}\s+(.+)$/gm)].map((m) => ancre(m[1])));
    }
    for (const [id, md] of Object.entries(textes)) {
      for (const m of md.matchAll(/\]\(([a-z]+):([^)\s]*)\)/g)) {
        const [, genre, cible] = m;
        if (genre === 'page') {
          const [page, a] = cible.split('#');
          if (!ids.includes(page)) echecs.push(`Documentation : ${langue}/${id}.md renvoie à une page inconnue (${cible})`);
          else if (a && ancres[page] && !ancres[page].has(a)) echecs.push(`Documentation : ${langue}/${id}.md renvoie à une ancre inconnue (${cible})`);
        } else if (genre === 'parametres') {
          if (cible && !sections.has(cible)) echecs.push(`Documentation : ${langue}/${id}.md renvoie à une section de paramètres inconnue (${cible})`);
        } else if (genre !== 'guide' && genre !== 'https') echecs.push(`Documentation : ${langue}/${id}.md, lien non reconnu (${genre}:${cible})`);
      }
    }
  }
}

fs.rmSync(temp, { recursive: true, force: true });

if (echecs.length) {
  console.error(`✗ ${echecs.length} problème(s) :\n- ${echecs.join('\n- ')}`);
  process.exit(1);
}
console.log(`✓ ${fichiersJs.length} fichiers JavaScript, langues et documentation, règles de contenu, paquet, catalogue et proposition piégés refusés, espaces des profils, copie des outils, synchronisation Git et raccourcis vérifiés.`);
