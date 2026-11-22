/* ==========================================================================
   Atelier · point d'entrée (_outils/atelier)
   --------------------------------------------------------------------------
   Les pages qui contiennent des ateliers (TD interactifs, quiz, exemples de
   cours) ne chargent que ce fichier, avec defer. Il crée l'espace de noms
   window.Atelier, charge l'outil de quiz s'il n'est pas déjà là (l'atelier
   s'en sert pour le serveur local, Claude et l'éditeur de code), puis charge,
   dans l'ordre, les modules de assets/js/.

   Deux listes :
     LOGIQUE     modules sans DOM : syntaxes, contrôles, comparaisons. Le
                 vérificateur (outils/verifier.js) et les tests les chargent
                 aussi dans Node : ils ne doivent pas toucher au document.
     INTERFACE   vues, espace de travail, sauvegarde, Claude, quiz, démarrage.

   Pour ajouter un éditeur : écrire editeurs/<nom>.js (logique) et
   vues/<nom>.js (interface), puis les ajouter aux listes ci-dessous.
   ========================================================================== */
(function () {
  'use strict';

  var LOGIQUE = [
    'noyau',
    'syntaxe',
    'editeurs/texte',
    'editeurs/relationnel',
    'editeurs/classes',
    'editeurs/table',
    'editeurs/sql',
    'editeurs/graphe',
    'editeurs/processus',
    'editeurs/chronogramme',
    'editeurs/sequence',
    'editeurs/cas',
    'editeurs/code',
  ];
  var INTERFACE = [
    'historique',
    'disposition',
    'canevas',
    'formulaire',
    'vues/texte',
    'vues/relationnel',
    'vues/classes',
    'vues/table',
    'vues/sql',
    'vues/graphe',
    'vues/processus',
    'vues/chronogramme',
    'vues/sequence',
    'vues/cas',
    'vues/code',
    'espace',
    'sauvegarde',
    'claude',
    'quiz',
    'demarrage',
  ];

  var script = document.currentScript;
  var base = script.src.replace(/atelier\.js(\?.*)?$/, '');
  var resoudre;
  var Atelier = (window.Atelier = {
    version: '1.1.0',
    base: base, // …/_outils/atelier/assets/
    racine: base.replace(/_outils\/atelier\/assets\/$/, ''), // …/studies/
    editeurs: {}, // logique de chaque éditeur
    vues: {}, // interface de chaque éditeur
    charge: new Promise(function (r) {
      resoudre = r;
    }), // tous les modules sont chargés
  });
  Atelier._charge = resoudre;
  document.dispatchEvent(new Event('atelier:defini'));

  // L'outil de quiz fournit la connexion au serveur, le panneau Claude et l'éditeur de code
  if (!window.QuizApp && !document.querySelector('script[src*="_outils/quiz/assets/quiz.js"]')) {
    var q = document.createElement('script');
    q.src = Atelier.racine + '_outils/quiz/assets/quiz.js';
    q.async = false;
    document.head.appendChild(q);
  }
  LOGIQUE.concat(INTERFACE).forEach(function (m) {
    var s = document.createElement('script');
    s.src = base + 'js/' + m + '.js';
    s.async = false; // exécution dans l'ordre de la liste
    document.head.appendChild(s);
  });
})();
