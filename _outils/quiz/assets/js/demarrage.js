/* ==========================================================================
   Quiz · démarrage (dernier module chargé)
   Détecte le serveur local, complète la barre du haut (état de la
   connexion, portail, réglages), puis lance le quiz ou le portail.
   ========================================================================== */
(function (A) {
  'use strict';

  var O = A.outils,
    el = O.el,
    C = A.connexion,
    T = A.t;

  // cle : texte du bouton dans textes.js, refait quand la langue change
  function boutonBarre(classe, icone, cle, action) {
    var b = el('button', 'bouton-barre ' + classe);
    b.type = 'button';
    b.innerHTML = O.icone(icone);
    function libeller() {
      b.setAttribute('aria-label', T(cle));
      b.title = T(cle);
    }
    libeller();
    document.addEventListener('ula:langue', libeller);
    b.addEventListener('click', action);
    return b;
  }

  // Témoin de connexion et boutons, avant le bouton de thème de la charte
  function completerBarre() {
    var barre = document.querySelector('.barre');
    if (!barre || barre.querySelector('.etat-serveur')) return;
    var groupe = el('div', 'barre-quiz');
    var etat = el('button', 'etat-serveur');
    etat.type = 'button';
    etat.addEventListener('click', function () {
      if (C.enLigne) A.dialogues.reglages();
      else A.dialogues.serveur();
    });
    groupe.appendChild(etat);
    if (C.enLigne && !document.querySelector('main.portail')) {
      groupe.appendChild(
        boutonBarre('', 'portail', 'barre.portail', function () {
          location.href = '/_outils/quiz/portail.html';
        }),
      );
    }
    // Dans l'application installée, la roue dentée de la charte (cours.js) ouvre ses
    // paramètres, qui contiennent ces réglages : pas de second bouton
    if (!/\bStudiesApp\//.test(navigator.userAgent)) {
      groupe.appendChild(
        boutonBarre('', 'reglages', 'barre.reglages', function () {
          A.dialogues.reglages();
        }),
      );
    }
    // Avant l'icône maison et le thème de la charte, qui restent côte à côte à droite
    var suivant = barre.querySelector('.bouton-accueil') || barre.querySelector('.bouton-theme');
    if (suivant) barre.insertBefore(groupe, suivant);
    else barre.appendChild(groupe);

    function maj() {
      var classe, texte, titre;
      if (C.claudeDisponible()) {
        classe = 'ok';
        texte = 'Claude';
        titre = T('barre.claudeTitre', { version: C.etat.claude.version });
      } else if (C.enLigne) {
        classe = 'partiel';
        texte = T('barre.sansClaude');
        titre = T('barre.sansClaudeTitre');
      } else {
        classe = 'hors-ligne';
        texte = T('barre.horsLigne');
        titre = T('barre.horsLigneTitre');
      }
      etat.className = 'etat-serveur ' + classe;
      etat.textContent = texte;
      etat.title = titre;
    }
    maj();
    C.surChangement(maj);
    document.addEventListener('ula:langue', maj);
  }

  function lancerQuiz(racine) {
    var source = document.getElementById('quiz-donnees');
    if (!source) return;
    var d;
    try {
      d = JSON.parse(source.textContent);
    } catch (e) {
      erreur(racine, 'Données JSON illisibles : ' + e.message);
      return;
    }
    var problemes = [];
    if (!d.id) problemes.push('identifiant « id » manquant');
    if (!Array.isArray(d.questions) || !d.questions.length) problemes.push('aucune question');
    (d.questions || []).forEach(function (q, i) {
      if (!A.types[q.type]) problemes.push('question ' + (i + 1) + ' : type inconnu « ' + q.type + ' »');
      if (!q.id) problemes.push('question ' + (i + 1) + ' : « id » manquant');
    });
    if (problemes.length) {
      erreur(racine, problemes.join('\n'));
      return;
    }
    A.quiz = new A.Quiz(racine, d);
    A.quiz.accueil();
    // Langue changée dans l'application : l'écran en cours est refait dans la nouvelle
    // langue (la réponse en cours de saisie est gardée)
    document.addEventListener('ula:langue', function () {
      var q = A.quiz;
      if (q.ecran === 'accueil') q.accueil();
      else if (q.ecran === 'question' && q.session) {
        var cle = q.questionCourante();
        if (cle && q.session.valide[cle.id]) return; // correction affichée : rien à perdre, mais pas d'état à refaire
        q.enregistrer();
        q.afficherQuestion(q.session.index);
      } else if (q.ecran === 'resultats') q.afficherResultats();
    });
  }

  function erreur(racine, message) {
    var d = el('div', 'quiz-erreur');
    d.appendChild(el('strong', null, T('moteur.erreur')));
    d.appendChild(el('pre', null, message));
    racine.appendChild(d);
  }

  // L'atelier (_outils/atelier/) ajoute le type de question « atelier » : si la page le
  // charge, on attend qu'il soit prêt avant de lancer le quiz
  function atelierCharge() {
    if (!document.querySelector('script[src*="_outils/atelier/assets/atelier.js"]')) return Promise.resolve(null);
    return new Promise(function (r) {
      if (window.Atelier) r(window.Atelier.charge);
      else
        document.addEventListener(
          'atelier:defini',
          function () {
            r(window.Atelier.charge);
          },
          { once: true },
        );
    }).then(function () {
      return window.Atelier;
    });
  }

  function demarrer() {
    C.initialiser()
      .then(function () {
        completerBarre();
        return atelierCharge();
      })
      .then(function (atelier) {
        if (atelier && atelier.brancherQuiz) atelier.brancherQuiz(A);
        var quiz = document.querySelector('main.quiz');
        if (quiz) lancerQuiz(quiz);
        var portail = document.querySelector('main.portail');
        if (portail) A.portail = new A.Portail(portail);
      })
      .catch(function (e) {
        console.error('[quiz] démarrage :', e);
      })
      .finally(function () {
        if (A._pret) A._pret(A);
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})(window.QuizApp);
