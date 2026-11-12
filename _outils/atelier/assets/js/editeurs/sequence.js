/* ==========================================================================
   Atelier · éditeur « sequence » : diagramme de séquence UML (logique)
   --------------------------------------------------------------------------
   Syntaxe :
     acteur Client
     objet g : Guichet            (ou « objet :Guichet », « participant X »)
     Client -> g : retirer(50)    message synchrone
     g ->> journal : noter()      message asynchrone
     g --> Client : billets       retour
     g -> g : verifier()          message à soi-même
     alt solde suffisant          fragments : alt / sinon, boucle, opt,
       g -> c : debiter(50)       fermés par « fin »
     sinon
       g --> Client : refus
     fin
   Un participant utilisé sans être déclaré est ajouté comme objet.
   ========================================================================== */
(function (A) {
  "use strict";

  var N = A.noyau, S = A.syntaxe, msg = N.message, ecart = N.ecart;
  var PART = "[A-Za-zÀ-ÖØ-öø-ÿ0-9_'·]+";
  var RE_MSG = new RegExp("^(" + PART + ")\\s*(->>|-->|->)\\s*(" + PART + ")\\s*(?::\\s*(.*))?$");
  var FRAGMENTS = { alt: "alt", alternative: "alt", boucle: "boucle", loop: "boucle", opt: "opt", option: "opt", par: "par" };

  function lire(texte) {
    var erreurs = [], participants = [], racine = [], pile = [{ elements: racine, fragment: null }];
    function participant(nom, genre, classe) {
      var p = participants.find(function (x) { return x.nom === nom; });
      if (!p) { p = { nom: nom, genre: genre || "objet", classe: classe || "" }; participants.push(p); }
      else if (genre) { p.genre = genre; if (classe) p.classe = classe; }
      return p;
    }
    function courant() { return pile[pile.length - 1].elements; }
    S.lignes(texte).forEach(function (l) {
      var t = l.texte, x;
      if ((x = t.match(/^acteur\s+(.+)$/i))) { participant(x[1].trim(), "acteur"); return; }
      if ((x = t.match(/^(objet|participant)\s+(.+)$/i))) {
        var p = x[2].trim(), i = p.indexOf(":");
        var nom = i >= 0 ? p.slice(0, i).trim() : p, classe = i >= 0 ? p.slice(i + 1).trim() : "";
        if (!nom) nom = ":" + classe;
        participant(nom, "objet", classe);
        return;
      }
      if ((x = t.match(/^(alt|alternative|boucle|loop|opt|option|par)\b\s*(.*)$/i))) {
        var f = { type: "fragment", genre: FRAGMENTS[x[1].toLowerCase()], sections: [{ garde: x[2].trim(), elements: [] }], ligne: l.num };
        courant().push(f);
        pile.push({ elements: f.sections[0].elements, fragment: f });
        return;
      }
      if ((x = t.match(/^(sinon|else)\b\s*(.*)$/i))) {
        var haut = pile[pile.length - 1];
        if (!haut.fragment || haut.fragment.genre !== "alt" && haut.fragment.genre !== "par") { erreurs.push(S.erreur(l.num, "« sinon » hors d'un fragment alt.")); return; }
        var s = { garde: x[2].trim(), elements: [] };
        haut.fragment.sections.push(s);
        haut.elements = s.elements;
        return;
      }
      if (/^(fin|end)$/i.test(t)) {
        if (pile.length === 1) erreurs.push(S.erreur(l.num, "« fin » sans fragment ouvert."));
        else pile.pop();
        return;
      }
      if ((x = t.match(RE_MSG))) {
        participant(x[1]); participant(x[3]);
        courant().push({ type: "message", de: x[1], vers: x[3], genre: x[2] === "-->" ? "retour" : x[2] === "->>" ? "asynchrone" : "synchrone", texte: (x[4] || "").trim(), ligne: l.num });
        return;
      }
      erreurs.push(S.erreur(l.num, "Ligne illisible : « " + t + " ». Exemple : Client -> g : retirer(50)"));
    });
    if (pile.length > 1) erreurs.push({ ligne: pile[pile.length - 1].fragment.ligne, message: "Fragment « " + pile[pile.length - 1].fragment.genre + " » non fermé : ajouter « fin »." });
    return { modele: { participants: participants, elements: racine }, erreurs: erreurs };
  }

  function ecrire(m) {
    if (!m) return "";
    var t = [];
    m.participants.forEach(function (p) {
      t.push(p.genre === "acteur" ? "acteur " + p.nom : "objet " + p.nom + (p.classe ? " : " + p.classe : ""));
    });
    (function elements(liste, niveau) {
      var r = "  ".repeat(niveau);
      liste.forEach(function (e) {
        if (e.type === "message") {
          t.push(r + e.de + " " + (e.genre === "retour" ? "-->" : e.genre === "asynchrone" ? "->>" : "->") + " " + e.vers + (e.texte ? " : " + e.texte : ""));
        } else {
          e.sections.forEach(function (s, i) {
            t.push(r + (i === 0 ? e.genre : "sinon") + (s.garde ? " " + s.garde : ""));
            elements(s.elements, niveau + 1);
          });
          t.push(r + "fin");
        }
      });
    })(m.elements, 0);
    return t.join("\n");
  }

  // Liste à plat des messages, dans l'ordre (fragments compris)
  function messages(m) {
    var res = [];
    (function parcourir(liste) {
      liste.forEach(function (e) {
        if (e.type === "message") res.push(e);
        else e.sections.forEach(function (s) { parcourir(s.elements); });
      });
    })(m.elements);
    return res;
  }

  function controler(m) {
    if (!m || !m.participants.length) return [msg("info", "Le diagramme est vide pour l'instant.")];
    var res = [], appels = {};
    messages(m).forEach(function (e, i) {
      var k = e.de + ">" + e.vers;
      if (e.genre === "synchrone" && e.de !== e.vers) appels[e.vers + ">" + e.de] = (appels[e.vers + ">" + e.de] || 0) + 1;
      if (e.genre === "retour") {
        if (!appels[k]) res.push(msg("info", "Retour « " + e.de + " → " + e.vers + " » sans appel préalable de « " + e.vers + " » vers « " + e.de + " ».", "message " + (i + 1)));
        else appels[k]--;
      }
      if (!e.texte && e.genre !== "retour") res.push(msg("attention", "Le message " + (i + 1) + " (" + e.de + " → " + e.vers + ") n'a pas de nom.", "message " + (i + 1)));
    });
    return res;
  }

  function cleMessage(e) {
    var texte = N.cle(String(e.texte || "").replace(/\(.*\)/, ""));
    return N.cle(e.de) + ">" + N.cle(e.vers) + ":" + (e.genre === "retour" ? "r" : "") + texte;
  }
  // Plus longue sous-suite commune
  function lcs(a, b) {
    var t = [];
    for (var i = 0; i <= a.length; i++) { t.push([]); for (var j = 0; j <= b.length; j++) t[i].push(0); }
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) {
      t[i][j] = a[i - 1] === b[j - 1] ? t[i - 1][j - 1] + 1 : Math.max(t[i - 1][j], t[i][j - 1]);
    }
    var commun = [];
    i = a.length; j = b.length;
    while (i && j) {
      if (a[i - 1] === b[j - 1]) { commun.unshift([i - 1, j - 1]); i--; j--; }
      else if (t[i - 1][j] >= t[i][j - 1]) i--; else j--;
    }
    return commun;
  }

  function comparer(m, sol) {
    if (!sol) return null;
    var ecarts = [];
    var p = N.f1(m.participants.map(function (x) { return N.cle(x.nom); }), sol.participants.map(function (x) { return N.cle(x.nom); }));
    p.manquants.forEach(function (k) { var x = sol.participants.find(function (y) { return N.cle(y.nom) === k; }); ecarts.push(ecart("manque", "Il manque le participant « " + x.nom + " ».")); });
    p.exces.forEach(function (k) { var x = m.participants.find(function (y) { return N.cle(y.nom) === k; }); ecarts.push(ecart("exces", "Le participant « " + x.nom + " » n'apparaît pas dans la solution.", x.nom)); });
    var me = messages(m), ms = messages(sol);
    var commun = lcs(me.map(cleMessage), ms.map(cleMessage));
    var vusE = new Set(commun.map(function (c) { return c[0]; })), vusS = new Set(commun.map(function (c) { return c[1]; }));
    ms.forEach(function (e, j) { if (!vusS.has(j)) ecarts.push(ecart("manque", "Message attendu en position " + (j + 1) + " : " + e.de + " → " + e.vers + (e.texte ? " : " + e.texte : "") + ".")); });
    me.forEach(function (e, i) { if (!vusE.has(i)) ecarts.push(ecart("exces", "Le message " + (i + 1) + " (" + e.de + " → " + e.vers + (e.texte ? " : " + e.texte : "") + ") n'est pas à cette place dans la solution.", "message " + (i + 1))); });
    var sm = ms.length || me.length ? 2 * commun.length / (me.length + ms.length) : 1;
    var score = (p.score + 2 * sm) / 3;
    return { score: score, ecarts: ecarts, resume: score === 1 ? "Identique à la solution proposée." : Math.round(score * 100) + " % de concordance avec la solution · " + N.pluriel(ecarts.length, "écart") };
  }

  A.editeurs.sequence = {
    nom: "sequence",
    options: {},
    libelle: "Diagramme de séquence",
    description: "Diagramme de séquence UML : participants (acteur, objet nom : Classe), messages A -> B : m() (synchrone), ->> (asynchrone), --> (retour), fragments alt/sinon, boucle, opt fermés par fin.",
    aide: "<ul><li>Participants : <code>acteur Client</code>, <code>objet g : Guichet</code>.</li>" +
      "<li>Messages : <code>Client -&gt; g : retirer(50)</code> (synchrone), <code>-&gt;&gt;</code> (asynchrone), <code>g --&gt; Client : billets</code> (retour).</li>" +
      "<li>Fragments : <code>alt condition</code> … <code>sinon</code> … <code>fin</code> ; aussi <code>boucle</code> et <code>opt</code>.</li></ul>",
    vide: function () { return { participants: [], elements: [] }; },
    lire: lire,
    ecrire: ecrire,
    controler: controler,
    comparer: comparer,
    messages: messages,
    cibles: function (m) {
      var t = (m && m.participants || []).map(function (p) { return p.nom; });
      if (m) messages(m).forEach(function (_, i) { t.push("message " + (i + 1)); });
      return t;
    },
    estVide: function (m) { return !m || !m.participants.length; }
  };
})(window.Atelier);
