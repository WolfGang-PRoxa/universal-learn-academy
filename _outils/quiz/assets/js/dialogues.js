/* ==========================================================================
   Quiz · boîtes de dialogue (QuizApp.dialogues)
   --------------------------------------------------------------------------
   ouvrir()      boîte générique (<dialog>)
   confirmer()   question à plusieurs réponses, renvoie une promesse
   reglages()    modèle et effort de Claude pour chaque usage, chemin de
                 Claude Code, langages disponibles, quota de l'abonnement
   generer()     génération d'un nouveau quiz par Claude Code, puis suivi
   serveur()     explications quand le serveur local n'est pas lancé
   ========================================================================== */
(function (A) {
  "use strict";

  var O = A.outils, el = O.el, html = O.html;

  A.LIBELLES_TYPES = {
    "qcm": "QCM (une réponse)", "qcm-multi": "QCM (plusieurs réponses)", "vrai-faux": "Vrai ou faux",
    "reponse-courte": "Réponse courte", "numerique": "Réponse numérique", "trous": "Texte ou code à trous",
    "association": "Association", "ordre": "Remise en ordre", "ouverte": "Question ouverte (rédaction)",
    "code": "Écriture de code (exécuté)", "atelier": "Atelier (diagramme, schéma, table…)"
  };

  /* Boîte générique ----------------------------------------------------------------- */

  function ouvrir(o) {
    var d = el("dialog", "dialogue" + (o.classe ? " " + o.classe : ""));
    var tete = el("div", "dialogue-tete");
    tete.appendChild(el("h2", null, o.titre));
    var x = O.bouton("", "bouton-icone-seul", function () { fermer(); }, "fermer");
    x.setAttribute("aria-label", "Fermer");
    tete.appendChild(x);
    d.appendChild(tete);
    var corps = el("div", "dialogue-corps");
    if (o.contenu) corps.appendChild(o.contenu);
    d.appendChild(corps);
    var pied = el("div", "dialogue-pied");
    d.appendChild(pied);
    function actions(liste) {
      pied.innerHTML = "";
      (liste || []).forEach(function (a) {
        if (a.espace) { pied.appendChild(el("span", "espace")); return; }
        pied.appendChild(O.bouton(a.libelle, a.classe, function () { a.action(fermer); }, a.icone));
      });
    }
    actions(o.actions);
    function fermer() {
      if (!d.open) return;
      d.close();
    }
    d.addEventListener("close", function () {
      if (o.surFermeture) o.surFermeture();
      d.remove();
    });
    d.addEventListener("click", function (e) { if (e.target === d) fermer(); });
    document.body.appendChild(d);
    d.showModal();
    O.insecables(corps);
    return { dialogue: d, corps: corps, fermer: fermer, actions: actions };
  }

  function confirmer(titre, texte, choix) {
    return new Promise(function (resolve) {
      var valeur = null;
      var contenu = html("div", "dialogue-texte", texte);
      var b = ouvrir({
        titre: titre,
        contenu: contenu,
        classe: "petit",
        actions: [{ espace: true }].concat(choix.map(function (c) {
          return { libelle: c.libelle, classe: c.classe, action: function (f) { valeur = c.valeur; f(); } };
        })),
        surFermeture: function () { resolve(valeur); }
      });
      return b;
    });
  }

  /* Serveur hors ligne ------------------------------------------------------------------ */

  function serveur() {
    var C = A.connexion;
    var c = el("div");
    c.appendChild(html("p", null, "Cette page est ouverte depuis le disque. Le quiz fonctionne, mais sans Claude en direct, sans exécution de code et avec des archives gardées dans ce navigateur seulement."));
    c.appendChild(html("p", null, "Pour tout activer, lancer le serveur local : double-cliquer sur <code>lancer.bat</code> dans le dossier <code>studies</code> (ou <code>lancer.sh</code> dans un terminal). Une fenêtre reste ouverte tant que le serveur tourne, et le portail s'ouvre dans le navigateur. L'application Studies (<code>lancer-app.bat</code>) fait la même chose dans sa propre fenêtre."));
    if (C.serveurDetecte) {
      var p = el("p", "dialogue-important");
      p.appendChild(document.createTextNode("Le serveur tourne déjà : "));
      var a = el("a", null, "ouvrir cette page depuis le serveur");
      a.href = C.urlServeur();
      p.appendChild(a);
      p.appendChild(document.createTextNode("."));
      c.appendChild(p);
    }
    ouvrir({ titre: "Serveur local", contenu: c, classe: "petit", actions: [{ espace: true }, { libelle: "Fermer", classe: "principal", action: function (f) { f(); } }] });
  }

  /* Réglages ------------------------------------------------------------------------------ */

  function reglages() {
    var C = A.connexion;
    if (!C.enLigne) { serveur(); return; }
    C.rafraichir().then(function (e) {
      var r = JSON.parse(JSON.stringify(e.reglages));
      var c = el("div", "reglages");

      // Claude Code
      var sc = el("section", "reglages-section");
      sc.appendChild(el("h3", null, "Claude Code"));
      sc.appendChild(el("p", "reglages-etat " + (e.claude.disponible ? "ok" : "ko"),
        e.claude.disponible ? "Trouvé : version " + e.claude.version : e.claude.erreur));
      if (e.claude.disponible) sc.appendChild(el("p", "reglages-chemin", e.claude.executable));
      var lab = el("label", "reglages-champ");
      lab.appendChild(el("span", null, "Chemin de l'exécutable (laisser vide pour la recherche automatique)"));
      var chemin = el("input", "champ");
      chemin.type = "text";
      chemin.value = r.claude.executable || "";
      chemin.placeholder = "Recherche automatique : PATH, extension VS Code…";
      lab.appendChild(chemin);
      sc.appendChild(lab);
      var q = e.quota && e.quota.unifiedWindows;
      if (q) {
        sc.appendChild(el("p", "reglages-quota", "Abonnement : " + (q.five_hour ? Math.round(q.five_hour.utilization * 100) + " % de la fenêtre de 5 h" : "") +
          (q.seven_day ? " · " + Math.round(q.seven_day.utilization * 100) + " % de la semaine" : "") +
          (q.five_hour && q.five_hour.resetsAt ? " · renouvellement à " + new Date(q.five_hour.resetsAt * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "")));
      }
      c.appendChild(sc);

      // Modèles par usage
      var su = el("section", "reglages-section");
      su.appendChild(el("h3", null, "Modèle pour chaque usage"));
      su.appendChild(html("p", "reglages-note", "Avec l'abonnement Pro, Sonnet, Opus et Haiku sont inclus ; Fable demande des crédits en plus. Opus donne les meilleures réponses mais consomme le quota plus vite ; l'effort règle le temps de réflexion."));
      var grille = el("div", "reglages-usages");
      Object.keys(e.usages).forEach(function (u) {
        var ligne = el("div", "reglages-usage");
        var t = el("div", "reglages-usage-titre");
        t.appendChild(el("strong", null, e.usages[u].libelle));
        t.appendChild(el("span", null, e.usages[u].description));
        ligne.appendChild(t);
        var choix = el("div", "reglages-usage-choix");
        var sel = el("select");
        sel.setAttribute("aria-label", "Modèle · " + e.usages[u].libelle);
        var connu = false;
        e.modeles.forEach(function (m) {
          var o = el("option", null, m.libelle);
          o.value = m.id;
          if (m.id === r.usages[u].modele) { o.selected = true; connu = true; }
          sel.appendChild(o);
        });
        var autre = el("option", null, "Autre…");
        autre.value = "__autre";
        sel.appendChild(autre);
        var libre = el("input", "champ");
        libre.type = "text";
        libre.placeholder = "claude-sonnet-5…";
        libre.hidden = connu;
        if (!connu) { sel.value = "__autre"; libre.value = r.usages[u].modele; }
        sel.addEventListener("change", function () {
          libre.hidden = sel.value !== "__autre";
          r.usages[u].modele = sel.value === "__autre" ? libre.value.trim() : sel.value;
        });
        libre.addEventListener("input", function () { r.usages[u].modele = libre.value.trim(); });
        var eff = el("select");
        eff.setAttribute("aria-label", "Effort · " + e.usages[u].libelle);
        e.efforts.forEach(function (x) {
          var o = el("option", null, x ? "effort " + x : "effort par défaut");
          o.value = x;
          if (x === r.usages[u].effort) o.selected = true;
          eff.appendChild(o);
        });
        eff.addEventListener("change", function () { r.usages[u].effort = eff.value; });
        var res = el("span", "reglages-test");
        var tester = O.bouton("Tester", "petit", function () {
          tester.disabled = true;
          res.className = "reglages-test";
          res.textContent = "Enregistrement et test…";
          C.modifierReglages(r).then(function () { return C.tester(u); }).then(function (x) {
            res.className = "reglages-test ok";
            res.textContent = "OK · " + (x.modele || "").replace(/^claude-/, "") + " · " + (x.duree / 1000).toFixed(1) + " s";
          }).catch(function (err) {
            res.className = "reglages-test ko";
            res.textContent = err.message.slice(0, 160);
          }).finally(function () { tester.disabled = false; });
        });
        choix.appendChild(sel);
        choix.appendChild(libre);
        choix.appendChild(eff);
        choix.appendChild(tester);
        ligne.appendChild(choix);
        ligne.appendChild(res);
        grille.appendChild(ligne);
      });
      su.appendChild(grille);
      c.appendChild(su);

      // Exécution du code
      var sx = el("section", "reglages-section");
      sx.appendChild(el("h3", null, "Exécution du code"));
      var ul = el("ul", "reglages-langages");
      Object.keys(e.executeurs).forEach(function (k) {
        ul.appendChild(el("li", e.executeurs[k] ? "ok" : "ko", (A.code.NOMS[k] || k) + " : " + (e.executeurs[k] || "indisponible")));
      });
      sx.appendChild(ul);
      c.appendChild(sx);

      ouvrir({
        titre: "Réglages",
        contenu: c,
        classe: "large",
        actions: [
          { libelle: "Annuler", classe: "discret", action: function (f) { f(); } },
          { espace: true },
          { libelle: "Enregistrer", classe: "principal", action: function (f) {
            r.claude.executable = chemin.value.trim();
            C.modifierReglages(r).then(function () { return C.rafraichir(true); }).then(function () {
              O.notifier("Réglages enregistrés.");
              f();
            }).catch(function (err) { O.notifier(err.message, "erreur"); });
          } }
        ]
      });
    }).catch(function (err) { O.notifier("Serveur injoignable : " + err.message, "erreur"); });
  }

  /* Génération d'un quiz ------------------------------------------------------------------ */

  var CLE_TACHE = "quiz-generation";

  function generer(o) {
    var C = A.connexion;
    if (!C.enLigne) { serveur(); return; }
    var d = o.donnees || { questions: [] };
    var typesQuiz = [];
    d.questions.forEach(function (q) { if (typesQuiz.indexOf(q.type) < 0) typesQuiz.push(q.type); });
    var c = el("div", "generation");

    function radio(nom, valeur, texte, coche) {
      var lab = el("label", "ligne-choix");
      var i = el("input");
      i.type = "radio"; i.name = nom; i.value = valeur; i.checked = Boolean(coche);
      lab.appendChild(i);
      lab.appendChild(html("span", null, texte));
      return lab;
    }
    var fs1 = el("fieldset", "quiz-reglage");
    fs1.appendChild(el("legend", null, "Sujet"));
    fs1.appendChild(radio("gen-sujet", "meme", "Le même sujet que ce quiz, avec des questions nouvelles", true));
    fs1.appendChild(radio("gen-sujet", "erreurs", "Centré sur mes erreurs de la dernière tentative" + (o.derniere ? "" : " <small>(aucune tentative terminée)</small>")));
    var lAutre = radio("gen-sujet", "autre", "Un autre sujet de la matière :");
    var autre = el("input", "champ");
    autre.type = "text";
    autre.placeholder = "par exemple : les jointures externes, les formes normales…";
    lAutre.appendChild(autre);
    autre.addEventListener("focus", function () { lAutre.querySelector("input").checked = true; });
    fs1.appendChild(lAutre);
    c.appendChild(fs1);

    var fs2 = el("fieldset", "quiz-reglage");
    fs2.appendChild(el("legend", null, "Types de questions"));
    var types = el("div", "themes");
    Object.keys(A.LIBELLES_TYPES).forEach(function (t) {
      var lab = el("label", "theme-puce");
      var i = el("input");
      i.type = "checkbox"; i.value = t; i.checked = typesQuiz.indexOf(t) >= 0;
      lab.appendChild(i);
      lab.appendChild(document.createTextNode(A.LIBELLES_TYPES[t]));
      types.appendChild(lab);
    });
    fs2.appendChild(types);
    fs2.appendChild(el("p", "reglages-note", "Cocher un seul type pour un quiz d'un seul type (que des QCM, que du code…)."));
    c.appendChild(fs2);

    var fs3 = el("fieldset", "quiz-reglage");
    fs3.appendChild(el("legend", null, "Format"));
    var ligne = el("div", "reglages-ligne");
    var ln = el("label", null, "Nombre de questions : ");
    var nombre = el("input", "champ nombre");
    nombre.type = "number"; nombre.min = 3; nombre.max = 60; nombre.value = d.questions.length || 15;
    ln.appendChild(nombre);
    ligne.appendChild(ln);
    var ld = el("label", null, "Difficulté : ");
    var diff = el("select");
    [["meme", "comparable"], ["plus_facile", "plus facile"], ["plus_difficile", "plus difficile"]].forEach(function (x) {
      var op = el("option", null, x[1]); op.value = x[0]; diff.appendChild(op);
    });
    ld.appendChild(diff);
    ligne.appendChild(ld);
    fs3.appendChild(ligne);
    c.appendChild(fs3);

    var fs4 = el("fieldset", "quiz-reglage");
    fs4.appendChild(el("legend", null, "Consignes pour Claude (facultatif)"));
    var consignes = el("textarea", "champ zone");
    consignes.placeholder = "par exemple : insister sur GROUP BY et HAVING, plus de questions sur les NULL…";
    fs4.appendChild(consignes);
    c.appendChild(fs4);

    var u = C.etat.reglages.usages.generation;
    c.appendChild(el("p", "reglages-note", "Claude Code écrit le quiz dans le dossier de la matière, vérifie les réponses (le code est exécuté) et l'ajoute à l'accueil de la matière. Compter plusieurs minutes. Modèle : " +
      (u.modele || "par défaut") + (u.effort ? ", effort " + u.effort : "") + " (modifiable dans les réglages)."));

    var boite = ouvrir({
      titre: "Générer un nouveau quiz",
      contenu: c,
      classe: "large",
      actions: [
        { libelle: "Annuler", classe: "discret", action: function (f) { f(); } },
        { espace: true },
        { libelle: "Générer", classe: "principal", icone: "generer", action: function () {
          var sujet = c.querySelector("input[name=gen-sujet]:checked").value;
          var options = {
            sujet: sujet,
            sujetTexte: autre.value.trim(),
            types: Array.prototype.filter.call(types.querySelectorAll("input"), function (i) { return i.checked; }).map(function (i) { return i.value; }),
            nombre: Number(nombre.value),
            difficulte: diff.value,
            consignes: consignes.value.trim()
          };
          if (sujet === "autre" && !options.sujetTexte) { O.notifier("Préciser le sujet.", "erreur"); return; }
          if (!options.types.length) { O.notifier("Cocher au moins un type de question.", "erreur"); return; }
          C.generer(options, o.page).then(function (t) {
            O.ecrireMemoire(CLE_TACHE, { id: t.id, page: t.page, debut: Date.now() });
            boite.fermer();
            suivre(t.id);
          }).catch(function (e) { O.notifier(e.message, "erreur"); });
        } }
      ]
    });
  }

  // Suivi d'une génération : journal, durée, annulation, lien vers le quiz créé
  function suivre(id) {
    var C = A.connexion;
    var c = el("div", "suivi");
    var etat = el("p", "suivi-etat", "Démarrage…");
    var journal = el("ol", "suivi-journal");
    c.appendChild(etat);
    c.appendChild(journal);
    var minuteur = null, fini = false;
    var boite = ouvrir({
      titre: "Génération du quiz",
      contenu: c,
      classe: "large",
      actions: [
        { libelle: "Arrêter la génération", classe: "discret", action: function () {
          C.annulerTache(id).then(maj);
        } },
        { espace: true },
        { libelle: "Masquer", action: function (f) { f(); } }
      ],
      surFermeture: function () { clearTimeout(minuteur); }
    });
    function maj() {
      C.tache(id).then(function (t) {
        journal.innerHTML = "";
        t.journal.slice(-40).forEach(function (l) {
          var li = el("li", "suivi-" + l.type);
          li.appendChild(el("span", "suivi-temps", O.chrono(l.t)));
          li.appendChild(el("span", null, l.texte));
          journal.appendChild(li);
        });
        journal.scrollTop = journal.scrollHeight;
        var ecoule = O.chrono((t.fin || Date.now()) - t.debut);
        if (t.etat === "en_cours") {
          etat.textContent = "Claude Code travaille… " + ecoule;
          minuteur = setTimeout(maj, 2000);
          return;
        }
        fini = true;
        O.supprimerMemoire(CLE_TACHE);
        if (t.etat === "terminee") {
          etat.innerHTML = "";
          etat.className = "suivi-etat ok";
          etat.appendChild(document.createTextNode("Quiz créé en " + ecoule + " : "));
          var a = el("a", null, t.fichier.split("/").pop());
          a.href = C.urlServeur(t.fichier);
          etat.appendChild(a);
          boite.actions([{ espace: true }, { libelle: "Fermer", action: function (f) { f(); } },
            { libelle: "Ouvrir le nouveau quiz", classe: "principal", action: function () { location.href = a.href; } }]);
        } else {
          etat.className = "suivi-etat ko";
          etat.textContent = (t.etat === "annulee" ? "Génération arrêtée." : "Échec : " + (t.erreur || "erreur inconnue")) + " (" + ecoule + ")";
          boite.actions([{ espace: true }, { libelle: "Fermer", classe: "principal", action: function (f) { f(); } }]);
        }
      }).catch(function (e) {
        etat.textContent = "Suivi impossible : " + e.message;
        O.supprimerMemoire(CLE_TACHE);
      });
    }
    maj();
    return boite;
  }

  // Au chargement d'une page : une génération lancée précédemment est-elle en cours ?
  function tacheEnCours() {
    var t = O.lireMemoire(CLE_TACHE);
    if (!t || !A.connexion.enLigne) return Promise.resolve(null);
    return A.connexion.tache(t.id).catch(function () { O.supprimerMemoire(CLE_TACHE); return null; });
  }

  A.dialogues = { ouvrir: ouvrir, confirmer: confirmer, serveur: serveur, reglages: reglages, generer: generer, suivre: suivre, tacheEnCours: tacheEnCours };
})(window.QuizApp);
