/* ==========================================================================
   Quiz · point d'entrée (_outils/quiz)
   --------------------------------------------------------------------------
   Les pages de quiz et le portail ne chargent que ce fichier (avec defer).
   Il crée l'espace de noms window.QuizApp puis charge, dans l'ordre, les
   modules de assets/js/. Pour ajouter un module : l'écrire dans assets/js/
   et l'ajouter à la liste ci-dessous, à sa place (un module peut utiliser
   ceux qui le précèdent).

     textes          textes de l'interface en français et en anglais
     outils          DOM, textes, dates, mémoire, icônes
     markdown        rendu des réponses de Claude
     connexion       serveur local : détection, API, flux
     types           les neuf types de questions de base
     code            éditeur, exécution, type « code », extraits exécutables
     claude          panneau de conversation avec Claude
     dialogues       réglages, génération de quiz, confirmations
     archives        progression, tentatives, reprise
     moteur          objet Quiz : session, score, sauvegarde
     ecran-accueil   reprise, réglages, historique
     ecran-question  question, indices, aide, correction
     ecran-resultats évaluations classique et détaillée, correction
     portail         page d'accueil du serveur
     demarrage       barre du haut, lancement
   ========================================================================== */
(function () {
  'use strict';

  var MODULES = [
    'textes',
    'outils',
    'markdown',
    'connexion',
    'types',
    'code',
    'claude',
    'dialogues',
    'archives',
    'moteur',
    'ecran-accueil',
    'ecran-question',
    'ecran-resultats',
    'portail',
    'demarrage',
  ];

  var script = document.currentScript;
  var base = script.src.replace(/quiz\.js(\?.*)?$/, '');
  var resoudre;
  window.QuizApp = {
    version: '2.1.0',
    base: base, // …/_outils/quiz/assets/
    racine: base.replace(/_outils\/quiz\/assets\/$/, ''), // …/studies/
    // Résolue quand le serveur local est détecté et la barre complétée
    // (l'atelier, _outils/atelier/, l'attend pour créer ses espaces de travail)
    pret: new Promise(function (r) {
      resoudre = r;
    }),
  };
  window.QuizApp._pret = resoudre;
  MODULES.forEach(function (m) {
    var s = document.createElement('script');
    s.src = base + 'js/' + m + '.js';
    s.async = false; // exécution dans l'ordre de la liste
    document.head.appendChild(s);
  });
})();
