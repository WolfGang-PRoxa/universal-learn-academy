'use strict';
// ESLint (configuration « flat ») pour app/ et _outils/, lancé depuis app/ (npm run lint,
// npm run check) : ESLint et ses modules sont installés dans app/node_modules.
// Règles recommandées de @eslint/js, avec l'environnement de chaque partie :
// - Node : processus principal, scripts et tests de app/, programme des outils
//   (_outils/app), serveurs et outils en ligne de commande de _outils ;
// - navigateur : pages des fenêtres annexes de app/ (modules ES pour paramètres,
//   documentation et guide ; scripts classiques pour le choix de la langue et la proposition
//   de synchro), scripts des pages des outils (quiz, atelier, charte, accueil, suivi) ;
// - ponts (preload) : Node et navigateur.

const { createRequire } = require('node:module');
const path = require('node:path');

const requireApp = createRequire(path.join(__dirname, 'app', 'package.json'));
const js = requireApp('@eslint/js');
const globals = requireApp('globals');

// Scripts classiques des pages des outils : ils partagent des globales entre fichiers
// (window.QuizApp, window.Atelier…), et certains s'exportent aussi pour Node (tests, vm).
const pagesOutils = [
  '_outils/atelier/assets/**/*.js',
  '_outils/charte/assets/**/*.js',
  '_outils/quiz/assets/**/*.js',
  '_outils/todo/assets/**/*.js',
  '_outils/ula/assets/**/*.js',
];

module.exports = [
  {
    ignores: [
      '**/node_modules/',
      'app/dist/',
      'app/out/',
      'app/release/',
      'app/.contenu/',
      'app/.outils/',
      'app/.catalogue/',
      '_outils/charte/vendor/',
    ],
  },
  js.configs.recommended,
  {
    rules: {
      // Le code ignore volontairement beaucoup d'erreurs attrapées (`catch (e) {}` : fichier
      // absent, commande introuvable…) : seules les variables et arguments inutilisés comptent.
      // `const { a, ...reste } = objet` sert à écarter a : ignoreRestSiblings.
      'no-unused-vars': ['error', { caughtErrors: 'none', ignoreRestSiblings: true }],
    },
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node } },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
  },
  {
    files: ['app/src/parametres/*.js', 'app/src/doc/*.js', 'app/src/guide/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.browser } },
  },
  {
    files: ['app/src/langue/*.js', 'app/src/proposition/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
  },
  {
    files: ['app/src/**/pont.cjs', '_outils/app/recherche-pont.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: pagesOutils,
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, ...globals.commonjs } },
  },
];
