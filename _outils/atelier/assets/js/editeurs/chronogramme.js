/* ==========================================================================
   Atelier · éditeur « chronogramme » (logique)
   --------------------------------------------------------------------------
   Ordonnancement de processus, exclusion mutuelle, signaux : une ligne par
   processus (ou ressource), une case par unité de temps, chaque case dans
   un état. Syntaxe :
     temps 0..12                 intervalle affiché (défaut 0..10)
     temps 0..3000 pas 50        une case dure 50 : instants en vraies valeurs
     etat x Exécution            états : code d'une lettre, puis libellé
     etat p Prêt                 (défaut : x Exécution, p Prêt, b Bloqué)
     P1 : x 0-3, p 3-5, x 5-7    segments « état début-fin » (fin exclue)
     P2 : ..xxpp.x               ou un caractère par case (. = rien)
   Options : processeurs (nombre de processus en exécution à la fois, contrôlé),
   actif (code de l'état « en exécution », défaut x), durees ({ P1: 5 } :
   temps d'exécution total attendu, contrôlé), pas (durée d'une case).
   Tracé de signal (codes en ligne : bipolaire, HDBn, Manchester…) :
   niveaux ({ p: 1, n: -1 } : chaque ligne est dessinée comme un signal, une
   case vide étant au niveau repos, 0 par défaut, ou sans tracé si
   repos vaut false), marques ({ B: "B+" } : repère écrit sur l'impulsion),
   graduations (étiquettes des colonnes, à la place des instants : les bits
   à coder, « 1 0 0 1 » ou « 1001 »).
   ========================================================================== */
(function (A) {
  "use strict";

  var N = A.noyau, S = A.syntaxe, msg = N.message, ecart = N.ecart;
  var ETATS = [{ code: "x", libelle: "Exécution" }, { code: "p", libelle: "Prêt" }, { code: "b", libelle: "Bloqué" }];

  // Durée d'une case : 1 pour un modèle enregistré avant l'arrivée du pas
  function pasDe(m) { return m && m.pas > 0 ? m.pas : 1; }

  function lire(texte, options) {
    var erreurs = [], debut = 0, fin = 10, pas = 1, etats = null, brutes = [];
    S.lignes(texte).forEach(function (l) {
      var t = l.texte, x;
      if ((x = t.match(/^temps\s+(-?\d+)\s*(?:\.\.|-|\s)\s*(-?\d+)(?:\s+pas\s+(\d+))?$/i))) {
        debut = Number(x[1]); fin = Number(x[2]); pas = x[3] ? Number(x[3]) : 1;
        if (fin <= debut) erreurs.push(S.erreur(l.num, "L'intervalle de temps doit aller croissant : « temps 0..12 »."));
        else if (pas < 1) { erreurs.push(S.erreur(l.num, "Le pas doit valoir au moins 1 : « temps 0..3000 pas 50 ».")); pas = 1; }
        else if ((fin - debut) % pas) {
          erreurs.push(S.erreur(l.num, "L'intervalle " + debut + ".." + fin + " n'est pas un multiple du pas " + pas + "."));
          fin = debut + Math.ceil((fin - debut) / pas) * pas;
        }
        return;
      }
      if ((x = t.match(/^[ée]tat\s+(\S)\s+(.+)$/i))) {
        etats = etats || [];
        etats.push({ code: x[1], libelle: x[2].trim() });
        return;
      }
      var i = t.indexOf(":");
      if (i < 0) { erreurs.push(S.erreur(l.num, "Ligne illisible : « " + t + " ». Exemple : P1 : x 0-3, p 3-5")); return; }
      brutes.push({ num: l.num, nom: t.slice(0, i).trim(), valeur: t.slice(i + 1).trim() });
    });
    if (fin <= debut) fin = debut + pas;
    etats = etats || (options && options.etats) || ETATS;
    var codes = etats.map(function (e) { return e.code; });
    var n = (fin - debut) / pas, lignes = [];
    brutes.forEach(function (b) {
      // Plusieurs lignes au même nom : elles complètent la même ligne du chronogramme
      var deja = lignes.find(function (l) { return N.cle(l.nom) === N.cle(b.nom); });
      var cases = deja ? deja.cases : [];
      if (!deja) for (var k = 0; k < n; k++) cases.push(null);
      if (b.valeur && /^[^\s,\d-]+$/.test(b.valeur) && !/\s/.test(b.valeur)) {
        // Un caractère par case
        b.valeur.split("").forEach(function (c, k) {
          if (k >= n) return;
          if (c === "." || c === "_") return;
          if (codes.indexOf(c) < 0) { erreurs.push(S.erreur(b.num, "État inconnu « " + c + " » (états : " + codes.join(", ") + ").")); return; }
          cases[k] = c;
        });
        if (b.valeur.length > n) erreurs.push(S.erreur(b.num, "« " + b.nom + " » dépasse l'intervalle de temps (" + N.pluriel(n, pas === 1 ? "unité" : "case") + ")."));
      } else if (b.valeur) {
        S.decouper(b.valeur, ",").forEach(function (seg) {
          var s = seg.match(/^(\S)\s+(-?\d+)\s*-\s*(-?\d+)$/);
          if (!s) { erreurs.push(S.erreur(b.num, "Segment illisible : « " + seg + " ». Exemple : x 0-3")); return; }
          if (codes.indexOf(s[1]) < 0) { erreurs.push(S.erreur(b.num, "État inconnu « " + s[1] + " » (états : " + codes.join(", ") + ").")); return; }
          var a = Number(s[2]), z = Number(s[3]);
          if (z <= a) { erreurs.push(S.erreur(b.num, "Segment vide ou à l'envers : « " + seg + " »."));
            return; }
          if (a < debut || z > fin) erreurs.push(S.erreur(b.num, "Le segment « " + seg + " » sort de l'intervalle " + debut + ".." + fin + "."));
          if ((a - debut) % pas || (z - debut) % pas) erreurs.push(S.erreur(b.num, "Le segment « " + seg + " » ne tombe pas sur une case : les instants vont de " + pas + " en " + pas + "."));
          var k0 = Math.floor((Math.max(a, debut) - debut) / pas), k1 = Math.ceil((Math.min(z, fin) - debut) / pas);
          for (var k = k0; k < k1; k++) cases[k] = s[1];
        });
      }
      if (!deja) lignes.push({ nom: b.nom, cases: cases });
    });
    return { modele: { debut: debut, fin: fin, pas: pas, etats: etats, lignes: lignes }, erreurs: erreurs };
  }

  function segments(ligne, debut, pas) {
    var res = [], cour = null;
    pas = pas || 1;
    ligne.cases.forEach(function (c, k) {
      if (cour && cour.code === c) { cour.fin = debut + (k + 1) * pas; return; }
      if (cour) res.push(cour);
      cour = c ? { code: c, debut: debut + k * pas, fin: debut + (k + 1) * pas } : null;
    });
    if (cour) res.push(cour);
    return res;
  }

  function ecrire(m) {
    if (!m) return "";
    var pas = pasDe(m);
    var t = ["temps " + m.debut + ".." + m.fin + (pas !== 1 ? " pas " + pas : "")];
    var defaut = JSON.stringify(m.etats) === JSON.stringify(ETATS);
    if (!defaut) m.etats.forEach(function (e) { t.push("etat " + e.code + " " + e.libelle); });
    m.lignes.forEach(function (l) {
      t.push(l.nom + " : " + segments(l, m.debut, pas).map(function (s) { return s.code + " " + s.debut + "-" + s.fin; }).join(", "));
    });
    return t.join("\n");
  }

  function controler(m, options) {
    options = options || {};
    if (!m || !m.lignes.length) return [msg("info", "Le chronogramme est vide pour l'instant.")];
    var res = [], actif = options.actif || "x", pas = pasDe(m);
    if (options.processeurs) {
      for (var k = 0; k < (m.fin - m.debut) / pas; k++) {
        var en = m.lignes.filter(function (l) { return l.cases[k] === actif; });
        if (en.length > options.processeurs) {
          res.push(msg("erreur", "Entre t = " + (m.debut + k * pas) + " et t = " + (m.debut + (k + 1) * pas) + ", " + en.length + " processus sont en exécution (" + en.map(function (l) { return l.nom; }).join(", ") + ") pour " + N.pluriel(options.processeurs, "processeur") + ".", en[0].nom));
        }
      }
    }
    Object.keys(options.durees || {}).forEach(function (nom) {
      var l = m.lignes.find(function (x) { return x.nom.toLowerCase() === nom.toLowerCase(); });
      if (!l) { res.push(msg("attention", "Il manque la ligne « " + nom + " ».")); return; }
      var d = l.cases.filter(function (c) { return c === actif; }).length * pas;
      if (d !== options.durees[nom]) res.push(msg("attention", "« " + l.nom + " » s'exécute " + d + " unité(s) de temps, " + options.durees[nom] + " attendue(s).", l.nom));
    });
    return res;
  }

  // État d'une ligne à l'instant t (début d'une case de la solution), quel que soit son pas
  function etatA(m, ligne, t) {
    if (t < m.debut || t >= m.fin) return null;
    return ligne.cases[Math.floor((t - m.debut) / pasDe(m))] || null;
  }

  function comparer(m, sol) {
    if (!sol) return null;
    var ecarts = [], justes = 0, total = 0, pas = pasDe(sol);
    sol.lignes.forEach(function (ls) {
      var le = m.lignes.find(function (x) { return N.cle(x.nom) === N.cle(ls.nom); });
      if (!le) { ecarts.push(ecart("manque", "Il manque la ligne « " + ls.nom + " ».")); total += ls.cases.length; return; }
      var fausses = [];
      for (var t = sol.debut; t < sol.fin; t += pas) {
        total++;
        if (etatA(sol, ls, t) === etatA(m, le, t)) justes++; else fausses.push(t);
      }
      if (fausses.length) {
        ecarts.push(ecart("different", "« " + le.nom + " » : " + N.pluriel(fausses.length, "case différente", "cases différentes") + " de la solution (t = " + plages(fausses, pas) + ").", le.nom));
      }
    });
    m.lignes.forEach(function (le) {
      if (!sol.lignes.some(function (x) { return N.cle(x.nom) === N.cle(le.nom); })) ecarts.push(ecart("exces", "La ligne « " + le.nom + " » n'apparaît pas dans la solution.", le.nom));
    });
    var score = total ? justes / total : 1;
    return { score: score, ecarts: ecarts, resume: score === 1 && !ecarts.length ? "Identique à la solution proposée." : Math.round(score * 100) + " % des cases justes · " + N.pluriel(ecarts.length, "écart") };
  }

  // Débuts des cases fausses : [3, 4, 5, 9] -> « 3 à 5, 9 » (avec un pas de 50 : [500, 550, 700] -> « 500 à 550, 700 »)
  function plages(liste, pas) {
    var res = [], d = null, p = null;
    liste.concat([null]).forEach(function (t) {
      if (d !== null && t === p + pas) { p = t; return; }
      if (d !== null) res.push(d === p ? String(d) : d + " à " + p);
      d = p = t;
    });
    return res.join(", ");
  }

  /* Tracé de signal ------------------------------------------------------------ */

  // Niveau d'une case (entre -1 et 1) ; null : rien à tracer
  function niveauDe(options, code) {
    var o = options || {};
    if (!o.niveaux) return null;
    if (code && o.niveaux[code] != null) return Math.max(-1, Math.min(1, Number(o.niveaux[code]) || 0));
    if (code) return 0;
    return o.repos === false ? null : Math.max(-1, Math.min(1, Number(o.repos) || 0));
  }

  // Étiquettes des n colonnes : une liste, ou un texte coupé aux espaces (sinon un caractère par colonne)
  function graduationsDe(options, n) {
    var g = options && options.graduations;
    if (g == null) return null;
    var l = Array.isArray(g) ? g.map(String) : /\s/.test(String(g).trim()) ? String(g).trim().split(/\s+/) : String(g).split("");
    var res = [];
    for (var k = 0; k < n; k++) res.push(l[k] != null ? l[k] : "");
    return res;
  }

  A.editeurs.chronogramme = {
    nom: "chronogramme",
    // Options reconnues (champ « options » d'un atelier), vérifiées par outils/verifier.js
    options: {
      debut: "premier instant (défaut 0)",
      fin: "dernier instant (défaut 10)",
      pas: "durée d'une case (défaut 1) ; dans le texte : « temps 0..3000 pas 50 »",
      etats: "états : [{ \"code\": \"x\", \"libelle\": \"Exécution\" }, …]",
      processeurs: "nombre de processeurs : au plus autant de processus en exécution à la fois",
      actif: "code de l'état d'exécution (défaut x)",
      durees: "durée d'exécution attendue par processus, dans l'unité de l'axe : { \"P1\": 3, … }",
      niveaux: "tracé de signal : niveau de chaque état, entre -1 et 1 ({ \"p\": 1, \"n\": -1 })",
      repos: "tracé de signal : niveau d'une case vide (0 par défaut ; false : rien de tracé)",
      marques: "tracé de signal : repère écrit sur l'impulsion d'un état ({ \"B\": \"B+\" })",
      graduations: "étiquettes des colonnes à la place des instants (les bits à coder : \"1 0 0 1\")"
    },
    libelle: "Chronogramme",
    description: "Chronogramme : une ligne par processus, chaque case de temps dans un état (segments « état début-fin », fin exclue ; « temps 0..3000 pas 50 » quand une case dure 50).",
    aide: "<ul><li><code>temps 0..12</code> fixe l'intervalle ; <code>temps 0..3000 pas 50</code> quand une case dure 50 ; <code>etat x Exécution</code> déclare un état (défaut : x Exécution, p Prêt, b Bloqué).</li>" +
      "<li>Une ligne par processus : <code>P1 : x 0-3, p 3-5</code> (fin exclue), ou un caractère par case : <code>P2 : ..xxpp.x</code>.</li></ul>",
    vide: function (options) {
      var d = options && options.debut != null ? options.debut : 0, p = options && options.pas > 0 ? options.pas : 1;
      var f = options && options.fin != null ? options.fin : d + 10 * p;
      if (f <= d || (f - d) % p) f = d + Math.max(1, Math.ceil((f - d) / p)) * p;
      return { debut: d, fin: f, pas: p, etats: (options && options.etats) || ETATS.slice(), lignes: [] };
    },
    lire: lire,
    ecrire: ecrire,
    controler: controler,
    comparer: comparer,
    segments: segments,
    pasDe: pasDe,
    niveauDe: niveauDe,
    graduationsDe: graduationsDe,
    ETATS: ETATS,
    cibles: function (m) { return (m && m.lignes || []).map(function (l) { return l.nom; }); },
    estVide: function (m) { return !m || !m.lignes.some(function (l) { return l.cases.some(Boolean); }); }
  };
})(window.Atelier);
