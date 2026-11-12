"use strict";
/* Réglages de l'outil, dans _outils/quiz/reglages.json : modèle et effort de Claude
   pour chaque usage, chemin de Claude Code, port du serveur. Le fichier est
   créé avec les valeurs par défaut s'il n'existe pas ; les clés manquantes
   reprennent leur valeur par défaut. */

const fs = require("fs");
const path = require("path");
const { QUIZ } = require("./chemins");

const FICHIER = path.join(QUIZ, "reglages.json");

// Les quatre endroits où l'outil fait appel à Claude
const USAGES = {
  aide:       { libelle: "Aide pendant le quiz",            description: "Conversation ouverte depuis une question, ou question libre sur le cours." },
  correction: { libelle: "Correction des questions ouvertes", description: "Note (0, ½ ou 1) et commentaire sur une réponse rédigée." },
  evaluation: { libelle: "Évaluation détaillée",            description: "Bilan complet d'une tentative et conseils de révision." },
  generation: { libelle: "Génération de quiz",              description: "Écriture d'un nouveau quiz par Claude Code (plusieurs minutes)." }
};

// Modèles proposés dans l'interface ; « autre » permet d'en saisir un librement
const MODELES = [
  { id: "sonnet", libelle: "Sonnet (dernière version)" },
  { id: "opus",   libelle: "Opus (dernière version)" },
  { id: "haiku",  libelle: "Haiku (rapide, économe)" },
  { id: "fable",  libelle: "Fable (demande des crédits en plus de Pro)" },
  { id: "",       libelle: "Modèle par défaut du compte" }
];
const EFFORTS = ["", "low", "medium", "high", "xhigh", "max"];

const DEFAUT = {
  port: 5178,
  claude: { executable: "" },
  usages: {
    aide:       { modele: "sonnet", effort: "medium" },
    correction: { modele: "sonnet", effort: "low" },
    evaluation: { modele: "sonnet", effort: "high" },
    generation: { modele: "opus",   effort: "high" }
  }
};

function copie(x) { return JSON.parse(JSON.stringify(x)); }

function fusion(base, ajout) {
  const r = copie(base);
  if (!ajout || typeof ajout !== "object") return r;
  if (Number.isInteger(ajout.port) && ajout.port > 1023 && ajout.port < 65536) r.port = ajout.port;
  if (ajout.claude && typeof ajout.claude.executable === "string") r.claude.executable = ajout.claude.executable.trim();
  for (const u of Object.keys(USAGES)) {
    const a = ajout.usages && ajout.usages[u];
    if (!a) continue;
    if (typeof a.modele === "string" && /^[A-Za-z0-9.\-_[\]]*$/.test(a.modele)) r.usages[u].modele = a.modele;
    if (EFFORTS.includes(a.effort)) r.usages[u].effort = a.effort;
  }
  return r;
}

function lire() {
  let brut = null;
  try { brut = JSON.parse(fs.readFileSync(FICHIER, "utf8")); } catch (e) { /* absent ou illisible */ }
  const r = fusion(DEFAUT, brut);
  if (!brut) ecrire(r);
  return r;
}

function ecrire(reglages) {
  fs.writeFileSync(FICHIER, JSON.stringify(reglages, null, 2) + "\n", "utf8");
}

// Applique une modification partielle venue de l'interface
function modifier(ajout) {
  const r = fusion(lire(), ajout);
  ecrire(r);
  return r;
}

module.exports = { USAGES, MODELES, EFFORTS, DEFAUT, lire, modifier, FICHIER };
