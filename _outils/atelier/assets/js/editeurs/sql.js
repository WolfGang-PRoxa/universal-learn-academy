/* ==========================================================================
   Atelier · éditeur « sql » (logique)
   --------------------------------------------------------------------------
   Le texte est du SQL, exécuté sur le serveur local (PostgreSQL, PGlite)
   dans une base neuve créée par un jeu de données (options.jeu : nom d'un
   jeu déclaré par la page ou le quiz). Deux modes :
     requete (défaut)   l'étudiant écrit une requête ; son résultat est
                        comparé à celui de la solution (sans tenir compte
                        de l'ordre des lignes, sauf options.ordre ; des noms
                        de colonnes, sauf options.colonnes) ;
     script             l'étudiant écrit un script (CREATE TABLE, INSERT…) ;
                        des tests l'éprouvent ensuite, chacun sur les mêmes
                        données : { nom, requete, doit: "reussir"|"echouer" }
                        ou { nom, requete, resultat: true } (même résultat
                        qu'avec le script de la solution).
   La logique prépare les demandes d'exécution et interprète les réponses ;
   l'appel au serveur est fait par la vue (ou le vérificateur).
   ========================================================================== */
(function (A) {
  "use strict";

  var N = A.noyau, msg = N.message, ecart = N.ecart;

  function valeurNormale(v) {
    if (v === null || v === undefined) return "∅";
    var s = String(v).trim();
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return String(Math.round(Number(s) * 1e6) / 1e6);
    return s;
  }

  // Compare deux résultats d'exécution : { ok, message }
  function comparerResultats(obtenu, attendu, options) {
    options = options || {};
    if (!obtenu) return { ok: false, message: "Pas de résultat." };
    if (obtenu.erreur) return { ok: false, message: "Ta requête provoque une erreur : " + obtenu.erreur };
    if (attendu && attendu.erreur) return { ok: false, message: "La solution provoque une erreur : " + attendu.erreur };
    if (!obtenu.colonnes) return { ok: false, message: "Ta requête ne renvoie pas de lignes." };
    if (!attendu || !attendu.colonnes) return { ok: false, message: "La solution ne renvoie pas de lignes." };
    if (obtenu.colonnes.length !== attendu.colonnes.length) {
      return { ok: false, message: "Ta requête renvoie " + N.pluriel(obtenu.colonnes.length, "colonne") + ", " + attendu.colonnes.length + " attendue(s)." };
    }
    if (options.colonnes) {
      var noms = function (r) { return r.colonnes.map(function (c) { return c.toLowerCase(); }).join(","); };
      if (noms(obtenu) !== noms(attendu)) return { ok: false, message: "Les colonnes n'ont pas les noms attendus (" + attendu.colonnes.join(", ") + ")." };
    }
    if (obtenu.total !== attendu.total) {
      return { ok: false, message: "Ta requête renvoie " + N.pluriel(obtenu.total, "ligne") + ", " + attendu.total + " attendue(s)." };
    }
    var cle = function (l) { return JSON.stringify(l.map(valeurNormale)); };
    var a = obtenu.lignes.map(cle), b = attendu.lignes.map(cle);
    if (!options.ordre) { a.sort(); b.sort(); }
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return { ok: false, message: options.ordre ? "Les lignes ne sont pas les bonnes, ou pas dans le bon ordre." : "Les lignes renvoyées ne sont pas celles attendues." };
    }
    return { ok: true, message: "Même résultat que la solution" + (options.ordre ? ", dans le bon ordre." : ".") };
  }

  // Prépare l'évaluation : { demandes: [{ langage, jeu, requetes }], interpreter(reponses) }
  function evaluation(modele, solution, options, jeu) {
    options = options || {};
    var code = String(modele && modele.code || "");
    var sol = solution ? String(solution.code || "") : "";
    jeu = jeu || "";
    if (options.mode === "script") {
      var tests = (options.tests || []).filter(function (t) { return t && t.requete; });
      var requetes = tests.map(function (t) { return t.requete; });
      var demandes = [{ langage: "sql", jeu: jeu + "\n" + code, requetes: requetes.length ? requetes : ["SELECT 1"] }];
      var besoinSolution = tests.some(function (t) { return t.resultat; });
      if (besoinSolution && sol) demandes.push({ langage: "sql", jeu: jeu + "\n" + sol, requetes: requetes });
      return {
        demandes: demandes,
        interpreter: function (reponses) {
          var r = reponses[0] || {}, ecarts = [];
          if (r.erreur) return { score: 0, ecarts: [ecart("different", r.erreur)], resume: "Exécution impossible." };
          var res = r.resultats || [];
          if (res[0] && /^Le jeu de données n'a pas pu être créé/.test(res[0].erreur || "")) {
            return { score: 0, ecarts: [ecart("different", "Ton script provoque une erreur : " + res[0].erreur.replace(/^Le jeu de données n'a pas pu être créé : /, ""))], resume: "Le script ne s'exécute pas.", details: [] };
          }
          if (!tests.length) return { score: null, ecarts: [], resume: "Le script s'exécute sans erreur.", details: [] };
          var reussis = 0, details = [];
          tests.forEach(function (t, i) {
            var x = res[i] || {}, ok, texte;
            if (t.resultat) {
              var c = comparerResultats(x, ((reponses[1] || {}).resultats || [])[i], options);
              ok = c.ok; texte = c.message;
            } else if (t.doit === "echouer") {
              ok = Boolean(x.erreur); texte = ok ? "Refusé, comme attendu : " + x.erreur : "Cette instruction aurait dû être refusée.";
            } else {
              ok = !x.erreur; texte = ok ? "Accepté, comme attendu." : "Refusé à tort : " + x.erreur;
            }
            if (ok) reussis++;
            else ecarts.push(ecart("different", (t.nom || "Test " + (i + 1)) + " : " + texte));
            details.push({ nom: t.nom || "Test " + (i + 1), requete: t.requete, ok: ok, message: texte });
          });
          var score = reussis / tests.length;
          return { score: score, ecarts: ecarts, details: details, resume: reussis + " test" + (reussis > 1 ? "s" : "") + " réussi" + (reussis > 1 ? "s" : "") + " sur " + tests.length + "." };
        }
      };
    }
    return {
      demandes: [{ langage: "sql", jeu: jeu, requetes: sol ? [code, sol] : [code] }],
      interpreter: function (reponses) {
        var r = reponses[0] || {};
        if (r.erreur) return { score: 0, ecarts: [ecart("different", r.erreur)], resume: "Exécution impossible." };
        var res = r.resultats || [];
        if (!sol) return { score: null, ecarts: [], resume: res[0] && res[0].erreur ? "Ta requête provoque une erreur." : "Requête exécutée.", obtenu: res[0] };
        var c = comparerResultats(res[0], res[1], options);
        return { score: c.ok ? 1 : 0, ecarts: c.ok ? [] : [ecart("different", c.message)], resume: c.message, obtenu: res[0], attendu: res[1] };
      }
    };
  }

  A.editeurs.sql = {
    nom: "sql",
    // Options reconnues (champ « options » d'un atelier), vérifiées par outils/verifier.js
    options: {
      jeu: "nom du jeu de données (bloc atelier-jeux de la page, ou jeux du quiz)",
      mode: "requete (défaut) ou script (création, modification, tests)",
      ordre: "true : l'ordre des lignes du résultat compte",
      colonnes: "true : les noms des colonnes comptent",
      lignes: "hauteur de l'éditeur, en lignes"
    },
    libelle: "SQL",
    description: "Code SQL (PostgreSQL), exécuté sur un jeu de données.",
    aide: "<p>Du SQL PostgreSQL. <kbd>Ctrl</kbd> + <kbd>Entrée</kbd> exécute le code sur le jeu de données de l'exercice (serveur local nécessaire). Chaque exécution repart des mêmes données.</p>",
    sansDessin: true,
    asynchrone: true,
    vide: function () { return { code: "" }; },
    lire: function (texte) { return { modele: { code: String(texte == null ? "" : texte) }, erreurs: [] }; },
    ecrire: function (m) { return m && m.code ? m.code : ""; },
    controler: function (m) {
      var code = String(m && m.code || "").trim();
      if (!code) return [msg("info", "Le code est vide pour l'instant.")];
      var res = [];
      if (/'[^']*$/.test(code.replace(/'[^']*'/g, ""))) res.push(msg("erreur", "Une apostrophe n'est pas refermée."));
      var p = (code.match(/\(/g) || []).length - (code.match(/\)/g) || []).length;
      if (p) res.push(msg("erreur", p > 0 ? "Il manque " + N.pluriel(p, "parenthèse fermante", "parenthèses fermantes") + "." : "Il y a " + N.pluriel(-p, "parenthèse fermante", "parenthèses fermantes") + " en trop."));
      if (/[‘’]/.test(code)) res.push(msg("attention", "Le code contient des apostrophes typographiques (‘ ’) : les remplacer par l'apostrophe droite '."));
      return res;
    },
    comparer: function () { return null; },
    evaluation: evaluation,
    comparerResultats: comparerResultats,
    estVide: function (m) { return !m || !String(m.code || "").trim(); }
  };
})(window.Atelier);
