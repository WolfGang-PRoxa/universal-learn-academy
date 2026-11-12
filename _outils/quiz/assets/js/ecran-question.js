/* ==========================================================================
   Quiz · écran d'une question (prototype de QuizApp.Quiz)
   Énoncé, réponse, indices, aide de Claude, validation et correction ;
   navigation libre en mode examen ; enregistrement à chaque changement.
   ========================================================================== */
(function (A) {
  "use strict";

  var O = A.outils, el = O.el, html = O.html;
  var P = A.Quiz.prototype;

  P.afficherQuestion = function (i) {
    var self = this, S = this.session, qs = this.questions(), q = qs[i], type = A.types[q.type];
    this.vider();
    this.ecran = "question";
    S.index = i;
    this.chronoDebut = Date.now();
    if (!S.etats[q.id]) S.etats[q.id] = {};

    var carte = el("section", "quiz-carte");
    carte.setAttribute("aria-labelledby", "quiz-enonce");

    // En-tête : numéro, thème, difficulté, chronomètre, enregistrement
    var tete = el("div", "quiz-tete");
    var cpt = el("span", "quiz-compteur", "Question " + (i + 1) + " ");
    cpt.appendChild(el("span", null, "/ " + qs.length));
    tete.appendChild(cpt);
    if (q.theme) tete.appendChild(el("span", "badge matiere", q.theme));
    if (q.difficulte) {
      var d = el("span", "quiz-difficulte", "●●●".slice(0, q.difficulte) + "○○○".slice(0, 3 - q.difficulte));
      d.title = "Difficulté : " + ["facile", "moyenne", "difficile"][q.difficulte - 1];
      tete.appendChild(d);
    }
    tete.appendChild(el("span", "espace"));
    if (S.mode === "examen") {
      var chrono = el("span", "quiz-chrono");
      var maj = function () { chrono.textContent = O.chrono(self.dureeTotale() + (Date.now() - self.chronoDebut)); };
      maj();
      this.minuteur = setInterval(maj, 1000);
      tete.appendChild(chrono);
    }
    tete.appendChild(el("span", "quiz-sauvegarde"));
    carte.appendChild(tete);

    var barre = el("div", "quiz-barre");
    var rempli = el("span");
    rempli.style.setProperty("--p", String(i / qs.length));
    barre.appendChild(rempli);
    carte.appendChild(barre);

    if (S.mode === "examen") carte.appendChild(this.navigateur(qs, i));

    var enonce = html("div", "quiz-enonce", q.type === "trous" ? (q.enonce || "<p>Compléter :</p>") : q.enonce);
    enonce.id = "quiz-enonce";
    carte.appendChild(enonce);
    var consigne = q.consigne || (typeof type.consigne === "function" ? type.consigne(q) : type.consigne);
    if (consigne) carte.appendChild(el("p", "quiz-consigne", consigne));

    var zoneRep = el("div", "quiz-reponse");
    carte.appendChild(zoneRep);
    this.zoneRep = zoneRep;
    this.widget = type.rendre(q, zoneRep, S.etats[q.id], S.reponses[q.id] === undefined ? null : S.reponses[q.id]);
    ["input", "change"].forEach(function (ev) {
      zoneRep.addEventListener(ev, function () { self.surChangement(); });
    });

    // Indices et aide
    this.zoneIndices = el("div", "quiz-indices");
    carte.appendChild(this.zoneIndices);
    this.outils = el("div", "quiz-outils");
    carte.appendChild(this.outils);
    this.majOutils();

    this.retour = el("div", "quiz-retour");
    this.retour.setAttribute("aria-live", "polite");
    carte.appendChild(this.retour);

    this.actions = el("div", "quiz-actions");
    carte.appendChild(this.actions);
    this.zone.appendChild(carte);

    if (S.valide[q.id]) this.montrerCorrection(false);
    else this.boutonsQuestion();

    O.enrichir(carte);
    this.etatSauvegarde(A.connexion.enLigne ? (S.fichier ? "enregistre" : "") : "local", S.fichier);
    this.zone.focus({ preventScroll: true });
    this.remonter();
    if (A.claude.estOuvert()) this.ouvrirClaude(q.id, true);
  };

  P.questionCourante = function () { return this.questions()[this.session.index]; };

  // Réponse modifiée : gardée dans la session (brouillon ou réponse d'examen), puis enregistrée
  P.surChangement = function () {
    var S = this.session, q = this.questionCourante();
    if (!q || S.valide[q.id] || !this.widget) return;
    S.reponses[q.id] = this.widget.lire();
    if (S.mode === "examen" && this.navigation) this.majNavigateur();
    this.sauver();
  };

  /* Navigation en mode examen ------------------------------------------------------ */

  P.navigateur = function (qs, i) {
    var self = this;
    var nav = el("nav", "quiz-navigateur");
    nav.setAttribute("aria-label", "Questions");
    this.navigation = nav;
    qs.forEach(function (q, k) {
      var b = el("button", "quiz-pastille", String(k + 1));
      b.type = "button";
      b.setAttribute("aria-label", "Question " + (k + 1));
      if (k === i) b.setAttribute("aria-current", "step");
      b.addEventListener("click", function () {
        if (k === self.session.index) return;
        self.enregistrer();
        self.afficherQuestion(k);
        self.sauver();
      });
      nav.appendChild(b);
    });
    this.majNavigateur();
    return nav;
  };
  P.majNavigateur = function () {
    var self = this, qs = this.questions();
    Array.prototype.forEach.call(this.navigation.children, function (b, k) {
      b.classList.toggle("repondue", self.repondue(qs[k].id));
    });
  };

  /* Indices et aide de Claude ----------------------------------------------------------- */

  P.majOutils = function () {
    var self = this, S = this.session, q = this.questionCourante();
    var indices = q.indices || [], vus = Math.min(S.indices[q.id] || 0, indices.length);
    this.zoneIndices.innerHTML = "";
    indices.slice(0, vus).forEach(function (t, k) {
      var b = el("div", "quiz-indice");
      b.appendChild(el("p", "quiz-indice-titre", "Indice " + (k + 1) + (indices.length > 1 ? " sur " + indices.length : "")));
      b.appendChild(html("div", null, t));
      self.zoneIndices.appendChild(b);
    });
    if (vus) O.enrichir(this.zoneIndices);
    this.outils.innerHTML = "";
    if (indices.length && vus < indices.length && !S.valide[q.id]) {
      var libelle = vus ? "Indice suivant (" + (indices.length - vus) + " restant" + (indices.length - vus > 1 ? "s" : "") + ")" : "Indice" + (indices.length > 1 ? " (" + indices.length + ")" : "");
      var pen = Number(this.d.penalite_indice) || 0;
      var b = O.bouton(libelle, "petit", function () {
        S.indices[q.id] = vus + 1;
        self.majOutils();
        self.sauver();
      }, "indice");
      if (pen) b.title = "Chaque indice retire " + Math.round(pen * 100) + " % des points de la question.";
      this.outils.appendChild(b);
    }
    var conv = S.conversations[q.id];
    var nb = conv ? conv.messages.filter(function (m) { return m.role === "claude"; }).length : 0;
    var c = O.bouton("Demander à Claude" + (nb ? " (" + nb + ")" : ""), "petit bouton-claude", function () { self.ouvrirClaude(q.id); }, "claude");
    c.title = A.connexion.claudeDisponible() ? "Ouvrir une conversation sur cette question" : "Sans serveur local : la demande sera copiée pour claude.ai";
    this.outils.appendChild(c);
  };

  P.suggestionsQuestion = function (id) {
    var S = this.session, q = this.parId[id];
    var corrigee = Boolean(S.valide[id]);
    var code = q.type === "code";
    if (!corrigee) {
      var l = [
        { libelle: "Je n'arrive pas à répondre, aide-moi", message: "Je ne parviens pas à répondre à cette question, j'ai besoin d'aide. Guide-moi sans me donner la réponse." },
        { libelle: "Explique-moi la notion", message: "Explique-moi la notion sur laquelle porte cette question, sans me donner la réponse." },
        { libelle: "Je ne comprends pas l'énoncé", message: "Je ne comprends pas bien l'énoncé : peux-tu le reformuler plus simplement ?" },
        { libelle: "Un exemple voisin", message: "Donne-moi un exemple voisin qui m'aiderait à trouver, sans résoudre la question." },
        { libelle: "Vérifie mon raisonnement", message: "Voici mon raisonnement, dis-moi s'il tient la route, sans me donner la réponse : ", remplir: true }
      ];
      if (code) l.splice(1, 0, { libelle: "Mon code ne marche pas", message: "Mon code ne donne pas le bon résultat (il est dans ma réponse actuelle). Aide-moi à trouver l'erreur, sans me donner la solution." });
      return l;
    }
    var s = S.scores[id];
    var liste = [];
    if (s !== 1) liste.push({ libelle: "Pourquoi ma réponse est fausse ?", message: "Pourquoi ma réponse est-elle fausse (ou incomplète) ? Explique-moi où mon raisonnement a dérapé." });
    liste.push(
      { libelle: "Je ne comprends pas la correction", message: "Je ne comprends pas la correction : peux-tu l'expliquer autrement, pas à pas ?" },
      { libelle: "Quel est le piège ?", message: "Quel est le piège classique de cette question, et comment l'éviter à l'examen ?" },
      { libelle: "Un exercice similaire", message: "Propose-moi un exercice similaire pour m'entraîner (sans la solution, je te la proposerai ensuite)." },
      { libelle: "J'ai une autre question", message: "", remplir: true }
    );
    return liste;
  };

  P.ouvrirClaude = function (id, silencieux) {
    var self = this, S = this.session, q = this.parId[id];
    var n = S.ordre.indexOf(id) + 1;
    A.claude.ouvrir({
      titre: "Aide · question " + n,
      sousTitre: [q.theme, this.meta.titre].filter(Boolean).join(" · "),
      conversation: this.conversation(id),
      contexte: function () {
        var c = self.contexteGeneral();
        c.question = self.contexteQuestion(id);
        return c;
      },
      suggestions: function () { return self.suggestionsQuestion(id); },
      surMaj: function () {
        self.sauver();
        if (self.ecran === "question" && self.questionCourante() && self.questionCourante().id === id) self.majOutils();
      }
    });
    if (silencieux) return;
  };

  /* Boutons ---------------------------------------------------------------------------- */

  P.boutonsQuestion = function () {
    var self = this, S = this.session, i = S.index, dernier = i === S.ordre.length - 1;
    this.actions.innerHTML = "";
    var quitter = O.bouton("Enregistrer et quitter", "discret", function () { self.quitter(); }, "pause");
    quitter.title = "La progression est enregistrée : le quiz pourra être repris plus tard.";
    if (S.mode === "examen") {
      var prec = O.bouton("← Précédente", null, function () { self.enregistrer(); self.afficherQuestion(i - 1); self.sauver(); });
      prec.disabled = i === 0;
      this.actions.appendChild(prec);
      this.actions.appendChild(quitter);
      this.actions.appendChild(el("span", "espace"));
      this.actions.appendChild(O.bouton("Terminer", "discret", function () { self.enregistrer(); self.confirmerFin(); }));
      this.actions.appendChild(O.bouton(dernier ? "Voir les résultats" : "Suivante →", "principal", function () {
        self.enregistrer();
        if (dernier) self.confirmerFin(); else { self.afficherQuestion(i + 1); self.sauver(); }
      }));
    } else {
      this.actions.appendChild(quitter);
      this.actions.appendChild(el("span", "espace"));
      this.actions.appendChild(O.bouton("Je ne sais pas", "discret", function () { self.valider(true); }));
      this.actions.appendChild(O.bouton(S.ordre.length && this.questionCourante().type === "ouverte" ? "Voir la réponse" : "Valider", "principal",
        function () { self.valider(false); }));
    }
    var aide = el("p", "quiz-aide", "");
    aide.hidden = true;
    this.aide = aide;
    this.actions.appendChild(aide);
  };

  P.enregistrer = function () {
    var S = this.session, q = this.questionCourante();
    if (this.widget && q && !S.valide[q.id]) S.reponses[q.id] = this.widget.lire();
  };

  P.quitter = function () {
    var self = this;
    this.enregistrer();
    this.accumuler();
    A.claude.fermer();
    this.sauver(true).then(function () {
      O.notifier("Progression enregistrée : le quiz pourra être repris depuis l'accueil.");
      self.accueil();
    });
  };

  // Examen : prévenir s'il reste des questions sans réponse
  P.confirmerFin = function () {
    var self = this;
    var vides = this.questions().filter(function (q) { return !self.repondue(q.id); }).length;
    if (!vides) return this.terminer();
    A.dialogues.confirmer("Terminer le quiz ?", "<p>" + vides + " question" + (vides > 1 ? "s restent" : " reste") + " sans réponse.</p>",
      [{ libelle: "Continuer le quiz", valeur: false, classe: "discret" }, { libelle: "Terminer quand même", valeur: true, classe: "principal" }])
      .then(function (oui) { if (oui) self.terminer(); });
  };

  /* Validation et correction (mode entraînement) ------------------------------------------- */

  P.valider = function (passer) {
    var self = this, S = this.session, q = this.questionCourante();
    var v = passer ? null : this.widget.lire();
    if (!passer && (v == null || v === "") && q.type !== "ouverte") {
      this.aide.hidden = false;
      this.aide.textContent = "Choisir ou saisir une réponse, ou cliquer sur « Je ne sais pas ».";
      return;
    }
    this.accumuler();
    S.reponses[q.id] = v;
    this.actions.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
    if (q.type === "code" && v != null) {
      this.retour.className = "quiz-retour attente";
      this.retour.innerHTML = "";
      this.retour.appendChild(el("p", "quiz-retour-titre", "Correction : exécution de ta réponse…"));
    }
    this.noter(q, v).then(function (r) {
      S.scores[q.id] = r.score;
      if (r.rapport) S.rapports[q.id] = r.rapport;
      S.valide[q.id] = true;
      if (self.ecran === "question" && self.questionCourante().id === q.id) {
        self.montrerCorrection(true);
        A.claude.rafraichir();
      }
      self.sauver(true);
    }).catch(function (e) {
      self.retour.className = "quiz-retour faux";
      self.retour.textContent = "Correction impossible : " + e.message;
      self.boutonsQuestion();
    });
  };

  P.montrerCorrection = function () {
    var self = this, S = this.session, q = this.questionCourante(), v = S.reponses[q.id];
    this.widget.verrouiller();
    this.widget.corriger(v);
    this.majOutils();
    if (S.scores[q.id] === null) {
      // Auto-évaluation (question ouverte, ou code non exécutable) : le retour attend la note
      var modele = this.blocModele(q, function (note) {
        S.scores[q.id] = note;
        self.remplirRetour();
        self.boutonsSuite();
        self.sauver(true);
      });
      this.zoneRep.appendChild(modele);
      O.enrichir(modele);
      this.retour.innerHTML = "";
      this.retour.className = "quiz-retour";
      this.actions.innerHTML = "";
      return;
    }
    if (q.type === "ouverte" || (q.type === "code" && (S.rapports[q.id] || {}).type === "indisponible")) {
      var m = this.blocModele(q, function (note) {
        S.scores[q.id] = note;
        self.remplirRetour();
        self.sauver(true);
      });
      this.zoneRep.appendChild(m);
      O.enrichir(m);
    }
    this.remplirRetour();
    this.boutonsSuite();
  };

  // Réponse modèle, points attendus, auto-évaluation et correction par Claude
  P.blocModele = function (q, surNote) {
    var self = this, S = this.session;
    var bloc = el("div", "quiz-modele");
    if (q.type === "code") {
      var r = S.rapports[q.id];
      if (r && r.message) bloc.appendChild(el("p", "quiz-alerte", r.message));
      bloc.appendChild(el("p", "quiz-modele-titre", "Solution de référence"));
      bloc.appendChild(html("div", null, A.types.code.solution(q)));
    } else if (A.types[q.type].blocModele) {
      // Type qui fournit lui-même sa réponse modèle (l'atelier)
      var rap = S.rapports[q.id];
      if (rap && rap.message) bloc.appendChild(el("p", "quiz-alerte", rap.message));
      bloc.appendChild(el("p", "quiz-modele-titre", "Solution proposée"));
      bloc.appendChild(A.types[q.type].blocModele(q));
    } else {
      bloc.appendChild(el("p", "quiz-modele-titre", "Réponse modèle"));
      bloc.appendChild(html("div", null, q.reponse_modele));
      if (q.criteres && q.criteres.length) {
        bloc.appendChild(el("p", "quiz-criteres-titre", "Points attendus"));
        var ul = el("ul");
        q.criteres.forEach(function (c) { ul.appendChild(html("li", null, c)); });
        bloc.appendChild(ul);
      }
    }
    var zoneClaude = el("div", "quiz-correction-claude");
    bloc.appendChild(zoneClaude);
    if (S.corrections[q.id]) zoneClaude.appendChild(this.blocCorrection(S.corrections[q.id]));

    var ev = el("div", "auto-eval");
    ev.appendChild(el("span", null, "Ma réponse était :"));
    [["Juste", 1], ["En partie juste", 0.5], ["Fausse", 0]].forEach(function (x) {
      var b = O.bouton(x[0], null, function () {
        ev.querySelectorAll(".bouton").forEach(function (y) { y.classList.remove("choisi"); });
        b.classList.add("choisi");
        surNote(x[1]);
      });
      if (S.scores[q.id] === x[1]) b.classList.add("choisi");
      ev.appendChild(b);
    });
    if (q.type === "ouverte" && A.connexion.claudeDisponible() && S.reponses[q.id]) {
      var bc = O.bouton("Faire corriger par Claude", "bouton-claude", function () {
        bc.disabled = true;
        zoneClaude.innerHTML = "";
        zoneClaude.appendChild(el("p", "quiz-aide", "Claude corrige ta réponse…"));
        A.connexion.corriger({
          enonce: O.texteDe(q.enonce),
          solution: O.texteDe(q.reponse_modele),
          criteres: (q.criteres || []).map(O.texteDe)
        }, S.reponses[q.id]).then(function (c) {
          c.date = new Date().toISOString();
          S.corrections[q.id] = c;
          zoneClaude.innerHTML = "";
          zoneClaude.appendChild(self.blocCorrection(c));
          O.enrichir(zoneClaude);
          ev.querySelectorAll(".bouton").forEach(function (y) { y.classList.toggle("choisi", y.textContent === ["Fausse", "En partie juste", "Juste"][c.note * 2]); });
          surNote(c.note);
        }).catch(function (e) {
          zoneClaude.innerHTML = "";
          zoneClaude.appendChild(el("p", "quiz-alerte", "Correction impossible : " + e.message));
        }).finally(function () { bc.disabled = false; });
      }, "claude");
      ev.appendChild(bc);
    }
    bloc.appendChild(ev);
    return bloc;
  };

  P.blocCorrection = function (c) {
    var b = el("div", "correction-claude");
    b.appendChild(el("p", "correction-claude-titre", "Correction de Claude : " + (c.note === 1 ? "juste" : c.note === 0.5 ? "en partie juste" : "fausse")));
    b.appendChild(el("p", null, c.commentaire));
    if (c.points_manquants && c.points_manquants.length) {
      var ul = el("ul");
      c.points_manquants.forEach(function (p) { ul.appendChild(el("li", null, p)); });
      b.appendChild(el("p", "correction-claude-sous-titre", "À ajouter ou corriger"));
      b.appendChild(ul);
    }
    return b;
  };

  P.remplirRetour = function () {
    var S = this.session, q = this.questionCourante(), type = A.types[q.type], s = S.scores[q.id];
    this.retour.innerHTML = "";
    var classe, texte;
    if (s === 1) { classe = "juste"; texte = "Bonne réponse"; }
    else if (s > 0) { classe = "partiel"; texte = "En partie juste (" + O.pourcent(s) + " %)"; }
    else { classe = "faux"; texte = this.repondue(q.id) ? "Mauvaise réponse" : "Pas de réponse"; }
    if ((S.indices[q.id] || 0) && Number(this.d.penalite_indice)) texte += " · " + S.indices[q.id] + " indice" + (S.indices[q.id] > 1 ? "s" : "") + " utilisé" + (S.indices[q.id] > 1 ? "s" : "");
    this.retour.className = "quiz-retour " + classe;
    this.retour.appendChild(el("p", "quiz-retour-titre", texte));
    if (S.rapports[q.id] && S.rapports[q.id].type !== "indisponible") this.retour.appendChild(A.code.rapport(S.rapports[q.id]));
    if (type.attendu && s < 1) {
      this.retour.appendChild(html("p", "quiz-attendu", "<b>Réponse attendue :</b> " + type.solution(q)));
      var acc = type.acceptees ? type.acceptees(q) : [];
      if (acc.length > 1) this.retour.appendChild(html("p", "quiz-acceptees", "<b>Réponses acceptées :</b> " + acc.map(O.echapper).join(" · ")));
    }
    if (q.type === "code" && s < 1 && q.solution && (S.rapports[q.id] || {}).type !== "indisponible") {
      var sol = el("details", "quiz-solution-code");
      sol.appendChild(el("summary", null, "Voir la solution de référence"));
      sol.appendChild(html("div", null, A.types.code.solution(q)));
      this.retour.appendChild(sol);
    }
    if (q.explication) this.retour.appendChild(html("div", "quiz-explication", q.explication));
    if (q.revoir) {
      var p = el("p", "quiz-revoir");
      var a = el("a", null, "Revoir : " + q.revoir.texte);
      a.href = q.revoir.lien;
      p.appendChild(a);
      this.retour.appendChild(p);
    }
    O.enrichir(this.retour);
  };

  P.boutonsSuite = function () {
    var self = this, S = this.session, i = S.index, dernier = i === S.ordre.length - 1;
    this.actions.innerHTML = "";
    this.actions.appendChild(O.bouton("Enregistrer et quitter", "discret", function () { self.quitter(); }, "pause"));
    this.actions.appendChild(el("span", "espace"));
    var b = O.bouton(dernier ? "Voir les résultats" : "Suivante →", "principal", function () {
      if (dernier) self.terminer(); else { self.afficherQuestion(i + 1); self.sauver(); }
    });
    this.actions.appendChild(b);
    b.focus({ preventScroll: true });
  };

  /* Clavier -------------------------------------------------------------------------------- */

  P.clavier = function (e) {
    if (this.ecran !== "question" || e.altKey || e.metaKey) return;
    var cible = e.target;
    if (cible.closest && cible.closest(".claude-panneau, dialog, .editeur, .atelier-code")) return;
    var saisie = /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName) && !(cible.type === "radio" || cible.type === "checkbox");
    if (e.key === "Enter") {
      if (cible.tagName === "TEXTAREA" && !e.ctrlKey) return;
      if (cible.tagName === "BUTTON" || cible.tagName === "A" || cible.tagName === "SUMMARY") return;
      var principal = this.actions && this.actions.querySelector(".bouton.principal:not(:disabled)");
      if (principal) { e.preventDefault(); principal.click(); }
      return;
    }
    if (saisie || e.ctrlKey || !this.widget || !this.widget.choisir) return;
    var pos = -1;
    if (/^[1-9]$/.test(e.key)) pos = Number(e.key) - 1;
    else if (/^[a-z]$/i.test(e.key)) pos = e.key.toUpperCase().charCodeAt(0) - 65;
    if (pos >= 0) { e.preventDefault(); this.widget.choisir(pos); }
  };
})(window.QuizApp);
