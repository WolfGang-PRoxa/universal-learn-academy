/* ==========================================================================
   Atelier · éditeur « texte » : rédaction libre (logique)
   --------------------------------------------------------------------------
   Pour les questions qui se rédigent : expliquer une erreur de modélisation,
   justifier un choix, lister des commandes. Pas de comparaison automatique :
   la solution s'affiche, et Claude corrige à la demande.

   Contrat commun à tous les éditeurs (voir _outils/atelier/README.md) :
     nom, libelle, description        identité, et description pour Claude
     options                          { nom: description } des options reconnues
     aide                             aide de la syntaxe texte (HTML)
     vide(options)                    modèle vide
     lire(texte, options)             -> { modele, erreurs: [{ ligne, message }] }
     ecrire(modele, options)          -> texte
     fusionner(nouveau, ancien)       garde ce que le texte ne décrit pas (positions…)
     controler(modele, options, tests) -> [{ niveau, message, cible }]
     comparer(modele, solution, opt)  -> { score, ecarts, resume } ou null
     cibles(modele)                   (facultatif) noms des éléments que l'on peut viser
     estVide(modele)
     sansDessin, asynchrone           pas de vue dessin ; évaluation par le serveur
   ========================================================================== */
(function (A) {
  "use strict";

  A.editeurs.texte = {
    nom: "texte",
    // Options reconnues (champ « options » d'un atelier), vérifiées par outils/verifier.js
    options: {
      lignes: "hauteur de la zone de rédaction, en lignes",
      placeholder: "texte d'invite de la zone vide"
    },
    libelle: "Rédaction",
    description: "Réponse rédigée librement.",
    aide: "<p>Rédiger la réponse librement. La solution proposée s'affiche à la demande, et Claude peut corriger.</p>",
    sansDessin: true,
    vide: function () { return { texte: "" }; },
    lire: function (texte) { return { modele: { texte: String(texte == null ? "" : texte) }, erreurs: [] }; },
    ecrire: function (m) { return m && m.texte ? m.texte : ""; },
    controler: function (m) {
      return m && m.texte && m.texte.trim() ? [] : [A.noyau.message("info", "La réponse est vide pour l'instant.")];
    },
    comparer: function () { return null; },
    estVide: function (m) { return !m || !String(m.texte || "").trim(); }
  };
})(window.Atelier);
