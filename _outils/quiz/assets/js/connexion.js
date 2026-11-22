/* ==========================================================================
   Quiz · connexion au serveur local (QuizApp.connexion)
   Une page de quiz fonctionne de deux façons :
     - servie par le serveur local (http://127.0.0.1:5178/…) : Claude,
       exécution du code et archives dans le dossier de la matière ;
     - ouverte depuis le disque (file://) : le quiz marche, mais sans Claude
       en direct (la demande est copiée pour claude.ai), sans exécution de
       code et avec des archives gardées dans le navigateur.
   Ce module détecte le mode, parle à l'API et relaie les flux de Claude.
   ========================================================================== */
(function (A) {
  'use strict';

  var PORT_DEFAUT = 5178;
  var C = {
    enLigne: false, // page servie par le serveur local, API joignable
    etat: null, // réponse de /api/etat
    serveurDetecte: false, // page ouverte depuis le disque, mais serveur lancé
    port: PORT_DEFAUT,
  };
  var auditeurs = [];

  function notifier() {
    auditeurs.forEach(function (f) {
      try {
        f(C);
      } catch (e) {
        console.error(e);
      }
    });
  }
  C.surChangement = function (f) {
    auditeurs.push(f);
  };

  // Chemin de la page relatif à la racine (« explore/informatique/codage/generated_quizzes/quiz-x.html »)
  C.cheminRelatif = function () {
    if (/^https?:$/.test(location.protocol)) return decodeURIComponent(location.pathname.replace(/^\//, ''));
    var href = decodeURIComponent(location.href.split('#')[0].split('?')[0]);
    var racine = decodeURIComponent(A.racine);
    return href.indexOf(racine) === 0 ? href.slice(racine.length) : href;
  };
  // Chemin donné à l'API pour désigner la page
  C.page = function () {
    return '/' + C.cheminRelatif();
  };
  C.urlServeur = function (chemin) {
    return (
      'http://127.0.0.1:' +
      C.port +
      '/' +
      (chemin == null ? C.cheminRelatif() : chemin).split('/').map(encodeURIComponent).join('/')
    );
  };

  /* Appels ------------------------------------------------------------------ */

  C.json = function (methode, route, corps, options) {
    var init = { method: methode, headers: {} };
    if (corps !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(corps);
    }
    if (options && options.keepalive) init.keepalive = true;
    return fetch('/api/' + route, init).then(function (r) {
      return r
        .json()
        .catch(function () {
          return {};
        })
        .then(function (d) {
          if (!r.ok || (d && d.erreur))
            throw new Error((d && d.erreur) || A.t('connexion.erreur', { statut: r.status }));
          return d;
        });
    });
  };

  /* Flux d'événements (réponses de Claude au fil de l'eau) ------------------------
     surEvenement(type, donnees) reçoit : session, debut, texte, outil, quota, fin, erreur */
  C.flux = function (route, corps, surEvenement) {
    var controleur = new AbortController();
    var promesse = fetch('/api/' + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
      signal: controleur.signal,
    }).then(function (r) {
      if (!r.ok)
        return r
          .json()
          .catch(function () {
            return {};
          })
          .then(function (d) {
            throw new Error(d.erreur || A.t('connexion.erreur', { statut: r.status }));
          });
      var lecteur = r.body.getReader(),
        decodeur = new TextDecoder(),
        tampon = '',
        resultat = null,
        echec = null;
      function traiter(bloc) {
        var type = 'message',
          donnees = '';
        bloc.split('\n').forEach(function (l) {
          if (l.indexOf('event: ') === 0) type = l.slice(7);
          else if (l.indexOf('data: ') === 0) donnees += l.slice(6);
        });
        var d;
        try {
          d = JSON.parse(donnees);
        } catch (e) {
          return;
        }
        if (type === 'quota' && C.etat) {
          C.etat.quota = d.info;
          notifier();
        }
        if (type === 'fin') resultat = d;
        if (type === 'erreur') echec = new Error(d.message);
        surEvenement(type, d);
      }
      function lire() {
        return lecteur.read().then(function (x) {
          if (x.done) {
            if (tampon.trim()) traiter(tampon);
            if (echec) throw echec;
            if (!resultat) throw new Error(A.t('connexion.interrompue'));
            return resultat;
          }
          tampon += decodeur.decode(x.value, { stream: true });
          var i;
          while ((i = tampon.indexOf('\n\n')) >= 0) {
            traiter(tampon.slice(0, i));
            tampon = tampon.slice(i + 2);
          }
          return lire();
        });
      }
      return lire();
    });
    return {
      promesse: promesse,
      annuler: function () {
        controleur.abort();
      },
    };
  };

  /* Raccourcis -------------------------------------------------------------------- */

  C.executer = function (demande) {
    return C.json('POST', 'executer', demande);
  };
  C.tentatives = function () {
    return C.json('GET', 'tentatives?page=' + encodeURIComponent(C.page())).then(function (d) {
      return d.tentatives;
    });
  };
  C.lireTentative = function (fichier) {
    return C.json('GET', 'tentative?fichier=' + encodeURIComponent(fichier));
  };
  C.sauverTentative = function (t, keepalive) {
    return C.json('POST', 'tentatives', { page: C.page(), tentative: t }, { keepalive: keepalive }).then(function (d) {
      return d.fichier;
    });
  };
  C.supprimerTentative = function (id) {
    return C.json('POST', 'tentatives/supprimer', { page: C.page(), id: id });
  };
  C.catalogue = function () {
    return C.json('GET', 'catalogue');
  };
  C.reglages = function () {
    return C.json('GET', 'reglages');
  };
  C.modifierReglages = function (r) {
    return C.json('PUT', 'reglages', r);
  };
  C.tester = function (usage) {
    return C.json('POST', 'claude/test', { usage: usage });
  };
  C.corriger = function (question, reponse) {
    return C.json('POST', 'claude/corriger', { page: C.page(), question: question, reponse: reponse });
  };
  C.generer = function (options, page) {
    return C.json('POST', 'generer', { page: page || C.page(), options: options });
  };
  C.tache = function (id) {
    return C.json('GET', 'taches/' + id);
  };
  C.annulerTache = function (id) {
    return C.json('POST', 'taches/' + id + '/annuler', {});
  };
  C.claudeDisponible = function () {
    return Boolean(C.enLigne && C.etat && C.etat.claude && C.etat.claude.disponible);
  };
  C.executable = function (langage) {
    return Boolean(C.enLigne && C.etat && C.etat.executeurs && C.etat.executeurs[langage]);
  };

  /* Détection -------------------------------------------------------------------- */

  C.rafraichir = function (forcer) {
    return C.json('GET', 'etat' + (forcer ? '?forcer=1' : '')).then(function (e) {
      C.etat = e;
      C.enLigne = true;
      notifier();
      return e;
    });
  };

  C.initialiser = function () {
    if (/^https?:$/.test(location.protocol)) {
      return C.rafraichir().catch(function () {
        C.enLigne = false;
        notifier();
        return null;
      });
    }
    // Ouverte depuis le disque : le serveur tourne-t-il ? (réponse opaque, mais la requête aboutit)
    return fetch('http://127.0.0.1:' + PORT_DEFAUT + '/api/ping', { mode: 'no-cors' })
      .then(function () {
        C.serveurDetecte = true;
        notifier();
        return null;
      })
      .catch(function () {
        notifier();
        return null;
      });
  };

  A.connexion = C;
})(window.QuizApp);
