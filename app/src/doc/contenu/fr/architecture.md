# Architecture

Universal Learn Academy est une application **Electron**. Elle se compose d’un hôte, propre à l’application installée, et des outils, partagés avec les lanceurs sans installation.

## Vue d’ensemble

| Partie | Emplacement | Rôle |
|---|---|---|
| Hôte | `app/src/main.js` | Dossier des données et des outils, paramètres, langue, Claude, mises à jour, synchronisation, fenêtres annexes |
| Programme des outils | `_outils/app/principal.js` | Serveur local, fenêtres des cours, menu, recherche, impression |
| Serveur local | `_outils/quiz/serveur/` et `_outils/ula/serveur/` | Sert les pages et l’API : quiz, TD, profils, cursus, catalogue |
| Pages | `_outils/charte/`, `_outils/ula/`, `explore/` | Charte commune (`cours.js`, `cours.css`), accueil, cours |

L’hôte publie `global.studiesHote` puis charge le programme des outils. Sans hôte (`lancer-app.bat`, navigateur avec `lancer.bat`), ce programme fonctionne seul, exactement comme avant : tout ce qui vient de l’hôte (paramètres, documentation, langue, synchronisation) en est absent, et l’interface reste en français.

## Fenêtres annexes

Les fenêtres propres à l’application sont des pages locales de `app/src/`, ouvertes par l’hôte, centrées sur la fenêtre des cours (`annexe.js`) :

| Dossier | Fenêtre |
|---|---|
| `parametres/` | Paramètres |
| `doc/` | Documentation |
| `guide/` | Paramétrage guidé |
| `langue/` | Choix de la langue au premier lancement |
| `proposition/` | Proposition de synchronisation |

Chacune passe par un script de préchargement (`pont.cjs`) qui expose, par `contextBridge`, une API limitée (`window.studies`, `window.choixLangue`…) vers les canaux IPC de l’hôte. Les pages ne chargent que leurs propres scripts (politique de sécurité `script-src 'self'`).

## Langues

| Textes | Fichier |
|---|---|
| Hôte, paramètres, documentation, guide | `app/src/i18n/fr.js` et `en.js` |
| Menu, dialogues et notifications des outils | `_outils/app/textes.js` |
| Barre du haut des pages | `TEXTES_BARRE` dans `_outils/charte/assets/cours.js` |
| Accueil | `_outils/ula/assets/textes.js` |
| Pages de la documentation | `app/src/doc/contenu/<langue>/` |

La langue est enregistrée dans `parametres.json` (`langue`). L’hôte l’annonce aux pages servies dans l’agent utilisateur (`StudiesApp/<version> ULA-langue/<code>`) ; à chaque changement, il appelle `window.ulaLangue(code)` dans les pages ouvertes, qui émettent l’événement `ula:langue`, et prévient les fenêtres annexes. Le français est la langue de référence : une clé absente d’une autre langue est prise en français.

## Documentation

`documentation.js` lit `doc/contenu/sommaire.json` et les pages Markdown de chaque langue (une page absente est prise en français). La fenêtre `doc/` les met en forme avec `doc/markdown.js` et reconnaît des liens particuliers :

| Lien | Effet |
|---|---|
| `page:<id>#<ancre>` | Autre page de la documentation |
| `parametres:<section>` | Paramètres, à la section voulue |
| `guide:` | Paramétrage guidé |
| `https://…` | Navigateur du système |
