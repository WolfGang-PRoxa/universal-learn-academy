/* ==========================================================================
   Quiz · portail (QuizApp.Portail)
   Page d'accueil du serveur local (_outils/quiz/portail.html) : quiz en cours à
   reprendre, puis, matière par matière, les cours générés et les quiz avec
   leurs résultats. Tout vient de /api/catalogue.
   ========================================================================== */
(function (A) {
  'use strict';

  var O = A.outils,
    el = O.el,
    html = O.html,
    C = A.connexion,
    T = A.t,
    Tn = A.tn;

  // Lien relatif à la racine du serveur (pas d'URL absolue : la charte marquerait le lien comme externe)
  function lien(texte, page, classe, ancre) {
    var a = el('a', classe, texte);
    a.setAttribute('href', '/' + page.split('/').map(encodeURIComponent).join('/') + (ancre ? '#' + ancre : ''));
    return a;
  }

  function Portail(racine) {
    this.racine = racine;
    this.zone = el('div', 'portail-zone');
    racine.appendChild(this.zone);
    this.libeller();
    this.afficher();
    // Langue changée dans l'application : textes de la page refaits
    var self = this;
    document.addEventListener('ula:langue', function () {
      self.libeller();
      self.afficher();
    });
  }

  // Textes fixes de portail.html, dans la langue de l'application
  Portail.prototype.libeller = function () {
    document.documentElement.lang = A.langue();
    document.title = T('portail.titre');
    var fil = document.querySelector('.fil [aria-current=page]');
    if (fil) fil.textContent = T('portail.fil');
    var entete = this.racine.querySelector('.entete');
    if (entete) {
      var sur = entete.querySelector('.surtitre');
      if (sur) {
        sur.innerHTML = '';
        sur.appendChild(el('span', 'badge matiere', T('portail.badge')));
        sur.appendChild(document.createTextNode(' ' + T('portail.surtitre')));
      }
      var h1 = entete.querySelector('h1');
      if (h1) h1.textContent = T('portail.h1');
      var chapeau = entete.querySelector('.chapeau');
      if (chapeau) chapeau.textContent = T('portail.chapeau');
    }
    var pied = document.querySelector('footer.pied');
    if (pied) pied.innerHTML = T('portail.pied');
  };

  Portail.prototype.afficher = function () {
    var self = this;
    this.zone.innerHTML = '';
    if (!C.enLigne) {
      var b = el('div', 'quiz-bandeau hors-ligne');
      b.appendChild(html('p', null, T('portail.horsLigne')));
      if (C.serveurDetecte) {
        var a = el('a', 'bouton petit', T('portail.ouvrirServeur'));
        a.href = C.urlServeur('_outils/quiz/portail.html');
        b.appendChild(a);
      }
      this.zone.appendChild(b);
      return;
    }
    this.zone.appendChild(el('p', 'quiz-attente', T('portail.chargement')));
    C.catalogue()
      .then(function (cat) {
        self.rendre(cat);
      })
      .catch(function (e) {
        self.zone.innerHTML = '';
        self.zone.appendChild(el('p', 'quiz-alerte', T('portail.indisponible', { message: e.message })));
      });
  };

  Portail.prototype.rendre = function (cat) {
    var z = this.zone;
    z.innerHTML = '';
    var matieres = cat.matieres || [];

    // Générations en cours
    var taches = (cat.taches || []).filter(function (t) {
      return t.etat === 'en_cours';
    });
    if (taches.length) {
      var bt = el('div', 'quiz-bandeau tache');
      bt.appendChild(el('p', null, Tn('portail.generations', taches.length)));
      bt.appendChild(
        O.bouton(T('portail.suivre'), 'petit', function () {
          A.dialogues.suivre(taches[0].id);
        }),
      );
      z.appendChild(bt);
    }

    // Quiz en cours, toutes matières confondues
    var enCours = [];
    matieres.forEach(function (m) {
      m.quiz.forEach(function (q) {
        if (q.tentatives.en_cours) enCours.push({ m: m, q: q });
      });
    });
    if (enCours.length) {
      var s = el('section', 'portail-section');
      s.appendChild(el('h2', null, T('portail.aReprendre')));
      var liste = el('div', 'portail-cartes');
      enCours.forEach(function (x) {
        var e = x.q.tentatives.en_cours;
        var carte = el('div', 'portail-carte en-cours');
        carte.dataset.matiere = x.m.teinte;
        carte.appendChild(el('span', 'portail-carte-matiere', x.m.nom + ' · ' + x.m.niveau));
        carte.appendChild(el('strong', null, x.q.titre));
        carte.appendChild(
          el(
            'span',
            'portail-carte-info',
            Tn('portail.position', e.repondues, {
              position: (e.position || 0) + 1,
              nb: e.nb,
              date: O.dateLisible(e.maj),
            }),
          ),
        );
        var a = lien(T('portail.reprendre'), x.q.page, 'bouton principal petit', 'reprendre');
        carte.appendChild(a);
        liste.appendChild(carte);
      });
      s.appendChild(liste);
      z.appendChild(s);
    }

    if (!matieres.length) {
      z.appendChild(html('p', 'portail-vide', T('portail.aucuneMatiere')));
      return;
    }

    // Une section par matière
    matieres.forEach(function (m) {
      var s = el('section', 'portail-matiere');
      if (m.teinte) s.dataset.matiere = m.teinte;
      var tete = el('div', 'portail-matiere-tete');
      tete.appendChild(el('span', 'pastille'));
      var h = el('h2');
      h.appendChild(document.createTextNode(m.nom + ' '));
      h.appendChild(el('small', null, m.niveau));
      tete.appendChild(h);
      if (m.accueil) tete.appendChild(lien(T('portail.accueilMatiere'), m.accueil, 'bouton petit discret'));
      s.appendChild(tete);

      var cols = el('div', 'portail-colonnes');
      var cc = el('div', 'portail-colonne');
      cc.appendChild(el('h3', null, T('portail.cours')));
      if (m.cours.length) {
        var ul = el('ul', 'portail-liste');
        m.cours.forEach(function (c) {
          var li = el('li');
          li.appendChild(lien(c.titre, c.page));
          ul.appendChild(li);
        });
        cc.appendChild(ul);
      } else cc.appendChild(el('p', 'portail-vide', T('portail.aucunCours')));
      cols.appendChild(cc);

      var cq = el('div', 'portail-colonne');
      cq.appendChild(el('h3', null, T('portail.quiz')));
      if (m.quiz.length) {
        m.quiz.forEach(function (q) {
          var t = q.tentatives,
            carte = el('div', 'portail-quiz');
          var titre = el('div', 'portail-quiz-titre');
          titre.appendChild(lien(q.titre, q.page));
          titre.appendChild(
            el(
              'span',
              'portail-quiz-info',
              T('portail.nbQuestions', { n: q.nb, types: q.types.map(A.libelleType).join(', ') }),
            ),
          );
          carte.appendChild(titre);
          var stats = el('div', 'portail-quiz-stats');
          if (t.nombre) {
            stats.appendChild(html('span', null, T('portail.meilleur', { pourcent: t.meilleur })));
            var dernier = lien(
              T('portail.derniere', { pourcent: t.dernier.pourcent, date: O.dateLisible(t.dernier.date, false) }),
              q.page,
              null,
              'tentative=' + t.dernier.id,
            );
            stats.appendChild(dernier);
            stats.appendChild(el('span', null, Tn('portail.tentatives', t.nombre)));
          } else stats.appendChild(el('span', null, T('portail.jamais')));
          if (t.en_cours) {
            var r = lien(T('portail.enCours'), q.page, 'portail-reprendre', 'reprendre');
            stats.appendChild(r);
          }
          carte.appendChild(stats);
          cq.appendChild(carte);
        });
      } else cq.appendChild(el('p', 'portail-vide', T('portail.aucunQuiz')));
      cols.appendChild(cq);
      s.appendChild(cols);

      // TD interactifs (atelier, _outils/atelier/) et avancement du travail enregistré
      if (m.travaux && m.travaux.length) {
        var ct = el('div', 'portail-colonne portail-travaux');
        ct.appendChild(el('h3', null, T('portail.td')));
        m.travaux.forEach(function (t) {
          var carte = el('div', 'portail-quiz');
          var titre = el('div', 'portail-quiz-titre');
          titre.appendChild(lien(t.titre, t.page));
          titre.appendChild(el('span', 'portail-quiz-info', Tn('portail.ateliers', t.ateliers)));
          carte.appendChild(titre);
          var stats = el('div', 'portail-quiz-stats');
          stats.appendChild(
            el(
              'span',
              null,
              t.commences ? Tn('portail.commences', t.commences, { total: t.ateliers }) : T('portail.pasCommence'),
            ),
          );
          if (t.corriges) stats.appendChild(el('span', null, Tn('portail.corriges', t.corriges)));
          if (t.maj)
            stats.appendChild(el('span', null, T('portail.dernierTravail', { date: O.dateLisible(t.maj, false) })));
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
