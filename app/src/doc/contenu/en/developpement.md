# Development

## Requirements

Node.js 22 or later. To build the AppImage from Windows: WSL with Node.

## Commands

From the `app/` folder:

| Command | Effect |
|---|---|
| `npm install` | Dependencies |
| `npm start` | Starts the application with the repository’s tools |
| `npm run check` | Checks: syntax, languages, documentation, content rules, trapped packages and archives, profiles, sync, shortcuts |
| `npm run dist` | Builds the Windows installer and the AppImage in `dist/`, without publishing them |
| `npm run catalogue` | Builds the catalogue in `app/.catalogue` (`-- --publier` to send it) |
| `npm run public` | Preview of the public repository (`-- --pousser` to update it) |
| `npm run release` | Builds and publishes a version (see below) |

## Environment variables

| Variable | Effect |
|---|---|
| `ULA_USER_DATA=<folder>` | Another settings folder, for testing (the language is then asked again) |
| `ULA_CATALOGUE=<folder>` | Reads a local catalogue, for example `app/.catalogue` |
| `ULA_SYNCHRO_INTERVALLE_MS=<ms>` | Shortens the sync interval |

## Adding a language

1. Copy `app/src/i18n/en.js` to `<code>.js`, translate each value without touching the keys or the `{…}` variables, and add it to `LANGUES` and `DICTIONNAIRES` in `app/src/i18n/index.js`.
2. Add the language to `_outils/app/textes.js`, to `TEXTES_BARRE` in `_outils/charte/assets/cours.js` and to `_outils/ula/assets/textes.js`.
3. Translate the pages in `app/src/doc/contenu/<code>/` and add the group titles in `sommaire.json`.
4. Run `npm run check`: it reports any missing key, any differing variable and any missing page.

## Adding a documentation page

1. Write `app/src/doc/contenu/fr/<id>.md` and `en/<id>.md`. The first `#` heading is the page title.
2. Add `<id>` to a group of `sommaire.json`.

Supported Markdown: headings, paragraphs, lists (nested by indentation), numbered lists, tables, code blocks, callouts (`> **Note**`, `> **Tip**`, `> **Warning**`), rules, bold, italics, code and links.

## Publishing a version

1. Increase `version` in `app/package.json`, commit and push to `main`, then update the public repository (`npm run public -- --pousser`).
2. From the Windows computer, with the GitHub CLI signed in and WSL: `npm ci`, then `npm run release`.

The script refuses to publish outside `main`, with local changes or with a version already published. It builds the installer and the AppImage, creates the release as a draft, uploads the files, publishes it, then checks every file. Courses are published independently with `npm run catalogue -- --publier`.
