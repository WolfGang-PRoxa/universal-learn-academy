"use strict";
/* Connexion à Claude.

   Ce que permet Anthropic (documentation de Claude Code, « Legal and compliance »
   et « Agent SDK overview », relue le 12 novembre 2026) : une application tierce
   ne peut pas proposer la connexion avec un compte claude.ai, ni recueillir ou
   stocker les identifiants ou jetons de session d'un compte. Elle peut en revanche :
   - utiliser une clé d'API personnelle de l'utilisateur (facturée à son compte) ;
   - laisser l'utilisateur se connecter lui-même à Claude Code, non modifié, avec
     son propre abonnement, par le parcours de connexion d'Anthropic.

   Studies propose donc deux modes, au choix dans les paramètres :
   - « compte » : Claude Code installé sur le poste, connecté par l'utilisateur.
     Le bouton « Se connecter » ouvre un terminal sur `claude auth login` : la
     connexion se fait chez Anthropic, Studies ne voit jamais les identifiants ;
   - « cle » : clé d'API Anthropic, chiffrée par le système (safeStorage : DPAPI
     sous Windows, trousseau sous Linux), jamais renvoyée à l'interface. Elle est
     transmise à Claude Code par la variable ANTHROPIC_API_KEY du serveur local.

   Dans les deux cas, les quiz font appel à Claude Code (`claude -p`, voir
   _outils/quiz/serveur/lib/claude.js) : il doit être installé. */

const { safeStorage, shell } = require("electron");
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const reglages = require("./reglages");

const WINDOWS = process.platform === "win32";
const URL_INSTALLATION = "https://code.claude.com/docs/en/setup";
const URL_CLES = "https://platform.claude.com/settings/keys";

/* -- Claude Code ------------------------------------------------------------ */

function comparerVersions(a, b) {
  const va = (String(a).match(/\d+/g) || []).map(Number), vb = (String(b).match(/\d+/g) || []).map(Number);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) if ((va[i] || 0) !== (vb[i] || 0)) return (va[i] || 0) - (vb[i] || 0);
  return 0;
}

// Chemin choisi dans les réglages de l'outil de quiz (portail), s'il y en a un
function cheminConfigure(racine) {
  try { return JSON.parse(fs.readFileSync(path.join(racine, "_outils", "quiz", "reglages.json"), "utf8")).claude.executable || ""; }
  catch (e) { return ""; }
}

function candidats(racine) {
  const liste = [];
  const configure = racine ? cheminConfigure(racine) : "";
  if (configure) liste.push(configure);
  const noms = WINDOWS ? ["claude.exe"] : ["claude"];
  for (const d of (process.env.PATH || "").split(path.delimiter)) for (const n of noms) if (d) liste.push(path.join(d, n));
  const maison = os.homedir();
  liste.push(path.join(maison, ".local", "bin", noms[0]), path.join(maison, ".claude", "local", noms[0]));
  for (const r of [".vscode", ".vscode-insiders", ".cursor", ".windsurf"]) {
    let dossiers = [];
    try { dossiers = fs.readdirSync(path.join(maison, r, "extensions")).filter((d) => d.startsWith("anthropic.claude-code-")); } catch (e) { continue; }
    dossiers.sort(comparerVersions).reverse();
    for (const d of dossiers) liste.push(path.join(maison, r, "extensions", d, "resources", "native-binary", noms[0]));
  }
  return [...new Set(liste)];
}

/** { executable, version } de la version la plus récente trouvée, ou null. */
function trouver(racine) {
  let meilleur = null;
  for (const c of candidats(racine)) {
    if (!c || !fs.existsSync(c)) continue;
    const r = spawnSync(c, ["--version"], { encoding: "utf8", timeout: 20000, windowsHide: true });
    if (r.status !== 0 || !/Claude Code/i.test(r.stdout)) continue;
    const version = r.stdout.trim().split(/\s+/)[0];
    if (!meilleur || comparerVersions(version, meilleur.version) > 0) meilleur = { executable: c, version };
  }
  return meilleur;
}

/** Compte connecté dans Claude Code (`claude auth status`), sans aucun secret. */
function compte(executable) {
  const env = Object.assign({}, process.env);
  delete env.ANTHROPIC_API_KEY;   // l'état du compte, pas celui de la clé
  const r = spawnSync(executable, ["auth", "status"], { encoding: "utf8", timeout: 20000, windowsHide: true, env });
  try {
    const d = JSON.parse(r.stdout);
    return { connecte: Boolean(d.loggedIn), methode: d.authMethod || null, email: d.email || null, abonnement: d.subscriptionType || null };
  } catch (e) {
    return { connecte: false, erreur: (r.stderr || r.stdout || "").trim().slice(0, 300) || null };
  }
}

/* -- Clé d'API --------------------------------------------------------------- */

function chiffrementDisponible() {
  if (!safeStorage.isEncryptionAvailable()) return false;
  // Sous Linux sans trousseau, Electron se rabat sur un chiffrement en clair : refusé
  if (process.platform === "linux" && typeof safeStorage.getSelectedStorageBackend === "function"
      && safeStorage.getSelectedStorageBackend() === "basic_text") return false;
  return true;
}

function cle() {
  const enregistree = reglages.lire().claude.cle;
  if (!enregistree || !enregistree.startsWith("enc:")) return "";
  try { return safeStorage.decryptString(Buffer.from(enregistree.slice(4), "base64")); }
  catch (e) { return ""; }
}

async function testerCle(valeur) {
  try {
    const r = await fetch("https://api.anthropic.com/v1/models?limit=1", {
      headers: { "x-api-key": valeur, "anthropic-version": "2023-06-01" },
      signal: AbortSignal.timeout(15000)
    });
    if (r.ok) return { valide: true };
    if (r.status === 401 || r.status === 403) return { valide: false, message: "Anthropic refuse cette clé (invalide ou révoquée)." };
    return { valide: null, message: "Vérification impossible (réponse " + r.status + " d'Anthropic)." };
  } catch (e) {
    return { valide: null, message: "Vérification impossible : pas de connexion à Anthropic." };
  }
}

async function enregistrerCle(valeur) {
  const texte = String(valeur || "").trim();
  if (!texte) {
    reglages.modifier({ claude: { cle: "" } });
    return { ok: true, supprimee: true };
  }
  if (!/^sk-ant-[\w-]{20,}$/.test(texte)) throw new Error("Ce n'est pas une clé d'API Anthropic (elle commence par « sk-ant- »).");
  if (!chiffrementDisponible()) throw new Error("Le système ne peut pas chiffrer la clé (aucun trousseau disponible) : elle n'est pas enregistrée.");
  const test = await testerCle(texte);
  if (test.valide === false) throw new Error(test.message);
  reglages.modifier({ claude: { cle: "enc:" + safeStorage.encryptString(texte).toString("base64") } });
  return { ok: true, avertissement: test.valide === null ? test.message : null };
}

/* -- État et actions ----------------------------------------------------------- */

async function statut(racine) {
  const r = reglages.lire().claude;
  const code = trouver(racine);
  return {
    mode: r.mode,
    claudeCode: code ? { executable: code.executable, version: code.version } : null,
    compte: code ? compte(code.executable) : null,
    cleEnregistree: Boolean(r.cle),
    cleLisible: Boolean(r.cle) && Boolean(cle()),
    chiffrementDisponible: chiffrementDisponible(),
    // Clé appliquée au serveur en cours (elle ne change qu'au redémarrage)
    cleActive: Boolean(process.env.ANTHROPIC_API_KEY) && process.env.STUDIES_CLE_APPLIQUEE === "1",
    liens: { installation: URL_INSTALLATION, cles: URL_CLES }
  };
}

/** Ouvre un terminal sur `claude auth login` : la connexion se fait chez Anthropic. */
function connecter(racine) {
  const code = trouver(racine);
  if (!code) throw new Error("Claude Code n'est pas installé sur ce poste.");
  const env = Object.assign({}, process.env);
  delete env.ANTHROPIC_API_KEY;
  delete env.ELECTRON_RUN_AS_NODE;
  if (WINDOWS) {
    // Ligne de commande écrite telle quelle : cmd /k retire la paire de guillemets extérieure
    spawn("cmd.exe", ['/d /c start "Studies - connexion à Claude" cmd.exe /k ""' + code.executable + '" auth login"'],
      { env, detached: true, stdio: "ignore", windowsVerbatimArguments: true, windowsHide: false }).unref();
    return { ok: true };
  }
  const commande = "'" + code.executable.replace(/'/g, "'\\''") + "' auth login; echo; read -p 'Entrée pour fermer…' x";
  const terminaux = [
    ["x-terminal-emulator", ["-e", "bash", "-c", commande]],
    ["gnome-terminal", ["--", "bash", "-c", commande]],
    ["konsole", ["-e", "bash", "-c", commande]],
    ["xfce4-terminal", ["-x", "bash", "-c", commande]],
    ["xterm", ["-e", "bash", "-c", commande]]
  ];
  for (const [t, args] of terminaux) {
    if (spawnSync("sh", ["-c", "command -v " + t]).status === 0) {
      spawn(t, args, { env, detached: true, stdio: "ignore" }).unref();
      return { ok: true };
    }
  }
  throw new Error("Aucun terminal trouvé : lancer « claude auth login » dans un terminal.");
}

function deconnecter(racine) {
  const code = trouver(racine);
  if (!code) throw new Error("Claude Code n'est pas installé sur ce poste.");
  const r = spawnSync(code.executable, ["auth", "logout"], { encoding: "utf8", timeout: 20000, windowsHide: true });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "La déconnexion a échoué.").trim().slice(0, 300));
  return { ok: true };
}

/** À appeler avant de démarrer le serveur : la clé passe par l'environnement. */
function appliquer() {
  const r = reglages.lire().claude;
  if (r.mode !== "cle") return false;
  const valeur = cle();
  if (!valeur) return false;
  process.env.ANTHROPIC_API_KEY = valeur;
  process.env.STUDIES_CLE_APPLIQUEE = "1";
  return true;
}

function ouvrirLien(nom) {
  const url = { installation: URL_INSTALLATION, cles: URL_CLES }[nom];
  if (url) shell.openExternal(url);
}

module.exports = { statut, connecter, deconnecter, enregistrerCle, appliquer, ouvrirLien, trouver };
