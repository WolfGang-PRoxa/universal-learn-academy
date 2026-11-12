/* ==========================================================================
   Atelier · éditeur « table » : grille de valeurs (logique)
   --------------------------------------------------------------------------
   Contenu d'une table de base de données, table de vérité, matrice, plan
   d'adressage, emploi du temps… Syntaxe, une ligne par rangée :
     | id | nom    | id_parrain |
     |----|--------|------------|
     | 1  | Julie  |            |
   Les barres de début et de fin sont facultatives, la ligne de tirets aussi.
   La première ligne donne les en-têtes. Une case vide s'écrit vide.
   Options :
     verrou     "entetes" (défaut) : en-têtes fixes ; "depart" : toutes les
                cases remplies au départ sont fixes ; "aucun"
     lignes     true : on peut ajouter et supprimer des lignes (défaut true)
     colonnes   true : on peut ajouter et supprimer des colonnes (défaut false)
     ordre      true : l'ordre des lignes compte dans la comparaison
     casse      true : la casse compte ; tolerance : écart permis sur les nombres
     cles       colonnes qui forment une clé (unicité contrôlée)
     types      { colonne: "entier" | "nombre" | "date" | "booleen" }
     mono       true : affichage en police à chasse fixe (tables de vérité)
   ========================================================================== */
(function (A) {
  "use strict";

  var N = A.noyau, S = A.syntaxe, msg = N.message, ecart = N.ecart;

  function cellules(ligne) {
    var t = ligne.trim();
    if (t[0] === "|") t = t.slice(1);
    if (t[t.length - 1] === "|" && t[t.length - 2] !== "\\") t = t.slice(0, -1);
    return t.split(/(?<!\\)\|/).map(function (c) { return c.trim().replace(/\\\|/g, "|"); });
  }

  function lire(texte) {
    var erreurs = [], colonnes = null, lignes = [];
    String(texte == null ? "" : texte).replace(/\r\n?/g, "\n").split("\n").forEach(function (brut, i) {
      if (!brut.trim() || /^\s*--/.test(brut)) return;
      if (/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(brut)) return;   // ligne de tirets
      var c = cellules(brut);
      if (!colonnes) { colonnes = c; return; }
      if (c.length > colonnes.length) erreurs.push(S.erreur(i + 1, "Cette ligne a " + c.length + " cases pour " + colonnes.length + " colonnes."));
      while (c.length < colonnes.length) c.push("");
      lignes.push(c.slice(0, colonnes.length));
    });
    return { modele: { colonnes: colonnes || [], lignes: lignes }, erreurs: erreurs };
  }

  function ecrire(m) {
    if (!m || !m.colonnes.length) return "";
    var toutes = [m.colonnes].concat(m.lignes);
    var larg = m.colonnes.map(function (_, j) {
      return Math.max(3, Math.max.apply(null, toutes.map(function (l) { return String(l[j] == null ? "" : l[j]).length; })));
    });
    function rangee(l) {
      return "| " + larg.map(function (w, j) { var v = String(l[j] == null ? "" : l[j]).replace(/\|/g, "\\|"); return v + " ".repeat(w - v.length); }).join(" | ") + " |";
    }
    return [rangee(m.colonnes), "|" + larg.map(function (w) { return "-".repeat(w + 2); }).join("|") + "|"]
      .concat(m.lignes.map(rangee)).join("\n");
  }

  /* Contrôles ------------------------------------------------------------------ */

  function indiceColonne(m, nom) {
    return m.colonnes.findIndex(function (c) { return c.toLowerCase() === String(nom).toLowerCase(); });
  }

  var TYPES = {
    entier: { re: /^-?\d+$/, libelle: "un entier" },
    nombre: { re: /^-?\d+([.,]\d+)?$/, libelle: "un nombre" },
    date: { re: /^\d{4}-\d{2}-\d{2}$/, libelle: "une date AAAA-MM-JJ" },
    booleen: { re: /^(0|1|v|f|vrai|faux|true|false)$/i, libelle: "un booléen (0/1, vrai/faux)" }
  };

  function controler(m, options) {
    options = options || {};
    var res = [];
    if (!m || !m.colonnes.length) return [msg("info", "La table est vide pour l'instant.")];
    var vides = 0;
    m.lignes.forEach(function (l) { l.forEach(function (v) { if (!String(v).trim()) vides++; }); });
    if (vides && options.complet) res.push(msg("info", N.pluriel(vides, "case vide", "cases vides") + "."));
    if (options.cles && options.cles.length) {
      var idx = options.cles.map(function (c) { return indiceColonne(m, c); });
      if (idx.every(function (i) { return i >= 0; })) {
        var vus = {};
        m.lignes.forEach(function (l, i) {
          var valeurs = idx.map(function (j) { return String(l[j]).trim(); });
          var c = "ligne " + (i + 1);
          if (valeurs.some(function (v) { return !v; })) res.push(msg("erreur", "Ligne " + (i + 1) + " : la clé (" + options.cles.join(", ") + ") ne peut pas être vide.", c));
          var k = valeurs.join(String.fromCharCode(1));
          if (vus[k]) res.push(msg("erreur", "Lignes " + vus[k] + " et " + (i + 1) + " : même valeur de clé (" + valeurs.join(", ") + ").", c));
          else vus[k] = i + 1;
        });
      }
    }
    Object.keys(options.types || {}).forEach(function (col) {
      var j = indiceColonne(m, col), t = TYPES[options.types[col]];
      if (j < 0 || !t) return;
      m.lignes.forEach(function (l, i) {
        var v = String(l[j]).trim();
        if (v && !t.re.test(v)) res.push(msg("erreur", "Ligne " + (i + 1) + ", « " + col + " » : « " + v + " » n'est pas " + t.libelle + ".", "ligne " + (i + 1)));
      });
    });
    return res;
  }

  /* Comparaison ------------------------------------------------------------------ */

  function normale(v, options) {
    var t = String(v == null ? "" : v).trim().replace(/\s+/g, " ");
    if (/^(null|∅)$/i.test(t)) t = "";
    var n = t.replace(",", ".");
    // Un mot binaire (« 0110 », « 00101 ») n'est pas un nombre : ses zéros de tête comptent
    if (/^-?\d+(\.\d+)?$/.test(n) && !/^-?0\d/.test(n)) return { nombre: Number(n) };
    t = t.replace(/\s*,\s*/g, ", ");   // une liste s'écrit avec ou sans espace après la virgule
    if (!options.casse) t = t.toLowerCase();
    if (!options.accents) t = N.sansAccents(t);
    return { texte: t };
  }
  function egales(a, b, options) {
    var x = normale(a, options), y = normale(b, options);
    if (x.nombre != null && y.nombre != null) return Math.abs(x.nombre - y.nombre) <= (options.tolerance || 0) + 1e-9;
    return x.texte != null && y.texte != null && x.texte === y.texte;
  }

  function comparer(m, sol, options) {
    if (!sol) return null;
    options = options || {};
    var ecarts = [];
    // Correspondance des colonnes : par nom, sinon par position
    var corresp = sol.colonnes.map(function (c, j) {
      var i = m.colonnes.findIndex(function (x) { return N.cle(x) === N.cle(c); });
      return i >= 0 ? i : (j < m.colonnes.length && !sol.colonnes.some(function (y) { return N.cle(y) === N.cle(m.colonnes[j]); }) ? j : -1);
    });
    corresp.forEach(function (i, j) {
      if (i < 0) ecarts.push(ecart("manque", "Il manque la colonne « " + sol.colonnes[j] + " »."));
      else if (N.cle(m.colonnes[i]) !== N.cle(sol.colonnes[j])) ecarts.push(ecart("different", "La colonne « " + m.colonnes[i] + " » devrait s'appeler « " + sol.colonnes[j] + " ».", "colonne " + m.colonnes[i]));
    });
    function ligneEtu(l) { return corresp.map(function (i) { return i >= 0 ? l[i] : ""; }); }
    var etu = m.lignes.map(ligneEtu), total = sol.lignes.length * sol.colonnes.length, justes = 0;
    var utilisees = new Set(), paires = [];
    if (options.ordre) {
      sol.lignes.forEach(function (l, i) { paires.push([i, i < etu.length ? i : -1]); if (i < etu.length) utilisees.add(i); });
    } else {
      // Chaque ligne attendue est associée à la ligne restante qui lui ressemble le plus
      sol.lignes.forEach(function (l, i) {
        var meilleur = -1, score = -1;
        etu.forEach(function (x, k) {
          if (utilisees.has(k)) return;
          var s = l.filter(function (v, j) { return egales(x[j], v, options); }).length;
          if (s > score) { score = s; meilleur = k; }
        });
        if (meilleur >= 0 && score > 0) utilisees.add(meilleur); else meilleur = -1;
        paires.push([i, meilleur]);
      });
    }
    paires.forEach(function (p) {
      var l = sol.lignes[p[0]];
      if (p[1] < 0) { ecarts.push(ecart("manque", "Il manque la ligne « " + l.join(" | ") + " ».")); return; }
      var x = etu[p[1]], fausses = [];
      l.forEach(function (v, j) { if (egales(x[j], v, options)) justes++; else fausses.push(j); });
      fausses.forEach(function (j) {
        ecarts.push(ecart("different", "Ligne " + (p[1] + 1) + ", « " + sol.colonnes[j] + " » : « " + (x[j] || "(vide)") + " » au lieu de « " + (l[j] || "(vide)") + " ».",
          "case " + (p[1] + 1) + ":" + (corresp[j] + 1)));
      });
    });
    var enTrop = etu.length - utilisees.size;
    etu.forEach(function (x, k) {
      if (!utilisees.has(k) && x.some(function (v) { return String(v).trim(); })) ecarts.push(ecart("exces", "La ligne " + (k + 1) + " (« " + m.lignes[k].join(" | ") + " ») n'apparaît pas dans la solution.", "ligne " + (k + 1)));
    });
    var score = total ? justes / (total + enTrop * sol.colonnes.length) : (etu.length ? 0 : 1);
    return {
      score: score, ecarts: ecarts,
      resume: score === 1 && !ecarts.length ? "Identique à la solution proposée." : Math.round(score * 100) + " % des cases justes · " + N.pluriel(ecarts.length, "écart")
    };
  }

  A.editeurs.table = {
    nom: "table",
    // Options reconnues (champ « options » d'un atelier), vérifiées par outils/verifier.js
    options: {
      verrou: "cases non modifiables : entetes (défaut), depart (les cases remplies au départ) ou aucun",
      lignes: "false : pas d'ajout ni de suppression de lignes",
      colonnes: "true : ajout et suppression de colonnes permis",
      ordre: "true : l'ordre des lignes compte",
      casse: "true : la casse compte",
      accents: "true : les accents comptent",
      tolerance: "écart permis sur les nombres",
      cles: "colonnes qui identifient une ligne (non vides, sans doublon)",
      types: "type attendu par colonne : { \"col\": \"entier\" | \"nombre\" | \"date\" | \"booleen\" }",
      mono: "true : police à chasse fixe",
      complet: "true : signaler les cases vides"
    },
    libelle: "Table",
    description: "Grille de valeurs : la première ligne donne les en-têtes, les cases sont séparées par des barres |.",
    aide: "<p>Une rangée par ligne, cases séparées par <code>|</code> ; la première ligne donne les en-têtes :</p>" +
      "<pre><code class='language-plaintext'>| id | nom   | id_parrain |\n| 1  | Julie |            |\n| 2  | Marc  | 1          |</code></pre>" +
      "<p>Une case vide s'écrit vide. La ligne de tirets sous les en-têtes est facultative.</p>",
    vide: function () { return { colonnes: [], lignes: [] }; },
    lire: lire,
    ecrire: ecrire,
    controler: controler,
    comparer: comparer,
    egales: egales,
    cibles: function (m) {
      var t = (m && m.colonnes || []).map(function (c) { return "colonne " + c; });
      (m && m.lignes || []).forEach(function (_, i) { t.push("ligne " + (i + 1)); });
      return t;
    },
    estVide: function (m) { return !m || !m.lignes.some(function (l) { return l.some(function (v) { return String(v).trim(); }); }); }
  };
})(window.Atelier);
