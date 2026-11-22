/* ==========================================================================
   Quiz · écran d'accueil (prototype de QuizApp.Quiz)
   Reprise d'un quiz en cours, réglages (mode, thèmes, types, nombre),
   historique des tentatives, génération et questions à Claude.
   ========================================================================== */
(function (A) {
  'use strict';

  var O = A.outils,
    el = O.el,
    html = O.html,
    T = A.t,
    Tn = A.tn;
  var P = A.Quiz.prototype;

  P.accueil = function () {
    var self = this,
      R = this.reglages,
      C = A.connexion;
    A.archives.oublier();
    this.vider();
    this.ecran = 'accueil';
    this.session = null;
    this.revue = false;
    var themes = this.themes(),
      noms = Object.keys(themes);
    var types = this.typesPresents(),
      nomsTypes = Object.keys(types);
    if (!R.themes) R.themes = noms.slice();
    if (!R.types) R.types = nomsTypes.slice();

    var sec = el('section', 'quiz-accueil');

    // Bandeau hors ligne
    if (!C.enLigne) {
      var hl = el('div', 'quiz-bandeau hors-ligne');
      hl.appendChild(html('p', null, T('accueil.horsLigne')));
      hl.appendChild(
        O.bouton(C.serveurDetecte ? T('accueil.ouvrirServeur') : T('accueil.activerServeur'), 'petit', function () {
          if (C.serveurDetecte) location.href = C.urlServeur();
          else A.dialogues.serveur();
        }),
      );
      sec.appendChild(hl);
    }

    // Génération lancée précédemment depuis cette page ou une autre
    var bandeauTache = el('div', 'quiz-bandeau tache');
    bandeauTache.hidden = true;
    sec.appendChild(bandeauTache);
    A.dialogues.tacheEnCours().then(function (t) {
      if (!t) return;
      bandeauTache.hidden = false;
      bandeauTache.appendChild(
        el(
          'p',
          null,
          t.etat === 'en_cours'
            ? T('accueil.generationEnCours')
            : t.etat === 'terminee'
              ? T('accueil.generationPrete')
              : T('accueil.generationEchec'),
        ),
      );
      bandeauTache.appendChild(
        O.bouton(T('accueil.voir'), 'petit', function () {
          A.dialogues.suivre(t.id);
        }),
      );
    });

    // Quiz en cours
    var reprise = el('div', 'quiz-reprise');
    reprise.hidden = true;
    sec.appendChild(reprise);

    // Chiffres clés
    var resume = el('div', 'quiz-resume');
    function tuile(val, txt) {
      var d = el('div');
      d.appendChild(el('strong', null, val));
      d.appendChild(el('span', null, txt));
      resume.appendChild(d);
    }
    tuile(String(this.d.questions.length), T('accueil.tuileQuestions'));
    if (noms.length > 1) tuile(String(noms.length), T('accueil.tuileThemes'));
    tuile(String(nomsTypes.length), nomsTypes.length > 1 ? T('accueil.tuileTypes') : A.libelleType(nomsTypes[0]));
    tuile('≈ ' + this.dureeEstimee() + ' min', T('accueil.tuileDuree'));
    sec.appendChild(resume);

    // Mode
    var fsMode = el('fieldset', 'quiz-reglage');
    fsMode.appendChild(el('legend', null, T('accueil.mode')));
    var modes = el('div', 'modes');
    [
      ['entrainement', T('mode.entrainement'), T('accueil.entrainementDesc')],
      ['examen', T('mode.examen'), T('accueil.examenDesc')],
    ].forEach(function (m) {
      var lab = el('label', 'mode');
      var inp = el('input');
      inp.type = 'radio';
      inp.name = 'quiz-mode';
      inp.value = m[0];
      inp.checked = R.mode === m[0];
      inp.addEventListener('change', function () {
        R.mode = m[0];
      });
      lab.appendChild(inp);
      lab.appendChild(el('span', 'mode-titre', m[1]));
      lab.appendChild(el('span', 'mode-desc', m[2]));
      modes.appendChild(lab);
    });
    fsMode.appendChild(modes);
    sec.appendChild(fsMode);

    // Filtres : thèmes et types
    function filtre(titre, liste, compte, choisis, libelle) {
      var fs = el('fieldset', 'quiz-reglage');
      fs.appendChild(el('legend', null, titre));
      var zone = el('div', 'themes');
      liste.forEach(function (n) {
        var lab = el('label', 'theme-puce');
        var inp = el('input');
        inp.type = 'checkbox';
        inp.checked = choisis.indexOf(n) >= 0;
        inp.addEventListener('change', function () {
          var i = choisis.indexOf(n);
          if (inp.checked && i < 0) choisis.push(n);
          if (!inp.checked && i >= 0) choisis.splice(i, 1);
          majNombre();
        });
        lab.appendChild(inp);
        lab.appendChild(document.createTextNode(libelle ? libelle(n) : n));
        lab.appendChild(el('small', null, String(compte[n])));
        zone.appendChild(lab);
      });
      fs.appendChild(zone);
      sec.appendChild(fs);
    }
    if (noms.length > 1) filtre(T('accueil.themes'), noms, themes, R.themes);
    if (nomsTypes.length > 1) filtre(T('accueil.types'), nomsTypes, types, R.types, A.libelleType);

    // Nombre, mélange
    var fsQ = el('fieldset', 'quiz-reglage');
    fsQ.appendChild(el('legend', null, T('accueil.questions')));
    var ligne = el('div', 'reglages-ligne');
    var labN = el('label', null, T('accueil.nombre'));
    var selN = el('select');
    labN.appendChild(selN);
    ligne.appendChild(labN);
    var labM = el('label');
    var chkM = el('input');
    chkM.type = 'checkbox';
    chkM.checked = R.melanger;
    chkM.addEventListener('change', function () {
      R.melanger = chkM.checked;
    });
    labM.appendChild(chkM);
    labM.appendChild(document.createTextNode(T('accueil.melanger')));
    ligne.appendChild(labM);
    fsQ.appendChild(ligne);
    sec.appendChild(fsQ);

    function disponibles() {
      return self.d.questions.filter(function (q) {
        return R.themes.indexOf(q.theme || 'Général') >= 0 && R.types.indexOf(q.type) >= 0;
      });
    }
    var alerte = el('p', 'quiz-alerte');
    alerte.hidden = true;
    function majNombre() {
      var n = disponibles().length;
      selN.innerHTML = '';
      var opts = [0].concat(
        [5, 10, 15, 20, 30].filter(function (x) {
          return x < n;
        }),
      );
      opts.forEach(function (x) {
        var o = el('option', null, x === 0 ? T('accueil.toutes', { n: n }) : String(x));
        o.value = x;
        selN.appendChild(o);
      });
      selN.value = opts.indexOf(R.nombre) >= 0 ? R.nombre : 0;
      alerte.hidden = n > 0;
      alerte.textContent = T('accueil.aucuneQuestion');
      demarrer.disabled = n === 0;
    }
    selN.addEventListener('change', function () {
      R.nombre = Number(selN.value);
    });

    var actions = el('div', 'quiz-actions');
    var demarrer = O.bouton(T('accueil.commencer'), 'principal', function () {
      var qs = disponibles();
      if (R.melanger) qs = O.melanger(qs);
      if (R.nombre) qs = qs.slice(0, R.nombre);
      self.commencer(qs);
    });
    actions.appendChild(demarrer);
    actions.appendChild(el('span', 'espace'));
    actions.appendChild(
      O.bouton(
        T('accueil.questionClaude'),
        'discret',
        function () {
          self.ouvrirClaudeGeneral();
        },
        'claude',
      ),
    );
    actions.appendChild(
      O.bouton(
        T('accueil.generer'),
        'discret',
        function () {
          self.dialogueGeneration();
        },
        'generer',
      ),
    );
    sec.appendChild(alerte);
    sec.appendChild(actions);
    sec.appendChild(el('p', 'quiz-cle-clavier', T('accueil.raccourcis')));

    // Historique
    var hist = el('section', 'quiz-historique');
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
    A.archives
      .lister(this.d.id)
      .then(function (liste) {
        self.tentatives = liste;
        var enCours =
          liste.filter(function (t) {
            return t.statut === 'en_cours';
          })[0] || null;
        self.resumeEnCours = enCours;
        if (enCours) self.afficherReprise(reprise, enCours);
        var autres = liste.filter(function (t) {
          return t.statut !== 'en_cours';
        });
        if (!autres.length) return;
        hist.hidden = false;
        var tete = el('div', 'quiz-historique-tete');
        tete.appendChild(el('h2', null, T('accueil.tentatives')));
        var finies = autres.filter(function (t) {
          return t.statut === 'terminee' && t.score;
        });
        if (finies.length) {
          var meilleur = Math.max.apply(
            null,
            finies.map(function (t) {
              return t.score.pourcent;
            }),
          );
          tete.appendChild(
            el('p', 'quiz-historique-meilleur', Tn('accueil.meilleur', finies.length, { pourcent: meilleur })),
          );
        }
        hist.appendChild(tete);
        if (finies.length > 1) hist.appendChild(self.courbe(finies.slice(0, 12).reverse()));
        var table = el('div', 'tentatives');
        autres.slice(0, 20).forEach(function (t) {
          var ligne = el('div', 'tentative ' + t.statut);
          var date = el('span', 'tentative-date', O.dateLisible(t.debut));
          ligne.appendChild(date);
          ligne.appendChild(
            el('span', 'tentative-mode', t.mode === 'examen' ? T('mode.examen') : T('mode.entrainement')),
          );
          var sc = el('span', 'tentative-score');
          if (t.statut === 'abandonnee')
            sc.appendChild(el('span', 'badge', T('accueil.abandonnee', { repondues: t.repondues, nb: t.nb })));
          else if (t.score) {
            var barre = el('span', 'mini-barre');
            var rem = el('span');
            rem.style.setProperty('--p', String(t.score.pourcent / 100));
            barre.appendChild(rem);
            sc.appendChild(barre);
            sc.appendChild(el('strong', null, t.score.pourcent + ' %'));
          }
          ligne.appendChild(sc);
          ligne.appendChild(el('span', 'tentative-duree', t.duree_ms ? O.duree(t.duree_ms) : ''));
          var marques = el('span', 'tentative-marques');
          if (t.evaluation) marques.appendChild(el('span', 'badge matiere', T('accueil.bilanClaude')));
          if (t.locale && !t.fichier) marques.appendChild(el('span', 'badge', T('accueil.navigateur')));
          ligne.appendChild(marques);
          ligne.appendChild(
            O.bouton(T('accueil.revoir'), 'petit', function () {
              self.revoirTentative(t);
            }),
          );
          table.appendChild(ligne);
        });
        hist.appendChild(table);
        O.insecables(hist);
      })
      .then(function () {
        self.suivreAncre();
      });
  };

  // Petite courbe des scores des dernières tentatives terminées
  P.courbe = function (liste) {
    var l = 240,
      h = 48,
      n = liste.length;
    var pts = liste.map(function (t, i) {
      return [
        Math.round(6 + (i * (l - 12)) / Math.max(1, n - 1)),
        Math.round(h - 6 - (t.score.pourcent / 100) * (h - 12)),
      ];
    });
    var svg =
      '<svg class="quiz-courbe" viewBox="0 0 ' +
      l +
      ' ' +
      h +
      '" width="' +
      l +
      '" height="' +
      h +
      '" role="img" aria-label="' +
      T('accueil.evolution') +
      '">' +
      '<line class="axe" x1="0" y1="' +
      (h - 6) +
      '" x2="' +
      l +
      '" y2="' +
      (h - 6) +
      '"/>' +
      '<polyline points="' +
      pts
        .map(function (p) {
          return p.join(',');
        })
        .join(' ') +
      '"/>' +
      pts
        .map(function (p, i) {
          return (
            '<circle cx="' +
            p[0] +
            '" cy="' +
            p[1] +
            '" r="3"><title>' +
            liste[i].score.pourcent +
            ' %</title></circle>'
          );
        })
        .join('') +
      '</svg>';
    return html('div', 'quiz-courbe-cadre', svg);
  };

  P.afficherReprise = function (zone, t) {
    var self = this;
    zone.hidden = false;
    zone.innerHTML = '';
    var txt = el('div', 'quiz-reprise-texte');
    txt.appendChild(el('strong', null, T('accueil.quizEnCours')));
    txt.appendChild(
      el(
        'span',
        null,
        Tn('accueil.reprise', t.repondues, {
          position: (t.position || 0) + 1,
          nb: t.nb,
          mode: t.mode === 'examen' ? T('mode.examenMin') : T('mode.entrainementMin'),
          date: O.dateLisible(t.maj || t.debut),
        }),
      ),
    );
    zone.appendChild(txt);
    var b = el('div', 'quiz-reprise-actions');
    b.appendChild(
      O.bouton(
        T('accueil.reprendre'),
        'principal',
        function () {
          self.reprendre(t);
        },
        'reprendre',
      ),
    );
    b.appendChild(
      O.bouton(T('accueil.abandonner'), 'discret', function () {
        A.dialogues
          .confirmer(T('accueil.abandonnerTitre'), '<p>' + T('accueil.abandonnerTexte') + '</p>', [
            { libelle: T('commun.annuler'), valeur: false, classe: 'discret' },
            { libelle: T('accueil.abandonner'), valeur: true, classe: 'principal' },
          ])
          .then(function (oui) {
            if (!oui) return;
            A.archives
              .lire(self.d.id, t)
              .then(function (complete) {
                return complete ? A.archives.abandonner(complete) : null;
              })
              .then(function () {
                self.accueil();
              });
          });
      }),
    );
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
    A.dialogues
      .confirmer(
        T('accueil.dejaEnCours'),
        '<p>' + Tn('accueil.dejaEnCoursTexte', t.repondues, { position: (t.position || 0) + 1, nb: t.nb }) + '</p>',
        [
          { libelle: T('commun.annuler'), valeur: null, classe: 'discret' },
          { libelle: T('accueil.recommencer'), valeur: 'nouveau' },
          { libelle: T('accueil.reprendre'), valeur: 'reprendre', classe: 'principal' },
        ],
      )
      .then(function (choix) {
        if (choix === 'reprendre') self.reprendre(t);
        else if (choix === 'nouveau') {
          A.archives
            .lire(self.d.id, t)
            .then(function (c) {
              return c ? A.archives.abandonner(c) : null;
            })
            .then(function () {
              self.resumeEnCours = null;
              go();
            });
        }
      });
  };

  // Complète une session archivée par une version antérieure du moteur
  function completer(s) {
    ['etats', 'reponses', 'scores', 'valide', 'rapports', 'corrections', 'indices', 'temps', 'conversations'].forEach(
      function (k) {
        if (!s[k]) s[k] = {};
      },
    );
    return s;
  }

  P.reprendre = function (resume) {
    var self = this;
    A.archives.lire(this.d.id, resume).then(function (t) {
      if (!t || !t.session) {
        O.notifier(T('accueil.tentativeIntrouvable'), 'erreur');
        return;
      }
      self.session = completer(t.session);
      self.session.statut = 'en_cours';
      self.session.fichier = resume.fichier || null;
      self.revue = false;
      var n = self.questions().length;
      if (!n) {
        O.notifier(T('accueil.questionsDisparues'), 'erreur');
        return;
      }
      self.afficherQuestion(Math.min(self.session.index || 0, n - 1));
    });
  };

  P.revoirTentative = function (resume) {
    var self = this;
    A.archives.lire(this.d.id, resume).then(function (t) {
      if (!t || !t.session) {
        O.notifier(T('accueil.tentativeIntrouvable'), 'erreur');
        return;
      }
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
    history.replaceState(null, '', location.pathname + location.search);
    if (h === '#reprendre' && this.resumeEnCours) return this.reprendre(this.resumeEnCours);
    var m = h.match(/^#tentative=([\d_-]+)$/);
    if (m) {
      var t = (this.tentatives || []).filter(function (x) {
        return x.id === m[1];
      })[0];
      if (t) this.revoirTentative(t);
    }
  };

  P.dialogueGeneration = function () {
    var derniere = (this.tentatives || []).filter(function (t) {
      return t.statut === 'terminee';
    })[0];
    A.dialogues.generer({ donnees: this.d, page: A.connexion.page(), derniere: derniere });
  };
})(window.QuizApp);
