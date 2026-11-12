"use strict";
/* Tâches longues confiées à Claude Code : génération d'un nouveau quiz.
   Une tâche tourne en arrière-plan (plusieurs minutes) ; la page suit son
   journal et récupère le fichier créé. Les tâches sont gardées en mémoire
   tant que le serveur tourne. */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { RACINE, OUTILS, relatif, depuisUrl, pageQuiz } = require("./chemins");
const claude = require("./claude");
const assistant = require("./assistant");
const catalogue = require("./catalogue");
const archives = require("./archives");

const taches = new Map();
const LIBELLES_TYPES = {
  "qcm": "QCM à une réponse", "qcm-multi": "QCM à plusieurs réponses", "vrai-faux": "vrai ou faux",
  "reponse-courte": "réponse courte", "numerique": "réponse numérique", "trous": "texte ou code à trous",
  "association": "association", "ordre": "remise en ordre", "ouverte": "question ouverte (rédaction)",
  "code": "écriture de code exécuté et vérifié",
  "atelier": "atelier de modélisation : diagramme de classes, modèle relationnel, table, automate… (voir _outils/atelier/README.md)"
};

function texteDemande(o, quiz) {
  const l = [];
  if (o.sujet === "erreurs") l.push("Sujet : les notions que l'étudiant a ratées lors de sa dernière tentative (voir plus bas), sans sortir des cours du quiz de départ.");
  else if (o.sujet === "autre" && o.sujetTexte) l.push("Sujet : " + String(o.sujetTexte).slice(0, 500) + " (dans la même matière).");
  else l.push("Sujet : le même que le quiz de départ, avec des questions nouvelles (ne pas reprendre ses questions).");
  const types = Array.isArray(o.types) && o.types.length ? o.types.filter((t) => LIBELLES_TYPES[t]) : null;
  if (types) l.push("Types de questions : " + (types.length === 1 ? "uniquement des questions de type « " + types[0] + " » (" + LIBELLES_TYPES[types[0]] + ")" : types.map((t) => t + " (" + LIBELLES_TYPES[t] + ")").join(", ")) + ".");
  else l.push("Types de questions : la même répartition que le quiz de départ (" + quiz.types.join(", ") + ").");
  const n = Number(o.nombre);
  l.push("Nombre de questions : " + (n >= 3 && n <= 60 ? n : quiz.nb) + ".");
  if (o.difficulte === "plus_facile") l.push("Difficulté : plus facile que le quiz de départ (davantage de questions faciles).");
  else if (o.difficulte === "plus_difficile") l.push("Difficulté : plus difficile que le quiz de départ (davantage de questions difficiles, pièges classiques, code plus long).");
  else l.push("Difficulté : comparable au quiz de départ.");
  if (o.consignes) l.push("Consignes de l'étudiant : " + String(o.consignes).slice(0, 2000));
  return l.map((x) => "- " + x).join("\n");
}

function creer(page, options) {
  const q = pageQuiz(page, { creer: true });
  if (!q) throw new Error("Page de quiz invalide.");
  if (!q.deMatiere) throw new Error("La génération se lance depuis un quiz de matière (dossier generated_quizzes).");
  if (!q.matiere) throw new Error(q.raison || "Aucun profil choisi.");
  // Le nouveau quiz va dans l'espace du profil (dossier du cours de son cursus),
  // jamais dans explore/ : ses liens partent de la racine (/_outils/…, /explore/…)
  const sortie = path.join(q.matiere, "generated_quizzes");
  fs.mkdirSync(sortie, { recursive: true });
  const d = catalogue.donneesQuiz(fs.readFileSync(q.abs, "utf8")) || { questions: [] };
  const source = fs.readFileSync(q.abs, "utf8");
  const quiz = {
    titre: catalogue.titrePage(source),
    nb: d.questions.length,
    types: [...new Set(d.questions.map((x) => x.type))],
    themes: [...new Set(d.questions.map((x) => x.theme).filter(Boolean))]
  };
  let tentative = "";
  if (options.sujet === "erreurs") {
    const derniere = archives.lister(page).find((t) => t.statut === "terminee");
    if (derniere) {
      const t = archives.lire(derniere.fichier);
      const ratees = { questions: (t.questions || []).filter((x) => x.score !== 1), score: t.score, debut: t.debut, mode: t.mode, duree_ms: t.duree_ms };
      tentative = "## Dernière tentative de l'étudiant (questions non entièrement réussies)\n\n" + assistant.texteTentative(ratees);
    } else {
      tentative = "## Dernière tentative\n\nAucune tentative terminée : couvrir l'ensemble du quiz de départ.";
    }
  }
  const matiere = relatif(q.cours);
  const message = assistant.prompt("generation")
    .replace(/\{\{demande\}\}/g, texteDemande(options, quiz))
    .replace(/\{\{page\}\}/g, relatif(q.abs))
    .replace(/\{\{titre\}\}/g, quiz.titre)
    .replace(/\{\{nb\}\}/g, String(quiz.nb))
    .replace(/\{\{types\}\}/g, quiz.types.join(", "))
    .replace(/\{\{themes\}\}/g, quiz.themes.join(" ; ") || "aucun")
    .replace(/\{\{tentative\}\}/g, tentative)
    .replace(/\{\{matiere\}\}/g, matiere)
    .replace(/\{\{sortie\}\}/g, relatif(sortie))
    .replace(/\{\{outils\}\}/g, path.relative(RACINE, OUTILS).startsWith("..") ? OUTILS.split(path.sep).join("/") : "_outils")
    .replace(/\{\{accueil\}\}/g, "/" + matiere + "/generated_courses/index.html")
    .replace(/\{\{domaine\}\}/g, "/" + matiere.split("/").slice(0, 2).join("/") + "/index.html");

  const avant = new Set(fs.readdirSync(sortie));
  const id = crypto.randomUUID();
  const tache = {
    id, page: relatif(q.abs), etat: "en_cours", debut: Date.now(), fin: null,
    journal: [], fichier: null, erreur: null, session: crypto.randomUUID(), quota: null
  };
  const noter = (type, texte) => {
    tache.journal.push({ t: Date.now() - tache.debut, type, texte: String(texte).slice(0, 400) });
    if (tache.journal.length > 400) tache.journal.shift();
  };
  noter("etape", "Claude Code démarre (modèle des réglages « Génération de quiz »).");
  const appel = claude.lancer({
    usage: "generation",
    systeme: null,                 // prompt système de Claude Code ; prompts/generation.md désigne les README à suivre
    message,
    session: tache.session,
    autorises: "Read Grep Glob Write Edit Bash(python:*) Bash(py:*) Bash(node:*) PowerShell(python:*) PowerShell(node:*)",
    permission: "acceptEdits",
    cwd: RACINE,
    dossiers: [OUTILS],
    journalTexte: true,
    delai: 40 * 60 * 1000,
    surEvenement(e) {
      if (e.type === "debut") noter("etape", "Modèle : " + e.modele);
      else if (e.type === "outil") noter("outil", e.nom + (e.detail ? " · " + e.detail.replace(RACINE.split(path.sep).join("/"), "") : ""));
      else if (e.type === "etape" && e.texte.trim()) noter("texte", e.texte.trim().split("\n")[0]);
      else if (e.type === "quota") tache.quota = e.info;
    }
  });
  tache.arreter = appel.arreter;
  appel.promesse.then((r) => {
    const m = (r.texte || "").match(/FICHIER:\s*(\S+\.html)/);
    let fichier = m ? m[1].replace(/\\/g, "/").replace(/^\.?\//, "") : null;
    if (fichier && !(depuisUrl("/" + fichier) && fs.existsSync(depuisUrl("/" + fichier)))) fichier = null;
    if (!fichier) {
      const nouveaux = fs.readdirSync(sortie).filter((n) => !avant.has(n) && n.endsWith(".html"));
      if (nouveaux.length) fichier = relatif(path.join(sortie, nouveaux[0]));
    }
    tache.fichier = fichier;
    tache.etat = fichier ? "terminee" : "erreur";
    if (!fichier) tache.erreur = "Claude a terminé sans créer de nouveau quiz. Dernier message : " + (r.texte || "").slice(-600);
    noter("etape", fichier ? "Quiz créé : " + fichier : "Aucun fichier créé.");
  }).catch((e) => {
    tache.etat = tache.etat === "annulee" ? "annulee" : "erreur";
    tache.erreur = e.message;
    noter("etape", "Arrêt : " + e.message);
  }).finally(() => { tache.fin = Date.now(); });
  taches.set(id, tache);
  return etat(id);
}

function etat(id) {
  const t = taches.get(id);
  if (!t) return null;
  const { arreter, ...visible } = t;
  return visible;
}

function annuler(id) {
  const t = taches.get(id);
  if (!t || t.etat !== "en_cours") return etat(id);
  t.etat = "annulee";
  t.arreter();
  return etat(id);
}

function lister() {
  return [...taches.keys()].map(etat).sort((a, b) => b.debut - a.debut);
}

function toutArreter() {
  for (const t of taches.values()) if (t.etat === "en_cours") t.arreter();
}

module.exports = { creer, etat, annuler, lister, toutArreter };
