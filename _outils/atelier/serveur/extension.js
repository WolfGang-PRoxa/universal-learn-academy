"use strict";
/* Extension de l'atelier pour le serveur local (_outils/quiz/serveur) : routes
   /api/atelier/… (chargée par _outils/quiz/serveur/lib/extensions.js).

     GET  travail?page=/explore/informatique/bases-de-donnees-3/generated_courses/td-01-x.html
                                  travail enregistré pour la page
     POST travail { page, id, etat }
                                  enregistre l'état d'un atelier de la page
     POST aide { page, message, contexte, session, reprendre, majContexte }
                                  conversation avec Claude (flux d'événements)
     POST corriger { page, editeur, contexte, cibles }
                                  correction structurée : note, commentaire, remarques

   Le travail d'une page est gardé dans un seul fichier, dans l'espace du profil
   actif (jamais dans explore/) :
     <profil>/<cursus>/<cours>/td_results/<nom de la page>.json
   (ou, pour une page hors du catalogue et hors d'un dossier generated_courses,
   dans td_results/ à côté de la page). Format décrit dans _outils/atelier/README.md. */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PROMPTS = path.join(__dirname, "prompts");
const MOTIF_ID = /^[A-Za-z0-9_-]{1,80}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function prompt(nom) { return fs.readFileSync(path.join(PROMPTS, nom + ".md"), "utf8").trim(); }
function ligne(etiquette, valeur) { return valeur === undefined || valeur === null || valeur === "" ? "" : etiquette + " : " + valeur + "\n"; }

/* Fichiers de travail ------------------------------------------------------- */

function fichierTravail(chemins, page, creer) {
  const abs = chemins.depuisUrl(page);
  if (!abs || path.extname(abs) !== ".html" || !fs.existsSync(abs)) throw new Error("Page invalide : " + page);
  const t = chemins.espace.travailDePage(chemins.RACINE, abs, { creer });
  if (!t.dossier) {
    if (creer) throw new Error(t.raison || "Aucun profil choisi.");
    return { abs, fichier: null };
  }
  return { abs, fichier: path.join(t.dossier, "td_results", path.basename(abs, ".html") + ".json") };
}

function lireTravail(f) {
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; }
}

function titrePage(abs) {
  try {
    const s = fs.readFileSync(abs, "utf8");
    const h1 = s.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    return h1 ? h1[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : path.basename(abs);
  } catch (e) { return path.basename(abs); }
}

function enregistrer(chemins, b) {
  if (!b || !MOTIF_ID.test(String(b.id || ""))) throw new Error("Identifiant d'atelier invalide.");
  if (!b.etat || typeof b.etat !== "object") throw new Error("État manquant.");
  const { abs, fichier } = fichierTravail(chemins, b.page, true);
  const t = lireTravail(fichier) || { format: "studies-atelier/travail-1", ateliers: {} };
  t.page = chemins.relatif(abs);
  t.titre = titrePage(abs);
  t.ateliers[b.id] = b.etat;
  t.maj = new Date().toISOString();
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  const tmp = fichier + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(t, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, fichier);
  return chemins.relatif(fichier);
}

/* Messages pour Claude ----------------------------------------------------------- */

function texteQuestion(q) {
  if (!q) return "";
  let t = "## Exercice" + (q.theme ? " : " + q.theme : "") + "\n";
  t += ligne("Atelier", q.numero) + ligne("Type de travail", q.type);
  t += "\nÉnoncé :\n" + (q.enonce || "(non fourni)") + "\n";
  if (q.details) t += "\n" + q.details + "\n";
  t += "\nTravail actuel de l'étudiant :\n```\n" + (q.reponse || "(vide)") + "\n```\n";
  t += ligne("Solution déjà affichée par l'étudiant", q.corrigee ? "oui" : "non");
  if (q.solution) t += "\nSolution proposée" + (q.corrigee ? "" : " (ne pas la révéler sauf demande explicite)") + " :\n```\n" + q.solution + "\n```\n";
  if (q.explication) t += ligne("Explication de la solution", "\n" + q.explication);
  return t;
}

function messageAide(b) {
  const c = b.contexte || {};
  let m = "";
  if (!b.reprendre) {
    m += "# Contexte\n" + ligne("Page", b.page) + ligne("TD", c.quiz && c.quiz.titre) + ligne("Matière", c.quiz && [c.quiz.matiere, c.quiz.niveau].filter(Boolean).join(", "));
    if (c.question) m += "\n" + texteQuestion(c.question);
    m += "\n# Demande de l'étudiant\n";
  } else if (c.question && b.majContexte) {
    m += "(Travail mis à jour)\n" + texteQuestion(c.question) + "\n# Demande de l'étudiant\n";
  }
  return m + String(b.message || "").slice(0, 8000);
}

const SCHEMA_CORRECTION = {
  type: "object",
  properties: {
    note: { type: "number", enum: [0, 0.25, 0.5, 0.75, 1] },
    commentaire: { type: "string" },
    remarques: {
      type: "array",
      items: {
        type: "object",
        properties: {
          cible: { type: "string" },
          niveau: { type: "string", enum: ["erreur", "attention", "info"] },
          message: { type: "string" }
        },
        required: ["niveau", "message"]
      }
    }
  },
  required: ["note", "commentaire", "remarques"]
};

/* Routes ------------------------------------------------------------------------- */

async function api(route, req, res, o) {
  const url = new URL(req.url, "http://127.0.0.1");
  const m = req.method;

  if (route === "travail" && m === "GET") {
    const { fichier } = fichierTravail(o.chemins, url.searchParams.get("page"));
    const t = fichier ? lireTravail(fichier) : null;
    return o.envoyerJson(res, 200, { ateliers: (t && t.ateliers) || {}, fichier: fichier ? o.chemins.relatif(fichier) : null });
  }

  if (route === "travail" && m === "POST") {
    return o.envoyerJson(res, 200, { fichier: enregistrer(o.chemins, await o.lireCorps(req)) });
  }

  if (route === "aide" && m === "POST") {
    const b = await o.lireCorps(req);
    const session = UUID.test(b.session || "") ? b.session : crypto.randomUUID();
    const reprendre = Boolean(b.reprendre && UUID.test(b.session || ""));
    let relais;
    const appel = o.claude.lancer({
      usage: "aide",
      systeme: prompt("aide"),
      message: messageAide(Object.assign({}, b, { reprendre })),
      session,
      reprendre,
      outils: "Read,Grep,Glob",
      dossiers: [o.chemins.RACINE, o.chemins.OUTILS],
      cwd: o.chemins.dossierLocal("conversations"),
      delai: 4 * 60 * 1000,
      surEvenement: (e) => relais && relais.surEvenement(e)
    });
    relais = o.relayer(res, session, appel);
    return relais.fin();
  }

  if (route === "corriger" && m === "POST") {
    const b = await o.lireCorps(req);
    const q = (b.contexte || {}).question || {};
    let message = texteQuestion(Object.assign({}, q, { corrigee: true }));
    if (Array.isArray(b.cibles) && b.cibles.length) {
      message += "\nNoms exacts des éléments du travail (à reprendre tels quels dans « cible ») :\n" + b.cibles.slice(0, 200).map((c) => "- " + c).join("\n") + "\n";
    }
    message += "\nCorrige ce travail.";
    const r = await o.claude.lancer({
      usage: "correction",
      systeme: prompt("correction"),
      message,
      persistance: false,
      outils: "",
      schema: SCHEMA_CORRECTION,
      cwd: o.chemins.dossierLocal("conversations"),
      delai: 4 * 60 * 1000,
      surEvenement: (e) => { if (e.type === "quota" && o.quota) o.quota(e.info); }
    }).promesse;
    let s = r.structure;
    if (!s) { try { s = JSON.parse(r.texte); } catch (e) { throw new Error("Réponse de correction illisible."); } }
    return o.envoyerJson(res, 200, { note: s.note, commentaire: s.commentaire, remarques: s.remarques || [], modele: r.modele });
  }

  return false;
}

// Pour le portail : les TD d'un cours et l'état du travail enregistré (dans le
// dossier du cours de l'espace du profil, `travail`)
function travauxMatiere(dossierMatiere, relatif, travail) {
  const res = [];
  const cours = path.join(dossierMatiere, "generated_courses");
  let pages = [];
  try { pages = fs.readdirSync(cours).filter((n) => /^(td|tp)-.*\.html$/.test(n)); } catch (e) { return res; }
  for (const n of pages.sort()) {
    const abs = path.join(cours, n);
    let source = "";
    try { source = fs.readFileSync(abs, "utf8"); } catch (e) { continue; }
    const total = (source.match(/<div class="atelier"/g) || []).length;
    if (!total) continue;
    const t = travail ? lireTravail(path.join(travail, "td_results", n.replace(/\.html$/, ".json"))) : null;
    const ateliers = t ? Object.values(t.ateliers || {}) : [];
    res.push({
      page: relatif(abs), titre: titrePage(abs), ateliers: total,
      commences: ateliers.filter((a) => a.resume !== "vide").length,
      corriges: ateliers.filter((a) => a.correction).length,
      maj: t ? t.maj : null
    });
  }
  return res;
}

module.exports = { nom: "atelier", api, travauxMatiere };
