#!/usr/bin/env node
"use strict";
/* Vérifie les ateliers des pages (studies/_outils/atelier).

   Usage :
     node _outils/atelier/outils/verifier.js [--executer] CHEMIN [CHEMIN ...]
     node _outils/atelier/outils/verifier.js --quiz [--executer] < donnees.json

   CHEMIN est un fichier .html ou un dossier, parcouru récursivement : seules
   les pages qui contiennent un bloc <div class="atelier"> sont vérifiées.
   Pour chaque page :
     - atelier.css et atelier.js chargés, et leur chemin mène bien à _outils/atelier/ ;
     - bloc <script id="atelier-jeux"> : JSON lisible, chaque jeu a un script ;
     - chaque atelier : JSON lisible, éditeur connu, identifiant présent et
       unique, champs et options connus (fautes de frappe), mode et vue
       valides, départ et solution sans erreur de syntaxe, solution qui passe
       les contrôles de l'éditeur (et ses tests : mots d'un automate…),
       disposition et remarques attendues qui visent des éléments existants,
       jeu de données SQL déclaré.
   Avec --executer, les solutions SQL sont exécutées (PGlite, installé au
   premier lancement du serveur local) : une requête doit renvoyer des
   lignes, un script doit passer ses tests.

   --quiz lit sur l'entrée standard le bloc de données d'un quiz et vérifie
   ses questions de type « atelier » ; il écrit une liste
   [{ id, ok: true | false | null, message }] (null : avertissement). C'est
   ainsi que _outils/quiz/outils/verifier_quiz.py s'en sert.

   Code de sortie : 1 s'il y a au moins une erreur, 0 sinon. */

const fs = require("fs");
const path = require("path");
const { charger, ATELIER } = require("./charger");

const RACINE = path.resolve(ATELIER, "..", "..");
const A = charger();
const N = A.noyau;

const MODES = ["exercice", "exemple", "lecture", "annoter"];
const VUES = ["dessin", "les-deux", "texte"];
const CHAMPS_BLOC = ["id", "editeur", "mode", "titre", "consigne", "enonce", "depart", "solution", "solution_source",
  "options", "tests", "explication", "hauteur", "vue", "disposition", "attendu", "question_reponse", "papier"];
const CHAMPS_QUESTION = ["id", "type", "theme", "difficulte", "enonce", "consigne", "explication", "revoir", "indices",
  "editeur", "mode", "titre", "depart", "solution", "options", "tests", "hauteur", "vue", "disposition", "attendu", "seuil"];
const OPTIONS_COMMUNES = ["hauteur"];

let executeur = null;
function executeurSql() {
  if (executeur !== null) return executeur;
  try {
    const ex = require(path.join(RACINE, "_outils", "quiz", "serveur", "lib", "executer.js"));
    executeur = ex.disponibilite().sql ? ex : false;
  } catch (e) { executeur = false; }
  return executeur;
}

function proches(nom, liste) {
  return liste.filter((x) => N.distance(N.cle(nom), N.cle(x)) <= 2).slice(0, 3);
}

/* Vérification d'un atelier (bloc de page ou question de quiz) ---------------------- */

// c : configuration ; jeux : { nom: { script } } ; err, avert : (message) => void
async function verifierAtelier(c, jeux, champs, executer, err, avert, ok) {
  for (const k of Object.keys(c)) {
    if (!champs.includes(k)) {
      const p = proches(k, champs);
      avert("champ « " + k + " » inconnu" + (p.length ? " (voulu : " + p.join(", ") + " ?)" : ""));
    }
  }
  const ed = A.editeurs[c.editeur];
  if (!ed) { err("éditeur inconnu « " + c.editeur + " » ; éditeurs possibles : " + Object.keys(A.editeurs).join(", ")); return; }
  if (c.mode != null && !MODES.includes(c.mode)) err("mode « " + c.mode + " » inconnu ; modes possibles : " + MODES.join(", "));
  if (c.vue != null && !VUES.includes(c.vue)) err("vue « " + c.vue + " » inconnue ; vues possibles : " + VUES.join(", "));
  if (c.hauteur != null && !(Number.isFinite(c.hauteur) && c.hauteur >= 120 && c.hauteur <= 1200)) err("« hauteur » : un nombre de pixels entre 120 et 1200");
  if (c.solution_source != null && !["enseignant", "proposee"].includes(c.solution_source)) err("« solution_source » vaut enseignant ou proposee");
  if (c.seuil != null && !(typeof c.seuil === "number" && c.seuil > 0 && c.seuil <= 1)) err("« seuil » : un nombre entre 0 et 1");

  const options = c.options || {};
  if (typeof options !== "object" || Array.isArray(options)) { err("« options » doit être un objet"); return; }
  const connues = Object.keys(ed.options || {}).concat(OPTIONS_COMMUNES);
  for (const k of Object.keys(options)) {
    if (!connues.includes(k)) {
      const p = proches(k, connues);
      avert("option « " + k + " » inconnue pour l'éditeur " + ed.nom + (p.length ? " (voulu : " + p.join(", ") + " ?)" : "") +
        (connues.length > OPTIONS_COMMUNES.length ? " ; options : " + connues.join(", ") : ""));
    }
  }

  // Textes : chaîne ou tableau de lignes
  for (const k of ["depart", "solution"]) {
    if (c[k] != null && typeof c[k] !== "string" && !(Array.isArray(c[k]) && c[k].every((x) => typeof x === "string"))) {
      err("« " + k + " » : un texte, ou un tableau de lignes");
      return;
    }
  }
  const lire = (k) => {
    const r = ed.lire(N.lignesDe(c[k]), options);
    r.erreurs.forEach((e) => err(k + ", ligne " + (e.ligne || "?") + " : " + e.message));
    return r.erreurs.length ? null : r.modele;
  };
  const depart = c.depart != null ? lire("depart") : ed.vide(options);
  const solution = c.solution != null ? lire("solution") : null;

  if (c.mode === "annoter") {
    if (!depart || ed.estVide(depart)) err("mode annoter : il faut un « depart » (le travail à critiquer)");
    if (!Array.isArray(c.attendu) || !c.attendu.length) avert("mode annoter : pas de remarques « attendu » ; la comparaison sera impossible");
  } else if (c.mode !== "lecture" && c.mode !== "exemple" && c.solution == null && ed.nom !== "texte") {
    avert("pas de « solution » : ni comparaison ni solution à afficher");
  }
  if ((c.mode === "lecture" || c.mode === "exemple") && (!depart || ed.estVide(depart))) err("mode " + c.mode + " : le « depart » est ce qui est montré ; il est vide");

  if (c.attendu != null) {
    if (!Array.isArray(c.attendu)) err("« attendu » : une liste [{ cible, texte }]");
    else {
      const cibles = depart && ed.cibles ? ed.cibles(depart) : null;
      // même élément, ou même lien pris dans l'autre sens (pas la classe seule pour un attribut)
      const existe = (x) => cibles.some((c) => N.memeCible(c, x) && N.memeCible(x, c));
      c.attendu.forEach((x, i) => {
        if (!x || typeof x.texte !== "string" || !x.texte.trim()) err("attendu " + (i + 1) + " : « texte » manquant");
        if (x && x.cible && cibles && !existe(x.cible)) avert("attendu " + (i + 1) + " : la cible « " + x.cible + " » ne correspond à aucun élément du départ");
      });
    }
  }

  if (c.disposition != null) {
    if (typeof c.disposition !== "object" || Array.isArray(c.disposition)) err("« disposition » : un objet { \"Nom\": [x, y] }");
    else if (depart) {
      const elements = (m) => (m.classes || m.noeuds || (m.acteurs || []).concat(m.cas || [])).map((x) => x.nom);
      const noms = elements(depart).concat(c.solution != null ? elements(ed.lire(N.lignesDe(c.solution), options).modele) : []);
      for (const [nom, p] of Object.entries(c.disposition)) {
        if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)) err("disposition de « " + nom + " » : [x, y]");
        else if (!noms.includes(nom)) avert("disposition : « " + nom + " » n'est un élément ni du départ ni de la solution");
      }
    }
  }

  // La solution doit passer les contrôles de l'éditeur (et ses tests)
  if (solution) {
    const msgs = ed.controler(solution, options, c.tests) || [];
    msgs.filter((m) => m.niveau === "erreur").forEach((m) => err("la solution ne passe pas les contrôles : " + m.message));
    msgs.filter((m) => m.niveau === "attention").forEach((m) => avert("solution, point d'attention : " + m.message));
    if (ed.estVide(solution)) err("la solution est vide");
    if (!ed.asynchrone && ed.comparer) {
      const r = ed.comparer(solution, solution, options);
      if (r && r.score !== 1) err("la solution comparée à elle-même n'obtient pas 100 % (" + Math.round(r.score * 100) + " %) : défaut de l'éditeur " + ed.nom);
    }
  }

  // Travail fait sur papier : lisible dans la syntaxe de l'éditeur, seulement pour un exercice
  if (c.papier != null) {
    if (c.mode && c.mode !== "exercice") err("« papier » : seulement pour un atelier en mode exercice");
    const p = c.papier && typeof c.papier === "object" && !Array.isArray(c.papier) ? c.papier : { texte: c.papier };
    const inconnus = Object.keys(p).filter((k) => !["texte", "source", "date", "note"].includes(k));
    if (inconnus.length) avert("« papier » : champ(s) inconnu(s) " + inconnus.join(", ") + " (texte, source, date, note)");
    if (p.date && isNaN(new Date(p.date))) err("« papier » : date illisible « " + p.date + " » (AAAA-MM-JJ)");
    const r = N.travailPapier(ed, c.papier, options);
    r.erreurs.forEach((e) => err("papier, ligne " + (e.ligne || "?") + " : " + e.message));
  }

  if (ed.nom === "graphe" && c.tests != null) {
    const t = c.tests;
    if (typeof t !== "object" || !["acceptes", "rejetes"].some((k) => Array.isArray(t[k]))) err("« tests » d'un automate : { \"acceptes\": [mots], \"rejetes\": [mots] }");
  }

  if (ed.nom === "sql") await verifierSql(c, ed, options, solution, jeux, executer, err, avert, ok);
}

async function verifierSql(c, ed, options, solution, jeux, executer, err, avert, ok) {
  if (options.mode != null && !["requete", "script"].includes(options.mode)) err("option « mode » : requete ou script");
  if (options.jeu && !(jeux && jeux[options.jeu])) { err("jeu de données « " + options.jeu + " » introuvable" + (jeux ? " ; jeux déclarés : " + (Object.keys(jeux).join(", ") || "aucun") : "")); return; }
  if (options.jeu && jeux[options.jeu] && typeof jeux[options.jeu].script !== "string") { err("jeu « " + options.jeu + " » : pas de « script »"); return; }
  if (options.mode === "script") {
    if (!Array.isArray(c.tests) || !c.tests.length) avert("mode script sans « tests » : la comparaison n'aura rien à vérifier");
    else c.tests.forEach((t, i) => {
      if (!t || (typeof t.requete !== "string" && !t.resultat)) err("test " + (i + 1) + " : « requete » manquante");
      if (t && t.doit != null && !["reussir", "echouer"].includes(t.doit)) err("test " + (i + 1) + " : « doit » vaut reussir ou echouer");
    });
  }
  if (!executer || !solution) return;
  const ex = executeurSql();
  if (!ex) { avert("--executer : PGlite indisponible (lancer une fois studies/lancer.bat), SQL non exécuté"); return; }
  const jeu = options.jeu ? jeux[options.jeu].script : "";
  const ev = ed.evaluation(solution, solution, Object.assign({}, options, { tests: c.tests }), jeu);
  const reps = [];
  for (const d of ev.demandes) reps.push(await ex.executer(d));
  const brut = reps.find((r) => r.erreur);
  if (brut) { err("exécution de la solution : " + brut.erreur); return; }
  const r = ev.interpreter(reps);
  const rates = (r.details || []).filter((x) => !x.ok);
  if (r.score !== 1) {
    err("la solution échoue : " + r.resume + (rates.length ? " (" + rates.map((x) => x.nom + " : " + x.message).join(" ; ") + ")" : ""));
    return;
  }
  if (options.mode !== "script") {
    const x = reps[0] && reps[0].resultats && reps[0].resultats[0];
    if (x && x.colonnes && !x.total) avert("la solution ne renvoie aucune ligne : l'exercice ne distingue pas les requêtes");
    ok("solution SQL : " + (x && x.colonnes ? x.total + " ligne(s), colonnes " + x.colonnes.join(", ") : "exécutée"));
  } else {
    ok("solution SQL : " + (r.details ? r.details.length + " test(s) réussi(s)" : "exécutée"));
  }
}

/* Pages HTML ------------------------------------------------------------------------ */

function ligneDe(source, index) { return source.slice(0, index).split("\n").length; }

function attribut(attrs, nom) {
  const m = attrs.match(new RegExp("\\b" + nom + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)')"));
  return m ? (m[2] != null ? m[2] : m[3]) : null;
}

function decoderJson(texte) { return JSON.parse(texte); }

// Le chemin d'un <link>/<script> de la page mène-t-il au fichier attendu ?
function cheminMene(page, href, cible) {
  if (!href || /^[a-z]+:/i.test(href)) return false;
  const p = href.startsWith("/") ? path.join(RACINE, href) : path.resolve(path.dirname(page), href.split(/[?#]/)[0]);
  return path.normalize(p).toLowerCase() === path.normalize(cible).toLowerCase() && fs.existsSync(p);
}

async function verifierPage(fichier, executer) {
  const erreurs = [], avertis = [], reussis = [];
  const source = fs.readFileSync(fichier, "utf8");

  const liens = [...source.matchAll(/<link\b[^>]*>/g)].map((m) => attribut(m[0], "href"));
  const scripts = [...source.matchAll(/<script\b[^>]*>/g)].map((m) => ({ src: attribut(m[0], "src"), balise: m[0] }));
  const css = path.join(ATELIER, "assets", "atelier.css"), js = path.join(ATELIER, "assets", "atelier.js");
  if (!liens.some((h) => cheminMene(fichier, h, css))) erreurs.push("atelier.css n'est pas chargé (ou son chemin ne mène pas à _outils/atelier/assets/atelier.css)");
  const sjs = scripts.find((s) => cheminMene(fichier, s.src, js));
  if (!sjs) erreurs.push("atelier.js n'est pas chargé (ou son chemin ne mène pas à _outils/atelier/assets/atelier.js)");
  else if (!/\bdefer\b/.test(sjs.balise)) erreurs.push("atelier.js doit être chargé avec defer");

  let jeux = {};
  const mj = source.match(/<script\b[^>]*id="atelier-jeux"[^>]*>([\s\S]*?)<\/script>/);
  if (mj) {
    try {
      jeux = decoderJson(mj[1]);
      for (const [nom, j] of Object.entries(jeux)) {
        if (!j || typeof j.script !== "string") erreurs.push("l." + ligneDe(source, mj.index) + " jeu « " + nom + " » : « script » manquant");
      }
    } catch (e) { erreurs.push("l." + ligneDe(source, mj.index) + " atelier-jeux : JSON illisible (" + e.message + ")"); jeux = {}; }
  }

  const ids = new Map();
  const re = /<div\b([^>]*)>/g;
  let m, nb = 0;
  while ((m = re.exec(source))) {
    const classe = attribut(m[1], "class") || "";
    if (!/(^|\s)atelier(\s|$)/.test(classe)) continue;
    nb++;
    const l = ligneDe(source, m.index);
    const id = attribut(m[1], "id");
    const editeur = attribut(m[1], "data-editeur");
    const ou = "l." + l + " atelier " + (id ? "« " + id + " »" : "sans id");
    const err = (t) => erreurs.push(ou + " : " + t), avert = (t) => avertis.push(ou + " : " + t), ok = (t) => reussis.push(ou + " : " + t);
    const suite = source.slice(re.lastIndex);
    const s = suite.match(/^\s*<script\s+type="application\/json"\s*>([\s\S]*?)<\/script>\s*<\/div>/);
    if (!s) { err("il faut un <script type=\"application/json\"> juste à l'intérieur du bloc, et rien d'autre"); continue; }
    let c;
    try { c = decoderJson(s[1]); } catch (e) { err("JSON illisible : " + e.message); continue; }
    if (!c || typeof c !== "object" || Array.isArray(c)) { err("le JSON doit être un objet"); continue; }
    if (!editeur && !c.editeur) { err("attribut data-editeur manquant"); continue; }
    if (editeur && c.editeur && editeur !== c.editeur) err("data-editeur (" + editeur + ") et « editeur » (" + c.editeur + ") diffèrent");
    c.editeur = c.editeur || editeur;
    c.id = c.id || id;
    if (!c.id) err("pas d'identifiant (attribut id) : le travail ne pourrait pas être enregistré");
    else if (!/^[A-Za-z][\w-]*$/.test(c.id)) err("identifiant « " + c.id + " » : lettres, chiffres, - et _ seulement, en commençant par une lettre");
    else if (ids.has(c.id)) err("identifiant déjà utilisé l." + ids.get(c.id));
    else ids.set(c.id, l);
    await verifierAtelier(c, jeux, CHAMPS_BLOC, executer, err, avert, ok);
  }
  if (!nb && mj) avertis.push("bloc atelier-jeux sans atelier");
  return { erreurs, avertis, reussis, nb };
}

function pages(chemins) {
  const res = [];
  for (const brut of chemins) {
    const p = path.resolve(brut);
    if (!fs.existsSync(p)) { console.log("introuvable : " + brut); continue; }
    if (fs.statSync(p).isDirectory()) {
      const parcourir = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
          if (e.name === "node_modules" || e.name.startsWith(".")) continue;
          const f = path.join(d, e.name);
          if (e.isDirectory()) parcourir(f);
          else if (e.name.endsWith(".html")) {
            const t = fs.readFileSync(f, "utf8");
            if (/<div\b[^>]*class="([^"]*\s)?atelier(\s[^"]*)?"/.test(t) && !t.includes("MODÈLE —")) res.push(f);
          }
        }
      };
      parcourir(p);
    } else if (p.endsWith(".html")) res.push(p);
    else console.log("pas un .html : " + brut);
  }
  return res;
}

/* Questions de quiz (--quiz) ------------------------------------------------------------ */

async function verifierQuiz(donnees, executer) {
  const sortie = [];
  for (const q of (donnees && donnees.questions) || []) {
    if (!q || q.type !== "atelier") continue;
    const id = q.id || "sans id";
    const c = Object.assign({}, q);
    await verifierAtelier(c, donnees.jeux || {}, CHAMPS_QUESTION, executer,
      (t) => sortie.push({ id, ok: false, message: t }),
      (t) => sortie.push({ id, ok: null, message: t }),
      (t) => sortie.push({ id, ok: true, message: t }));
    if (q.mode && q.mode !== "annoter") sortie.push({ id, ok: null, message: "dans un quiz, « mode » ne vaut que annoter (sinon, l'omettre)" });
  }
  return sortie;
}

function lireEntree() {
  return new Promise((resolve) => {
    let t = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (x) => { t += x; });
    process.stdin.on("end", () => resolve(t));
  });
}

async function principal(argv) {
  const executer = argv.includes("--executer");
  if (argv.includes("--quiz")) {
    const sortie = await verifierQuiz(JSON.parse(await lireEntree()), executer);
    process.stdout.write(JSON.stringify(sortie));
    return 0;
  }
  const chemins = argv.filter((a) => !a.startsWith("--"));
  if (!chemins.length) {
    console.log(fs.readFileSync(__filename, "utf8").match(/\/\* ([\s\S]*?)\*\//)[1].replace(/^ {3}/gm, ""));
    return 2;
  }
  let te = 0, ta = 0, total = 0, n = 0;
  for (const f of pages(chemins)) {
    n++;
    console.log(path.relative(RACINE, f));
    const r = await verifierPage(f, executer);
    total += r.nb; te += r.erreurs.length; ta += r.avertis.length;
    r.erreurs.forEach((x) => console.log("  ✗ " + x));
    r.avertis.forEach((x) => console.log("  ! " + x));
    r.reussis.forEach((x) => console.log("  ✓ " + x));
    if (!r.erreurs.length && !r.avertis.length) console.log("  OK · " + r.nb + " atelier(s)");
  }
  console.log("\n" + n + " page(s), " + total + " atelier(s) : " + te + " erreur(s), " + ta + " avertissement(s).");
  return te ? 1 : 0;
}

principal(process.argv.slice(2)).then((code) => {
  const ex = executeur;
  if (ex && ex.nettoyer) ex.nettoyer();
  process.exit(code);
}).catch((e) => { console.error(e && e.stack || e); process.exit(1); });
