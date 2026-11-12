#!/usr/bin/env node
"use strict";
/* Tests de la logique de l'atelier : lecture des syntaxes, écriture (aller-
   retour texte -> modèle -> texte), contrôles et comparaisons.
   Usage : node _outils/atelier/outils/tests.js   (code de sortie 1 si un test échoue) */

const { charger } = require("./charger");
const A = charger();
const E = A.editeurs;

let reussis = 0, echoues = 0;
function test(nom, f) {
  try { f(); reussis++; }
  catch (e) { echoues++; console.log("✗ " + nom + "\n    " + e.message); }
}
function egal(obtenu, attendu, quoi) {
  const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
  if (a !== b) throw new Error((quoi ? quoi + " : " : "") + "obtenu " + a + ", attendu " + b);
}
function vrai(v, quoi) { if (!v) throw new Error(quoi || "condition fausse"); }
function lireOk(ed, texte, options) {
  const r = E[ed].lire(texte, options);
  if (r.erreurs.length) throw new Error("erreurs de syntaxe inattendues : " + JSON.stringify(r.erreurs));
  return r.modele;
}
function allerRetour(ed, texte, options) {
  const m = lireOk(ed, texte, options);
  const t = E[ed].ecrire(m, options);
  egal(E[ed].ecrire(lireOk(ed, t, options), options), t, "aller-retour " + ed);
  return m;
}
function niveaux(liste) { return liste.map((m) => m.niveau); }
function contient(liste, motif) {
  vrai(liste.some((m) => motif.test(m.message)), "aucun message ne correspond à " + motif + " dans " + JSON.stringify(liste.map((m) => m.message)));
}

/* Noyau ------------------------------------------------------------------------ */

test("noyau : noms comparables", () => {
  egal(A.noyau.cle("Vendeur·ses"), "vendeur");
  egal(A.noyau.cle("Réalisateurs"), "realisateur");
  egal(A.noyau.cle("Cours"), A.noyau.cle("cours"));
});
test("noyau : multiplicités", () => {
  egal(A.noyau.multNormale("0..*"), "*");
  egal(A.noyau.multNormale("1..1"), "1");
  egal(A.noyau.multNormale(" 1 .. * "), "1..*");
  egal(A.noyau.multiplicite("3..1"), null);
  egal(A.noyau.multiplicite("x"), null);
});
test("syntaxe : commentaires", () => {
  egal(A.syntaxe.lignes("-- titre\nA -- B // note\n  x").map((l) => l.texte), ["A -- B", "x"]);
});

/* Relationnel ------------------------------------------------------------------------ */

const DINGO = "Vendeurs(_id_, nom, #id_parrain(id))\nArticles(_id_, nom, categorie, prix : numeric(6,2), date_vente, #id_vendeur(Vendeurs.id))";
test("relationnel : lecture et aller-retour", () => {
  const m = allerRetour("relationnel", DINGO);
  egal(m.relations.length, 2);
  egal(m.relations[1].attributs[5], { nom: "id_vendeur", cle: false, etrangere: true, ref: { table: "Vendeurs", colonne: "id" }, type: null });
  egal(m.relations[1].attributs[3].type, "numeric(6,2)");
});
test("relationnel : clé composée et multi-lignes", () => {
  const m = lireOk("relationnel", "Musicien(_id_mus_, nom)\nOrchestre(_id_orch_)\nActivite(_#id_mus_,\n  _#id_orch_, debut)");
  egal(m.relations[2].attributs.map((a) => [a.nom, a.cle, a.etrangere]), [["id_mus", true, true], ["id_orch", true, true], ["debut", false, false]]);
  egal(E.relationnel.controler(m), []);
});
test("relationnel : erreurs de syntaxe", () => {
  const r = E.relationnel.lire("Bad(x y)\nRien\nOups(a, b");
  egal(r.erreurs.map((e) => e.ligne), [1, 2, 3]);
});
test("relationnel : contrôles", () => {
  const m = lireOk("relationnel", "Articles(_id_, #id_vendeur)\nVendeurs(_id_vendeur_, nom)\nSans(a, b)\nR(_x_, #y(Inconnue))");
  const c = E.relationnel.controler(m);
  contient(c, /déclarée plus bas/);
  contient(c, /« Sans » n'a pas de clé primaire/);
  contient(c, /« Inconnue », qui n'est pas une relation/);
});
test("relationnel : clé étrangère sans table précisée", () => {
  const c = E.relationnel.controler(lireOk("relationnel", "Vendeurs(_id_)\nArticles(_id_, #id_vendeur)"));
  contient(c, /aucune relation n'a de clé primaire nommée « id_vendeur »/);
});
test("relationnel : comparaison", () => {
  const sol = lireOk("relationnel", "Vendeurs(_id_, nom)\nArticles(_id_, nom, prix, #id_vendeur(Vendeurs))");
  egal(E.relationnel.comparer(sol, sol).score, 1);
  const c = E.relationnel.comparer(lireOk("relationnel", "Vendeur(_id_, nom)\nArticle(id, nom, #id_vendeur(Vendeur))"), sol);
  vrai(c.score < 1 && c.score > 0.5, "score " + c.score);
  contient(c.ecarts, /Il manque l'attribut « prix »/);
  contient(c.ecarts, /devrait faire partie de la clé primaire/);
});

/* Classes ----------------------------------------------------------------------------- */

const CLASSES = [
  "classe Vendeur", "  id : int {PK}", "  nom : varchar [1]",
  "classe abstraite Personne", "  + age() : int",
  "interface Comparable",
  "classe Article", "  _id_ : int", "  prix : numeric",
  "Vendeur \"1\" -- \"*\" Article : vend >",
  "Vendeur \"0..1 parrain\" -- \"* filleul\" Vendeur : parraine",
  "Acteur \"2..*\" -- \"*\" Film : joue [Distribution]",
  "Voiture \"1\" *-- \"4\" Roue", "Etudiant --|> Personne", "A \"3\" --* \"1\" B", "Compte ..|> Comparable"
].join("\n");
test("classes : lecture et aller-retour", () => {
  const m = allerRetour("classes", CLASSES);
  egal(m.classes.map((c) => [c.nom, c.genre]), [["Vendeur", "classe"], ["Personne", "abstraite"], ["Comparable", "interface"], ["Article", "classe"]]);
  egal(m.classes[3].attributs[0].contraintes, ["PK"]);
  egal(m.classes[1].methodes[0].nom, "age");
  const l = m.liens;
  egal([l[0].ma, l[0].mb, l[0].nom, l[0].sens], ["1", "*", "vend", ">"]);
  egal([l[1].ma, l[1].ra, l[1].mb, l[1].rb], ["0..1", "parrain", "*", "filleul"]);
  egal(l[2].classeAsso, "Distribution");
  egal([l[3].genre, l[3].a], ["composition", "Voiture"]);
  egal([l[5].genre, l[5].a, l[5].b, l[5].ma], ["composition", "B", "A", "1"]);
});
test("classes : contrôles BDD", () => {
  const m = lireOk("classes", "classe Acteur\n  nom : VARCHAR\n  adresses : ADRESSE [1..*]\nclasse Film\n  titre : varchar {PK}\nActeur -- Film\nActeur \"x..y\" -- \"*\" Truc");
  const c = E.classes.controler(m, { bdd: true });
  contient(c, /« Acteur » n'a pas d'identifiant/);
  contient(c, /multivalué/);
  contient(c, /type composé « ADRESSE »/);
  contient(c, /Multiplicité manquante/);
  contient(c, /« Truc », qui n'est pas définie/);
});
test("classes : cycle d'héritage et composition", () => {
  const c = E.classes.controler(lireOk("classes", "classe A\n  x\nclasse B\n  y\nA --|> B\nB --|> A\nA \"*\" *-- \"1\" B"));
  contient(c, /Cycle d'héritage/);
  contient(c, /une partie appartient à un seul composite/);
});
test("classes : comparaison", () => {
  const sol = lireOk("classes", "classe Vendeur\n  id : int {PK}\nclasse Article\n  id : int {PK}\n  prix\nVendeur \"1\" -- \"*\" Article");
  egal(E.classes.comparer(sol, sol).score, 1);
  const c = E.classes.comparer(lireOk("classes", "classe Vendeurs\n  id : int {PK}\nclasse Articles\n  id\nVendeurs \"1\" *-- \"*\" Articles"), sol);
  contient(c.ecarts, /la solution utilise une association, pas une composition/);
  contient(c.ecarts, /Il manque l'attribut « prix »/);
  contient(c.ecarts, /devrait être l'identifiant/);
});
test("classes : multiplicités comparées", () => {
  const sol = lireOk("classes", "classe V\n  a\nclasse W\n  b\nV \"1\" -- \"*\" W");
  const c = E.classes.comparer(lireOk("classes", "classe V\n  a\nclasse W\n  b\nV \"*\" -- \"*\" W"), sol);
  contient(c.ecarts, /multiplicité attendue côté « V » : 1/);
});
test("classes : objets", () => {
  const texte = "classe Carre\n  pleine : boolean\n\nobjet c1 : Carre\n  pleine = true\n  note = \"c1\"\nobjet c2 : Carre\n\nc1 o-- c2";
  const m = allerRetour("classes", texte);
  egal([m.classes[1].genre, m.classes[1].type, m.classes[1].attributs[0].defaut], ["objet", "Carre", "true"]);
  const messages = (t) => E.classes.controler(lireOk("classes", t)).filter((c) => c.niveau !== "info").map((c) => c.message);
  egal(messages("objet a : A\nobjet b : A\na o-- b"), []);
  vrai(messages("objet a : A\nobjet b : A\na \"1\" o-- \"*\" b")[0].includes("Pas de multiplicités"));
  vrai(E.classes.lire("objet c1").erreurs[0].message.includes("Objet illisible"));
  const sol = lireOk("classes", "objet a : Carre\n  pleine = true\nobjet b : Cercle\n  pleine = false\na o-- b");
  egal(E.classes.comparer(sol, sol).score, 1);
  const c = E.classes.comparer(lireOk("classes", "objet a : Triangle\n  pleine = false\nobjet b : Cercle\n  pleine = false\na o-- b"), sol);
  vrai(c.ecarts.some((e) => e.message.includes("classe « Carre »")));
  vrai(c.ecarts.some((e) => e.message.includes("autre valeur") && e.cible === "a.pleine"));
});

test("classes : multiplicités d'une agrégation comparées", () => {
  const sol = lireOk("classes", "classe V\n  a\nclasse W\n  b\nV \"1\" o-- \"*\" W");
  const c = E.classes.comparer(lireOk("classes", "classe V\n  a\nclasse W\n  b\nV \"2\" o-- \"*\" W"), sol);
  egal(c.ecarts.map((e) => e.message), ["Entre « V – W » : multiplicité attendue côté « V » : 1."]);
  const sansLien = E.classes.comparer(lireOk("classes", "classe V\n  a\nclasse W\n  b"), sol);
  egal(sansLien.ecarts.map((e) => e.message), ["Il manque une agrégation entre « V – W »."]);
});

test("graphe : PERT, lecture et aller-retour", () => {
  const P = { pert: true };
  const m = allerRetour("graphe", "etape D 0 0\netape E 3 5\netape F\nD -> E : A 3\nE -> F : fictive", P);
  egal([m.pert, m.noeuds[1].tot, m.noeuds[1].tard, m.noeuds[2].tot], [true, "3", "5", ""]);
  egal(E.graphe.tachePert("T5 : 3"), { nom: "T5", duree: 3 });
  egal(E.graphe.tachePert("fictive").fictive, true);
  egal(E.graphe.tachePert("rien"), null);
  contient(E.graphe.lire("etape D 0 0").erreurs, /illisible/);
});

test("graphe : PERT, contrôles", () => {
  const P = { pert: true };
  const c = (t) => E.graphe.controler(lireOk("graphe", t, P), P);
  egal(c("etape D 0 0\netape F 3 3\nD -> F : A 3"), []);
  contient(c("D -> F : A"), /tâche et sa durée/);
  contient(c("etape D 0 0\netape F 2 2\nD -> F : A 3"), /plus tôt ne laisse pas/);
  contient(c("etape D 0 2\netape F 3 3\nD -> F : A 3"), /plus tard ne laisse pas/);
  contient(c("D -> F : A 1\nD -> F : B 2"), /Deux arcs/);
  contient(c("D -> E : A 1\nE -> F : A 2"), /deux fois/);
  contient(c("D -> E : A 1\nE -> F : B 2\nF -> E : C 3"), /circuit/);
  contient(c("D -> F : A 1\nG -> F : B 2"), /étapes de début/);
  contient(c("etape F 5 3\nD -> F : A 1"), /dépasse/);
});

test("graphe : PERT, comparaison sur les tâches", () => {
  const P = { pert: true };
  const sol = lireOk("graphe", "etape D 0 0\netape X 3 3\netape Y 3 4\netape F 5 5\nD -> X : A 3\nX -> Y : fictive\nY -> F : B 1\nX -> F : C 2", P);
  egal(E.graphe.comparer(sol, sol, P).score, 1);
  // D'autres noms d'étapes, et pas de tâche fictive : mêmes tâches, mêmes précédences
  const autre = lireOk("graphe", "etape a 0 0\netape b 3 3\netape c 3 4\netape z 5 5\na -> b : A 3\nb -> c : fictive\nc -> z : B 1\nb -> z : C 2", P);
  egal(E.graphe.comparer(autre, sol, P).score, 1);
  const r = E.graphe.comparer(lireOk("graphe", "etape D 0 0\netape X 3 3\netape F 5 5\nD -> X : A 3\nD -> F : B 1", P), sol, P);
  contient(r.ecarts.map((e) => ({ message: e.message })), /Il manque la tâche « C »/);
  contient(r.ecarts.map((e) => ({ message: e.message })), /doit attendre la fin de « A »/);
});

test("processus : organigramme", () => {
  const O = { organigramme: true };
  const m = allerRetour("processus", "Projet\n  1 Analyse : 1 analyste, 5 j\n  2 Code", O);
  egal([m.organigramme, m.noeuds[1].etiquette], [true, "1 analyste, 5 j"]);
  contient(E.processus.controler(lireOk("processus", "A\n  B\n  B", O)), /Deux éléments/);
  const c = E.processus.comparer(lireOk("processus", "A\n  B", O), lireOk("processus", "A\n  B\n  C", O), O);
  contient(c.ecarts, /3 éléments/);
});

test("table : listes, avec ou sans espace", () => {
  vrai(E.table.egales("B,C", "b, c", {}) && E.table.egales("A, B,C", "A,B , C", {}));
});

test("classes : fusion des positions", () => {
  const ancien = lireOk("classes", "classe A\n  x\nclasse B\n  y");
  ancien.classes[0].x = 10; ancien.classes[0].y = 20; ancien.classes[1].x = 300; ancien.classes[1].y = 40;
  // B renommée en B2 : elle garde sa place ; C, nouvelle, n'en a pas encore
  const renomme = E.classes.fusionner(lireOk("classes", "classe A\n  x\nclasse B2\n  y"), ancien);
  egal([renomme.classes[0].x, renomme.classes[1].x], [10, 300]);
  const ajout = E.classes.fusionner(lireOk("classes", "classe A\n  x\nclasse B\n  y\nclasse C"), A.noyau.copie(ancien));
  egal([ajout.classes[1].x, ajout.classes[2].x], [300, undefined]);
});

/* Table --------------------------------------------------------------------------------- */

test("table : lecture, aller-retour, comparaison", () => {
  const m = allerRetour("table", "| id | nom | id_parrain |\n|---|---|---|\n| 1 | Julie | |\n| 2 | Marc | 1 |");
  egal(m.colonnes, ["id", "nom", "id_parrain"]);
  egal(m.lignes[0], ["1", "Julie", ""]);
  const autre = lireOk("table", "id | nom | id_parrain\n2 | marc | 1\n1 | Julie | 3");
  const c = E.table.comparer(autre, m);
  egal(Math.round(c.score * 6), 5);
  contient(c.ecarts, /« id_parrain » : « 3 » au lieu de « \(vide\) »/);
});
test("table : contrôles de clé et de type", () => {
  const m = lireOk("table", "id | n\n1 | a\n1 | b\nx | c");
  const c = E.table.controler(m, { cles: ["id"], types: { id: "entier" } });
  contient(c, /même valeur de clé/);
  contient(c, /« x » n'est pas un entier/);
});

test("table : un mot binaire garde ses zéros de tête", () => {
  const sol = lireOk("table", "| Top | État | Bit |\n| 1 | 01010 | 0 |\n| 2 | 00000 | 1 |");
  egal(E.table.comparer(lireOk("table", "| Top | État | Bit |\n| 1 | 01010 | 0 |\n| 2 | 00000 | 1 |"), sol, { ordre: true }).score, 1);
  // « 1010 » n'est pas « 01010 », « 0 » n'est pas « 00000 » ; « 0 » et « 1 » restent des nombres
  const c = E.table.comparer(lireOk("table", "| Top | État | Bit |\n| 1 | 1010 | 0,0 |\n| 2 | 0 | 1 |"), sol, { ordre: true });
  egal(Math.round(c.score * 6), 4);
  contient(c.ecarts, /« 1010 » au lieu de « 01010 »/);
  vrai(E.table.egales("0,50", "0.5", {}) && E.table.egales("12", "12,0", {}) && !E.table.egales("011", "11", {}));
});

/* Graphe et automates -------------------------------------------------------------------- */

const AUTOMATE = "automate\ninitial q0\nfinal q2\nq0 -> q1 : a\nq1 -> q2 : b\nq2 -> q2 : a, b";
test("graphe : automate, aller-retour et mots", () => {
  const m = allerRetour("graphe", AUTOMATE);
  vrai(m.automate && m.oriente);
  vrai(E.graphe.accepte(m, "ab") && E.graphe.accepte(m, "abba") && !E.graphe.accepte(m, "ba") && !E.graphe.accepte(m, ""));
  const c = E.graphe.controler(m, {}, { acceptes: ["ab", "b"], rejetes: ["a"] });
  contient(c, /« b » devrait être accepté/);
});
test("graphe : équivalence de langages", () => {
  const sol = lireOk("graphe", AUTOMATE);
  // Même langage (ab(a|b)*) avec un état de plus
  const eq = lireOk("graphe", "automate\ninitial s\nfinal t u\ns -> r : a\nr -> t : b\nt -> u : a, b\nu -> u : a, b");
  egal(E.graphe.comparer(eq, sol).score, 1);
  const diff = lireOk("graphe", "automate\ninitial q0\nfinal q2\nq0 -> q1 : a\nq1 -> q2 : b");
  const c = E.graphe.comparer(diff, sol);
  vrai(c.score < 1);
  contient(c.ecarts, /« aba » est accepté par la solution mais pas par ton automate/);
});
test("graphe : ε-transitions et déterminisme", () => {
  const m = lireOk("graphe", "automate\ninitial a\nfinal c\na -> b : ε\nb -> c : x\na -> c : x\na -> b : x");
  vrai(E.graphe.accepte(m, "x"));
  const c = E.graphe.controler(m, { deterministe: true });
  contient(c, /ε-transition/);
  contient(c, /deux transitions portent « x »/);
});
test("graphe : non orienté et pondéré", () => {
  const m = allerRetour("graphe", "A -- B : 5\nB -- C : 2\nnoeud D");
  vrai(!m.oriente);
  const c = E.graphe.comparer(lireOk("graphe", "A -- B : 5\nC -- B : 2\nnoeud D"), m);
  egal(c.score, 1);
});

/* Processus ------------------------------------------------------------------------------- */

test("processus : arbre, aller-retour, comparaison sans ordre", () => {
  const m = allerRetour("processus", "P1 : main\n  P2\n    P4\n  P3");
  egal(E.processus.enfants(m, m.noeuds[0].id).length, 2);
  const autre = lireOk("processus", "A\n  B\n  C\n    D");
  egal(E.processus.comparer(autre, m).score, 1);
  const faux = E.processus.comparer(lireOk("processus", "A\n  B\n  C"), m);
  contient(faux.ecarts, /La solution compte 4 processus, ton arbre 3/);
});

/* Chronogramme ----------------------------------------------------------------------------- */

test("chronogramme : segments, compact, processeurs", () => {
  const m = allerRetour("chronogramme", "temps 0..6\nP1 : x 0-3, p 3-6\nP2 : p 0-3, x 3-6");
  egal(m.lignes[0].cases, ["x", "x", "x", "p", "p", "p"]);
  const compact = lireOk("chronogramme", "temps 0..6\nP1 : xxxppp\nP2 : pppxxx");
  egal(E.chronogramme.comparer(compact, m).score, 1);
  const c = E.chronogramme.controler(lireOk("chronogramme", "temps 0..4\nP1 : xx..\nP2 : .xx."), { processeurs: 1 });
  contient(c, /2 processus sont en exécution/);
});

/* Séquence ---------------------------------------------------------------------------------- */

test("sequence : participants, fragments, comparaison", () => {
  const m = allerRetour("sequence", "acteur Client\nobjet g : Guichet\nClient -> g : retirer(50)\nalt solde suffisant\n  g --> Client : billets\nsinon\n  g --> Client : refus\nfin");
  egal(m.participants.map((p) => p.genre), ["acteur", "objet"]);
  egal(E.sequence.messages(m).length, 3);
  egal(E.sequence.comparer(m, m).score, 1);
  const r = E.sequence.lire("alt x\nA -> B : m()");
  contient(r.erreurs, /non fermé/);
});

/* Cas d'utilisation ------------------------------------------------------------------------- */

const GAB = "systeme GAB\nacteur Porteur\nacteur <<actor>> SA Visa\ncas Retirer de l'argent\ncas Saisir son code\ncas Imprimer un ticket\n" +
  "Porteur -- Retirer de l'argent\nSA Visa -- Retirer de l'argent : secondaire\n" +
  "Retirer de l'argent ..> Saisir son code : include\nImprimer un ticket ..> Retirer de l'argent : extend";
test("cas : lecture, aller-retour, noms avec espaces", () => {
  const m = allerRetour("cas", GAB);
  egal(m.systeme, "GAB");
  egal(m.acteurs.map((a) => a.genre), ["humain", "systeme"]);
  egal(m.cas.length, 3);
  egal(m.liens.map((l) => l.type), ["association", "association", "include", "extend"]);
  egal(m.liens[1].etiquette, "secondaire");
  egal(E.cas.controler(m), []);
});
test("cas : association rangée acteur d'abord, nom non déclaré, relier avant de déclarer", () => {
  const m = lireOk("cas", "Payer -- Client\nacteur Client");
  egal([m.liens[0].a, m.liens[0].b], ["Client", "Payer"]);
  egal(m.cas.map((c) => c.nom), ["Payer"]);
  egal(E.cas.ecrire(m), "acteur Client\ncas Payer\nClient -- Payer");
  egal(lireOk("cas", "A ..> B : << include >>\nC ..> B : étend").liens.map((l) => l.type), ["include", "extend"]);
  const s = lireOk("cas", "acteur <<actor>> Système d'autorisation\nSystème d'autorisation -- Payer : secondaire");
  egal([s.systeme, s.liens.length], ["", 1]);
});
test("cas : erreurs de syntaxe", () => {
  contient(E.cas.lire("A ..> B").erreurs, /include ou extend/);
  contient(E.cas.lire("A --> B").erreurs, /illisible/);
  contient(E.cas.lire("cas X\nacteur X").erreurs, /déjà un cas/);
  contient(E.cas.lire("acteur X\ncas X").erreurs, /déjà un acteur/);
});
test("cas : contrôles", () => {
  const c = (t) => E.cas.controler(lireOk("cas", t));
  contient(c("acteur A\nacteur B\nA -- B"), /deux acteurs/);
  contient(c("cas A\ncas B\nA -- B"), /pas par une association/);
  contient(c("acteur A\ncas B\nA ..> B : include"), /pas un acteur/);
  contient(c("acteur A\ncas B\nA --|> B"), /pas un acteur et un cas/);
  contient(c("acteur A\ncas B"), /n'est relié à aucun cas/);
  contient(c("acteur A\ncas B"), /n'est relié à rien/);
  contient(c("cas A\ncas B\nA ..> B : include\nB ..> A : include"), /boucle/);
  contient(c("acteur A\nA -- B\nA -- B"), /reliés deux fois/);
  egal(niveaux(c("acteur A\ncas B\nacteur C\nC --|> A\nA -- B")), []);
});
test("cas : comparaison", () => {
  const sol = lireOk("cas", GAB);
  egal(E.cas.comparer(sol, sol).score, 1);
  // Noms voisins : mêmes mots, autre tournure
  const voisin = lireOk("cas", GAB.replace(/Retirer de l'argent/g, "Retirer l'argent"));
  egal(E.cas.comparer(voisin, sol).score, 1);
  // include et extend confondus, sens inversé
  const r = E.cas.comparer(lireOk("cas", GAB.replace("Saisir son code : include", "Saisir son code : extend")), sol);
  vrai(r.score < 1); contient(r.ecarts, /attend « include »/);
  const s = E.cas.comparer(lireOk("cas", GAB.replace("Retirer de l'argent ..> Saisir son code", "Saisir son code ..> Retirer de l'argent")), sol);
  contient(s.ecarts, /le sens diffère/);
  const e = E.cas.comparer(lireOk("cas", GAB.replace(" : secondaire", "")), sol);
  contient(e.ecarts, /secondaire/);
  const v = E.cas.comparer(lireOk("cas", "acteur Porteur\nacteur Banque\nPorteur -- Banque"), sol);
  contient(v.ecarts, /Il manque le cas/); contient(v.ecarts, /Banque/);
  egal(E.cas.cibles(sol).length, 9);
  vrai(A.noyau.memeCible("Porteur -- Retirer de l'argent", "Retirer de l'argent--Porteur"));
});

/* SQL -------------------------------------------------------------------------------------- */

test("sql : contrôles et comparaison des résultats", () => {
  contient(E.sql.controler({ code: "SELECT 'a FROM t" }), /apostrophe/);
  const r = { colonnes: ["n"], lignes: [["1"], ["2"]], total: 2 };
  vrai(E.sql.comparerResultats(r, { colonnes: ["x"], lignes: [["2"], ["1"]], total: 2 }).ok);
  vrai(!E.sql.comparerResultats(r, { colonnes: ["x"], lignes: [["2"], ["1"]], total: 2 }, { ordre: true }).ok);
  const ev = E.sql.evaluation({ code: "INSERT INTO t VALUES (1)" }, null, { mode: "script", tests: [{ requete: "INSERT INTO t VALUES (NULL)", doit: "echouer" }] }, "CREATE TABLE t (x int NOT NULL);");
  egal(ev.demandes[0].requetes, ["INSERT INTO t VALUES (NULL)"]);
  egal(ev.interpreter([{ resultats: [{ erreur: "null value" }] }]).score, 1);
});

/* Communs ---------------------------------------------------------------------------------- */

test("tous les éditeurs : une solution comparée à elle-même obtient 100 %", () => {
  const exemples = {
    classes: "classe A\n  x : int {PK}\nA \"1\" -- \"*\" B : cite >\nC --|> A",
    relationnel: "R(_a_, #b(S.b))\nS(_b_)",
    table: "| a | b |\n| 1 |  |\n| 1 |  |",
    graphe: "automate\ninitial q0\nfinal q1\nq0 -> q1 : a\nq9 -> q0 : b",
    processus: "P1\n  P2\n  P3\n    P4",
    chronogramme: "temps 0..4\nP1 : x 0-2\nP1 : p 2-3\nP2 : .pxx",
    sequence: "acteur C\nC -> g : m()\ng --> C",
    cas: GAB
  };
  for (const [nom, texte] of Object.entries(exemples)) {
    const m = E[nom].lire(texte, {}).modele;
    egal(E[nom].comparer(m, JSON.parse(JSON.stringify(m)), {}).score, 1, nom);
  }
});

test("chronogramme : deux lignes au même nom se complètent", () => {
  const m = lireOk("chronogramme", "temps 0..4\nP1 : x 0-2\nP1 : p 2-3");
  egal(m.lignes.length, 1);
  egal(E.chronogramme.ecrire(m), "temps 0..4\nP1 : x 0-2, p 2-3");
});

test("chronogramme : pas de temps (une case dure 50)", () => {
  const m = allerRetour("chronogramme", "temps 0..300 pas 50\nT1 : x 0-50, x 150-250\nF : x 50-150, p 150-250");
  egal([m.debut, m.fin, m.pas], [0, 300, 50]);
  egal(m.lignes[0].cases, ["x", null, null, "x", "x", null]);
  egal(E.chronogramme.ecrire(m), "temps 0..300 pas 50\nT1 : x 0-50, x 150-250\nF : x 50-150, p 150-250");
  // Un caractère par case, quelle que soit sa durée
  egal(E.chronogramme.comparer(lireOk("chronogramme", "temps 0..300 pas 50\nT1 : x..xx.\nF : .xxpp."), m).score, 1);
  // Contrôles et écarts en vraies valeurs
  const c = E.chronogramme.controler(lireOk("chronogramme", "temps 0..300 pas 50\nT1 : xx....\nF : .xx..."), { processeurs: 1, durees: { T1: 150 } });
  contient(c, /Entre t = 50 et t = 100, 2 processus/);
  contient(c, /« T1 » s'exécute 100 unité\(s\) de temps, 150 attendue\(s\)/);
  const e = E.chronogramme.comparer(lireOk("chronogramme", "temps 0..300 pas 50\nT1 : x.....\nF : .xxpp."), m);
  egal(Math.round(e.score * 12), 10);
  contient(e.ecarts, /2 cases différentes de la solution \(t = 150 à 200\)/);
  // Une grille plus grossière se compare instant par instant
  egal(E.chronogramme.comparer(lireOk("chronogramme", "temps 0..300 pas 100\nT1 : x 100-200\nF : x 0-100"), lireOk("chronogramme", "temps 0..300 pas 50\nT1 : ..xx..\nF : xx....")).score, 1);
  // Erreurs : intervalle ou segment qui ne tombe pas sur une case
  contient(E.chronogramme.lire("temps 0..320 pas 50\nT1 :").erreurs, /n'est pas un multiple du pas 50/);
  contient(E.chronogramme.lire("temps 0..300 pas 50\nT1 : x 0-75").erreurs, /ne tombe pas sur une case/);
  // Sans pas : comme avant, et un modèle enregistré sans champ « pas » se relit
  egal(lireOk("chronogramme", "temps 0..4\nP1 : xx..").pas, 1);
  egal(E.chronogramme.ecrire({ debut: 0, fin: 3, etats: E.chronogramme.ETATS, lignes: [{ nom: "P1", cases: ["x", null, "p"] }] }), "temps 0..3\nP1 : x 0-1, p 2-3");
  egal([E.chronogramme.vide({ pas: 50 }).fin, E.chronogramme.vide({}).fin], [500, 10]);
});

test("relationnel : clé étrangère au nom libre, oubli bien pénalisé", () => {
  const sol = lireOk("relationnel", "Clients(_numero_, nom)\nCommandes(_numero_, date, #numero_client(Clients.numero))");
  egal(E.relationnel.comparer(lireOk("relationnel", "Clients(_numero_, nom)\nCommandes(_numero_, date, #client(Clients.numero))"), sol).score, 1);
  const oubli = E.relationnel.comparer(lireOk("relationnel", "Clients(_numero_, nom)\nCommandes(_numero_, date)"), sol);
  vrai(oubli.score <= 0.8, "oubli de la clé étrangère noté " + oubli.score);
  contient(E.relationnel.comparer(lireOk("relationnel", "Clients(_numero_, nom)\nCommandes(_numero_, date, numero_client)"), sol).ecarts, /devrait être une clé étrangère/);
});

test("relationnel : une clé étrangère vise une clé primaire entière", () => {
  const m = lireOk("relationnel", "visiteur(_id_visiteur_, login)\nobjet(_id_objet_, nom)\nstock(_#id_objet_, _#id_visiteur_, nb_achat)\navatar(_id_avatar_, nom, #id_visiteur)");
  egal(E.relationnel.controler(m, {}).filter((x) => x.niveau !== "info").length, 0, "notation du TP sans avertissement");
  const amb = lireOk("relationnel", "a(_id_, x)\nb(_id_, y)\nc(_z_, #id)");
  contient(E.relationnel.controler(amb, {}), /plusieurs relations/);
});

test("noyau : cible d'une remarque (mode annoter)", () => {
  const N = A.noyau;
  vrai(N.memeCible("Film", "Film.Genre"), "la classe couvre ses attributs");
  vrai(!N.memeCible("Film.Titre", "Film.Genre"), "un autre attribut ne couvre pas");
  vrai(N.memeCible("Salle--Cinéma", "Cinema--Salle"), "lien dans l'autre sens, sans accents");
  vrai(!N.memeCible("Cinéma", "Cinéma--Salle"), "la classe ne couvre pas ses liens");
  vrai(!N.memeCible("Cinéma--Salle", "Cinéma.Adresse"), "un lien ne couvre pas un attribut");
});

test("noyau : pluriels", () => {
  egal(A.noyau.pluriel(2, "niveau"), "2 niveaux");
  egal(A.noyau.pluriel(3, "processus"), "3 processus");
  egal(A.noyau.pluriel(1, "écart"), "1 écart");
  egal(A.noyau.pluriel(2, "écart"), "2 écarts");
});

test("chronogramme : tracé de signal (niveaux, graduations)", () => {
  const C = E.chronogramme, o = { niveaux: { p: 1, n: -1, B: 1, v: -1 } };
  egal([C.niveauDe(o, "p"), C.niveauDe(o, "v"), C.niveauDe(o, null), C.niveauDe(o, "z")], [1, -1, 0, 0]);
  egal(C.niveauDe(Object.assign({ repos: false }, o), null), null, "case vide sans tracé");
  egal(C.niveauDe({}, "p"), null, "sans niveaux, pas de tracé");
  egal(C.graduationsDe({ graduations: "1 0 0 1" }, 5), ["1", "0", "0", "1", ""]);
  egal(C.graduationsDe({ graduations: "101" }, 3), ["1", "0", "1"]);
  egal(C.graduationsDe({}, 3), null);
  // Une ligne écrite un caractère par case se compare à la même ligne écrite en segments
  const etats = "etat p +V\netat n −V\n";
  const m = lireOk("chronogramme", "temps 0..6\n" + etats + "Bipolaire : p..n.p");
  egal(C.comparer(lireOk("chronogramme", C.ecrire(m)), m).score, 1);
});

test("noyau : travail fait sur papier", () => {
  const N = A.noyau;
  const r = N.travailPapier(E.chronogramme, { texte: ["temps 0..4", "etat p +V", "etat n −V", "Bipolaire : p..n"], source: "TD1.pdf", date: "2026-10-01" }, {});
  egal(r.erreurs, []);
  egal(r.etat.modele.lignes[0].cases, ["p", null, null, "n"]);
  egal(r.etat.texte, "temps 0..4\netat p +V\netat n −V\nBipolaire : p..n", "texte gardé tel qu'écrit");
  egal([r.etat.resume, r.etat.maj, r.etat.papier.source], ["commencé", "2026-10-01T00:00:00.000Z", "TD1.pdf"]);
  // Un texte simple, déjà sous la forme qu'écrit l'éditeur
  const t = N.travailPapier(E.texte, "Entropie E1 = 4,304 bits", {});
  egal([t.etat.modele.texte, t.etat.texte, t.etat.maj], ["Entropie E1 = 4,304 bits", null, ""]);
  vrai(N.travailPapier(E.chronogramme, "temps 0..2\nP1 : x 0-5", {}).erreurs.length > 0, "erreur de syntaxe signalée");
});

test("code : blocs Ruby, parenthèses, chaînes et commentaires", () => {
  const C = E.code;
  const ok = "class Decaleur\n  attr_reader :largeur # accès\n  def decale(c)\n    @buffer.push(c)\n    return @buffer.shift()\n  end\n  def to_s()\n    \"<<#{@buffer.join()}>>\"\n  end\nend";
  egal(C.blocsRuby(ok), { ouverts: 3, fermes: 3 });
  egal(C.controler(lireOk("code", ok), { langage: "ruby" }), []);
  // Modificateur, affectation d'un if, do avec paramètres, end dans une chaîne ou un commentaire
  egal(C.blocsRuby("x = 1 if y\nprenom = if a then 1 else 2 end\n3.times do |i|\n  puts \"end\" # end\nend"), { ouverts: 2, fermes: 2 });
  contient(C.controler(lireOk("code", "def f(n)\n  if n > 1\n    n\nend"), {}), /Il manque 1 « end »/);
  // Commentaire =begin … =end (la sortie attendue en fin de fichier, par exemple)
  egal(C.blocsRuby("def f\n  1\nend\n=begin\nif x\nend\n=end"), { ouverts: 1, fermes: 1 });
  // def précédé de private (méthode privée redéfinie), et sa forme sans end
  egal(C.blocsRuby("class A\n  private def seuil ()\n    0\n  end\n  private def t = 1\nend"), { ouverts: 2, fermes: 2 });
  contient(C.controler(lireOk("code", "Class Numeric\n  def p(x)\n    x\n  end\nend"), {}), /s'écrit en minuscules/);
  contient(C.controler(lireOk("code", "puts(f(1)"), {}), /Il manque 1 parenthèse fermante/);
  egal(C.comparer(), null);
  // Diagramme de classes : noms de méthodes Ruby en ? ! =
  egal(E.classes.lire(["classe F", "  + vide?() : Boolean", "  + raz!()", "  + nom=(n)"].join("\n"), { methodes: true }).erreurs, []);
  egal(E.classes.lire(["classe P", "  + <=>(autre) : Integer", "  + ==(r)", "  + [](i)", "  + +(r) : NR"].join("\n"), { methodes: true }).erreurs, []);
  egal(C.controler(lireOk("code", ""), {})[0].niveau, "info");
});

test("éditeurs : options déclarées", () => {
  for (const [nom, ed] of Object.entries(E)) vrai(ed.options && typeof ed.options === "object", nom + " : pas de liste d'options");
});

console.log((echoues ? "✗ " : "✓ ") + reussis + " test(s) réussi(s)" + (echoues ? ", " + echoues + " échoué(s)" : "") + ".");
process.exit(echoues ? 1 : 0);
