/* ==========================================================================
   Atelier · éditeur « cas » : diagramme de cas d'utilisation UML (logique)
   --------------------------------------------------------------------------
   Syntaxe :
     systeme Guichet automatique      frontière du système (facultative)
     acteur Porteur                   acteur humain (bonhomme)
     acteur <<actor>> SA Visa         acteur non humain (rectangle stéréotypé)
     cas Retirer de l'argent          les noms peuvent contenir des espaces
     Porteur -- Retirer de l'argent               association
     SA Visa -- Retirer de l'argent : secondaire  association avec étiquette
     Retirer de l'argent ..> Saisir son code : include    inclusion
     Imprimer un ticket ..> Retirer de l'argent : extend  extension
     Porteur Visa --|> Porteur        généralisation (acteurs ou cas)
   Un nom utilisé sans être déclaré devient un cas. Une association s'écrit
   dans les deux sens : elle est rangée avec l'acteur en premier.
   Un acteur dont toutes les associations portent « secondaire » est placé à
   droite du système par la vue.
   ========================================================================== */
(function (A) {
  "use strict";

  var N = A.noyau, S = A.syntaxe, msg = N.message, ecart = N.ecart;
  var RE_LIEN = /^(.+?)\s+(--\|>|\.\.>|--)\s+(.+?)(?:\s*:\s*(.*))?$/;
  var RE_ACTEUR = /^acteur\s+(?:(?:<<|«)\s*(?:actor|systeme|système)\s*(?:>>|»)\s*)?(.+)$/i;
  var RE_NON_HUMAIN = /^acteur\s+(?:<<|«)/i;
  // Mots sans poids dans le nom d'un cas : « Retirer de l'argent » et « Retirer argent » sont voisins
  var VIDES = new Set(["le", "la", "les", "l", "de", "des", "du", "d", "un", "une", "au", "aux", "a", "en", "son", "sa", "ses", "avec", "par", "pour", "et"]);

  function genreRelation(etiquette) {
    var t = N.sansAccents(String(etiquette || "")).toLowerCase().replace(/[<>«»\s]/g, "");
    if (/^(include|inclut|inclure|inclusion)$/.test(t)) return "include";
    if (/^(extend|etend|etendre|extension)$/.test(t)) return "extend";
    return null;
  }

  function lire(texte) {
    var erreurs = [], m = { systeme: "", acteurs: [], cas: [], liens: [] }, relations = [];
    function trouver(nom) { return m.acteurs.find(function (x) { return x.nom === nom; }) || m.cas.find(function (x) { return x.nom === nom; }); }
    function ajouterCas(nom) { if (!trouver(nom)) m.cas.push({ nom: nom }); }
    S.lignes(texte).forEach(function (l) {
      var t = l.texte, x;
      // La relation d'abord : un acteur peut s'appeler « Système d'autorisation »
      if ((x = t.match(RE_LIEN))) { relations.push({ l: l, x: x }); return; }
      if ((x = t.match(/^(?:systeme|système)\s+(.+)$/i))) { m.systeme = x[1].trim(); return; }
      if ((x = t.match(RE_ACTEUR))) {
        var nom = x[1].trim();
        if (m.cas.some(function (c) { return c.nom === nom; })) { erreurs.push(S.erreur(l.num, "« " + nom + " » est déjà un cas d'utilisation.")); return; }
        var v = m.acteurs.find(function (a) { return a.nom === nom; });
        if (!v) m.acteurs.push({ nom: nom, genre: RE_NON_HUMAIN.test(t) ? "systeme" : "humain" });
        return;
      }
      if ((x = t.match(/^cas\s+(.+)$/i))) {
        var c = x[1].trim();
        if (m.acteurs.some(function (a) { return a.nom === c; })) { erreurs.push(S.erreur(l.num, "« " + c + " » est déjà un acteur.")); return; }
        ajouterCas(c);
        return;
      }
      erreurs.push(S.erreur(l.num, "Ligne illisible : « " + t + " ». Exemples : acteur Client   cas Payer   Client -- Payer   A ..> B : include"));
    });
    // Les relations après les déclarations : on peut relier avant de déclarer
    relations.forEach(function (r) {
      var a = r.x[1].trim(), op = r.x[2], b = r.x[3].trim(), et = (r.x[4] || "").trim(), type;
      if (op === "--") type = "association";
      else if (op === "--|>") type = "generalisation";
      else {
        type = genreRelation(et);
        if (!type) { erreurs.push(S.erreur(r.l.num, "« ..> » s'écrit avec include ou extend : « " + a + " ..> " + b + " : include »."));
          return; }
        et = "";
      }
      ajouterCas(a); ajouterCas(b);
      var inverse = type === "association" && !m.acteurs.some(function (x) { return x.nom === a; }) && m.acteurs.some(function (x) { return x.nom === b; });
      m.liens.push({ type: type, a: inverse ? b : a, b: inverse ? a : b, etiquette: et });
    });
    return { modele: m, erreurs: erreurs };
  }

  function ecrire(m) {
    if (!m) return "";
    var t = [];
    if (m.systeme) t.push("systeme " + m.systeme);
    m.acteurs.forEach(function (a) { t.push("acteur " + (a.genre === "systeme" ? "<<actor>> " : "") + a.nom); });
    m.cas.forEach(function (c) { t.push("cas " + c.nom); });
    m.liens.forEach(function (l) {
      if (l.type === "association") t.push(l.a + " -- " + l.b + (l.etiquette ? " : " + l.etiquette : ""));
      else if (l.type === "generalisation") t.push(l.a + " --|> " + l.b);
      else t.push(l.a + " ..> " + l.b + " : " + l.type);
    });
    return t.join("\n");
  }

  function fusionner(nouveau, ancien) {
    if (!ancien) return nouveau;
    function reporter(liste, ancienne) {
      liste.forEach(function (n) {
        var v = ancienne.find(function (x) { return x.nom === n.nom; });
        if (v) { n.x = v.x; n.y = v.y; }
      });
    }
    reporter(nouveau.acteurs, ancien.acteurs);
    reporter(nouveau.cas, ancien.cas);
    return nouveau;
  }

  /* Contrôles ----------------------------------------------------------------------- */

  function cible(l) { return l.a + "--" + l.b; }

  function controler(m) {
    if (!m || !(m.acteurs.length + m.cas.length)) return [msg("info", "Le diagramme est vide pour l'instant.")];
    var res = [], relies = new Set(), paires = {};
    function estActeur(nom) { return m.acteurs.some(function (a) { return a.nom === nom; }); }
    if (!m.acteurs.length) res.push(msg("attention", "Aucun acteur : qui utilise le système ?"));
    if (!m.cas.length) res.push(msg("attention", "Aucun cas d'utilisation : que fait le système pour ses acteurs ?"));
    m.liens.forEach(function (l) {
      relies.add(l.a); relies.add(l.b);
      var acteurA = estActeur(l.a), acteurB = estActeur(l.b), k = [l.a, l.b].sort().join("~");
      if (l.a === l.b) res.push(msg("erreur", "« " + l.a + " » est relié à lui-même.", l.a));
      else if (l.type === "association") {
        if (acteurA && acteurB) res.push(msg("erreur", "Une association relie un acteur à un cas d'utilisation : « " + l.a + " » et « " + l.b + " » sont deux acteurs.", cible(l)));
        else if (!acteurA && !acteurB) res.push(msg("erreur", "Deux cas d'utilisation se relient par include, extend ou une généralisation, pas par une association : « " + l.a + " » et « " + l.b + " ».", cible(l)));
      } else if (l.type === "generalisation") {
        if (acteurA !== acteurB) res.push(msg("erreur", "Une généralisation relie deux acteurs ou deux cas, pas un acteur et un cas : « " + l.a + " » et « " + l.b + " ».", cible(l)));
      } else if (acteurA || acteurB) res.push(msg("erreur", "« " + l.type + " » relie deux cas d'utilisation, pas un acteur : « " + l.a + " » et « " + l.b + " ».", cible(l)));
      if (paires[k]) res.push(msg("attention", "« " + l.a + " » et « " + l.b + " » sont reliés deux fois.", cible(l)));
      paires[k] = true;
    });
    m.acteurs.forEach(function (a) { if (!relies.has(a.nom)) res.push(msg("attention", "L'acteur « " + a.nom + " » n'est relié à aucun cas d'utilisation.", a.nom)); });
    m.cas.forEach(function (c) { if (!relies.has(c.nom)) res.push(msg("attention", "Le cas « " + c.nom + " » n'est relié à rien.", c.nom)); });
    // Une inclusion ne boucle pas : le cas de base exécute toujours le cas inclus
    var suivants = {};
    m.liens.forEach(function (l) { if (l.type === "include") (suivants[l.a] = suivants[l.a] || []).push(l.b); });
    function atteint(de, vers, vus) {
      return (suivants[de] || []).some(function (x) {
        if (x === vers) return true;
        if (vus.has(x)) return false;
        vus.add(x);
        return atteint(x, vers, vus);
      });
    }
    m.cas.forEach(function (c) { if (atteint(c.nom, c.nom, new Set())) res.push(msg("attention", "Les inclusions forment une boucle autour de « " + c.nom + " ».", c.nom)); });
    return res;
  }

  /* Comparaison ------------------------------------------------------------------------ */

  function motsCles(nom) {
    return N.sansAccents(String(nom)).toLowerCase().split(/[^a-z0-9]+/).filter(function (x) { return x && !VIDES.has(x); });
  }
  // Part de mots communs à deux noms de cas (Jaccard)
  function ressemblance(a, b) {
    var x = new Set(motsCles(a.nom).map(N.cle)), y = new Set(motsCles(b.nom).map(N.cle));
    if (!x.size || !y.size) return 0;
    var communs = 0;
    x.forEach(function (k) { if (y.has(k)) communs++; });
    return communs / (x.size + y.size - communs);
  }

  function comparer(m, sol) {
    if (!sol) return null;
    var nomOf = function (x) { return x.nom; };
    var acteurs = N.apparier(m.acteurs, sol.acteurs, nomOf, ressemblance);
    var cas = N.apparier(m.cas, sol.cas, nomOf, ressemblance);
    // Chaque nom de l'étudiant est remplacé par le nom apparié de la solution
    var vers = {};
    acteurs.paires.concat(cas.paires).forEach(function (p) { vers[p[0].nom] = p[1].nom; });
    function nomSol(n) { return vers[n] || n; }
    function secondaire(l) { return l.type === "association" && N.cle(l.etiquette) === "secondaire"; }
    function fait(l, nom) { return "L|" + l.type + "|" + N.cle(nom(l.a)) + "|" + N.cle(nom(l.b)) + (secondaire(l) ? "|s" : ""); }
    var fe = m.acteurs.map(function (a) { return "A|" + N.cle(nomSol(a.nom)); })
      .concat(m.cas.map(function (c) { return "C|" + N.cle(nomSol(c.nom)); }))
      .concat(m.liens.map(function (l) { return fait(l, nomSol); }));
    var fs = sol.acteurs.map(function (a) { return "A|" + N.cle(a.nom); })
      .concat(sol.cas.map(function (c) { return "C|" + N.cle(c.nom); }))
      .concat(sol.liens.map(function (l) { return fait(l, function (n) { return n; }); }));
    var st = N.f1(fe, fs), ecarts = [];
    acteurs.seulsB.forEach(function (a) { ecarts.push(ecart("manque", "Il manque l'acteur « " + a.nom + " ».")); });
    acteurs.seulsA.forEach(function (a) { ecarts.push(ecart("exces", "L'acteur « " + a.nom + " » n'apparaît pas dans la solution.", a.nom)); });
    cas.seulsB.forEach(function (c) { ecarts.push(ecart("manque", "Il manque le cas « " + c.nom + " ».")); });
    cas.seulsA.forEach(function (c) { ecarts.push(ecart("exces", "Le cas « " + c.nom + " » n'apparaît pas dans la solution.", c.nom)); });
    // Liens : même paire d'éléments mais autre nature ou autre sens, sinon manquant ou en trop
    var attendus = sol.liens.filter(function (l) { return st.manquants.indexOf(fait(l, function (n) { return n; })) >= 0; });
    var enTrop = m.liens.filter(function (l) { return st.exces.indexOf(fait(l, nomSol)) >= 0; });
    var nomLien = { association: "association", include: "include", extend: "extend", generalisation: "généralisation" };
    attendus.forEach(function (s) {
      var i = enTrop.findIndex(function (l) {
        var a = nomSol(l.a), b = nomSol(l.b);
        return (a === s.a && b === s.b) || (a === s.b && b === s.a);
      });
      if (i >= 0) {
        var l = enTrop[i];
        enTrop.splice(i, 1);
        var texte = l.type === s.type && secondaire(l) !== secondaire(s) ? "l'étiquette « secondaire » diffère"
          : l.type === s.type ? "le sens diffère" : "la solution attend « " + nomLien[s.type] + " » (" + s.a + " → " + s.b + "), pas « " + nomLien[l.type] + " »";
        ecarts.push(ecart("different", "Entre « " + l.a + " » et « " + l.b + " » : " + texte + ".", cible(l)));
      } else ecarts.push(ecart("manque", "Il manque le lien « " + nomLien[s.type] + " » entre « " + s.a + " » et « " + s.b + " »."));
    });
    enTrop.forEach(function (l) { ecarts.push(ecart("exces", "Le lien « " + nomLien[l.type] + " » entre « " + l.a + " » et « " + l.b + " » n'apparaît pas dans la solution.", cible(l))); });
    return { score: st.score, ecarts: ecarts, resume: st.score === 1 ? "Identique à la solution proposée." : Math.round(st.score * 100) + " % de concordance avec la solution · " + N.pluriel(ecarts.length, "écart") };
  }

  A.editeurs.cas = {
    nom: "cas",
    options: {},
    libelle: "Cas d'utilisation",
    description: "Diagramme de cas d'utilisation UML : systeme Nom, acteur Nom (acteur <<actor>> Nom pour un acteur non humain), cas Nom, associations A -- B (étiquette facultative : secondaire), B ..> C : include, B ..> C : extend, généralisations A --|> B.",
    aide: "<ul><li>Éléments : <code>systeme Guichet</code>, <code>acteur Client</code>, <code>acteur &lt;&lt;actor&gt;&gt; Banque</code> (non humain), <code>cas Retirer de l'argent</code>.</li>" +
      "<li>Association : <code>Client -- Retirer de l'argent</code>, ou <code>Banque -- Retirer de l'argent : secondaire</code>.</li>" +
      "<li>Entre deux cas : <code>A ..&gt; B : include</code> ou <code>A ..&gt; B : extend</code> ; généralisation : <code>A --|&gt; B</code> (aussi entre acteurs).</li></ul>",
    vide: function () { return { systeme: "", acteurs: [], cas: [], liens: [] }; },
    lire: lire,
    ecrire: ecrire,
    fusionner: fusionner,
    controler: controler,
    comparer: comparer,
    cibles: function (m) {
      var t = (m && m.acteurs || []).concat(m && m.cas || []).map(function (x) { return x.nom; });
      (m && m.liens || []).forEach(function (l) { t.push(cible(l)); });
      return t;
    },
    estVide: function (m) { return !m || !(m.acteurs.length + m.cas.length); }
  };
})(window.Atelier);
