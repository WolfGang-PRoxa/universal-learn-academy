/* ==========================================================================
   Quiz · fin du quiz et résultats (prototype de QuizApp.Quiz)
   Deux évaluations :
     - classique : score, note, bonnes et mauvaises réponses, réponses
       attendues et acceptées, bilan par thème, correction détaillée ;
     - détaillée, rédigée par Claude : bilan, difficultés, révisions
       conseillées avec liens vers le cours ; on peut ensuite l'interroger.
   Sert aussi à relire une tentative archivée.
   ========================================================================== */
(function (A) {
  'use strict';

  var O = A.outils,
    el = O.el,
    html = O.html,
    T = A.t,
    Tn = A.tn;
  var P = A.Quiz.prototype;

  /* Fin du quiz : correction des questions restantes (mode examen) ---------------- */

  P.terminer = function () {
    var self = this,
      S = this.session,
      qs = this.questions();
    this.enregistrer();
    this.accumuler();
    this.vider();
    this.ecran = 'correction';
    this.zone.appendChild(el('p', 'quiz-attente', T('resultats.correctionEnCours')));
    var restantes = qs.filter(function (q) {
      return !S.valide[q.id];
    });
    Promise.all(
      restantes.map(function (q) {
        var v = S.reponses[q.id] === undefined ? null : S.reponses[q.id];
        S.reponses[q.id] = v;
        return self
          .noter(q, v)
          .then(function (r) {
            S.scores[q.id] = r.score;
            if (r.rapport) S.rapports[q.id] = r.rapport;
          })
          .catch(function (e) {
            S.scores[q.id] = null;
            S.rapports[q.id] = {
              type: 'indisponible',
              message: T('question.correctionImpossible', { message: e.message }),
            };
          })
          .finally(function () {
            S.valide[q.id] = true;
          });
      }),
    ).then(function () {
      S.statut = 'terminee';
      S.fin = new Date().toISOString();
      self.revue = false;
      self.afficherResultats();
      self.sauver(true);
    });
  };

  /* Écran de résultats ----------------------------------------------------------------- */

  P.afficherResultats = function () {
    var self = this,
      S = this.session;
    this.vider();
    this.ecran = 'resultats';

    if (this.revue) {
      var b = el('div', 'quiz-bandeau revue');
      b.appendChild(
        el(
          'p',
          null,
          T(S.statut === 'abandonnee' ? 'resultats.relectureAbandonnee' : 'resultats.relecture', {
            date: O.dateLisible(S.debut),
          }),
        ),
      );
      b.appendChild(
        O.bouton(T('resultats.retourAccueil'), 'petit', function () {
          self.accueil();
        }),
      );
      this.zone.appendChild(b);
    }

    this.cadreBilan = el('div', 'quiz-bilan-cadre');
    this.zone.appendChild(this.cadreBilan);
    this.rendreBilan();

    // Évaluation détaillée par Claude
    this.cadreEvaluation = el('section', 'quiz-evaluation');
    this.zone.appendChild(this.cadreEvaluation);
    this.rendreEvaluation();

    // Actions
    var actions = el('div', 'quiz-actions');
    var qs = this.questions();
    var ratees = qs.filter(function (q) {
      return S.scores[q.id] !== 1;
    });
    if (ratees.length) {
      actions.appendChild(
        O.bouton(Tn('resultats.refaire', ratees.length), 'principal', function () {
          self.relancer(self.reglages.melanger ? O.melanger(ratees) : ratees);
        }),
      );
    }
    actions.appendChild(
      O.bouton(T('resultats.recommencer'), null, function () {
        self.relancer(self.reglages.melanger ? O.melanger(qs) : qs.slice());
      }),
    );
    actions.appendChild(
      O.bouton(T('resultats.accueilQuiz'), 'discret', function () {
        self.accueil();
      }),
    );
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
    this.zone.appendChild(actions);

    // Correction détaillée
    var revue = el('section', 'quiz-revue');
    var tete = el('div', 'quiz-revue-tete');
    tete.appendChild(el('h2', null, T('resultats.correctionDetaillee')));
    var lab = el('label');
    var chk = el('input');
    chk.type = 'checkbox';
    lab.appendChild(chk);
    lab.appendChild(document.createTextNode(T('resultats.erreursSeules')));
    tete.appendChild(lab);
    revue.appendChild(tete);
    var liste = el('div', 'revue-liste');
    chk.addEventListener('change', function () {
      liste.classList.toggle('erreurs-seules', chk.checked);
    });
    qs.forEach(function (q, i) {
      liste.appendChild(self.itemRevue(q, i));
    });
    revue.appendChild(liste);
    this.zone.appendChild(revue);

    O.enrichir(this.zone);
    this.remonter();
  };

  P.relancer = function (questions) {
    this.session = this.nouvelleSession(questions, this.reglages.mode);
    this.revue = false;
    this.resumeEnCours = null;
    this.afficherQuestion(0);
    this.sauver(true);
  };

  // Évaluation classique : anneau, note, compteurs, bilan par thème, archive
  P.rendreBilan = function () {
    var self = this,
      S = this.session,
      sc = this.score(),
      qs = this.questions();
    var c = this.cadreBilan;
    c.innerHTML = '';

    var bilan = el('section', 'quiz-bilan');
    var anneau = el('div', 'quiz-anneau');
    anneau.style.setProperty('--p', String(sc.ratio));
    anneau.appendChild(el('span', null, sc.pourcent + ' %'));
    bilan.appendChild(anneau);
    var txt = el('div', 'quiz-bilan-texte');
    var mot = sc.a_evaluer
      ? T('resultats.presqueFini')
      : sc.ratio >= 0.85
        ? T('resultats.excellent')
        : sc.ratio >= 0.6
          ? T('resultats.bien')
          : T('resultats.retravailler');
    txt.appendChild(el('h2', null, mot));
    var virgule = function (x) {
      return A.langue() === 'fr' ? String(x).replace('.', ',') : String(x);
    };
    txt.appendChild(
      html(
        'p',
        null,
        T(sc.somme > 1 ? 'resultats.note.plusieurs' : 'resultats.note.un', {
          note: virgule(sc.note20),
          points: virgule(sc.somme),
          nb: sc.nb,
        }),
      ),
    );
    txt.appendChild(
      html(
        'p',
        null,
        T('resultats.duree', {
          duree: O.duree(this.dureeTotale()),
          mode: S.mode === 'examen' ? T('mode.examenMin') : T('mode.entrainementMin'),
        }),
      ),
    );
    bilan.appendChild(txt);
    c.appendChild(bilan);

    var tuiles = el('div', 'quiz-compteurs');
    [
      ['justes', sc.justes, 'juste'],
      ['partielles', sc.partielles, 'partiel'],
      ['fausses', sc.fausses, 'faux'],
      ['sansReponse', sc.sans_reponse, 'vide'],
      ['aEvaluer', sc.a_evaluer, 'attente'],
    ].forEach(function (x) {
      if (!x[1] && (x[0] === 'aEvaluer' || x[0] === 'partielles')) return;
      var t = el('div', 'compteur ' + x[2]);
      t.appendChild(el('strong', null, String(x[1])));
      t.appendChild(el('span', null, T('resultats.compteur.' + x[0])));
      tuiles.appendChild(t);
    });
    c.appendChild(tuiles);

    var parTheme = {};
    qs.forEach(function (q) {
      var n = q.theme || 'Général';
      if (!parTheme[n]) parTheme[n] = { s: 0, n: 0 };
      parTheme[n].n++;
      parTheme[n].s += S.scores[q.id] || 0;
    });
    var noms = Object.keys(parTheme);
    if (noms.length > 1) {
      var th = el('section', 'quiz-themes');
      th.appendChild(el('h2', null, T('resultats.parTheme')));
      noms.forEach(function (n) {
        var r = parTheme[n].s / parTheme[n].n;
        var ligne = el('div', 'theme-barre');
        ligne.appendChild(el('span', null, n));
        var piste = el('span', 'piste'),
          rem = el('span');
        rem.style.setProperty('--p', String(r));
        piste.appendChild(rem);
        ligne.appendChild(piste);
        ligne.appendChild(el('span', 'val', O.pourcent(r) + ' %'));
        th.appendChild(ligne);
      });
      c.appendChild(th);
    }

    var arch = el('p', 'quiz-archive');
    arch.appendChild(el('span', 'quiz-sauvegarde'));
    var dl = O.bouton(
      T('resultats.telecharger'),
      'discret petit',
      function () {
        A.archives.telecharger(self.tentative());
      },
      'telecharger',
    );
    arch.appendChild(dl);
    c.appendChild(arch);
    this.etatSauvegarde(A.connexion.enLigne ? (S.fichier ? 'enregistre' : '') : 'local', S.fichier);
    O.insecables(c);
  };

  // Recalcul après une auto-évaluation dans la correction détaillée
  P.majBilan = function () {
    this.rendreBilan();
    this.sauver(true);
  };

  /* Évaluation détaillée par Claude ------------------------------------------------------ */

  P.rendreEvaluation = function () {
    var self = this,
      S = this.session,
      c = this.cadreEvaluation;
    c.innerHTML = '';
    var tete = el('div', 'quiz-evaluation-tete');
    tete.insertAdjacentHTML('beforeend', '<span class="claude-logo">' + O.icone('claude') + '</span>');
    var t = el('div');
    t.appendChild(el('h2', null, T('resultats.evaluation')));
    t.appendChild(el('p', null, T('resultats.evaluationDesc')));
    tete.appendChild(t);
    c.appendChild(tete);
    var corps = el('div', 'quiz-evaluation-corps');
    c.appendChild(corps);
    var pied = el('div', 'quiz-evaluation-pied');
    c.appendChild(pied);

    if (S.evaluation && S.evaluation.texte) {
      corps.innerHTML = A.markdown(S.evaluation.texte);
      O.enrichir(corps);
      pied.appendChild(
        el(
          'span',
          'quiz-evaluation-meta',
          (S.evaluation.modele || '').replace(/^claude-/, '') + ' · ' + O.dateLisible(S.evaluation.date),
        ),
      );
      pied.appendChild(el('span', 'espace'));
      pied.appendChild(
        O.bouton(
          T('resultats.questionBilan'),
          'petit bouton-claude',
          function () {
            self.questionBilan();
          },
          'claude',
        ),
      );
      if (A.connexion.claudeDisponible())
        pied.appendChild(
          O.bouton(T('resultats.refaireBilan'), 'discret petit', function () {
            self.demanderEvaluation();
          }),
        );
      return;
    }
    if (S.statut === 'en_cours') return;
    if (A.connexion.claudeDisponible()) {
      var u = A.connexion.etat.reglages.usages.evaluation;
      pied.appendChild(
        O.bouton(
          T('resultats.obtenir'),
          'principal',
          function () {
            self.demanderEvaluation();
          },
          'claude',
        ),
      );
      pied.appendChild(
        el(
          'span',
          'quiz-evaluation-meta',
          T(u.effort ? 'resultats.modeleEffort' : 'resultats.modele', {
            modele: u.modele || T('resultats.parDefaut'),
            effort: u.effort,
          }),
        ),
      );
    } else {
      pied.appendChild(
        O.bouton(
          T('resultats.copierDemande'),
          null,
          function () {
            var texte =
              T('resultats.demande') +
              '\n\n' +
              T('resultats.demandeQuiz') +
              self.meta.titre +
              ' (' +
              [self.meta.matiere, self.meta.niveau].filter(Boolean).join(', ') +
              ')\n\n' +
              self.texteTentative();
            O.copier(texte).then(function () {
              O.notifier(T('resultats.demandeCopiee'));
              window.open('https://claude.ai/new', '_blank', 'noopener');
            });
          },
          'copier',
        ),
      );
      pied.appendChild(
        el(
          'span',
          'quiz-evaluation-meta',
          A.connexion.enLigne ? T('resultats.claudeIntrouvable') : T('resultats.serveurAbsent'),
        ),
      );
    }
  };

  // Tentative en texte (demande copiée pour claude.ai)
  P.texteTentative = function () {
    var t = this.tentative();
    return t.questions
      .map(function (q, i) {
        return (
          'Q' +
          (i + 1) +
          ' (' +
          q.type +
          (q.theme ? ', ' + q.theme : '') +
          ') · score ' +
          (q.score == null ? T('resultats.compteur.aEvaluer') : O.pourcent(q.score) + ' %') +
          (q.indices_vus ? ' · ' + T('resultats.texteIndices', { n: q.indices_vus }) : '') +
          '\n' +
          q.enonce +
          '\n' +
          T('resultats.texteReponse') +
          (q.reponse_texte || T('resultats.texteAucune')) +
          '\n' +
          T('resultats.texteAttendue') +
          q.attendu_texte
        );
      })
      .join('\n\n');
  };

  P.demanderEvaluation = function () {
    var self = this,
      S = this.session,
      c = this.cadreEvaluation;
    var corps = c.querySelector('.quiz-evaluation-corps'),
      pied = c.querySelector('.quiz-evaluation-pied');
    corps.innerHTML = '';
    pied.innerHTML = '';
    var etat = el('p', 'claude-etat', T('resultats.analyse'));
    pied.appendChild(etat);
    var annuler = O.bouton(T('commun.annuler'), 'discret petit', function () {
      appel.annuler();
    });
    pied.appendChild(annuler);
    var t = this.tentative();
    delete t.session;
    var texte = '',
      peinture = null,
      modele = null;
    function peindre() {
      peinture = null;
      corps.innerHTML = A.markdown(texte);
    }
    var appel = A.connexion.flux('claude/evaluer', { page: A.connexion.page(), tentative: t }, function (type, d) {
      if (type === 'debut') modele = d.modele;
      else if (type === 'texte') {
        texte += d.texte;
        etat.textContent = T('resultats.redige');
        if (!peinture) peinture = requestAnimationFrame(peindre);
      } else if (type === 'outil')
        etat.textContent = T('resultats.consulte', { quoi: d.detail ? d.detail.split('/').pop() : d.nom });
    });
    appel.promesse
      .then(function (fin) {
        S.evaluation = {
          texte: fin.texte || texte,
          modele: fin.modele || modele,
          date: new Date().toISOString(),
          session: fin.session,
        };
        delete S.conversations.evaluation;
        self.sauver(true);
      })
      .catch(function (e) {
        if (e.name !== 'AbortError') O.notifier(T('resultats.evaluationImpossible', { message: e.message }), 'erreur');
      })
      .finally(function () {
        if (self.ecran === 'resultats') self.rendreEvaluation();
        if (A.connexion.enLigne) A.connexion.rafraichir().catch(function () {});
      });
  };

  // Conversation qui poursuit celle du bilan (même session Claude)
  P.questionBilan = function () {
    var self = this,
      S = this.session;
    var conv = this.conversation('evaluation');
    if (!conv.session && S.evaluation) conv.session = S.evaluation.session;
    A.claude.ouvrir({
      titre: T('resultats.questionsBilan'),
      sousTitre: this.meta.titre,
      conversation: conv,
      accueil: T('resultats.questionsBilanAccueil'),
      contexte: function () {
        var c = self.contexteGeneral();
        c.tentative = self.resumeTentative();
        return c;
      },
      suggestions: [
        { libelle: T('suggestion.commencer'), message: T('suggestion.commencerMessage') },
        { libelle: T('suggestion.erreur'), message: T('suggestion.erreurMessage') },
        { libelle: T('suggestion.cible'), message: T('suggestion.cibleMessage') },
      ],
      surMaj: function () {
        self.sauver();
      },
    });
  };

  /* Correction détaillée : une entrée par question -------------------------------------------- */

  P.itemRevue = function (q, i) {
    var self = this,
      S = this.session,
      type = A.types[q.type],
      v = S.reponses[q.id];
    var det = el('details', 'revue-item');
    var score = el('span', 'revue-score');
    function etat() {
      det.classList.remove('juste', 'partiel', 'faux', 'attente');
      var sc = S.scores[q.id];
      det.classList.add(sc == null ? 'attente' : sc === 1 ? 'juste' : sc > 0 ? 'partiel' : 'faux');
      score.textContent =
        sc == null
          ? T('resultats.compteur.aEvaluer')
          : sc === 1
            ? '✓'
            : !self.repondue(q.id)
              ? T('resultats.compteur.sansReponse')
              : O.pourcent(sc) + ' %';
    }
    var sum = el('summary');
    sum.appendChild(el('span', 'revue-num', String(i + 1)));
    var titre = el('span', 'revue-titre');
    var court = html('div', null, this.enonceComplet(q));
    court.querySelectorAll('pre').forEach(function (p) {
      p.replaceWith(' … ');
    });
    titre.textContent = court.textContent.replace(/\s+/g, ' ').trim();
    sum.appendChild(titre);
    sum.appendChild(score);
    det.appendChild(sum);

    var corps = el('div', 'revue-corps');
    corps.appendChild(html('div', 'revue-enonce', this.enonceComplet(q)));
    function ligne(etiquette, contenu) {
      var p = el('div', 'revue-ligne');
      p.appendChild(el('b', null, etiquette));
      p.appendChild(html('div', 'rep', contenu));
      corps.appendChild(p);
    }
    var r = type.resume(q, v == null ? null : v);
    ligne(T('resultats.maReponse'), r == null || r === '' ? '<em>' + T('resultats.pasDeReponse') + '</em>' : r);
    if (S.rapports[q.id] && S.rapports[q.id].type !== 'indisponible')
      corps.appendChild(A.code.rapport(S.rapports[q.id]));
    if (q.type === 'ouverte' || S.scores[q.id] === null) {
      corps.appendChild(
        this.blocModele(q, function (note) {
          S.scores[q.id] = note;
          etat();
          self.majBilan();
        }),
      );
    } else {
      ligne(T('resultats.reponseAttendue'), type.solution(q));
      var acc = type.acceptees ? type.acceptees(q) : [];
      if (acc.length > 1) ligne(T('resultats.reponsesAcceptees'), acc.map(O.echapper).join(' · '));
    }
    var infos = [];
    if (S.temps[q.id]) infos.push(T('resultats.temps', { duree: O.duree(S.temps[q.id]) }));
    if (q.indices && q.indices.length)
      infos.push(T('resultats.indicesVus', { n: S.indices[q.id] || 0, total: q.indices.length }));
    if (S.etats[q.id] && S.etats[q.id].executions)
      infos.push(T('resultats.executions', { n: S.etats[q.id].executions }));
    if (infos.length) corps.appendChild(el('p', 'revue-infos', infos.join(' · ')));
    if (q.explication) corps.appendChild(html('div', 'quiz-explication', q.explication));
    var conv = S.conversations[q.id];
    if (conv && conv.messages.length) {
      var c = el('details', 'revue-conversation');
      c.appendChild(
        el(
          'summary',
          null,
          T('resultats.conversation', {
            n: conv.messages.filter(function (m) {
              return m.role !== 'note';
            }).length,
          }),
        ),
      );
      conv.messages.forEach(function (m) {
        if (m.role === 'note') return;
        var b = el('div', 'claude-message ' + (m.role === 'etudiant' ? 'etudiant' : 'claude'));
        var cb = el('div', 'claude-corps');
        if (m.role === 'claude') cb.innerHTML = A.markdown(m.texte);
        else cb.textContent = m.texte;
        b.appendChild(cb);
        c.appendChild(b);
      });
      corps.appendChild(c);
    }
    var pied = el('div', 'revue-pied');
    if (q.revoir) {
      var a = el('a', 'quiz-revoir', T('question.revoirLien', { texte: q.revoir.texte }));
      a.href = q.revoir.lien;
      pied.appendChild(a);
    }
    pied.appendChild(el('span', 'espace'));
    pied.appendChild(
      O.bouton(
        T('question.demanderClaude'),
        'petit bouton-claude',
        function () {
          self.ouvrirClaude(q.id);
        },
        'claude',
      ),
    );
    corps.appendChild(pied);
    det.appendChild(corps);
    etat();
    return det;
  };
})(window.QuizApp);
