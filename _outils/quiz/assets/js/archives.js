/* ==========================================================================
   Quiz · archives et progression (QuizApp.archives)
   --------------------------------------------------------------------------
   Une tentative est enregistrée dès la première question, puis à chaque
   changement (réponse, indice, message à Claude…) : c'est ce qui permet de
   reprendre un quiz interrompu à tout moment, même après en avoir fait un
   autre. Deux copies :
     - sur le serveur local : <Matière>/quiz_results/<id du quiz>/<id>.json ;
     - dans le navigateur (localStorage) : secours hors ligne et reprise
       immédiate ; la plus récente des deux l'emporte.
   Sans serveur, les tentatives terminées restent dans le navigateur et
   peuvent être téléchargées en JSON.
   ========================================================================== */
(function (A) {
  'use strict';

  var O = A.outils,
    C = A.connexion;
  var MAX_LOCALES = 15;
  var attente = null,
    enVol = null,
    rejouer = false,
    derniere = null;
  var auditeurs = [];

  function cleEnCours(idQuiz) {
    return 'quiz-encours:' + idQuiz;
  }
  function cleHistorique(idQuiz) {
    return 'quiz-historique:' + idQuiz;
  }

  function signaler(etat, detail) {
    auditeurs.forEach(function (f) {
      try {
        f(etat, detail);
      } catch (e) {
        console.error(e);
      }
    });
  }

  function resumeDe(t) {
    var qs = t.questions || [];
    return {
      id: t.id,
      statut: t.statut,
      debut: t.debut,
      maj: t.enregistre,
      duree_ms: t.duree_ms,
      mode: t.mode,
      score: t.score,
      nb: qs.length,
      repondues: qs.filter(function (q) {
        return q.repondue;
      }).length,
      position: t.session ? t.session.index : null,
      evaluation: Boolean(t.evaluation && t.evaluation.texte),
      locale: true,
    };
  }

  // Copie dans le navigateur : la tentative en cours, et l'historique local des tentatives finies
  function sauverLocal(t) {
    var idQuiz = t.quiz.id;
    if (t.statut === 'en_cours') {
      O.ecrireMemoire(cleEnCours(idQuiz), t);
    } else {
      var courante = O.lireMemoire(cleEnCours(idQuiz));
      if (courante && courante.id === t.id) O.supprimerMemoire(cleEnCours(idQuiz));
      var h = (O.lireMemoire(cleHistorique(idQuiz)) || []).filter(function (x) {
        return x.id !== t.id;
      });
      if (t.statut === 'terminee') h.unshift(t);
      h = h.slice(0, MAX_LOCALES);
      while (h.length && !O.ecrireMemoire(cleHistorique(idQuiz), h)) h.pop(); // quota dépassé : on retire les plus anciennes
    }
  }

  function envoyer(t, keepalive) {
    if (!C.enLigne) {
      signaler('local');
      return Promise.resolve(null);
    }
    signaler('enregistrement');
    return C.sauverTentative(t, keepalive)
      .then(function (fichier) {
        signaler('enregistre', fichier);
        return fichier;
      })
      .catch(function (e) {
        signaler('erreur', e.message);
        return null;
      });
  }

  /*
    Enregistre la tentative fournie par obtenir() (une fonction : la tentative est
    construite au dernier moment). Par défaut, l'envoi au serveur est regroupé
    (une seconde après le dernier changement) ; immediat : envoi tout de suite.
  */
  function sauver(obtenir, options) {
    options = options || {};
    derniere = obtenir;
    var t = obtenir();
    t.enregistre = new Date().toISOString();
    sauverLocal(t);
    clearTimeout(attente);
    if (options.immediat || options.keepalive) return vider(options.keepalive);
    attente = setTimeout(function () {
      vider(false);
    }, 1200);
    return Promise.resolve(null);
  }

  function vider(keepalive) {
    clearTimeout(attente);
    if (!derniere) return Promise.resolve(null);
    if (enVol && !keepalive) {
      rejouer = true;
      return enVol;
    }
    var t = derniere();
    t.enregistre = new Date().toISOString();
    enVol = envoyer(t, keepalive).then(function (f) {
      enVol = null;
      if (rejouer) {
        rejouer = false;
        return vider(false);
      }
      return f;
    });
    return enVol;
  }

  // Tentatives d'un quiz (serveur et navigateur fusionnés), de la plus récente à la plus ancienne
  function lister(idQuiz) {
    var locales = (O.lireMemoire(cleHistorique(idQuiz)) || []).map(resumeDe);
    var enCours = O.lireMemoire(cleEnCours(idQuiz));
    if (enCours) locales.unshift(resumeDe(enCours));
    var serveur = C.enLigne
      ? C.tentatives().catch(function () {
          return [];
        })
      : Promise.resolve([]);
    return serveur.then(function (liste) {
      var parId = {};
      liste.forEach(function (t) {
        parId[t.id] = t;
      });
      locales.forEach(function (t) {
        var s = parId[t.id];
        if (!s || (t.maj && s.maj && t.maj > s.maj))
          parId[t.id] = s ? Object.assign({}, s, t, { fichier: s.fichier }) : t;
      });
      return Object.keys(parId)
        .map(function (k) {
          return parId[k];
        })
        .sort(function (a, b) {
          return a.id < b.id ? 1 : -1;
        });
    });
  }

  // Tentative complète, depuis le serveur ou le navigateur (la plus récente des deux)
  function lire(idQuiz, resume) {
    var locale = null;
    var enCours = O.lireMemoire(cleEnCours(idQuiz));
    if (enCours && enCours.id === resume.id) locale = enCours;
    else
      (O.lireMemoire(cleHistorique(idQuiz)) || []).forEach(function (t) {
        if (t.id === resume.id) locale = t;
      });
    if (!C.enLigne || !resume.fichier) return Promise.resolve(locale);
    return C.lireTentative(resume.fichier)
      .then(function (s) {
        return locale && locale.enregistre && s.enregistre && locale.enregistre > s.enregistre ? locale : s;
      })
      .catch(function () {
        return locale;
      });
  }

  // Tentative en cours d'un quiz (ou null)
  function enCours(idQuiz) {
    return lister(idQuiz).then(function (liste) {
      var r = liste.filter(function (t) {
        return t.statut === 'en_cours';
      })[0];
      return r ? lire(idQuiz, r) : null;
    });
  }

  // Abandon : supprimée si aucune réponse n'a été donnée, sinon gardée comme « abandonnée »
  function abandonner(t) {
    var idQuiz = t.quiz.id;
    O.supprimerMemoire(cleEnCours(idQuiz));
    var vide = !(t.questions || []).some(function (q) {
      return q.repondue;
    });
    if (vide) return C.enLigne ? C.supprimerTentative(t.id).catch(function () {}) : Promise.resolve();
    t.statut = 'abandonnee';
    t.enregistre = new Date().toISOString();
    sauverLocal(t);
    return envoyer(t);
  }

  function telecharger(t) {
    O.telecharger(t.quiz.id + '_' + t.id + '.json', JSON.stringify(t, null, 2) + '\n');
  }

  // Dernier enregistrement avant de quitter la page (envoi qui survit à la fermeture)
  window.addEventListener('pagehide', function () {
    if (derniere) sauver(derniere, { keepalive: true });
  });

  A.archives = {
    sauver: sauver,
    vider: vider,
    lister: lister,
    lire: lire,
    enCours: enCours,
    abandonner: abandonner,
    telecharger: telecharger,
    surEtat: function (f) {
      auditeurs.push(f);
    },
    oublier: function () {
      derniere = null;
      clearTimeout(attente);
    },
  };
})(window.QuizApp);
