/* ==========================================================================
   Quiz · code exécutable (QuizApp.code et type « code »)
   --------------------------------------------------------------------------
   - editeur() : zone de saisie de code avec coloration (highlight.js),
     numéros de ligne, indentation automatique, Ctrl+Entrée pour exécuter ;
   - afficherResultat() : tableaux SQL, sorties d'un programme, erreurs ;
   - type de question « code » : l'étudiant écrit du SQL, du Python, du
     JavaScript ou du C ; la correction exécute sa réponse sur le serveur
     local et la compare à la solution (SQL) ou à des tests (programmes) ;
   - activerExtraits() : bouton « Exécuter » sur les blocs
     <pre data-executer="sql" data-jeu="emp"> des énoncés et explications.
   ========================================================================== */
(function (A) {
  "use strict";

  var O = A.outils, el = O.el, html = O.html;
  var NOMS = { sql: "SQL", python: "Python", javascript: "JavaScript", c: "C", "c-posix": "C POSIX" };
  var LANGUE_HLJS = { sql: "sql", python: "python", javascript: "javascript", c: "c", "c-posix": "c" };

  /* Éditeur ----------------------------------------------------------------- */

  function editeur(parent, options) {
    options = options || {};
    // options.hljs : nom d'une langue highlight.js enregistrée ailleurs (syntaxes de l'atelier)
    var langue = options.hljs || LANGUE_HLJS[options.langage] || "plaintext";
    var boite = el("div", "editeur");
    var gouttiere = el("div", "editeur-lignes");
    gouttiere.setAttribute("aria-hidden", "true");
    var cadre = el("div", "editeur-cadre");
    var rendu = el("pre", "editeur-rendu");
    rendu.setAttribute("aria-hidden", "true");
    var codeRendu = el("code", "hljs language-" + langue);
    rendu.appendChild(codeRendu);
    var saisie = el("textarea", "editeur-saisie");
    saisie.spellcheck = false;
    saisie.setAttribute("autocapitalize", "off");
    saisie.setAttribute("autocomplete", "off");
    saisie.setAttribute("wrap", "off");
    saisie.setAttribute("aria-label", options.libelle || ("Code " + (NOMS[options.langage] || "")));
    saisie.value = options.valeur || "";
    cadre.appendChild(rendu);
    cadre.appendChild(saisie);
    boite.appendChild(gouttiere);
    boite.appendChild(cadre);
    parent.appendChild(boite);

    function peindre() {
      var v = saisie.value;
      var h = window.hljs;
      if (h && h.getLanguage(langue)) {
        try { codeRendu.innerHTML = h.highlight(v, { language: langue, ignoreIllegals: true }).value + "\n"; }
        catch (e) { codeRendu.textContent = v + "\n"; }
      } else {
        codeRendu.textContent = v + "\n";
      }
      var n = v.split("\n").length;
      if (gouttiere.childElementCount !== n) {
        var t = [];
        for (var i = 1; i <= n; i++) t.push(i);
        gouttiere.textContent = t.join("\n");
      }
      boite.style.setProperty("--lignes", String(Math.min(26, Math.max(options.lignes || 5, n + 1))));
      synchroniser();
    }
    function synchroniser() {
      rendu.scrollTop = saisie.scrollTop;
      rendu.scrollLeft = saisie.scrollLeft;
      gouttiere.scrollTop = saisie.scrollTop;
    }
    function inserer(texte) {
      // execCommand garde l'historique d'annulation (Ctrl+Z) ; setRangeText sinon
      if (!document.execCommand || !document.execCommand("insertText", false, texte)) {
        saisie.setRangeText(texte, saisie.selectionStart, saisie.selectionEnd, "end");
        peindre();
      }
    }
    function debutLigne(pos) { return saisie.value.lastIndexOf("\n", pos - 1) + 1; }

    saisie.addEventListener("input", peindre);
    saisie.addEventListener("scroll", synchroniser);
    saisie.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        if (options.surExecuter) options.surExecuter();
        return;
      }
      if (e.key === "Tab" && !e.ctrlKey && !e.altKey) {
        var d = saisie.selectionStart, f = saisie.selectionEnd, v = saisie.value;
        if (d === f && !e.shiftKey) { e.preventDefault(); inserer("    "); return; }
        e.preventDefault();
        var debut = debutLigne(d), bloc = v.slice(debut, f);
        var nouveau = e.shiftKey ? bloc.replace(/^( {1,4}|\t)/gm, "") : bloc.replace(/^/gm, "    ");
        saisie.setSelectionRange(debut, f);
        inserer(nouveau);
        saisie.setSelectionRange(debut, debut + nouveau.length);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        var p = saisie.selectionStart, ligne = saisie.value.slice(debutLigne(p), p);
        var retrait = (ligne.match(/^[ \t]*/) || [""])[0];
        if (/[:{(\[]\s*$/.test(ligne)) retrait += "    ";
        e.preventDefault();
        inserer("\n" + retrait);
      }
    });
    peindre();
    if (options.lectureSeule) saisie.readOnly = true;

    return {
      boite: boite,
      valeur: function () { return saisie.value; },
      definir: function (v) { saisie.value = v; peindre(); },
      focus: function () { saisie.focus(); },
      desactiver: function (oui) { saisie.readOnly = oui !== false; boite.classList.toggle("verrou", oui !== false); },
      saisie: saisie
    };
  }

  /* Affichage des résultats d'exécution ------------------------------------------- */

  function tableSql(r, titre) {
    var bloc = el("div", "sortie-sql");
    if (titre) bloc.appendChild(el("p", "sortie-titre", titre));
    if (r.erreur) { bloc.appendChild(el("pre", "brut sortie-erreur", r.erreur)); return bloc; }
    if (r.message) { bloc.appendChild(el("p", "sortie-message", r.message)); return bloc; }
    var cadre = el("div", "tableau compact mono sortie-table");
    var t = el("table"), tete = el("thead"), tr = el("tr");
    r.colonnes.forEach(function (c) { tr.appendChild(el("th", null, c)); });
    tete.appendChild(tr);
    t.appendChild(tete);
    var corps = el("tbody");
    r.lignes.forEach(function (l) {
      var ligne = el("tr");
      l.forEach(function (v) { ligne.appendChild(v === null ? el("td", "nul", "NULL") : el("td", null, v)); });
      corps.appendChild(ligne);
    });
    t.appendChild(corps);
    cadre.appendChild(t);
    bloc.appendChild(cadre);
    bloc.appendChild(el("p", "sortie-message", r.total + " ligne" + (r.total > 1 ? "s" : "") + (r.total > r.lignes.length ? " (les " + r.lignes.length + " premières sont affichées)" : "")));
    return bloc;
  }

  function sortieProgramme(x, titre) {
    var bloc = el("div", "sortie-programme");
    if (titre) bloc.appendChild(el("p", "sortie-titre", titre));
    bloc.appendChild(el("pre", "brut sortie-texte", x.sortie || "(aucune sortie)"));
    if (x.erreur) bloc.appendChild(el("pre", "brut sortie-erreur", x.erreur));
    bloc.appendChild(el("p", "sortie-message", "Code de sortie " + x.code + " · " + x.duree + " ms"));
    return bloc;
  }

  function afficherResultat(zone, langage, r) {
    zone.innerHTML = "";
    zone.hidden = false;
    if (r.erreur && !r.compilation) { zone.appendChild(el("pre", "brut sortie-erreur", r.erreur)); return; }
    if (r.compilation) {
      zone.appendChild(el("p", "sortie-titre", "Erreurs de compilation"));
      zone.appendChild(el("pre", "brut sortie-erreur", r.compilation));
      return;
    }
    if (langage === "sql") {
      (r.resultats || []).forEach(function (x) { zone.appendChild(tableSql(x)); });
    } else {
      if (r.avertissements) zone.appendChild(el("pre", "brut sortie-avertissement", r.avertissements));
      (r.executions || []).forEach(function (x, i) {
        zone.appendChild(sortieProgramme(x, r.executions.length > 1 ? "Exécution " + (i + 1) : null));
      });
    }
  }

  function messageHorsLigne() {
    return A.connexion.enLigne
      ? "Ce langage n'est pas disponible sur le serveur local."
      : "Pour exécuter le code, ouvrir ce quiz depuis le serveur local (lancer studies/lancer.bat).";
  }

  function scriptJeu(nom) {
    var j = nom && A.donnees && A.donnees.jeux && A.donnees.jeux[nom];
    return j ? j.script : "";
  }

  // Exécution interactive : code saisi, sortie affichée sous l'éditeur
  function lancer(langage, code, jeu, sortie, bouton) {
    if (!A.connexion.executable(langage)) {
      sortie.hidden = false;
      sortie.innerHTML = "";
      sortie.appendChild(el("p", "sortie-message", messageHorsLigne()));
      return Promise.resolve(null);
    }
    if (bouton) bouton.disabled = true;
    sortie.hidden = false;
    sortie.innerHTML = "";
    sortie.appendChild(el("p", "sortie-message attente", "Exécution…"));
    return A.connexion.executer({ langage: langage, code: code, jeu: jeu }).then(function (r) {
      afficherResultat(sortie, langage, r);
      return r;
    }).catch(function (e) {
      sortie.innerHTML = "";
      sortie.appendChild(el("pre", "brut sortie-erreur", e.message));
      return null;
    }).finally(function () { if (bouton) bouton.disabled = false; });
  }

  /* Comparaison des résultats --------------------------------------------------------- */

  function valeurNormale(v) {
    if (v === null || v === undefined) return "∅";
    var s = String(v).trim();
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s)) return String(Math.round(Number(s) * 1e6) / 1e6);
    return s;
  }

  function comparerSql(obtenu, attendu, q) {
    if (obtenu.erreur) return { ok: false, message: "Votre requête provoque une erreur." };
    if (!obtenu.colonnes) return { ok: false, message: "Votre requête ne renvoie pas de lignes." };
    if (attendu.erreur) return { ok: false, message: "La solution du quiz provoque une erreur : " + attendu.erreur };
    if (obtenu.colonnes.length !== attendu.colonnes.length) {
      return { ok: false, message: "Votre requête renvoie " + obtenu.colonnes.length + " colonne(s), " + attendu.colonnes.length + " attendue(s)." };
    }
    if (q.colonnes === true) {
      var noms = function (r) { return r.colonnes.map(function (c) { return c.toLowerCase(); }).join(","); };
      if (noms(obtenu) !== noms(attendu)) return { ok: false, message: "Les colonnes n'ont pas les noms attendus (" + attendu.colonnes.join(", ") + ")." };
    }
    if (obtenu.total !== attendu.total) {
      return { ok: false, message: "Votre requête renvoie " + obtenu.total + " ligne(s), " + attendu.total + " attendue(s)." };
    }
    var cle = function (l) { return JSON.stringify(l.map(valeurNormale)); };
    var a = obtenu.lignes.map(cle), b = attendu.lignes.map(cle);
    if (!q.ordre) { a.sort(); b.sort(); }
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return { ok: false, message: q.ordre ? "Les lignes ne sont pas les bonnes, ou pas dans le bon ordre." : "Les lignes renvoyées ne sont pas celles attendues." };
    }
    return { ok: true, message: "Votre requête renvoie exactement le résultat attendu" + (q.ordre ? ", dans le bon ordre." : ".") };
  }

  function sortieNormale(t) {
    return String(t || "").split("\n").map(function (l) { return l.replace(/\s+$/, ""); }).join("\n").replace(/\n+$/, "");
  }

  function tests(q) {
    if (Array.isArray(q.tests) && q.tests.length) return q.tests;
    if (q.sortie != null) return [{ entree: q.entree || "", sortie: q.sortie }];
    return [];
  }

  /* Type de question « code » ----------------------------------------------------------- */

  function zoneJeu(q) {
    var j = q.jeu && A.donnees && A.donnees.jeux && A.donnees.jeux[q.jeu];
    if (!j) return null;
    var d = el("details", "jeu-donnees");
    d.appendChild(el("summary", null, "Données : " + (j.titre || q.jeu)));
    if (j.description) d.appendChild(html("div", "jeu-description", j.description));
    var p = el("pre");
    var c = el("code", "language-sql");
    c.textContent = j.script;
    p.appendChild(c);
    var voir = el("details", "jeu-script");
    voir.appendChild(el("summary", null, "Script SQL de création"));
    voir.appendChild(p);
    d.appendChild(voir);
    return d;
  }

  A.types.code = {
    consigne: function (q) {
      var n = tests(q).length;
      if (q.langage === "sql") return "Écrire la requête, la tester avec « Exécuter » (Ctrl+Entrée), puis valider : elle est comparée au résultat attendu.";
      return "Écrire le programme en " + (NOMS[q.langage] || q.langage) + ", le tester avec « Exécuter » (Ctrl+Entrée), puis valider" +
        (n ? " : il sera vérifié sur " + n + " test" + (n > 1 ? "s" : "") + "." : ".");
    },
    rendre: function (q, zone, etat, ancienne) {
      var jeu = zoneJeu(q);
      if (jeu) zone.appendChild(jeu);
      var ed = editeur(zone, {
        langage: q.langage,
        valeur: ancienne != null ? ancienne : (q.depart || ""),
        lignes: q.lignes || (q.langage === "sql" ? 5 : 9),
        surExecuter: function () { executer(); }
      });
      var barre = el("div", "code-barre");
      var b = O.bouton("Exécuter", "petit", function () { executer(); }, "executer");
      barre.appendChild(b);
      barre.appendChild(el("span", "code-aide", A.connexion.executable(q.langage) ? "Ctrl+Entrée" : messageHorsLigne()));
      zone.appendChild(barre);
      var sortie = el("div", "code-sortie");
      sortie.hidden = true;
      sortie.setAttribute("aria-live", "polite");
      zone.appendChild(sortie);
      function executer() {
        etat.executions = (etat.executions || 0) + 1;
        var code = ed.valeur();
        if (q.harnais && q.langage !== "sql") code += "\n" + q.harnais;
        lancer(q.langage, code, scriptJeu(q.jeu), sortie, b);
        zone.dispatchEvent(new Event("change", { bubbles: true }));
      }
      return {
        lire: function () { var v = ed.valeur(); return v.trim() ? v : null; },
        verrouiller: function () { ed.desactiver(true); b.disabled = true; },
        corriger: function () { /* le rapport de correction s'affiche dans le retour */ },
        focus: ed.saisie
      };
    },
    // Correction : exécute la réponse ; renvoie { score, rapport } (score null : auto-évaluation)
    evaluer: function (q, v) {
      if (v == null) return Promise.resolve({ score: 0, rapport: null });
      if (!A.connexion.executable(q.langage)) return Promise.resolve({ score: null, rapport: { type: "indisponible", message: messageHorsLigne() } });
      if (q.langage === "sql") {
        if (!q.solution) return Promise.resolve({ score: null, rapport: { type: "indisponible", message: "Pas de solution de référence : comparer soi-même." } });
        return A.connexion.executer({ langage: "sql", jeu: scriptJeu(q.jeu), requetes: [v, q.solution] }).then(function (r) {
          if (r.erreur) return { score: null, rapport: { type: "indisponible", message: r.erreur } };
          var c = comparerSql(r.resultats[0], r.resultats[1], q);
          return { score: c.ok ? 1 : 0, rapport: { type: "sql", message: c.message, obtenu: r.resultats[0], attendu: r.resultats[1] } };
        });
      }
      var liste = tests(q);
      if (!liste.length) return Promise.resolve({ score: null, rapport: { type: "indisponible", message: "Ce quiz ne fournit pas de test : comparer à la solution." } });
      var code = v + (q.harnais ? "\n" + q.harnais : "");
      return A.connexion.executer({ langage: q.langage, code: code, entrees: liste.map(function (t) { return t.entree || ""; }) }).then(function (r) {
        if (r.compilation) return { score: 0, rapport: { type: "tests", compilation: r.compilation, tests: [] } };
        if (r.erreur) return { score: null, rapport: { type: "indisponible", message: r.erreur } };
        var res = liste.map(function (t, i) {
          var x = r.executions[i] || {};
          var ok = sortieNormale(x.sortie) === sortieNormale(t.sortie);
          return { nom: t.nom || "Test " + (i + 1), entree: t.entree || "", attendu: t.sortie, obtenu: x.sortie || "", erreur: x.erreur || "", ok: ok };
        });
        var passes = res.filter(function (x) { return x.ok; }).length;
        return { score: passes / res.length, rapport: { type: "tests", tests: res, message: passes + " test" + (passes > 1 ? "s" : "") + " réussi" + (passes > 1 ? "s" : "") + " sur " + res.length + "." } };
      });
    },
    noter: function () { return null; },
    resume: function (q, v) {
      if (v == null) return null;
      var c = el("code", "language-" + (LANGUE_HLJS[q.langage] || "plaintext"));
      c.textContent = v;
      return "<pre>" + c.outerHTML + "</pre>";
    },
    solution: function (q) {
      if (!q.solution) return "<em>Pas de solution de référence.</em>";
      var c = el("code", "language-" + (LANGUE_HLJS[q.langage] || "plaintext"));
      c.textContent = q.solution;
      return "<pre>" + c.outerHTML + "</pre>";
    },
    resumeTexte: function (q, v) { return v == null ? null : "```" + q.langage + "\n" + v + "\n```"; },
    details: function (q) {
      var t = "Question de code en " + (NOMS[q.langage] || q.langage) + ".";
      var j = q.jeu && A.donnees && A.donnees.jeux && A.donnees.jeux[q.jeu];
      if (j) t += "\nJeu de données « " + q.jeu + " » :\n```sql\n" + j.script.slice(0, 3000) + "\n```";
      if (q.depart) t += "\nCode de départ :\n```" + q.langage + "\n" + q.depart + "\n```";
      var l = tests(q);
      if (l.length) t += "\nTests (entrée → sortie attendue) :\n" + l.map(function (x) { return "- " + JSON.stringify(x.entree || "") + " → " + JSON.stringify(x.sortie); }).join("\n");
      if (q.harnais) t += "\nCode ajouté après celui de l'étudiant pour les tests :\n```" + q.langage + "\n" + q.harnais + "\n```";
      return t;
    }
  };

  // Rapport de correction d'une question de code, affiché dans le retour et la revue
  function rapport(r) {
    var bloc = el("div", "code-rapport");
    if (!r) return bloc;
    // Rapports d'autres types de questions (A.rapports[type], par exemple l'atelier)
    if (A.rapports && A.rapports[r.type]) { bloc.appendChild(A.rapports[r.type](r)); return bloc; }
    if (r.message) bloc.appendChild(el("p", "code-rapport-message", r.message));
    if (r.type === "sql") {
      var cols = el("div", "colonnes");
      cols.appendChild(tableSql(r.obtenu, "Votre résultat"));
      cols.appendChild(tableSql(r.attendu, "Résultat attendu"));
      bloc.appendChild(cols);
    } else if (r.type === "tests") {
      if (r.compilation) {
        bloc.appendChild(el("p", "sortie-titre", "Erreurs de compilation"));
        bloc.appendChild(el("pre", "brut sortie-erreur", r.compilation));
      }
      (r.tests || []).forEach(function (t) {
        var d = el("details", "test-resultat " + (t.ok ? "juste" : "faux"));
        if (!t.ok) d.open = true;
        d.appendChild(el("summary", null, (t.ok ? "✓ " : "✗ ") + t.nom));
        var g = el("div", "test-detail");
        if (t.entree) { g.appendChild(el("p", "sortie-titre", "Entrée")); g.appendChild(el("pre", "brut sortie-texte", t.entree)); }
        g.appendChild(el("p", "sortie-titre", "Sortie attendue"));
        g.appendChild(el("pre", "brut sortie-texte", t.attendu));
        g.appendChild(el("p", "sortie-titre", "Votre sortie"));
        g.appendChild(el("pre", "brut sortie-texte", t.obtenu || "(aucune sortie)"));
        if (t.erreur) g.appendChild(el("pre", "brut sortie-erreur", t.erreur));
        d.appendChild(g);
        bloc.appendChild(d);
      });
    }
    return bloc;
  }

  /* Extraits exécutables dans les énoncés --------------------------------------------- */

  function activerExtraits(zone) {
    zone.querySelectorAll("pre[data-executer]").forEach(function (pre) {
      var figure = pre.closest("figure.code") || pre;
      if (figure.dataset.executable) return;
      figure.dataset.executable = "1";
      var langage = pre.dataset.executer;
      var legende = figure.querySelector("figcaption");
      var b = O.bouton("Essayer", "bouton-essayer", null, "executer");
      if (legende) legende.insertBefore(b, legende.lastChild);
      else figure.insertAdjacentElement("afterend", b);
      var atelier = null;
      b.addEventListener("click", function () {
        if (atelier) { atelier.hidden = !atelier.hidden; return; }
        atelier = el("div", "atelier-code");
        var ed = editeur(atelier, { langage: langage, valeur: pre.textContent.replace(/\n$/, ""), surExecuter: go });
        var barre = el("div", "code-barre");
        var run = O.bouton("Exécuter", "petit", go, "executer");
        barre.appendChild(run);
        barre.appendChild(el("span", "code-aide", "Modifier le code puis l'exécuter · Ctrl+Entrée"));
        atelier.appendChild(barre);
        var sortie = el("div", "code-sortie");
        sortie.hidden = true;
        atelier.appendChild(sortie);
        figure.insertAdjacentElement("afterend", atelier);
        function go() { lancer(langage, ed.valeur(), scriptJeu(pre.dataset.jeu), sortie, run); }
        go();
      });
    });
  }

  A.code = { editeur: editeur, afficherResultat: afficherResultat, rapport: rapport, activerExtraits: activerExtraits, tableSql: tableSql, NOMS: NOMS };
})(window.QuizApp);
