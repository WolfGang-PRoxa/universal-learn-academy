"use strict";
/* Extension ula du serveur local (_outils/quiz/serveur) : routes /api/ula/…
   (chargée par _outils/quiz/serveur/lib/extensions.js au démarrage).

     GET  etat                         racine, profils, profil actif, cours installés
     PUT  profil { nom }               choisit le profil actif (mémorisé sur le poste)
     POST profils { nom }              crée un profil (et le choisit)
     POST profils/renommer { ancien, nouveau }
     GET  cursus                       arbre du cursus du profil actif, avec les cours
     POST cursus/dossier { parent, nom }        crée un dossier de cursus
     POST cursus/renommer { chemin, nom }
     POST cursus/deplacer { chemin, vers }
     POST cursus/retirer { chemin }             dossier vide ou lien sans travail
     POST cursus/ajouter { cours, dossier, nom } ajoute un cours du catalogue (lien)
     GET  catalogue                    catalogue distant (release « catalogue ») et état local
     POST catalogue/installer { id }   télécharge (ou met à jour) un cours
     POST catalogue/installer-pack { id }  tous les cours d'un pack (reprend les manquants)
     POST cursus/ajouter-pack { cours: [ids], dossier }  range un pack dans un dossier du cursus
     POST catalogue/supprimer { id }   supprime un cours téléchargé (le travail reste)
     POST proposer { chemin, infos }   archive d'un cours de l'espace + adresse de l'issue
     POST ouvrir { chemin }            ouvre un dossier de la racine dans l'explorateur

   Tout ce qui s'écrit ici va dans l'espace du profil ; explore/ ne change que par
   le catalogue (installer, supprimer). Voir _outils/ula/README.md. */

const path = require("path");
const { spawn } = require("child_process");
const espace = require("../lib/espace");
const catalogue = require("../lib/catalogue");
const proposition = require("../lib/proposition");

function etat(RACINE) {
  const profils = espace.profils(RACINE).map((p) => ({ nom: p.nom, cree: p.fiche.cree || null }));
  return {
    racine: RACINE,
    source: catalogue.estSource(RACINE),
    session: espace.nomSession(),
    profils,
    profil: espace.profilActif(RACINE),
    cours: espace.cours(RACINE).map((c) => ({ id: c.id, domaine: c.domaine, chemin: c.chemin, titre: c.fiche.titre, niveau: c.fiche.niveau || "", origine: c.fiche.origine || "", teinte: c.fiche.teinte || "", description: c.fiche.description || "", accueil: require("fs").existsSync(path.join(RACINE, c.chemin, "generated_courses", "index.html")) ? c.chemin + "/generated_courses/index.html" : null }))
  };
}

function profilRequis(RACINE) {
  const p = espace.profilActif(RACINE);
  if (!p) throw new Error("Aucun profil choisi : le choisir ou le créer d'abord.");
  return p;
}

function ouvrirDossier(abs) {
  const cmd = process.platform === "win32" ? ["explorer", [abs]] : process.platform === "darwin" ? ["open", [abs]] : ["xdg-open", [abs]];
  spawn(cmd[0], cmd[1], { detached: true, stdio: "ignore", windowsHide: false }).unref();
}

let installations = new Map();   // id -> { etat, journal, erreur }

async function api(route, req, res, o) {
  const { RACINE } = o.chemins;
  const m = req.method;
  const corps = () => o.lireCorps(req);
  const ok = (x) => o.envoyerJson(res, 200, x);
  try {
    if (route === "etat" && m === "GET") return ok(etat(RACINE));

    if (route === "profil" && m === "PUT") {
      const b = await corps();
      espace.choisirProfil(RACINE, b.nom === null ? null : String(b.nom));
      return ok(etat(RACINE));
    }
    if (route === "profils" && m === "POST") {
      const b = await corps();
      const n = espace.creerProfil(RACINE, b.nom);
      espace.choisirProfil(RACINE, n);
      return ok(etat(RACINE));
    }
    if (route === "profils/renommer" && m === "POST") {
      const b = await corps();
      espace.renommerProfil(RACINE, String(b.ancien), b.nouveau);
      return ok(etat(RACINE));
    }

    if (route === "cursus" && m === "GET") {
      const p = espace.profilActif(RACINE);
      if (!p) return ok({ profil: null, arbre: null });
      return ok({ profil: p, arbre: espace.arbre(RACINE, p) });
    }
    if (route.startsWith("cursus/") && m === "POST") {
      const p = profilRequis(RACINE);
      const b = await corps();
      let chemin = null;
      if (route === "cursus/dossier") chemin = espace.creerDossier(RACINE, p, b.parent || p, b.nom);
      else if (route === "cursus/renommer") chemin = espace.renommer(RACINE, p, b.chemin, b.nom);
      else if (route === "cursus/deplacer") chemin = espace.deplacer(RACINE, p, b.chemin, b.vers || p);
      else if (route === "cursus/retirer") espace.retirer(RACINE, p, b.chemin);
      else if (route === "cursus/ajouter") chemin = espace.ajouterCours(RACINE, p, String(b.cours), b.dossier || p, b.nom || null);
      else if (route === "cursus/ajouter-pack") {
        const r = espace.ajouterPack(RACINE, p, (Array.isArray(b.cours) ? b.cours : []).map(String), b.dossier);
        return ok(Object.assign(r, { arbre: espace.arbre(RACINE, p) }));
      }
      else return false;
      return ok({ chemin, arbre: espace.arbre(RACINE, p) });
    }

    if (route === "catalogue" && m === "GET") {
      const r = await catalogue.lister(RACINE);
      r.installations = Object.fromEntries(installations);
      return ok(r);
    }
    if (route === "catalogue/installer" && m === "POST") {
      const b = await corps();
      const id = String(b.id);
      const suivi = { etat: "en_cours", journal: [], erreur: null };
      installations.set(id, suivi);
      const r = await catalogue.installer(RACINE, id, (l) => suivi.journal.push(l)).catch((e) => { suivi.etat = "erreur"; suivi.erreur = e.message; throw e; });
      suivi.etat = "terminee";
      return ok(r);
    }
    if (route === "catalogue/installer-pack" && m === "POST") {
      const b = await corps();
      return ok(await catalogue.installerPack(RACINE, String(b.id)));
    }
    if (route === "catalogue/supprimer" && m === "POST") {
      const b = await corps();
      return ok(catalogue.supprimer(RACINE, String(b.id)));
    }

    if (route === "proposer" && m === "POST") {
      const p = profilRequis(RACINE);
      const b = await corps();
      try {
        const r = proposition.preparer(RACINE, p, b.chemin, b.infos || {});
        return ok(Object.assign({}, r, { archive: o.chemins.relatif(r.archive) }));
      } catch (e) {
        return o.envoyerJson(res, 422, { erreur: e.message, problemes: e.problemes || [] });
      }
    }

    if (route === "ouvrir" && m === "POST") {
      const b = await corps();
      const abs = path.resolve(RACINE, String(b.chemin || ""));
      if (!o.chemins.dansRacine(abs)) return o.erreur(res, 403, "Chemin refusé.");
      ouvrirDossier(abs);
      return ok({ ok: true });
    }
  } catch (e) {
    return o.erreur(res, 400, e.message);
  }
  return false;
}

module.exports = { nom: "ula", api };
