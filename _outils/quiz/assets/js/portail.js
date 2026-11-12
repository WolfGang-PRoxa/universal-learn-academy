/* ==========================================================================
   Quiz · portail (QuizApp.Portail)
   Page d'accueil du serveur local (_outils/quiz/portail.html) : quiz en cours à
   reprendre, puis, matière par matière, les cours générés et les quiz avec
   leurs résultats. Tout vient de /api/catalogue.
   ========================================================================== */
(function (A) {
  "use strict";

  var O = A.outils, el = O.el, html = O.html, C = A.connexion;

  // Lien relatif à la racine du serveur (pas d'URL absolue : la charte marquerait le lien comme externe)
  function lien(texte, page, classe, ancre) {
    var a = el("a", classe, texte);
    a.setAttribute("href", "/" + page.split("/").map(encodeURIComponent).join("/") + (ancre ? "#" + ancre : ""));
    return a;
  }

  function Portail(racine) {
    this.racine = racine;
    this.zone = el("div", "portail-zone");
    racine.appendChild(this.zone);
    this.afficher();
  }

  Portail.prototype.afficher = function () {
    var self = this;
    this.zone.innerHTML = "";
    if (!C.enLigne) {
      var b = el("div", "quiz-bandeau hors-ligne");
      b.appendChild(html("p", null, "<strong>Le portail a besoin du serveur local.</strong> Lancer <code>lancer.bat</code> (double-clic) : le portail s'ouvre alors tout seul dans le navigateur."));
      if (C.serveurDetecte) {
        var a = el("a", "bouton petit", "Ouvrir le portail du serveur");
        a.href = C.urlServeur("_outils/quiz/portail.html");
        b.appendChild(a);
      }
      this.zone.appendChild(b);
      return;
    }
    this.zone.appendChild(el("p", "quiz-attente", "Chargement…"));
    C.catalogue().then(function (cat) { self.rendre(cat); }).catch(function (e) {
      self.zone.innerHTML = "";
      self.zone.appendChild(el("p", "quiz-alerte", "Catalogue indisponible : " + e.message));
    });
  };

  Portail.prototype.rendre = function (cat) {
    var z = this.zone;
    z.innerHTML = "";
    var matieres = cat.matieres || [];

    // Générations en cours
    var taches = (cat.taches || []).filter(function (t) { return t.etat === "en_cours"; });
    if (taches.length) {
      var bt = el("div", "quiz-bandeau tache");
      bt.appendChild(el("p", null, taches.length + " génération" + (taches.length > 1 ? "s" : "") + " de quiz en cours."));
      bt.appendChild(O.bouton("Suivre", "petit", function () { A.dialogues.suivre(taches[0].id); }));
      z.appendChild(bt);
    }

    // Quiz en cours, toutes matières confondues
    var enCours = [];
    matieres.forEach(function (m) {
      m.quiz.forEach(function (q) { if (q.tentatives.en_cours) enCours.push({ m: m, q: q }); });
    });
    if (enCours.length) {
      var s = el("section", "portail-section");
      s.appendChild(el("h2", null, "À reprendre"));
      var liste = el("div", "portail-cartes");
      enCours.forEach(function (x) {
        var e = x.q.tentatives.en_cours;
        var carte = el("div", "portail-carte en-cours");
        carte.dataset.matiere = x.m.teinte;
        carte.appendChild(el("span", "portail-carte-matiere", x.m.nom + " · " + x.m.niveau));
        carte.appendChild(el("strong", null, x.q.titre));
        carte.appendChild(el("span", "portail-carte-info", "Question " + ((e.position || 0) + 1) + " sur " + e.nb + " · " + e.repondues + " réponse" + (e.repondues > 1 ? "s" : "") + " · " + O.dateLisible(e.maj)));
        var a = lien("Reprendre", x.q.page, "bouton principal petit", "reprendre");
        carte.appendChild(a);
        liste.appendChild(carte);
      });
      s.appendChild(liste);
      z.appendChild(s);
    }

    if (!matieres.length) {
      z.appendChild(html("p", "portail-vide", "Aucune matière pour l'instant. Demander à Claude de « traiter » un cours (charte <code>_outils/charte/README.md</code>) ou de générer un quiz (<code>_outils/quiz/README.md</code>)."));
      return;
    }

    // Une section par matière
    matieres.forEach(function (m) {
      var s = el("section", "portail-matiere");
      if (m.teinte) s.dataset.matiere = m.teinte;
      var tete = el("div", "portail-matiere-tete");
      tete.appendChild(el("span", "pastille"));
      var h = el("h2");
      h.appendChild(document.createTextNode(m.nom + " "));
      h.appendChild(el("small", null, m.niveau));
      tete.appendChild(h);
      if (m.accueil) tete.appendChild(lien("Accueil de la matière", m.accueil, "bouton petit discret"));
      s.appendChild(tete);

      var cols = el("div", "portail-colonnes");
      var cc = el("div", "portail-colonne");
      cc.appendChild(el("h3", null, "Cours"));
      if (m.cours.length) {
        var ul = el("ul", "portail-liste");
        m.cours.forEach(function (c) { var li = el("li"); li.appendChild(lien(c.titre, c.page)); ul.appendChild(li); });
        cc.appendChild(ul);
      } else cc.appendChild(el("p", "portail-vide", "Aucun cours mis en forme."));
      cols.appendChild(cc);

      var cq = el("div", "portail-colonne");
      cq.appendChild(el("h3", null, "Quiz"));
      if (m.quiz.length) {
        m.quiz.forEach(function (q) {
          var t = q.tentatives, carte = el("div", "portail-quiz");
          var titre = el("div", "portail-quiz-titre");
          titre.appendChild(lien(q.titre, q.page));
          titre.appendChild(el("span", "portail-quiz-info", q.nb + " questions · " + q.types.map(function (x) { return A.LIBELLES_TYPES[x] || x; }).join(", ")));
          carte.appendChild(titre);
          var stats = el("div", "portail-quiz-stats");
          if (t.nombre) {
            stats.appendChild(html("span", null, "Meilleur <strong>" + t.meilleur + " %</strong>"));
            var dernier = lien("dernière : " + t.dernier.pourcent + " % le " + O.dateLisible(t.dernier.date, false), q.page, null, "tentative=" + t.dernier.id);
            stats.appendChild(dernier);
            stats.appendChild(el("span", null, t.nombre + " tentative" + (t.nombre > 1 ? "s" : "")));
          } else stats.appendChild(el("span", null, "Jamais fait"));
          if (t.en_cours) {
            var r = lien("en cours : reprendre", q.page, "portail-reprendre", "reprendre");
            stats.appendChild(r);
          }
          carte.appendChild(stats);
          cq.appendChild(carte);
        });
      } else cq.appendChild(el("p", "portail-vide", "Aucun quiz : en demander un à Claude."));
      cols.appendChild(cq);
      s.appendChild(cols);

      // TD interactifs (atelier, _outils/atelier/) et avancement du travail enregistré
      if (m.travaux && m.travaux.length) {
        var ct = el("div", "portail-colonne portail-travaux");
        ct.appendChild(el("h3", null, "TD interactifs"));
        m.travaux.forEach(function (t) {
          var carte = el("div", "portail-quiz");
          var titre = el("div", "portail-quiz-titre");
          titre.appendChild(lien(t.titre, t.page));
          titre.appendChild(el("span", "portail-quiz-info", t.ateliers + " atelier" + (t.ateliers > 1 ? "s" : "")));
          carte.appendChild(titre);
          var stats = el("div", "portail-quiz-stats");
          stats.appendChild(el("span", null, t.commences ? t.commences + " commencé" + (t.commences > 1 ? "s" : "") + " sur " + t.ateliers : "Pas commencé"));
          if (t.corriges) stats.appendChild(el("span", null, t.corriges + " corrigé" + (t.corriges > 1 ? "s" : "") + " par Claude"));
          if (t.maj) stats.appendChild(el("span", null, "dernier travail le " + O.dateLisible(t.maj, false)));
          carte.appendChild(stats);
          ct.appendChild(carte);
        });
        s.appendChild(ct);
      }
      z.appendChild(s);
    });
    O.insecables(z);
  };

  A.Portail = Portail;
})(window.QuizApp);
