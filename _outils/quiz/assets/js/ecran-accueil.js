/* ==========================================================================
   Quiz · écran d'accueil (prototype de QuizApp.Quiz)
   Reprise d'un quiz en cours, réglages (mode, thèmes, types, nombre),
   historique des tentatives, génération et questions à Claude.
   ========================================================================== */
(function (A) {
  "use strict";

  var O = A.outils, el = O.el, html = O.html;
  var P = A.Quiz.prototype;

  P.accueil = function () {
    var self = this, R = this.reglages, C = A.connexion;
    A.archives.oublier();
    this.vider();
    this.ecran = "accueil";
    this.session = null;
    this.revue = false;
    var themes = this.themes(), noms = Object.keys(themes);
    var types = this.typesPresents(), nomsTypes = Object.keys(types);
    if (!R.themes) R.themes = noms.slice();
    if (!R.types) R.types = nomsTypes.slice();

    var sec = el("section", "quiz-accueil");

    // Bandeau hors ligne
    if (!C.enLigne) {
      var hl = el("div", "quiz-bandeau hors-ligne");
      hl.appendChild(html("p", null, "<strong>Mode hors ligne.</strong> Le quiz fonctionne, mais sans Claude en direct ni exécution de code, et la progression reste dans ce navigateur."));
      hl.appendChild(O.bouton(C.serveurDetecte ? "Ouvrir via le serveur" : "Activer le serveur local", "petit", function () {
        if (C.serveurDetecte) location.href = C.urlServeur(); else A.dialogues.serveur();
      }));
      sec.appendChild(hl);
    }

    // Génération lancée précédemment depuis cette page ou une autre
    var bandeauTache = el("div", "quiz-bandeau tache");
    bandeauTache.hidden = true;
    sec.appendChild(bandeauTache);
    A.dialogues.tacheEnCours().then(function (t) {
      if (!t) return;
      bandeauTache.hidden = false;
      bandeauTache.appendChild(el("p", null, t.etat === "en_cours" ? "Une génération de quiz est en cours." : t.etat === "terminee" ? "Un nouveau quiz est prêt." : "La dernière génération de quiz n'a pas abouti."));
      bandeauTache.appendChild(O.bouton("Voir", "petit", function () { A.dialogues.suivre(t.id); }));
    });

    // Quiz en cours
    var reprise = el("div", "quiz-reprise");
    reprise.hidden = true;
    sec.appendChild(reprise);

    // Chiffres clés
    var resume = el("div", "quiz-resume");
    function tuile(val, txt) {
      var d = el("div");
      d.appendChild(el("strong", null, val));
      d.appendChild(el("span", null, txt));
      resume.appendChild(d);
    }
    tuile(String(this.d.questions.length), "questions");
    if (noms.length > 1) tuile(String(noms.length), "thèmes");
    tuile(String(nomsTypes.length), nomsTypes.length > 1 ? "types de questions" : A.LIBELLES_TYPES[nomsTypes[0]] || nomsTypes[0]);
    tuile("≈ " + this.dureeEstimee() + " min", "en tout");
    sec.appendChild(resume);

    // Mode
    var fsMode = el("fieldset", "quiz-reglage");
    fsMode.appendChild(el("legend", null, "Mode"));
    var modes = el("div", "modes");
    [["entrainement", "Entraînement", "Correction, explication, indices et aide de Claude après chaque question."],
     ["examen", "Examen", "Correction à la fin, avec chronomètre. Navigation libre entre les questions."]].forEach(function (m) {
      var lab = el("label", "mode");
      var inp = el("input");
      inp.type = "radio"; inp.name = "quiz-mode"; inp.value = m[0];
      inp.checked = R.mode === m[0];
      inp.addEventListener("change", function () { R.mode = m[0]; });
      lab.appendChild(inp);
      lab.appendChild(el("span", "mode-titre", m[1]));
      lab.appendChild(el("span", "mode-desc", m[2]));
      modes.appendChild(lab);
    });
    fsMode.appendChild(modes);
    sec.appendChild(fsMode);

    // Filtres : thèmes et types
    function filtre(titre, liste, compte, choisis, libelle) {
      var fs = el("fieldset", "quiz-reglage");
      fs.appendChild(el("legend", null, titre));
      var zone = el("div", "themes");
      liste.forEach(function (n) {
        var lab = el("label", "theme-puce");
        var inp = el("input");
        inp.type = "checkbox";
        inp.checked = choisis.indexOf(n) >= 0;
        inp.addEventListener("change", function () {
          var i = choisis.indexOf(n);
          if (inp.checked && i < 0) choisis.push(n);
          if (!inp.checked && i >= 0) choisis.splice(i, 1);
          majNombre();
        });
        lab.appendChild(inp);
        lab.appendChild(document.createTextNode(libelle ? libelle(n) : n));
        lab.appendChild(el("small", null, String(compte[n])));
        zone.appendChild(lab);
      });
      fs.appendChild(zone);
      sec.appendChild(fs);
    }
    if (noms.length > 1) filtre("Thèmes", noms, themes, R.themes);
    if (nomsTypes.length > 1) filtre("Types de questions", nomsTypes, types, R.types, function (t) { return A.LIBELLES_TYPES[t] || t; });

    // Nombre, mélange
    var fsQ = el("fieldset", "quiz-reglage");
    fsQ.appendChild(el("legend", null, "Questions"));
    var ligne = el("div", "reglages-ligne");
    var labN = el("label", null, "Nombre : ");
    var selN = el("select");
    labN.appendChild(selN);
    ligne.appendChild(labN);
    var labM = el("label");
    var chkM = el("input");
    chkM.type = "checkbox";
    chkM.checked = R.melanger;
    chkM.addEventListener("change", function () { R.melanger = chkM.checked; });
    labM.appendChild(chkM);
    labM.appendChild(document.createTextNode("Mélanger l'ordre"));
    ligne.appendChild(labM);
    fsQ.appendChild(ligne);
    sec.appendChild(fsQ);

    function disponibles() {
      return self.d.questions.filter(function (q) {
        return R.themes.indexOf(q.theme || "Général") >= 0 && R.types.indexOf(q.type) >= 0;
      });
    }
    var alerte = el("p", "quiz-alerte");
    alerte.hidden = true;
    function majNombre() {
      var n = disponibles().length;
      selN.innerHTML = "";
      var opts = [0].concat([5, 10, 15, 20, 30].filter(function (x) { return x < n; }));
      opts.forEach(function (x) {
        var o = el("option", null, x === 0 ? "Toutes (" + n + ")" : String(x));
        o.value = x;
        selN.appendChild(o);
      });
      selN.value = opts.indexOf(R.nombre) >= 0 ? R.nombre : 0;
      alerte.hidden = n > 0;
      alerte.textContent = "Aucune question : cocher au moins un thème et un type.";
      demarrer.disabled = n === 0;
    }
    selN.addEventListener("change", function () { R.nombre = Number(selN.value); });

    var actions = el("div", "quiz-actions");
    var demarrer = O.bouton("Commencer", "principal", function () {
      var qs = disponibles();
      if (R.melanger) qs = O.melanger(qs);
      if (R.nombre) qs = qs.slice(0, R.nombre);
      self.commencer(qs);
    });
    actions.appendChild(demarrer);
    actions.appendChild(el("span", "espace"));
    actions.appendChild(O.bouton("Question à Claude", "discret", function () { self.ouvrirClaudeGeneral(); }, "claude"));
    actions.appendChild(O.bouton("Générer un quiz similaire", "discret", function () { self.dialogueGeneration(); }, "generer"));
    sec.appendChild(alerte);
    sec.appendChild(actions);
    sec.appendChild(el("p", "quiz-cle-clavier",
      "Raccourcis : 1, 2, 3… ou A, B, C… pour choisir ; Entrée pour valider et passer à la suite ; Ctrl+Entrée pour exécuter du code."));

    // Historique
    var hist = el("section", "quiz-historique");
    hist.hidden = true;
    sec.appendChild(hist);

    this.zone.appendChild(sec);
    majNombre();
    O.insecables(sec);
    this.chargerHistorique(reprise, hist);
  };

  /* Historique et reprise ------------------------------------------------------------ */

  P.chargerHistorique = function (reprise, hist) {
    var self = this;
    A.archives.lister(this.d.id).then(function (liste) {
      self.tentatives = liste;
      var enCours = liste.filter(function (t) { return t.statut === "en_cours"; })[0] || null;
      self.resumeEnCours = enCours;
      if (enCours) self.afficherReprise(reprise, enCours);
      var autres = liste.filter(function (t) { return t.statut !== "en_cours"; });
      if (!autres.length) return;
      hist.hidden = false;
      var tete = el("div", "quiz-historique-tete");
      tete.appendChild(el("h2", null, "Mes tentatives"));
      var finies = autres.filter(function (t) { return t.statut === "terminee" && t.score; });
      if (finies.length) {
        var meilleur = Math.max.apply(null, finies.map(function (t) { return t.score.pourcent; }));
        tete.appendChild(el("p", "quiz-historique-meilleur", "Meilleur score : " + meilleur + " % · " + finies.length + " tentative" + (finies.length > 1 ? "s" : "") + " terminée" + (finies.length > 1 ? "s" : "")));
      }
      hist.appendChild(tete);
      if (finies.length > 1) hist.appendChild(self.courbe(finies.slice(0, 12).reverse()));
      var table = el("div", "tentatives");
      autres.slice(0, 20).forEach(function (t) {
        var ligne = el("div", "tentative " + t.statut);
        var date = el("span", "tentative-date", O.dateLisible(t.debut));
        ligne.appendChild(date);
        ligne.appendChild(el("span", "tentative-mode", t.mode === "examen" ? "Examen" : "Entraînement"));
        var sc = el("span", "tentative-score");
        if (t.statut === "abandonnee") sc.appendChild(el("span", "badge", "abandonnée · " + t.repondues + "/" + t.nb));
        else if (t.score) {
          var barre = el("span", "mini-barre");
          var rem = el("span");
          rem.style.setProperty("--p", String(t.score.pourcent / 100));
          barre.appendChild(rem);
          sc.appendChild(barre);
          sc.appendChild(el("strong", null, t.score.pourcent + " %"));
        }
        ligne.appendChild(sc);
        ligne.appendChild(el("span", "tentative-duree", t.duree_ms ? O.duree(t.duree_ms) : ""));
        var marques = el("span", "tentative-marques");
        if (t.evaluation) marques.appendChild(el("span", "badge matiere", "bilan Claude"));
        if (t.locale && !t.fichier) marques.appendChild(el("span", "badge", "navigateur"));
        ligne.appendChild(marques);
        ligne.appendChild(O.bouton("Revoir", "petit", function () { self.revoirTentative(t); }));
        table.appendChild(ligne);
      });
      hist.appendChild(table);
      O.insecables(hist);
    }).then(function () { self.suivreAncre(); });
  };

  // Petite courbe des scores des dernières tentatives terminées
  P.courbe = function (liste) {
    var l = 240, h = 48, n = liste.length;
    var pts = liste.map(function (t, i) { return [Math.round(6 + i * (l - 12) / Math.max(1, n - 1)), Math.round(h - 6 - (t.score.pourcent / 100) * (h - 12))]; });
    var svg = '<svg class="quiz-courbe" viewBox="0 0 ' + l + " " + h + '" width="' + l + '" height="' + h + '" role="img" aria-label="Évolution des scores">' +
      '<line class="axe" x1="0" y1="' + (h - 6) + '" x2="' + l + '" y2="' + (h - 6) + '"/>' +
      '<polyline points="' + pts.map(function (p) { return p.join(","); }).join(" ") + '"/>' +
      pts.map(function (p, i) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3"><title>' + liste[i].score.pourcent + " %</title></circle>"; }).join("") + "</svg>";
    return html("div", "quiz-courbe-cadre", svg);
  };

  P.afficherReprise = function (zone, t) {
    var self = this;
    zone.hidden = false;
    zone.innerHTML = "";
    var txt = el("div", "quiz-reprise-texte");
    txt.appendChild(el("strong", null, "Quiz en cours"));
    txt.appendChild(el("span", null, "Question " + ((t.position || 0) + 1) + " sur " + t.nb + " · " + t.repondues + " réponse" + (t.repondues > 1 ? "s" : "") +
      " · " + (t.mode === "examen" ? "examen" : "entraînement") + " · dernière activité le " + O.dateLisible(t.maj || t.debut)));
    zone.appendChild(txt);
    var b = el("div", "quiz-reprise-actions");
    b.appendChild(O.bouton("Reprendre", "principal", function () { self.reprendre(t); }, "reprendre"));
    b.appendChild(O.bouton("Abandonner", "discret", function () {
      A.dialogues.confirmer("Abandonner le quiz en cours ?", "<p>Les réponses déjà données restent dans l'historique, marquées « abandonnée ». Une tentative sans réponse est simplement supprimée.</p>",
        [{ libelle: "Annuler", valeur: false, classe: "discret" }, { libelle: "Abandonner", valeur: true, classe: "principal" }]).then(function (oui) {
        if (!oui) return;
        A.archives.lire(self.d.id, t).then(function (complete) {
          return complete ? A.archives.abandonner(complete) : null;
        }).then(function () { self.accueil(); });
      });
    }));
    zone.appendChild(b);
    O.insecables(zone);
  };

  P.commencer = function (questions) {
    var self = this;
    var go = function () {
      self.session = self.nouvelleSession(questions, self.reglages.mode);
      self.revue = false;
      self.afficherQuestion(0);
      self.sauver(true);
    };
    if (!this.resumeEnCours) return go();
    var t = this.resumeEnCours;
    A.dialogues.confirmer("Un quiz est déjà en cours", "<p>Tu en étais à la question " + ((t.position || 0) + 1) + " sur " + t.nb + " (" + t.repondues + " réponse" + (t.repondues > 1 ? "s" : "") + "). Le reprendre, ou l'abandonner pour recommencer ?</p>",
      [{ libelle: "Annuler", valeur: null, classe: "discret" }, { libelle: "Abandonner et recommencer", valeur: "nouveau" }, { libelle: "Reprendre", valeur: "reprendre", classe: "principal" }]).then(function (choix) {
      if (choix === "reprendre") self.reprendre(t);
      else if (choix === "nouveau") {
        A.archives.lire(self.d.id, t).then(function (c) { return c ? A.archives.abandonner(c) : null; }).then(function () {
          self.resumeEnCours = null;
          go();
        });
      }
    });
  };

  // Complète une session archivée par une version antérieure du moteur
  function completer(s) {
    ["etats", "reponses", "scores", "valide", "rapports", "corrections", "indices", "temps", "conversations"].forEach(function (k) { if (!s[k]) s[k] = {}; });
    return s;
  }

  P.reprendre = function (resume) {
    var self = this;
    A.archives.lire(this.d.id, resume).then(function (t) {
      if (!t || !t.session) { O.notifier("Tentative introuvable.", "erreur"); return; }
      self.session = completer(t.session);
      self.session.statut = "en_cours";
      self.session.fichier = resume.fichier || null;
      self.revue = false;
      var n = self.questions().length;
      if (!n) { O.notifier("Les questions de cette tentative n'existent plus dans le quiz.", "erreur"); return; }
      self.afficherQuestion(Math.min(self.session.index || 0, n - 1));
    });
  };

  P.revoirTentative = function (resume) {
    var self = this;
    A.archives.lire(this.d.id, resume).then(function (t) {
      if (!t || !t.session) { O.notifier("Tentative introuvable.", "erreur"); return; }
      self.session = completer(t.session);
      self.session.statut = t.statut;
      self.session.fichier = resume.fichier || null;
      self.revue = true;
      self.afficherResultats();
    });
  };

  // Liens du portail : #reprendre, #tentative=<id>
  P.suivreAncre = function () {
    var h = location.hash;
    if (!h) return;
    history.replaceState(null, "", location.pathname + location.search);
    if (h === "#reprendre" && this.resumeEnCours) return this.reprendre(this.resumeEnCours);
    var m = h.match(/^#tentative=([\d_-]+)$/);
    if (m) {
      var t = (this.tentatives || []).filter(function (x) { return x.id === m[1]; })[0];
      if (t) this.revoirTentative(t);
    }
  };

  P.dialogueGeneration = function () {
    var derniere = (this.tentatives || []).filter(function (t) { return t.statut === "terminee"; })[0];
    A.dialogues.generer({ donnees: this.d, page: A.connexion.page(), derniere: derniere });
  };
})(window.QuizApp);
