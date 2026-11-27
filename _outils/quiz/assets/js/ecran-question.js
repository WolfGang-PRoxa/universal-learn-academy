/* ==========================================================================
   Quiz · écran d'une question (prototype de QuizApp.Quiz)
   Énoncé, réponse, indices, aide de Claude, validation et correction ;
   navigation libre entre les questions, dans les deux modes ; enregistrement
   à chaque changement.
   ========================================================================== */
(function (A) {
  'use strict';

  var O = A.outils,
    el = O.el,
    html = O.html,
    T = A.t,
    Tn = A.tn;
  var P = A.Quiz.prototype;

  P.afficherQuestion = function (i) {
    var self = this,
      S = this.session,
      qs = this.questions(),
      q = qs[i],
      type = A.types[q.type];
    this.vider();
    this.ecran = 'question';
    S.index = i;
    this.chronoDebut = Date.now();
    if (!S.etats[q.id]) S.etats[q.id] = {};

    var carte = el('section', 'quiz-carte');
    carte.setAttribute('aria-labelledby', 'quiz-enonce');

    // En-tête : numéro, thème, difficulté, chronomètre, enregistrement
    var tete = el('div', 'quiz-tete');
    var cpt = el('span', 'quiz-compteur', T('question.numero', { n: i + 1 }) + ' ');
    cpt.appendChild(el('span', null, '/ ' + qs.length));
    tete.appendChild(cpt);
    if (q.theme) tete.appendChild(el('span', 'badge matiere', q.theme));
    if (q.difficulte) {
      var d = el('span', 'quiz-difficulte', '●●●'.slice(0, q.difficulte) + '○○○'.slice(0, 3 - q.difficulte));
      d.title = T('question.difficulte', {
        niveau: T(['question.facile', 'question.moyenne', 'question.difficile'][q.difficulte - 1]),
      });
      tete.appendChild(d);
    }
    tete.appendChild(el('span', 'espace'));
    if (S.mode === 'examen') {
      var chrono = el('span', 'quiz-chrono');
      var maj = function () {
        chrono.textContent = O.chrono(self.dureeTotale() + (Date.now() - self.chronoDebut));
      };
      maj();
      this.minuteur = setInterval(maj, 1000);
      tete.appendChild(chrono);
    }
    tete.appendChild(el('span', 'quiz-sauvegarde'));
    carte.appendChild(tete);

    var barre = el('div', 'quiz-barre');
    var rempli = el('span');
    rempli.style.setProperty('--p', String(i / qs.length));
    barre.appendChild(rempli);
    carte.appendChild(barre);

    carte.appendChild(this.navigateur(qs, i));

    var enonce = html(
      'div',
      'quiz-enonce',
      q.type === 'trous' ? q.enonce || '<p>' + T('question.completer') + '</p>' : q.enonce,
    );
    enonce.id = 'quiz-enonce';
    carte.appendChild(enonce);
    var consigne = q.consigne || (typeof type.consigne === 'function' ? type.consigne(q) : type.consigne);
    if (consigne) carte.appendChild(el('p', 'quiz-consigne', consigne));

    var zoneRep = el('div', 'quiz-reponse');
    carte.appendChild(zoneRep);
    this.zoneRep = zoneRep;
    this.widget = type.rendre(q, zoneRep, S.etats[q.id], S.reponses[q.id] === undefined ? null : S.reponses[q.id]);
    ['input', 'change'].forEach(function (ev) {
      zoneRep.addEventListener(ev, function () {
        self.surChangement();
      });
    });

    // Indices et aide
    this.zoneIndices = el('div', 'quiz-indices');
    carte.appendChild(this.zoneIndices);
    this.outils = el('div', 'quiz-outils');
    carte.appendChild(this.outils);
    this.majOutils();

    this.retour = el('div', 'quiz-retour');
    this.retour.setAttribute('aria-live', 'polite');
    carte.appendChild(this.retour);

    this.actions = el('div', 'quiz-actions');
    carte.appendChild(this.actions);
    this.zone.appendChild(carte);

    if (S.valide[q.id]) this.montrerCorrection(false);
    else this.boutonsQuestion();

    O.enrichir(carte);
    this.etatSauvegarde(A.connexion.enLigne ? (S.fichier ? 'enregistre' : '') : 'local', S.fichier);
    this.zone.focus({ preventScroll: true });
    this.remonter();
    if (A.claude.estOuvert()) this.ouvrirClaude(q.id, true);
  };

  P.questionCourante = function () {
    return this.questions()[this.session.index];
  };

  // Réponse modifiée : gardée dans la session (brouillon ou réponse d'examen), puis enregistrée
  P.surChangement = function () {
    var S = this.session,
      q = this.questionCourante();
    if (!q || S.valide[q.id] || !this.widget) return;
    S.reponses[q.id] = this.widget.lire();
    if (this.navigation) this.majNavigateur();
    this.sauver();
  };

  /* Navigation libre entre les questions ---------------------------------------------
     Les pastilles mènent à n'importe quelle question, dans les deux modes. En
     entraînement, une question corrigée prend la couleur de son résultat ; une
     réponse commencée mais pas encore validée est gardée comme brouillon. */

  P.allerA = function (k) {
    if (!this.session || k < 0 || k >= this.session.ordre.length || k === this.session.index) return;
    this.enregistrer();
    this.afficherQuestion(k);
    this.sauver();
  };

  P.navigateur = function (qs, i) {
    var self = this;
    var nav = el('nav', 'quiz-navigateur');
    nav.setAttribute('aria-label', T('accueil.questions'));
    this.navigation = nav;
    var fleche = function (texte, libelle, k) {
      var f = el('button', 'quiz-fleche', texte);
      f.type = 'button';
      f.setAttribute('aria-label', libelle);
      f.title = libelle;
      f.disabled = k < 0 || k >= qs.length;
      f.addEventListener('click', function () {
        self.allerA(k);
      });
      return f;
    };
    nav.appendChild(fleche('‹', T('navigation.precedente'), i - 1));
    qs.forEach(function (q, k) {
      var b = el('button', 'quiz-pastille', String(k + 1));
      b.type = 'button';
      if (k === i) b.setAttribute('aria-current', 'step');
      b.addEventListener('click', function () {
        self.allerA(k);
      });
      nav.appendChild(b);
    });
    nav.appendChild(fleche('›', T('navigation.suivante'), i + 1));
    this.majNavigateur();
    return nav;
  };

  // État d'une question pour sa pastille : a-faire, repondue, juste, partielle, fausse, a-evaluer
  P.etatQuestion = function (id) {
    var S = this.session;
    if (S.mode !== 'examen' && S.valide[id]) {
      var s = S.scores[id];
      if (s === null || s === undefined) return 'a-evaluer';
      return s === 1 ? 'juste' : s > 0 ? 'partielle' : 'fausse';
    }
    return this.repondue(id) ? 'repondue' : 'a-faire';
  };

  P.majNavigateur = function () {
    var self = this,
      qs = this.questions();
    if (!this.navigation) return;
    var etats = ['a-faire', 'repondue', 'juste', 'partielle', 'fausse', 'a-evaluer'];
    Array.prototype.forEach.call(this.navigation.querySelectorAll('.quiz-pastille'), function (b, k) {
      var etat = self.etatQuestion(qs[k].id);
      etats.forEach(function (e) {
        b.classList.toggle(e, e === etat);
      });
      var libelle = T('question.numero', { n: k + 1 }) + ' · ' + T('navigation.' + etat);
      b.setAttribute('aria-label', libelle);
      b.title = libelle;
    });
  };

  /* Indices et aide de Claude ----------------------------------------------------------- */

  P.majOutils = function () {
    var self = this,
      S = this.session,
      q = this.questionCourante();
    var indices = q.indices || [],
      vus = Math.min(S.indices[q.id] || 0, indices.length);
    this.zoneIndices.innerHTML = '';
    indices.slice(0, vus).forEach(function (t, k) {
      var b = el('div', 'quiz-indice');
      b.appendChild(
        el(
          'p',
          'quiz-indice-titre',
          indices.length > 1
            ? T('question.indiceSur', { n: k + 1, total: indices.length })
            : T('question.indiceN', { n: k + 1 }),
        ),
      );
      b.appendChild(html('div', null, t));
      self.zoneIndices.appendChild(b);
    });
    if (vus) O.enrichir(this.zoneIndices);
    this.outils.innerHTML = '';
    if (indices.length && vus < indices.length && !S.valide[q.id]) {
      var libelle = vus
        ? Tn('question.indiceSuivant', indices.length - vus)
        : indices.length > 1
          ? T('question.indices', { n: indices.length })
          : T('question.indice');
      var pen = Number(this.d.penalite_indice) || 0;
      var b = O.bouton(
        libelle,
        'petit',
        function () {
          S.indices[q.id] = vus + 1;
          self.majOutils();
          self.sauver();
        },
        'indice',
      );
      if (pen) b.title = T('question.penalite', { pourcent: Math.round(pen * 100) });
      this.outils.appendChild(b);
    }
    var conv = S.conversations[q.id];
    var nb = conv
      ? conv.messages.filter(function (m) {
          return m.role === 'claude';
        }).length
      : 0;
    var c = O.bouton(
      T('question.demanderClaude') + (nb ? ' (' + nb + ')' : ''),
      'petit bouton-claude',
      function () {
        self.ouvrirClaude(q.id);
      },
      'claude',
    );
    c.title = A.connexion.claudeDisponible() ? T('question.conversation') : T('question.sansServeur');
    this.outils.appendChild(c);
  };

  P.suggestionsQuestion = function (id) {
    var S = this.session,
      q = this.parId[id];
    var corrigee = Boolean(S.valide[id]);
    var code = q.type === 'code';
    if (!corrigee) {
      var l = [
        { libelle: T('suggestion.aide'), message: T('suggestion.aideMessage') },
        { libelle: T('suggestion.notion'), message: T('suggestion.notionMessage') },
        { libelle: T('suggestion.enonce'), message: T('suggestion.enonceMessage') },
        { libelle: T('suggestion.exemple'), message: T('suggestion.exempleMessage') },
        { libelle: T('suggestion.raisonnement'), message: T('suggestion.raisonnementMessage'), remplir: true },
      ];
      if (code) l.splice(1, 0, { libelle: T('suggestion.code'), message: T('suggestion.codeMessage') });
      return l;
    }
    var s = S.scores[id];
    var liste = [];
    if (s !== 1) liste.push({ libelle: T('suggestion.fausse'), message: T('suggestion.fausseMessage') });
    liste.push(
      { libelle: T('suggestion.correction'), message: T('suggestion.correctionMessage') },
      { libelle: T('suggestion.piege'), message: T('suggestion.piegeMessage') },
      { libelle: T('suggestion.exercice'), message: T('suggestion.exerciceMessage') },
      { libelle: T('suggestion.autre'), message: '', remplir: true },
    );
    return liste;
  };

  P.ouvrirClaude = function (id, silencieux) {
    var self = this,
      S = this.session,
      q = this.parId[id];
    var n = S.ordre.indexOf(id) + 1;
    A.claude.ouvrir({
      titre: T('question.aideTitre', { n: n }),
      sousTitre: [q.theme, this.meta.titre].filter(Boolean).join(' · '),
      conversation: this.conversation(id),
      contexte: function () {
        var c = self.contexteGeneral();
        c.question = self.contexteQuestion(id);
        return c;
      },
      suggestions: function () {
        return self.suggestionsQuestion(id);
      },
      surMaj: function () {
        self.sauver();
        if (self.ecran === 'question' && self.questionCourante() && self.questionCourante().id === id) self.majOutils();
      },
    });
    if (silencieux) return;
  };

  /* Boutons ---------------------------------------------------------------------------- */

  P.boutonsQuestion = function () {
    var self = this,
      S = this.session,
      i = S.index,
      dernier = i === S.ordre.length - 1;
    this.actions.innerHTML = '';
    var quitter = O.bouton(
      T('question.quitter'),
      'discret',
      function () {
        self.quitter();
      },
      'pause',
    );
    quitter.title = T('question.quitterTitre');
    if (S.mode === 'examen') {
      var prec = O.bouton(T('question.precedente'), null, function () {
        self.enregistrer();
        self.afficherQuestion(i - 1);
        self.sauver();
      });
      prec.disabled = i === 0;
      this.actions.appendChild(prec);
      this.actions.appendChild(quitter);
      this.actions.appendChild(el('span', 'espace'));
      this.actions.appendChild(
        O.bouton(T('question.terminer'), 'discret', function () {
          self.enregistrer();
          self.confirmerFin();
        }),
      );
      this.actions.appendChild(
        O.bouton(dernier ? T('question.resultats') : T('question.suivante'), 'principal', function () {
          self.enregistrer();
          if (dernier) self.confirmerFin();
          else {
            self.afficherQuestion(i + 1);
            self.sauver();
          }
        }),
      );
    } else {
      // Entraînement : on peut aussi passer à une autre question sans valider celle-ci
      // (flèches et pastilles du navigateur, ou ce bouton)
      this.actions.appendChild(quitter);
      this.actions.appendChild(el('span', 'espace'));
      if (!dernier) {
        var passer = O.bouton(T('question.passer'), 'discret', function () {
          self.allerA(i + 1);
        });
        passer.title = T('question.suivanteSansValider');
        this.actions.appendChild(passer);
      }
      this.actions.appendChild(
        O.bouton(T('question.jeNeSaisPas'), 'discret', function () {
          self.valider(true);
        }),
      );
      this.actions.appendChild(
        O.bouton(
          S.ordre.length && this.questionCourante().type === 'ouverte'
            ? T('question.voirReponse')
            : T('question.valider'),
          'principal',
          function () {
            self.valider(false);
          },
        ),
      );
    }
    var aide = el('p', 'quiz-aide', '');
    aide.hidden = true;
    this.aide = aide;
    this.actions.appendChild(aide);
  };

  P.enregistrer = function () {
    var S = this.session,
      q = this.questionCourante();
    if (this.widget && q && !S.valide[q.id]) S.reponses[q.id] = this.widget.lire();
  };

  P.quitter = function () {
    var self = this;
    this.enregistrer();
    this.accumuler();
    A.claude.fermer();
    this.sauver(true).then(function () {
      O.notifier(T('question.progressionEnregistree'));
      self.accueil();
    });
  };

  // Fin du quiz : prévenir s'il reste des questions sans réponse (ni réponse ni « Je ne sais pas »)
  P.confirmerFin = function () {
    var self = this,
      S = this.session;
    var vides = this.questions().filter(function (q) {
      return !self.repondue(q.id) && !S.valide[q.id];
    });
    if (!vides.length) return this.terminer();
    A.dialogues
      .confirmer(T('question.terminerTitre'), '<p>' + Tn('question.sansReponse', vides.length) + '</p>', [
        { libelle: T('question.continuer'), valeur: false, classe: 'discret' },
        { libelle: T('question.terminerQuandMeme'), valeur: true, classe: 'principal' },
      ])
      .then(function (oui) {
        if (oui) return self.terminer();
        // Retour à la première question restée sans réponse
        if (self.ecran === 'question') self.allerA(S.ordre.indexOf(vides[0].id));
      });
  };

  /* Validation et correction (mode entraînement) ------------------------------------------- */

  P.valider = function (passer) {
    var self = this,
      S = this.session,
      q = this.questionCourante();
    var v = passer ? null : this.widget.lire();
    if (!passer && (v == null || v === '') && q.type !== 'ouverte') {
      this.aide.hidden = false;
      this.aide.textContent = T('question.choisir');
      return;
    }
    this.accumuler();
    S.reponses[q.id] = v;
    this.actions.querySelectorAll('button').forEach(function (b) {
      b.disabled = true;
    });
    if (q.type === 'code' && v != null) {
      this.retour.className = 'quiz-retour attente';
      this.retour.innerHTML = '';
      this.retour.appendChild(el('p', 'quiz-retour-titre', T('question.execution')));
    }
    this.noter(q, v)
      .then(function (r) {
        S.scores[q.id] = r.score;
        if (r.rapport) S.rapports[q.id] = r.rapport;
        S.valide[q.id] = true;
        if (self.ecran === 'question' && self.questionCourante().id === q.id) {
          self.montrerCorrection(true);
          A.claude.rafraichir();
        }
        self.sauver(true);
      })
      .catch(function (e) {
        self.retour.className = 'quiz-retour faux';
        self.retour.textContent = T('question.correctionImpossible', { message: e.message });
        self.boutonsQuestion();
      });
  };

  P.montrerCorrection = function () {
    var self = this,
      S = this.session,
      q = this.questionCourante(),
      v = S.reponses[q.id];
    this.widget.verrouiller();
    this.widget.corriger(v);
    this.majOutils();
    this.majNavigateur();
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
      this.retour.innerHTML = '';
      this.retour.className = 'quiz-retour';
      this.actions.innerHTML = '';
      return;
    }
    if (q.type === 'ouverte' || (q.type === 'code' && (S.rapports[q.id] || {}).type === 'indisponible')) {
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
    var self = this,
      S = this.session;
    var bloc = el('div', 'quiz-modele');
    if (q.type === 'code') {
      var r = S.rapports[q.id];
      if (r && r.message) bloc.appendChild(el('p', 'quiz-alerte', r.message));
      bloc.appendChild(el('p', 'quiz-modele-titre', T('question.solutionReference')));
      bloc.appendChild(html('div', null, A.types.code.solution(q)));
    } else if (A.types[q.type].blocModele) {
      // Type qui fournit lui-même sa réponse modèle (l'atelier)
      var rap = S.rapports[q.id];
      if (rap && rap.message) bloc.appendChild(el('p', 'quiz-alerte', rap.message));
      bloc.appendChild(el('p', 'quiz-modele-titre', T('question.solutionProposee')));
      bloc.appendChild(A.types[q.type].blocModele(q));
    } else {
      bloc.appendChild(el('p', 'quiz-modele-titre', T('question.reponseModele')));
      bloc.appendChild(html('div', null, q.reponse_modele));
      if (q.criteres && q.criteres.length) {
        bloc.appendChild(el('p', 'quiz-criteres-titre', T('question.pointsAttendus')));
        var ul = el('ul');
        q.criteres.forEach(function (c) {
          ul.appendChild(html('li', null, c));
        });
        bloc.appendChild(ul);
      }
    }
    var zoneClaude = el('div', 'quiz-correction-claude');
    bloc.appendChild(zoneClaude);
    if (S.corrections[q.id]) zoneClaude.appendChild(this.blocCorrection(S.corrections[q.id]));

    var ev = el('div', 'auto-eval');
    ev.appendChild(el('span', null, T('question.maReponse')));
    [
      [T('question.juste'), 1],
      [T('question.enPartie'), 0.5],
      [T('question.fausse'), 0],
    ].forEach(function (x) {
      var b = O.bouton(x[0], null, function () {
        ev.querySelectorAll('.bouton').forEach(function (y) {
          y.classList.remove('choisi');
        });
        b.classList.add('choisi');
        surNote(x[1]);
      });
      b.dataset.note = String(x[1]);
      if (S.scores[q.id] === x[1]) b.classList.add('choisi');
      ev.appendChild(b);
    });
    if (q.type === 'ouverte' && A.connexion.claudeDisponible() && S.reponses[q.id]) {
      var bc = O.bouton(
        T('question.faireCorriger'),
        'bouton-claude',
        function () {
          bc.disabled = true;
          zoneClaude.innerHTML = '';
          zoneClaude.appendChild(el('p', 'quiz-aide', T('question.claudeCorrige')));
          A.connexion
            .corriger(
              {
                enonce: O.texteDe(q.enonce),
                solution: O.texteDe(q.reponse_modele),
                criteres: (q.criteres || []).map(O.texteDe),
              },
              S.reponses[q.id],
            )
            .then(function (c) {
              c.date = new Date().toISOString();
              S.corrections[q.id] = c;
              zoneClaude.innerHTML = '';
              zoneClaude.appendChild(self.blocCorrection(c));
              O.enrichir(zoneClaude);
              ev.querySelectorAll('.bouton').forEach(function (y) {
                y.classList.toggle('choisi', y.dataset.note === String(c.note));
              });
              surNote(c.note);
            })
            .catch(function (e) {
              zoneClaude.innerHTML = '';
              zoneClaude.appendChild(
                el('p', 'quiz-alerte', T('question.correctionImpossible', { message: e.message })),
              );
            })
            .finally(function () {
              bc.disabled = false;
            });
        },
        'claude',
      );
      ev.appendChild(bc);
    }
    bloc.appendChild(ev);
    return bloc;
  };

  P.blocCorrection = function (c) {
    var b = el('div', 'correction-claude');
    b.appendChild(
      el(
        'p',
        'correction-claude-titre',
        T('question.correctionClaude', {
          note: T(c.note === 1 ? 'question.justeMin' : c.note === 0.5 ? 'question.enPartieMin' : 'question.fausseMin'),
        }),
      ),
    );
    b.appendChild(el('p', null, c.commentaire));
    if (c.points_manquants && c.points_manquants.length) {
      var ul = el('ul');
      c.points_manquants.forEach(function (p) {
        ul.appendChild(el('li', null, p));
      });
      b.appendChild(el('p', 'correction-claude-sous-titre', T('question.aCorriger')));
      b.appendChild(ul);
    }
    return b;
  };

  P.remplirRetour = function () {
    var S = this.session,
      q = this.questionCourante(),
      type = A.types[q.type],
      s = S.scores[q.id];
    this.retour.innerHTML = '';
    var classe, texte;
    if (s === 1) {
      classe = 'juste';
      texte = T('question.bonne');
    } else if (s > 0) {
      classe = 'partiel';
      texte = T('question.partielle', { pourcent: O.pourcent(s) });
    } else {
      classe = 'faux';
      texte = this.repondue(q.id) ? T('question.mauvaise') : T('question.pasDeReponse');
    }
    if ((S.indices[q.id] || 0) && Number(this.d.penalite_indice))
      texte += ' · ' + Tn('question.indicesUtilises', S.indices[q.id]);
    this.retour.className = 'quiz-retour ' + classe;
    this.retour.appendChild(el('p', 'quiz-retour-titre', texte));
    this.majNavigateur();
    if (S.rapports[q.id] && S.rapports[q.id].type !== 'indisponible')
      this.retour.appendChild(A.code.rapport(S.rapports[q.id]));
    if (type.attendu && s < 1) {
      this.retour.appendChild(html('p', 'quiz-attendu', '<b>' + T('question.attendue') + '</b> ' + type.solution(q)));
      var acc = type.acceptees ? type.acceptees(q) : [];
      if (acc.length > 1)
        this.retour.appendChild(
          html('p', 'quiz-acceptees', '<b>' + T('question.acceptees') + '</b> ' + acc.map(O.echapper).join(' · ')),
        );
    }
    if (q.type === 'code' && s < 1 && q.solution && (S.rapports[q.id] || {}).type !== 'indisponible') {
      var sol = el('details', 'quiz-solution-code');
      sol.appendChild(el('summary', null, T('question.voirSolution')));
      sol.appendChild(html('div', null, A.types.code.solution(q)));
      this.retour.appendChild(sol);
    }
    if (q.explication) this.retour.appendChild(html('div', 'quiz-explication', q.explication));
    if (q.revoir) {
      var p = el('p', 'quiz-revoir');
      var a = el('a', null, T('question.revoirLien', { texte: q.revoir.texte }));
      a.href = q.revoir.lien;
      p.appendChild(a);
      this.retour.appendChild(p);
    }
    O.enrichir(this.retour);
  };

  P.boutonsSuite = function () {
    var self = this,
      S = this.session,
      i = S.index,
      dernier = i === S.ordre.length - 1;
    this.actions.innerHTML = '';
    this.actions.appendChild(
      O.bouton(
        T('question.quitter'),
        'discret',
        function () {
          self.quitter();
        },
        'pause',
      ),
    );
    this.actions.appendChild(el('span', 'espace'));
    if (!dernier)
      this.actions.appendChild(
        O.bouton(T('question.terminer'), 'discret', function () {
          self.confirmerFin();
        }),
      );
    var b = O.bouton(dernier ? T('question.resultats') : T('question.suivante'), 'principal', function () {
      if (dernier) self.confirmerFin();
      else self.allerA(i + 1);
    });
    this.actions.appendChild(b);
    b.focus({ preventScroll: true });
  };

  /* Clavier -------------------------------------------------------------------------------- */

  P.clavier = function (e) {
    if (this.ecran !== 'question' || e.altKey || e.metaKey) return;
    var cible = e.target;
    if (cible.closest && cible.closest('.claude-panneau, dialog, .editeur, .atelier-code')) return;
    var saisie =
      /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName) && !(cible.type === 'radio' || cible.type === 'checkbox');
    if (e.key === 'Enter') {
      if (cible.tagName === 'TEXTAREA' && !e.ctrlKey) return;
      if (cible.tagName === 'BUTTON' || cible.tagName === 'A' || cible.tagName === 'SUMMARY') return;
      var principal = this.actions && this.actions.querySelector('.bouton.principal:not(:disabled)');
      if (principal) {
        e.preventDefault();
        principal.click();
      }
      return;
    }
    if (saisie || e.ctrlKey || !this.widget || !this.widget.choisir) return;
    var pos = -1;
    if (/^[1-9]$/.test(e.key)) pos = Number(e.key) - 1;
    else if (/^[a-z]$/i.test(e.key)) pos = e.key.toUpperCase().charCodeAt(0) - 65;
    if (pos >= 0) {
      e.preventDefault();
      this.widget.choisir(pos);
    }
  };
})(window.QuizApp);
