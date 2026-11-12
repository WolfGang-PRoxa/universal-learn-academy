"use strict";
/* Extension de l'outil TODO pour le serveur local (_outils/quiz/serveur) : routes
   /api/todo/… (chargée par _outils/quiz/serveur/lib/extensions.js au démarrage).

     GET fichier                  { texte, version } : contenu de TODO.md
     PUT fichier { texte, version, forcer }
                                  écrit TODO.md et renvoie { version } ;
                                  409 { erreur, texte, version } si le fichier
                                  a changé depuis la version lue (une autre
                                  page, Claude, l'éditeur…), sauf avec forcer

   Seul le TODO.md du profil actif (<racine>/<profil>/TODO.md) est lu ou écrit :
   le suivi est personnel. La version est « date de modification-taille » :
   elle change à chaque écriture. */

const fs = require("fs");
const path = require("path");

const TAILLE_MAX = 2 * 1024 * 1024;

function version(stat) { return Math.round(stat.mtimeMs) + "-" + stat.size; }

function lireFichier(fichier) {
  const texte = fs.readFileSync(fichier, "utf8");
  return { texte, version: version(fs.statSync(fichier)) };
}

async function api(route, req, res, outils) {
  if (route !== "fichier") return false;
  const { RACINE, espace } = outils.chemins;
  const profil = espace.profilActif(RACINE);
  if (!profil) return outils.erreur(res, 409, "Aucun profil choisi : le choisir sur l'accueil (TODO.md est dans l'espace du profil).");
  const fichier = path.join(RACINE, profil, "TODO.md");

  if (req.method === "GET") {
    if (!fs.existsSync(fichier)) return outils.erreur(res, 404, "TODO.md est introuvable dans l'espace du profil « " + profil + " » (" + profil + "/TODO.md).");
    return outils.envoyerJson(res, 200, lireFichier(fichier));
  }

  if (req.method === "PUT") {
    let corps;
    try { corps = await outils.lireCorps(req, TAILLE_MAX + 4096); }
    catch (e) { return outils.erreur(res, 400, e.message); }
    if (!corps || typeof corps.texte !== "string") return outils.erreur(res, 400, "Texte manquant.");
    if (Buffer.byteLength(corps.texte, "utf8") > TAILLE_MAX) return outils.erreur(res, 413, "Texte trop long.");
    if (fs.existsSync(fichier) && !corps.forcer) {
      const actuel = lireFichier(fichier);
      if (actuel.version !== corps.version && actuel.texte !== corps.texte) {
        return outils.envoyerJson(res, 409, Object.assign({ erreur: "TODO.md a changé depuis son ouverture." }, actuel));
      }
    }
    fs.writeFileSync(fichier, corps.texte, "utf8");
    return outils.envoyerJson(res, 200, { version: version(fs.statSync(fichier)) });
  }

  return outils.erreur(res, 405, "Méthode non prise en charge.");
}

module.exports = { nom: "todo", api };
