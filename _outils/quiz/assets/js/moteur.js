/* ==========================================================================
   Quiz · moteur (QuizApp.Quiz)
   --------------------------------------------------------------------------
   L'objet Quiz lit les questions de la page, tient la session en cours et
   l'enregistre. Les écrans sont dans des fichiers à part, qui complètent le
   prototype : ecran-accueil.js, ecran-question.js, ecran-resultats.js.

   La session est un objet sérialisable (elle est archivée telle quelle, ce
   qui permet la reprise) ; tout y est indexé par l'identifiant de question :
     id, statut (en_cours, terminee, abandonnee), mode, reglages,
     ordre [id…], index, etats {id: ordre tiré au sort…}, reponses, scores,
     valide, rapports (code), corrections (Claude), indices (nombre vus),
     temps (ms), conversations {cle: {session, messages}}, debut, fin,
     evaluation { texte, modele, date, session }.
   ========================================================================== */
(function (A) {
  'use strict';

  var O = A.outils,
    el = O.el,
    T = A.t;
  var SECONDES_PAR_QUESTION = 45;

  function Quiz(racine, donnees) {
    var self = this;
    this.racine = racine;
    this.d = donnees;
    A.donnees = donnees;
    this.parId = {};
    donnees.questions.forEach(function (q) {
      self.parId[q.id] = q;
    });
    this.meta = lireMeta();
    this.zone = el('div', 'quiz-zone');
    this.zone.tabIndex = -1;
    racine.appendChild(this.zone);
    this.reglages = {
      mode: 'entrainement',
      melanger: donnees.melanger !== false,
      nombre: 0,
      themes: null,
      types: null,
    };
    this.session = null;
    this.chronoDebut = null;
    document.addEventListener('keydown', function (e) {
      self.clavier(e);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        self.accumuler();
        if (self.session && self.session.statut === 'en_cours') A.archives.vider();
      } else if (self.ecran === 'question') self.chronoDebut = Date.now();
    });
    window.addEventListener('beforeprint', function () {
      self.zone.querySelectorAll('details').forEach(function (d) {
        d.open = true;
      });
    });
    A.archives.surEtat(function (etat, detail) {
      self.etatSauvegarde(etat, detail);
    });
  }

  // Titre, matière et niveau, lus dans l'en-tête et le fil d'Ariane de la page
  function lireMeta() {
    var h1 = document.querySelector('.entete h1');
    var fil = Array.prototype.slice.call(document.querySelectorAll('.fil > *:not(.pastille)'));
    var badge = document.querySelector('.entete .badge.matiere');
    return {
      titre: h1 ? h1.textContent.trim() : document.title,
      niveau: fil[0] ? fil[0].textContent.trim() : '',
      matiere: fil[1] ? fil[1].textContent.trim() : badge ? badge.textContent.trim() : '',
    };
  }

  var P = Quiz.prototype;

  /* Questions et session -------------------------------------------------------- */

  P.themes = function () {
    var t = {};
    this.d.questions.forEach(function (q) {
      var n = q.theme || 'Général';
      t[n] = (t[n] || 0) + 1;
    });
    return t;
  };
  P.typesPresents = function () {
    var t = {};
    this.d.questions.forEach(function (q) {
      t[q.type] = (t[q.type] || 0) + 1;
    });
    return t;
  };
  P.dureeEstimee = function (n) {
    return Math.max(1, Math.round(((n || this.d.questions.length) * SECONDES_PAR_QUESTION) / 60));
  };

  P.nouvelleSession = function (questions, mode) {
    return {
      id: O.horodatage(),
      statut: 'en_cours',
      mode: mode,
      reglages: JSON.parse(JSON.stringify(this.reglages)),
      ordre: questions.map(function (q) {
        return q.id;
      }),
      index: 0,
      etats: {},
      reponses: {},
      scores: {},
      valide: {},
      rapports: {},
      corrections: {},
      indices: {},
      temps: {},
      conversations: {},
      debut: new Date().toISOString(),
      fin: null,
      evaluation: null,
    };
  };

  // Questions de la session, dans l'ordre (celles retirées du quiz depuis sont ignorées)
  P.questions = function () {
    var self = this;
    return this.session.ordre
      .map(function (id) {
        return self.parId[id];
      })
      .filter(Boolean);
  };

  P.repondue = function (id) {
    var v = this.session.reponses[id];
    return v !== undefined && v !== null && v !== '';
  };

  // Temps passé sur la question affichée, ajouté à la session
  P.accumuler = function () {
    if (!this.session || this.chronoDebut == null || this.ecran !== 'question') return;
    var id = this.session.ordre[this.session.index];
    var maintenant = Date.now();
    this.session.temps[id] = (this.session.temps[id] || 0) + (maintenant - this.chronoDebut);
    this.chronoDebut = maintenant;
  };
  P.dureeTotale = function () {
    var t = this.session.temps,
      s = 0;
    Object.keys(t).forEach(function (k) {
      s += t[k];
    });
    return s;
  };

  P.conversation = function (cle) {
    var c = this.session.conversations;
    if (!c[cle]) c[cle] = { session: null, messages: [] };
    return c[cle];
  };

  /* Notation --------------------------------------------------------------------- */

  // Score d'une réponse, pénalité d'indices comprise ; renvoie une promesse { score, rapport }
  P.noter = function (q, v) {
    var type = A.types[q.type],
      S = this.session,
      pen = Number(this.d.penalite_indice) || 0;
    var n = S.indices[q.id] || 0;
    function appliquer(r) {
      if (r.score != null && pen && n) r.score = Math.max(0, r.score * (1 - pen * n));
      return r;
    }
    if (type.evaluer) return type.evaluer(q, v).then(appliquer);
    return Promise.resolve(appliquer({ score: type.noter(q, v), rapport: null }));
  };

  P.score = function () {
    var self = this,
      S = this.session,
      qs = this.questions();
    var r = { nb: qs.length, justes: 0, partielles: 0, fausses: 0, sans_reponse: 0, a_evaluer: 0, somme: 0 };
    qs.forEach(function (q) {
      var s = S.scores[q.id];
      if (s === null) {
        r.a_evaluer++;
        return;
      }
      if (s === undefined) {
        r.sans_reponse++;
        return;
      }
      r.somme += s;
      if (s === 1) r.justes++;
      else if (s > 0) r.partielles++;
      else if (self.repondue(q.id)) r.fausses++;
      else r.sans_reponse++;
    });
    r.ratio = r.nb ? r.somme / r.nb : 0;
    r.pourcent = O.pourcent(r.ratio);
    r.note20 = Math.round(r.ratio * 40) / 2;
    r.somme = Math.round(r.somme * 100) / 100;
    return r;
  };

  /* Archive ------------------------------------------------------------------------ */

  function texteTrous(q) {
    var t = q.texte.replace(/\{\{(\d+)\}\}/g, function (_, k) {
      return '[' + (Number(k) + 1) + ']';
    });
    return q.code ? "<pre><code class='language-plaintext'>" + t + '</code></pre>' : '<p>' + t + '</p>';
  }
  P.enonceComplet = function (q) {
    return q.type === 'trous' ? (q.enonce || '') + texteTrous(q) : q.enonce;
  };

  P.detailQuestion = function (q) {
    var S = this.session,
      id = q.id,
      type = A.types[q.type];
    var v = S.reponses[id] === undefined ? null : S.reponses[id];
    var conv = S.conversations[id];
    var rap = S.rapports[id];
    return {
      id: id,
      type: q.type,
      theme: q.theme || null,
      difficulte: q.difficulte || null,
      enonce: O.texteDe(this.enonceComplet(q)),
      reponse: v,
      reponse_texte: v == null ? null : A.resumeTexte(q, v, S.etats[id]),
      attendu_texte: O.texteDe(type.solution(q)),
      acceptees: type.acceptees ? type.acceptees(q) : undefined,
      repondue: this.repondue(id),
      corrigee: Boolean(S.valide[id]) || S.statut !== 'en_cours',
      score: S.scores[id] === undefined ? null : S.scores[id],
      indices_vus: S.indices[id] || 0,
      indices_total: (q.indices || []).length,
      duree_ms: S.temps[id] || 0,
      executions: (S.etats[id] && S.etats[id].executions) || undefined,
      rapport: rap ? rap.message : undefined,
      correction_claude: S.corrections[id] || undefined,
      aide:
        conv && conv.messages.length
          ? conv.messages
              .filter(function (m) {
                return m.role !== 'note';
              })
              .map(function (m) {
                return { role: m.role, texte: m.texte, date: m.date };
              })
          : undefined,
    };
  };

  P.tentative = function () {
    var self = this,
      S = this.session;
    this.accumuler();
    return {
      format: 'studies-quiz/tentative-1',
      id: S.id,
      statut: S.statut,
      quiz: {
        id: this.d.id,
        titre: this.meta.titre,
        matiere: this.meta.matiere,
        niveau: this.meta.niveau,
        page: A.connexion.cheminRelatif(),
      },
      debut: S.debut,
      fin: S.fin,
      duree_ms: this.dureeTotale(),
      mode: S.mode,
      reglages: S.reglages,
      score: this.score(),
      questions: this.questions().map(function (q) {
        return self.detailQuestion(q);
      }),
      evaluation: S.evaluation,
      session: S,
    };
  };

  P.sauver = function (immediat) {
    if (!this.session) return Promise.resolve(null);
    var self = this;
    return A.archives.sauver(
      function () {
        return self.tentative();
      },
      { immediat: immediat },
    );
  };

  // Témoin d'enregistrement (en-tête de question, résultats)
  P.etatSauvegarde = function (etat, detail) {
    var t = document.querySelector('.quiz-sauvegarde');
    if (!t) return;
    t.className = 'quiz-sauvegarde ' + etat;
    t.textContent =
      {
        enregistrement: T('sauvegarde.enCours'),
        enregistre: T('sauvegarde.faite'),
        local: T('sauvegarde.locale'),
        erreur: T('sauvegarde.erreur'),
      }[etat] || '';
    t.title =
      etat === 'enregistre'
        ? T('sauvegarde.dans', { fichier: detail })
        : etat === 'erreur'
          ? detail
          : etat === 'local'
            ? T('sauvegarde.localeTitre')
            : '';
    if (etat === 'enregistre' && this.session) this.session.fichier = detail;
  };

  /* Contexte envoyé à Claude --------------------------------------------------------- */

  P.contexteQuestion = function (id) {
    var S = this.session,
      q = this.parId[id],
      type = A.types[q.type];
    var i = S.ordre.indexOf(id);
    var v = S.reponses[id];
    if (this.widget && S.ordre[S.index] === id && !S.valide[id]) {
      var courante = this.widget.lire();
      if (courante != null && courante !== '') v = courante;
    }
    var vus = (q.indices || []).slice(0, S.indices[id] || 0).map(O.texteDe);
    var corrigee = Boolean(S.valide[id]) || S.statut !== 'en_cours';
    return {
      numero: i + 1,
      total: S.ordre.length,
      type: q.type,
      theme: q.theme,
      difficulte: q.difficulte,
      enonce: O.texteDe(this.enonceComplet(q)),
      details: type.details ? type.details(q, S.etats[id]) : '',
      reponse: v == null || v === '' ? null : A.resumeTexte(q, v, S.etats[id]),
      corrigee: corrigee,
      score: S.scores[id] === undefined ? null : S.scores[id],
      solution: O.texteDe(type.solution(q)),
      explication: q.explication ? O.texteDe(q.explication) : q.reponse_modele ? O.texteDe(q.reponse_modele) : '',
      indices_vus: vus,
      revoir: q.revoir || null,
    };
  };

  P.contexteGeneral = function () {
    return {
      quiz: { titre: this.meta.titre, matiere: this.meta.matiere, niveau: this.meta.niveau },
      mode: this.session ? this.session.mode : null,
    };
  };

  // Résumé textuel de la tentative (question libre depuis les résultats)
  P.resumeTentative = function () {
    var self = this,
      S = this.session,
      sc = this.score();
    var t =
      T('moteur.score', {
        pourcent: sc.pourcent,
        justes: sc.justes,
        partielles: sc.partielles,
        fausses: sc.fausses,
        vides: sc.sans_reponse,
      }) + '\n';
    this.questions().forEach(function (q, i) {
      var s = S.scores[q.id];
      t +=
        'Q' +
        (i + 1) +
        ' [' +
        q.type +
        (q.theme ? ', ' + q.theme : '') +
        '] ' +
        (s == null ? T('resultats.compteur.aEvaluer') : O.pourcent(s) + ' %') +
        ' : ' +
        O.texteDe(self.enonceComplet(q)).replace(/\s+/g, ' ').slice(0, 160) +
        '\n';
    });
    return t;
  };

  P.ouvrirClaudeGeneral = function (options) {
    var self = this;
    options = options || {};
    var cle = options.cle || 'general';
    if (!this.session) this.sessionLibre = this.sessionLibre || { conversations: {} };
    var conv = this.session
      ? this.conversation(cle)
      : (this.sessionLibre.conversations[cle] = this.sessionLibre.conversations[cle] || {
          session: null,
          messages: [],
        });
    A.claude.ouvrir({
      titre: options.titre || T('accueil.questionClaude'),
      sousTitre: this.meta.titre,
      conversation: conv,
      contexte: function () {
        var c = self.contexteGeneral();
        if (self.session && self.ecran === 'resultats') c.tentative = self.resumeTentative();
        return c;
      },
      accueil: options.accueil,
      suggestions: options.suggestions || [
        { libelle: T('suggestion.notionCours'), message: T('suggestion.notionCoursMessage'), remplir: true },
        { libelle: T('suggestion.exempleConcret'), message: T('suggestion.exempleConcretMessage'), remplir: true },
        { libelle: T('suggestion.cles'), message: T('suggestion.clesMessage') },
      ],
      surMaj: function () {
        self.sauver();
      },
    });
  };

  P.vider = function () {
    this.accumuler();
    clearInterval(this.minuteur);
    this.zone.innerHTML = '';
    this.ecran = null;
    this.widget = null;
  };

  // Ramène le haut de la zone du quiz à l'écran s'il en est sorti
  P.remonter = function () {
    var haut = this.zone.getBoundingClientRect().top;
    if (haut < 0) window.scrollTo({ top: window.scrollY + haut - 72, behavior: 'smooth' });
  };

  P.erreur = function (message) {
    var d = el('div', 'quiz-erreur');
    d.appendChild(el('strong', null, T('moteur.erreur')));
    d.appendChild(el('pre', null, message));
    this.racine.appendChild(d);
  };

  A.Quiz = Quiz;
})(window.QuizApp);
