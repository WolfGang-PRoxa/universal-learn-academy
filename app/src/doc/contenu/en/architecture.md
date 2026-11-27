# Architecture

Universal Learn Academy is an **Electron** application. It is made of a host, specific to the installed application, and of the tools, shared with the launchers that need no installation.

## Overview

| Part          | Location                                           | Role                                                                                 |
| ------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Host          | `app/src/main.js`                                  | Data and tools folders, settings, language, Claude, updates, sync, secondary windows |
| Tools program | `_outils/app/principal.js`                         | Local server, course windows, menu, search, printing                                 |
| Local server  | `_outils/quiz/serveur/` and `_outils/ula/serveur/` | Serves the pages and the API: quizzes, tutorials, profiles, curriculum, catalogue    |
| Pages         | `_outils/charte/`, `_outils/ula/`, `explore/`      | Shared style (`cours.js`, `cours.css`), home page, courses                           |

The host publishes `global.studiesHote` then loads the tools program. Without the host (`lancer-app.bat`, a browser with `lancer.bat`), this program runs alone, exactly as before: everything that comes from the host (settings, documentation, language, sync) is missing, and the interface stays in French.

## Secondary windows

The application’s own windows are local pages of `app/src/`, opened by the host and centred on the course window (`annexe.js`):

| Folder         | Window                          |
| -------------- | ------------------------------- |
| `parametres/`  | Settings                        |
| `doc/`         | Documentation                   |
| `guide/`       | Guided setup                    |
| `langue/`      | Language choice at first launch |
| `proposition/` | Sync proposal                   |

Each one goes through a preload script (`pont.cjs`) that exposes, through `contextBridge`, a limited API (`window.studies`, `window.choixLangue`…) to the host’s IPC channels. Pages only load their own scripts (security policy `script-src 'self'`).

## Languages

| Texts                                  | File                                                  |
| -------------------------------------- | ----------------------------------------------------- |
| Host, settings, documentation, guide   | `app/src/i18n/fr.js` and `en.js`                      |
| Tools menu, dialogs and notifications  | `_outils/app/textes.js`                               |
| Top bar of the pages                   | `TEXTES_BARRE` in `_outils/charte/assets/cours.js`    |
| Home page                              | `_outils/ula/assets/textes.js`                        |
| “My revisions” portal and quiz screens | `_outils/quiz/assets/js/textes.js`                    |
| TD workshops (editors, views, checks)  | `tr("…", "…")` (`_outils/atelier/assets/js/noyau.js`) |
| Local server messages                  | `tr("…", "…")` (`_outils/quiz/serveur/lib/langue.js`) |
| Documentation pages                    | `app/src/doc/contenu/<language>/`                     |

The language is saved in `parametres.json` (`langue`). The host announces it to the served pages in the user agent (`StudiesApp/<version> ULA-langue/<code>`); on each change, it calls `window.ulaLangue(code)` in the open pages, which emit the `ula:langue` event, and notifies the secondary windows. The local server answers in the language of the request: user agent of the pages, or `X-ULA-Langue` header of the host’s calls. French is the reference language: a key missing from another language is taken in French.

## Documentation

`documentation.js` reads `doc/contenu/sommaire.json` and each language’s Markdown pages (a missing page is taken in French). The `doc/` page, laid over the course window like the settings (`parametres-integres.js`), formats them with `doc/markdown.js` and recognises special links:

| Link                   | Effect                         |
| ---------------------- | ------------------------------ |
| `page:<id>#<anchor>`   | Another documentation page     |
| `parametres:<section>` | Settings, at the given section |
| `guide:`               | Guided setup                   |
| `https://…`            | System browser                 |
