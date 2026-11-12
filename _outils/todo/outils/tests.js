#!/usr/bin/env node
"use strict";
/* Tests de l'outil TODO : node _outils/todo/outils/tests.js
   - lecture et écriture de TODO.md, octet pour octet, et de cas limites ;
   - chaque opération de la page, suivie d'une relecture stable ;
   - extension du serveur (lecture, écriture, conflit), dans un dossier temporaire.
   Le vrai TODO.md n'est jamais modifié. */

const fs = require("fs");
const os = require("os");
const path = require("path");
const M = require("../assets/markdown-todo.js");
const extension = require("../serveur/extension.js");

const RACINE = path.resolve(__dirname, "..", "..", "..");
let reussis = 0;
const echecs = [];

function test(nom, fn) {
  try { fn(); reussis += 1; }
  catch (e) { echecs.push(nom + " : " + e.message); }
}
async function testAsync(nom, fn) {
  try { await fn(); reussis += 1; }
  catch (e) { echecs.push(nom + " : " + e.message); }
}
function egal(a, b, quoi) {
  if (a !== b) throw new Error((quoi || "valeur") + " : attendu " + JSON.stringify(b) + ", obtenu " + JSON.stringify(a));
}
function vrai(v, quoi) { if (!v) throw new Error(quoi || "condition fausse"); }
// Après une opération : le texte produit se relit à l'identique
function stable(doc) {
  const t = M.ecrire(doc);
  egal(M.ecrire(M.lire(t)), t, "relecture stable");
  return t;
}
function liste(doc, etiquette, n) {
  const l = doc.blocs.filter((b) => b.type === "liste" && b.etiquette === etiquette);
  return l[n || 0];
}
function titre(doc, texte) { return doc.blocs.find((b) => b.type === "titre" && b.texte.startsWith(texte)); }

/* Lecture et écriture ------------------------------------------------------------ */

test("TODO.md relu et réécrit à l'identique", () => {
  const t = fs.readFileSync(path.join(RACINE, "TODO.md"), "utf8");
  egal(M.ecrire(M.lire(t)), t, "TODO.md");
});

const CAS = {
  "fins de ligne Windows": "# T\r\n\r\nListe\r\n- [ ] a\r\n- [x] b\r\n",
  "sans retour final": "## S\n\n- [ ] a",
  "lignes vides en fin": "## S\n\n- [ ] a\n\n\n",
  "puces étoile et espaces": "#  Titre à deux espaces\n\n* [ ] a\n*  b\n- [X] c\n",
  "ligne d'espaces": "## S\n   \n- [ ] a\n",
  "étiquette après paragraphe": "Paragraphe\nsur deux lignes\nÉtiquette\n- [ ] a\n",
  "liste collée au titre": "### Sous\n- [ ] a\n  - [ ] sous-tâche\n  détail\n",
  "tableau puis liste": "| a | b |\n|---|---|\n| 1 | 2 |\n- [ ] a\n",
  "liste numérotée": "1. un\n2. deux\n   suite\n",
  "vide": "",
  "une ligne": "texte"
};
Object.keys(CAS).forEach((nom) => test("cas limite : " + nom, () => egal(M.ecrire(M.lire(CAS[nom])), CAS[nom])));

test("étiquette reconnue, tableau non", () => {
  const d = M.lire(CAS["étiquette après paragraphe"]);
  egal(d.blocs.length, 2, "blocs");
  egal(d.blocs[1].etiquette, "Étiquette", "étiquette");
  egal(M.lire(CAS["tableau puis liste"]).blocs[1].etiquette, null, "pas d'étiquette après un tableau");
});

test("structure et comptes de TODO.md", () => {
  const d = M.lire(fs.readFileSync(path.join(RACINE, "TODO.md"), "utf8"));
  const s = M.structure(d);
  vrai(s.sections.length >= 5, "au moins 5 sections");
  vrai(s.sections.some((x) => x.sous.length >= 3), "des sous-sections");
  const n = M.compter(d.blocs);
  vrai(n.taches > 20 && n.faites > 0 && n.faites < n.taches, "comptes plausibles (" + n.faites + "/" + n.taches + ")");
});

/* Opérations ------------------------------------------------------------------------ */

const BASE = [
  "# TODO", "", "Intro.", "", "## L3", "", "### Codage — `L3/Codage/` (teinte `codage`)", "",
  "Fait : cours 1.", "", "Cours", "- [ ] cours 2", "- [x] cours 1", "  - [ ] relire", "  détail", "",
  "Quiz", "- [ ] quiz 1", "- note sans case", "", "### POO", "", "- [ ] cours 3", "", "## L2", "", "- [ ] rien", ""
].join("\n");
const doc = () => M.lire(BASE);

test("base relue à l'identique", () => egal(M.ecrire(doc()), BASE));

test("cocher et décocher", () => {
  const d = doc(), it = liste(d, "Cours").items[0];
  vrai(M.basculer(d, it.id)); egal(it.marque, "x");
  vrai(M.basculer(d, it.id)); egal(it.marque, " ");
  egal(M.basculer(d, liste(d, "Quiz").items[1].id), false, "une note ne se coche pas");
  stable(d);
});

test("cocher une sous-tâche", () => {
  const d = doc(), it = liste(d, "Cours").items[1];
  vrai(M.basculerSous(d, it.id, 0));
  egal(it.suite[0], "  - [x] relire");
  egal(M.basculerSous(d, it.id, 1), false, "une ligne de détail ne se coche pas");
  egal(M.compter([liste(d, "Cours")]).faites, 2);
  stable(d);
});

test("ajouter une tâche et une note", () => {
  const d = doc(), l = liste(d, "Quiz");
  const it = M.ajouter(d, l.id, "quiz 2\n- [ ] sous\ndétail");
  egal(it.texte, "quiz 2"); egal(it.suite.join("|"), "  - [ ] sous|  détail");
  M.ajouter(d, l.id, "note", { note: true, position: 0 });
  egal(l.items[0].marque, null);
  egal(M.ajouter(d, l.id, "   "), null, "texte vide refusé");
  vrai(stable(d).includes("- note\n- [ ] quiz 1"), "note ajoutée en tête");
});

test("modifier une tâche, la changer en note", () => {
  const d = doc(), it = liste(d, "Cours").items[0];
  vrai(M.modifier(d, it.id, "cours 2 bis\n  - [x] fait", true));
  egal(it.marque, null); egal(it.texte, "cours 2 bis"); egal(it.suite[0], "  - [x] fait");
  vrai(M.modifier(d, it.id, "cours 2 ter", false));
  egal(it.marque, " "); egal(it.suite.length, 0);
  egal(M.modifier(d, it.id, "  "), false, "texte vide refusé");
  stable(d);
});

test("supprimer : la liste vidée disparaît avec son étiquette", () => {
  const d = doc(), l = liste(d, "Quiz");
  M.supprimer(d, l.items[0].id);
  M.supprimer(d, l.items[0].id);
  egal(liste(d, "Quiz"), undefined, "liste Quiz retirée");
  const t = stable(d);
  vrai(!t.includes("Quiz"), "étiquette retirée");
  vrai(t.includes("  détail\n\n### POO"), "espacement gardé");
});

test("déplacer dans la liste et vers une autre", () => {
  const d = doc(), cours = liste(d, "Cours"), quiz = liste(d, "Quiz");
  const a = cours.items[0];
  vrai(M.deplacer(d, a.id, cours.id, 2));
  egal(cours.items[1].id, a.id, "descendu d'un cran");
  vrai(M.deplacer(d, a.id, quiz.id, 0));
  egal(quiz.items[0].id, a.id, "passé en tête de Quiz");
  egal(cours.items.length, 1);
  M.deplacer(d, cours.items[0].id, quiz.id);
  egal(liste(d, "Cours"), undefined, "liste vidée retirée");
  egal(quiz.items.length, 4);
  stable(d);
});

test("renommer et retirer l'étiquette d'une liste", () => {
  const d = doc(), l = liste(d, "Quiz");
  M.renommerListe(d, l.id, "  Quiz   à faire ");
  egal(l.etiquette, "Quiz à faire");
  M.renommerListe(d, l.id, "");
  egal(l.etiquette, null);
  M.renommerListe(d, l.id, "- [ ] pas une étiquette");
  egal(l.etiquette, null, "une puce ne peut pas servir d'étiquette");
  stable(d);
});

test("ajouter une liste et un paragraphe à une sous-section", () => {
  const d = doc(), poo = titre(d, "POO");
  const l = M.ajouterListe(d, poo.id, "TD", "td 1");
  egal(l.etiquette, "TD");
  M.ajouterTexte(d, poo.id, "Remarque.\n\nSuite.");
  const t = stable(d);
  vrai(t.includes("- [ ] cours 3\n\nTD\n- [ ] td 1\n\nRemarque.\nSuite.\n\n## L2"), "ajouts à la fin de POO");
  const codage = titre(d, "Codage");
  M.ajouterListe(d, codage.id, "", "sans étiquette");
  vrai(stable(d).includes("- note sans case\n\n- [ ] sans étiquette\n\n### POO"), "liste sans étiquette");
});

test("modifier et supprimer un paragraphe", () => {
  const d = doc(), p = d.blocs.find((b) => b.type === "texte" && b.lignes[0].startsWith("Fait"));
  M.modifierTexte(d, p.id, "Fait : cours 1 et 2.\n\n");
  egal(p.lignes.join("|"), "Fait : cours 1 et 2.");
  M.modifierTexte(d, p.id, "  ");
  vrai(!stable(d).includes("Fait"), "paragraphe vidé retiré");
});

test("monter et descendre un bloc dans sa partie", () => {
  const d = doc(), quiz = liste(d, "Quiz");
  vrai(M.deplacerBloc(d, quiz.id, -1));
  vrai(stable(d).includes("Fait : cours 1.\n\nQuiz\n- [ ] quiz 1\n- note sans case\n\nCours"), "Quiz avant Cours");
  const fait = d.blocs.find((b) => b.type === "texte" && b.lignes[0].startsWith("Fait"));
  egal(M.deplacerBloc(d, fait.id, -1), false, "pas au-dessus du titre");
});

test("sections : renommer, ajouter, déplacer, supprimer", () => {
  const d = doc();
  vrai(M.renommerTitre(d, titre(d, "POO").id, "Introduction à la POO"));
  const l1 = M.ajouterTitre(d, "L1");
  egal(l1.niveau, 2);
  const shell = M.ajouterTitre(d, "Shell", titre(d, "L2").id);
  egal(shell.niveau, 3);
  vrai(stable(d).includes("## L2\n\n- [ ] rien\n\n### Shell\n\n## L1"), "sous-section avant la section suivante");
  vrai(M.deplacerTitre(d, titre(d, "Introduction").id, -1), "POO monte au-dessus de Codage");
  const s = M.structure(d);
  egal(s.sections[0].sous[0].titre.texte, "Introduction à la POO");
  egal(M.deplacerTitre(d, titre(d, "Introduction").id, -1), false, "déjà en tête");
  vrai(M.deplacerTitre(d, titre(d, "L2").id, -1), "L2 monte au-dessus de L3");
  egal(M.structure(d).sections[0].titre.texte, "L2");
  egal(M.structure(d).sections[0].sous[0].titre.texte, "Shell", "L2 garde sa sous-section");
  vrai(M.supprimerTitre(d, titre(d, "L3").id));
  const t = stable(d);
  vrai(!t.includes("Codage") && !t.includes("POO"), "L3 et son contenu supprimés");
});

/* Extension du serveur ---------------------------------------------------------------- */

function faux(racine) {
  const res = { statut: 0, corps: null };
  const outils = {
    chemins: { RACINE: racine },
    envoyerJson: (r, statut, objet) => { res.statut = statut; res.corps = objet; },
    erreur: (r, statut, message) => { res.statut = statut; res.corps = { erreur: message }; },
    lireCorps: (req) => req.corps instanceof Error ? Promise.reject(req.corps) : Promise.resolve(req.corps)
  };
  return {
    res, appel: (methode, corps, route) => extension.api(route === undefined ? "fichier" : route, { method: methode, corps }, res, outils)
  };
}

(async () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "todo-test-"));
  try {
    await testAsync("extension : fichier absent", async () => {
      const f = faux(dossier);
      await f.appel("GET");
      egal(f.res.statut, 404);
    });
    fs.writeFileSync(path.join(dossier, "TODO.md"), BASE, "utf8");
    await testAsync("extension : lecture", async () => {
      const f = faux(dossier);
      await f.appel("GET");
      egal(f.res.statut, 200); egal(f.res.corps.texte, BASE);
      vrai(/^\d+-\d+$/.test(f.res.corps.version), "version");
    });
    await testAsync("extension : écriture, puis conflit, puis écriture forcée", async () => {
      const f = faux(dossier);
      await f.appel("GET");
      const v = f.res.corps.version;
      await f.appel("PUT", { texte: BASE + "- [ ] ajout\n", version: v });
      egal(f.res.statut, 200, "écriture");
      egal(fs.readFileSync(path.join(dossier, "TODO.md"), "utf8"), BASE + "- [ ] ajout\n");
      await f.appel("PUT", { texte: "autre", version: v });
      egal(f.res.statut, 409, "conflit avec l'ancienne version");
      egal(f.res.corps.texte, BASE + "- [ ] ajout\n", "le conflit renvoie la version du disque");
      await f.appel("PUT", { texte: "autre", version: v, forcer: true });
      egal(f.res.statut, 200, "écriture forcée");
      egal(fs.readFileSync(path.join(dossier, "TODO.md"), "utf8"), "autre");
    });
    await testAsync("extension : requêtes refusées", async () => {
      const f = faux(dossier);
      await f.appel("PUT", { version: "x" });
      egal(f.res.statut, 400, "texte manquant");
      await f.appel("PUT", new Error("JSON invalide."));
      egal(f.res.statut, 400, "JSON invalide");
      await f.appel("DELETE");
      egal(f.res.statut, 405, "méthode");
      egal(await f.appel("GET", undefined, "autre"), false, "route inconnue non traitée");
    });
  } finally {
    fs.rmSync(dossier, { recursive: true, force: true });
  }
  if (echecs.length) {
    echecs.forEach((e) => console.log("✗ " + e));
    console.log(`${reussis} test(s) réussi(s), ${echecs.length} échec(s).`);
    process.exit(1);
  }
  console.log(`✓ ${reussis} test(s) réussi(s).`);
})();
