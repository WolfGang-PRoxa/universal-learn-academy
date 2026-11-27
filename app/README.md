[Français](README.fr.md) · **English**

# Universal Learn Academy, the desktop app

The courses, quizzes and interactive TD of ula in a desktop app that installs itself, updates itself, downloads courses on demand and is configured in its settings. Modelled on CV Studio (Electron, electron-builder, electron-updater, publishing with the GitHub CLI). Up to version 1.0.3 it was called **Studies** and shipped all the courses in its installer.

Running without installing works as before: `lancer.bat` (server and browser), `lancer-app.bat` (window built on the PC from the repository) and `git pull` to get one's courses and progress from one computer to another.

## Install

| System                 | File from the [latest release](https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/latest) | Installation                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10 or 11 (x64) | `Universal-Learn-Academy-Setup-<version>.exe`                                                             | For the current user, no administrator rights needed. The app is not signed: SmartScreen asks for "More info", then "Run anyway". |
| Linux (x64)            | `Universal-Learn-Academy-<version>.AppImage`                                                              | `chmod +x Universal-Learn-Academy-<version>.AppImage`, then run it.                                                               |

Later versions install themselves at startup (see "Updates"). Moving from Studies 1.0.x to 2.0.0 also goes through the automatic update: the app id (`fr.wolfgangproxa.studies`) and the package name (`studies`, hence the install folder `%LOCALAPPDATA%\Programs\studies`) are kept; the settings in `%APPDATA%\Studies` are carried over to `%APPDATA%\Universal Learn Academy`, and the old "Studies" shortcuts are removed.

## First launch

A small window in the app's style (`src/langue/`) first asks for the **language**: French or English, with the system language suggested (arrow keys and Enter are enough). Closed without a choice, the system language is used this time and the question comes back at the next launch. Then the home page asks for the user name, prefilled with the Windows or Linux session name: it is the name of the user's space folder. It also offers an example curriculum ("Informatique": L1, L2, L3 folders with all their courses) and to download its courses right away, in the background. Then the home page's "Online catalogue" lists the courses; each downloaded course goes into a folder of the curriculum (see `_outils/ula/README.md`).

```
<local app data>/Universal Learn Academy/donnees/   data folder (default)
├── explore/<domain>/<course>/    downloaded courses, read-only
└── <profile>/<curriculum>/<course>/   link to the course (ula-lien.json) and progress
```

## Language, documentation and guided setup

Since version 2.6.0:

- **Language** (`langue` in `parametres.json`, "Language" card in the settings): French or English for the menus, settings, notifications, the top bar of the pages, the home page, the documentation and the guide. The change applies immediately to all windows. Courses, quizzes and TD stay in French for now. Strings: `src/i18n/fr.js` (reference) and `en.js`; `_outils/app/textes.js` (menu, dialogs); `TEXTES_BARRE` in `_outils/charte/assets/cours.js` (top bar); `_outils/ula/assets/textes.js` (home page). The language is announced to the pages in the user agent (`ULA-langue/<code>`) and `window.ulaLangue(code)` notifies them of a change. Without the host (`lancer.bat`, `lancer-app.bat`), everything stays in French.
- **Built-in documentation** (`src/doc/`, `src/documentation.js`): F1, the "?" button in the page bar, **Help › Documentation** menu, tray icon menu or "Help" card in the settings. A user guide and technical documentation, as Markdown pages per language (`src/doc/contenu/<language>/<id>.md`, order in `sommaire.json`), with search (Ctrl+F) and links to the settings (`parametres:<section>`) or the guide (`guide:`). Since version 2.7.0 it opens like the settings, over the page in the course window (same overlay and centred panel, Esc or the cross close it); a settings link opens the settings on top of it.
- **Guided setup** (`src/guide/`): button in the documentation, **Help › Guided setup…** menu or "Help" card. The settings one by one, with a short explanation and a link to the matching settings card: language, profile (and example curriculum if there is none yet), Claude, scale, window at launch, closing the window, updates, shortcuts, data folder, synchronisation (if the folder is a tracked repository), then a summary. Each choice applies immediately.

`npm run check` verifies that each dictionary has the same keys and the same variables in both languages, that every key used exists, and that every page in the table of contents exists in each language with valid links.

## Settings

The gear in the top bar, on every page, or Ctrl+, (**File › App settings…** menu). In the installed app, it replaces the quiz tool's "Settings" gear, whose settings are gathered here; in a browser or with `lancer-app.bat`, the quiz gear stays as before.

Since version 2.6.2, the settings are no longer a system window: like those of Modding Manager, they open inside the course window, over the page (`src/parametres-integres.js`, which also carries the documentation since 2.7.0). A transparent view covers the window; the settings page draws a dark overlay and a centred panel on it (the whole window minus a 24 px margin, at most 1500 × 1100), of which only the content scrolls. The cross, Esc or a click on the overlay close them; reopened from another course window, they move there. From 860 px of panel width, the section navigation moves to the side (current section highlighted) and the cards are laid out in 2 or 3 columns of at least 420 px, without gaps: the order is kept, a wide card (window at launch, Claude models) takes the whole row, the last card of an incomplete row stretches to the edge, and the cards of a row have the same height. Below that, a single column with the navigation at the top.

- **Updates** (on by default): at startup, then every 6 hours (checked every quarter of an hour), when the PC wakes up and shortly after the window is hidden, the app looks for a new version in the GitHub releases, like Modding Manager. It downloads it in the background (differentially, thanks to the `.blockmap` files), announces it with a notification (once per version; a click opens this section) and with the "Restart and install version…" entry of the tray icon menu, and installs it when the app quits. "Restart and install" applies it right away. The setting also turns off the periodic check.
- **Interface scale**: "Automatic" (100 %, default: the home pages take the whole width of the window and the text grows a little on a large screen) or from 50 to 200 %. It applies immediately to all course windows, to the settings (same readability everywhere) and at each launch; Ctrl+Plus, Ctrl+Minus and Ctrl+wheel adjust further until the window is closed, Ctrl+0 returns to the chosen scale.
- **Background** (on by default): see "Background" below.
- **Window at launch**: large window (maximised, default) or custom size and position, set in a frame that represents the screens to scale (mouse or keyboard) or with four fields. If the position is no longer visible (screen unplugged), the window opens maximised. Taken from CV Studio.
- **Shortcuts**: Desktop, Start menu (applications menu on Linux), or any chosen folder. For each location, the app says what it finds: nothing ("Create"), a valid shortcut, a shortcut to an old copy or a broken one ("Repair"), a file that opens something else ("Replace", after confirmation). Shortcuts have the name of the installer's ones ("Universal Learn Academy"): uninstalling removes those on the Desktop and in the Start menu. On Linux, they are `.desktop` files that launch the AppImage.
- **Connection to Claude**: see below.
- **Claude models and code execution** (formerly the quizzes' "Settings"): Claude Code path, model and effort for hints, grading, evaluation and quiz generation (with a "Test" button), executable languages. Read and saved through the local server's API (`_outils/quiz/reglages.json` of the tools).
- **Profile**: the active profile (remembered on the computer), adding and renaming a profile. The home page can also switch profiles.
- **Synchronisation**: see "Synchronisation between several PCs" below.
- **Data folder**: `%LOCALAPPDATA%\Universal Learn Academy\donnees` (`~/.local/share/Universal Learn Academy/donnees` on Linux) by default, or another folder. "Choose another folder…" switches folders without copying; "Move…" copies the data to the chosen folder at the next start, checks the copy (same files, same sizes) and only then removes the old folder. A git repository of ula (it contains `_outils/app` and `explore/`) is recognised: it is the catalogue author's "repository mode", where tools and catalogue are the repository's and where `git pull` / `git push` synchronise everything.

## Connection to Claude

Quizzes call Claude (hints, grading of written answers, evaluation, quiz generation) through Claude Code (`claude -p`, see `_outils/quiz/serveur/lib/claude.js`).

What Anthropic allows, according to the Claude Code documentation read on 12 November 2026 ([Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance), [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)):

- a third-party app **may not** offer sign-in with a claude.ai account, route requests through its users' Free, Pro or Max plan, or collect or store their credentials or session tokens;
- it **may** use the user's API key, billed to their account;
- nothing prevents users from signing in themselves, with their plan, to the unmodified Claude Code binary.

The app therefore offers two modes:

| Mode                                                 | What the app does                                                                                                                                                                                                                                                              | For whom                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| **My Claude account, through Claude Code** (default) | Detects Claude Code and shows the signed-in account (`claude auth status`). "Sign in…" opens a terminal on `claude auth login`: signing in happens on Anthropic's website, the app never sees the credentials.                                                                 | Users with a Claude plan.                         |
| **An Anthropic API key**                             | The key is checked with Anthropic, encrypted by the system (`safeStorage`: DPAPI on Windows, keyring on Linux; refused if there is no keyring), never sent back to the interface. At startup, it is passed to the local server in `ANTHROPIC_API_KEY`, which Claude Code uses. | Users without a plan: usage is billed to the key. |

In both cases, Claude Code must be installed; without it, courses and quizzes are displayed, but without Claude's help. The app is neither named nor presented as an Anthropic product.

## Synchronisation between several PCs

Since version 2.5.0, when the data folder is a Git repository whose branch tracks a branch of a remote repository, the app offers once, in a small window in its style centred on the course window (`src/proposition/`), to synchronise it automatically ("Enable", "Later": asked again at the next launch, like the cross or Esc, "No thanks") (`synchro.auto` in `parametres.json`). Once enabled, synchronisation runs at launch (about ten seconds after), every 30 minutes (even with the window closed, since the app stays in the background), when the PC wakes up and when quitting (10 seconds at most). "Synchronise now": cloud button in the page bar (green dot: up to date, blue: in progress, red: problem, a click then opens the settings), tray icon menu, "Synchronisation" card in the settings.

A cycle (`src/synchro-git.js`, verified by `npm run check` on two clones of the same repository):

1. nothing if a Git command is in progress (`index.lock`, merge or rebase to finish): new attempt at the next cycle;
2. commit of what changed in the scope, message "Progression du 16/11/2026 à 15:50 (<PC name>)", with the computer's Git identity;
3. `git fetch`, then merge with the tracked branch (`--autostash`: files modified outside the scope do not get in the way);
4. `git push`, retried once if the other PC has just pushed; never `--force`.

| Data folder                              | What is committed automatically                                                                                                                                                                                                                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ula repository (catalogue author's mode) | Only the progress written by the app in a profile's space: `quiz_results/`, `td_results/`, `ula-lien.json`, `ula-profil.json`. The rest (labs, courses being written) waits for its own commits; local commits already made go out with the progress. |
| Other folder turned into a repository    | Everything, except `explore/`, `_outils/` and temporary files.                                                                                                                                                                                        |

Conflicts (same file modified on two PCs between two synchronisations): `td_results/<page>.json` is merged workshop by workshop (the most recent according to `maj`), a quiz attempt keeps the most recently saved version, the `ula-lien.json` and `ula-profil.json` records keep the local version. For any other file, in the ula repository the merge is cancelled and left to be done by hand (`git pull`); in another folder, the local version stays and the other one is saved next to it (`nom (conflit 16-11-2026 15h50).ext`), with a notification. A file deleted on one side and modified on the other is kept. A file larger than 50 MB is not committed (reported in the card).

Credentials: Git must be installed and already connected to the remote repository (Git Credential Manager, GitHub CLI, SSH key). The app neither asks for nor keeps any, and Git cannot ask it anything (`GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, SSH in `BatchMode`): a refused access is reported ("run git pull once by hand").

`git pull` by hand: it remains possible at any time (at university, without the app). If the app is running, it notices (HEAD commit watched every 5 seconds) and reloads the home page.

Without the host (`lancer.bat`, `lancer-app.bat`, browser), nothing changes: no cloud button, synchronisation with `git pull` and `git push` as before. `ULA_SYNCHRO_INTERVALLE_MS` shortens the interval for testing.

Next steps (proposal approved on 16 November 2026): link a GitHub repository from the app (GitHub app limited to the chosen repository, sign-in by code, Git downloaded on demand), then a mirror of the profile's space to a OneDrive, Google Drive, pCloud or Dropbox folder.

## Catalogue, tools and personal data

### What is shipped

- **The installer** only contains the program (`app.asar`) and the **tools**: files tracked by git under `_outils/`, minus those excluded by the rules (`_outils/ula/lib/regles.js`: scans, local settings…). No courses any more: about 100 MB instead of 640.
- **Courses** are downloaded on demand from the public repository's `catalogue` release, one by one or as a level pack ("Licence 1 informatique"…, `explore/packs/`, see `_outils/ula/README.md`): `catalogue.json` and one archive per course, produced by `npm run catalogue` (`scripts/catalogue.mjs`). An archive contains the course's files tracked by git (`explore/<domain>/<course>/`), minus personal data; lab files only if they are in the whitelist, in their original version.

What is **never** published (neither in an installer, nor in the catalogue, nor in the public repository): everything outside `explore/` and `_outils/` (the profile spaces: `romain/` with its labs, attempts, TODO, admin papers, Hop3x…), `quiz_results/` and `td_results/`, the "Mon suivi" tool (`_outils/todo/`, used to develop the app), lab files not in the list or modified, filled-in English worksheets, homework notebooks, scans, any path containing the student's name, and the email address of the git identity in a text file.

**Lab files.** The student's lab folder (`romain/<curriculum>/<course>/TP/`) mixes provided files and work. The instructions and original files (assignments, data, provided files, documentation, Makefile, launchers) are published in `explore/<domain>/<course>/TP/`, in their **original version** (first commit; the last one for `run.sh` and `run.bat`, which only contain the environment), according to the rules in `scripts/tp-fournis.mjs`; `app/tp-fournis.json` keeps, for each of them, its working file, the original commit and the checksum. After a new lab, update the rules and run `node scripts/tp-fournis.mjs` again: it writes the original versions to `explore/` and updates the list. For the student, a file missing from a course is looked for in that course's folder in their space (their lab).

### Blocking checks

1. `scripts/preparer-contenu.mjs` only copies the allowed tools to `app/.outils/`, with a manifest (size and checksum of each file);
2. electron-builder puts them in `resources/outils/`;
3. after packaging and before the installer or the AppImage is created, `scripts/apres-empaquetage.cjs` goes through the whole package (tools, `app.asar`, resources): a personal file, a course file or a difference with the manifest **makes the build fail**;
4. `npm run catalogue` and `npm run public` check each published file (rules, checksums of lab files, email address) and refuse everything at the first problem;
5. `npm run check` verifies that a trapped package, course archive and course proposal are indeed refused.

### Where the app writes

- **Data folder** (`%LOCALAPPDATA%\Universal Learn Academy\donnees` by default, `~/.local/share/Universal Learn Academy/donnees` on Linux; never in Documents): downloaded courses (`explore/`, versions in `.ula-version.json`) and the profile spaces. Nothing the user produces goes into `explore/`: updating or removing a course never touches their work.
- **Tools**: copied at first launch, then at each new version, to `%LOCALAPPDATA%\Universal Learn Academy\outils` (`~/.local/share/Universal Learn Academy/outils` on Linux), according to the manifest: a file modified since it was copied (the quiz settings…) is never overwritten.
- **ula git repository** (student's mode): the repository is used as is, tools, catalogue and work included, and `git pull` / `git push` synchronise them as before.
- **Settings**: `%APPDATA%\Universal Learn Academy\parametres.json` (`~/.config/Universal Learn Academy`). Uninstalling keeps them.
- **Freeze log**: `%APPDATA%\Universal Learn Academy\logs\gels.log` (under 512 KB, the old one becomes `gels.1.log`), see "Scrolling and freeze log".
- **Active profile**: `%LOCALAPPDATA%\studies-quiz\ula-profil-actif.json`, shared with `lancer.bat`.
- PGlite (SQL questions) ships with the app and is copied when needed to `%LOCALAPPDATA%\studies-quiz`: Node is not needed on the computer.

### Public repository and working repository

| Repository                                                                                            | Visibility | Contents                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WolfGang-PRoxa/ula` (this one, formerly `studies`)                                                   | private    | everything: catalogue, tools, app, and the student's space (`romain/`: labs, attempts, TD, TODO, admin papers). Used for `git pull` from one computer to another. |
| [`WolfGang-PRoxa/universal-learn-academy`](https://github.com/WolfGang-PRoxa/universal-learn-academy) | public     | only the publishable content, the app releases and the `catalogue` release. Automatic updates and the catalogue read it.                                          |

The public repository is never edited by hand: `npm run public` (preview) then `npm run public -- --pousser` updates it from this repository (`scripts/exporter-public.mjs`): the catalogue (the same files as its archives) and its domain home pages, the tools, the home page, the launchers, the license (`LICENSE`), the changelog (`CHANGELOG.md`, `CHANGELOG.fr.md`), the `app/` code (without `tp-fournis.json`), `app/public/README.md` and `README.fr.md` as its front page. The history of this private repository never goes to the public repository. `npm run donnees-perso` lists the tracked files that the rules consider personal.

The original materials (lecture notes, slides, assignments, past exams) are published with the catalogue: their redistribution remains to be confirmed with their authors.

## Course proposals

"Propose this course" (home page, on a course in one's space) prepares a checked archive of the generated pages only, and opens a prefilled issue in the public repository; the user attaches the archive to it. To accept it: `npm run accepter-proposition -- <archive.zip> [--domaine d] [--id id] [--essai]` (same checks, links made relative, checkers, domain home pages), then commit and `npm run catalogue -- --publier`. Details: `_outils/ula/README.md`.

## Background

Taken from Modding Manager (version 2.4.0). Closing the window (the cross, Ctrl+W) no longer quits the app: the window is hidden, the app's icon stays in the notification area (bottom right of the taskbar), and the local server keeps running (a quiz generation runs to completion). The first time, a balloon reminds the user (`arrierePlan.bulleMontree`). On Windows, the icon is the `build/icon.ico` file, packaged on purpose (`build.files`): Windows picks the size that suits the screen.

- **Reopen**: click or double-click on the icon, "Open Universal Learn Academy" entry of its menu, or launch the app again (shortcut, Start menu): a single instance runs, and a new launch shows the existing window again, on the same page.
- **Icon menu** (right-click): Open, Check for updates (or "Restart and install version…" when a version is ready), Quit.
- **Quit**: the icon's Quit entry or Ctrl+Q. If a quiz generation is in progress, the app asks first; "Continue" cancels and the cross hides the window again. A downloaded update is installed at that moment.
- **Setting** "Keep Universal Learn Academy in the background when the window is closed" (Background card in the settings, `arrierePlan.fermeture`, on by default): unchecked, the cross of the last window quits the app as before. Modding Manager does not have this setting; it is added here for those who prefer the old behaviour.
- **Linux (AppImage)**: same behaviour if the desktop has a notification area (StatusNotifierItem: KDE, Cinnamon, XFCE, GNOME with the AppIndicator extension, detected through D-Bus at launch); otherwise the cross closes the app.
- Modding Manager's launch at Windows startup is not carried over.

## Scrolling and freeze log

Up to 2.3.0, mouse-wheel scrolling sometimes stopped, on any page, and resumed after a click. Measurements made (wheel events sent through the debugging protocol while the settings, Claude's status, the update check and Ctrl+F followed one another):

- the only long freeze reproduced (6 to 52 s) comes from Chromium's occluded-window calculation on Windows: when it considers the window covered, the page becomes "hidden", stops painting and stops scrolling until a click or a focus change runs it again. This calculation is turned off (`--disable-features=CalculateNativeWinOcclusion`, in `src/main.js`), as VS Code does; no more freezes after that;
- the main process, through which the wheel and the keyboard go on Windows, was blocked about 0.3 s each time the settings opened (looking for Claude Code with `spawnSync`), up to 20 s per executable if one did not answer, and by `gh auth token` during an update check. All these calls are now asynchronous (`src/claude.js`, `src/mises-a-jour.js`);
- the search bar (Ctrl+F) is removed from the window when it closes instead of only being hidden, and closes when the page changes.

`src/diagnostic.js` keeps a short log, `gels.log`, in the app's log folder (`%APPDATA%\Universal Learn Academy\logs`, `~/.config/Universal Learn Academy/logs`; button in Settings › About): each block of the main process longer than 150 ms, with the call in progress, and each page still hidden one second after its window is shown. If scrolling freezes again, this log tells which of the two happens.

## Updates

electron-updater reads the releases of `universal-learn-academy`, a public repository. **No token is put in the executable.** If public reading fails (404, repository made private again), the app tries the token of the GitHub CLI already signed in on the computer (`gh auth token`), kept in memory for the time of the check and the download. The catalogue does the same.

The `catalogue` release is a pre-release: it is never "Latest", and the `releases/latest` API read by electron-updater does not return it.

## Development

Requirements: Node.js 22 or later; for the AppImage, WSL with Node (`~/.local/node` is enough) or a Linux machine.

```bash
cd app
npm install        # dependencies (if Electron is not downloaded: node node_modules/electron/install.js)
npm start          # start the app (tools from the repository, data folder from the settings)
npm run check      # prettier --check and eslint, then checks: syntax, rules, trapped package/catalogue/proposal, profiles, tools, shortcuts
npm run format     # format app/ and ../_outils/ with Prettier (.prettierrc.json and .prettierignore at the root of ula)
npm run lint       # ESLint only, on app/ and ../_outils/ (eslint.config.js at the root of ula: Node for the main process, scripts, tests and tool servers, browser for the pages)
npm test           # automated tests (test/*.test.js, run by node --test)
npm run dist       # build the Windows installer and the AppImage in dist/ without publishing them (-- --win or -- --linux for only one)
npm run catalogue  # build the catalogue in app/.catalogue (-- --publier to upload it)
```

Continuous integration: `.github/workflows/ci.yml` at the root of ula (every push and pull request: Ubuntu, Node 22, `npm ci`, `npm run check`, `npm test` in `app/`); the public repository's workflow is `public/.github/workflows/ci.yml`, copied by `npm run public` (there, `check.mjs` skips the lab whitelist, which is not published). Pushing a workflow file with the GitHub CLI's token needs the `workflow` scope: `gh auth refresh -h github.com -s workflow`.

Packs and example curricula (catalogue, developer side only): `npm run catalogue -- pack-ajouter | pack-ajouter-cours | cursus-ajouter | cursus-ajouter-pack | verifier`, see `_outils/ula/README.md`.

`ULA_USER_DATA=<folder>` starts the app with another settings folder (testing); `ULA_CATALOGUE=<folder>` makes it read a local catalogue (for example `app/.catalogue`).

### Publishing a version

1. Increase `version` in `app/package.json` (updates compare this number; `X.Y.Z` format, the only place the version is written), move the `[Unreleased]` entries of `CHANGELOG.md` and `CHANGELOG.fr.md` under a new `## [X.Y.Z] - YYYY-MM-DD` heading (and add its link at the bottom), commit and push to `main`, then update the public repository: `npm run public -- --pousser`.
2. From the Windows PC:

   ```bash
   cd app
   npm ci
   npm run release
   ```

   Requirements: GitHub CLI signed in (`gh auth login`), WSL for the AppImage.

The script (`scripts/release.mjs`):

- refuses to publish outside `main`, with local changes (the shipped tools are those of the last commit), if `main` is not up to date with GitHub, or if the version is already published;
- builds (`scripts/construire.mjs`): tools prepared and checked, NSIS x64 installer with `electron-builder`, then x64 AppImage in WSL (`scripts/construire-linux.sh`: electron-builder cannot make an AppImage on Windows);
- extracts the block map embedded in the AppImage to `Universal-Learn-Academy-<version>.AppImage.blockmap` (`scripts/carte-appimage.mjs`), in the same format as the Windows one;
- creates the `v<version>` release as a draft, uploads the six files to it (installer, AppImage, their `.blockmap`, `latest.yml`, `latest-linux.yml`), then publishes it and marks it "Latest": an installed app never sees an incomplete release;
- reads the release back and checks that each file is there with the right size. If one is missing, running `npm run release` again repairs it.

Courses no longer depend on app versions: a new or corrected course is published with `npm run catalogue -- --publier`, and users see it in the home page catalogue ("Update available").

### Structure

```
app/
  package.json            version, dependencies, electron-builder configuration
  src/
    main.js               host: data and tools folders, PGlite, API key, profiles, then loads _outils/app/principal.js
    donnees.js            data folder (local app folder or repository), local copy of the shipped tools
    deplacement.js        checked move of the data folder (2.8 migration from Documents/ULA, "Move…")
    reglages.js           settings (parametres.json)
    mises-a-jour.js       electron-updater, gh token for a private repository
    fenetre-lancement.js  window size and position at launch
    raccourcis.js         Desktop, menu and chosen-folder shortcuts (Windows and Linux)
    raccourcis-regles.js  detection of an existing shortcut, .desktop files (checked by check.mjs)
    claude.js             Claude Code (detection, account), encrypted API key
    depot.js              GitHub repository and app id
    parametres/           settings page (pont.cjs, index.html, parametres.js, cadre-fenetre.js…)
    i18n/                 strings of the host, settings, documentation and guide (fr.js, en.js)
    annexe.js             auxiliary windows in the app's style, centred on the course window
    choix-langue.js       language choice at first launch (langue/ page)
    documentation.js      reading the documentation pages (table of contents, page, search)
    doc/                  documentation, over the page like the settings (markdown.js, doc.js), and its pages (contenu/<language>/)
    guide/                guided setup
    assets/icone.png
  scripts/
    contenu-regles.cjs    re-exports _outils/ula/lib/regles.js (personal data)
    tp-fournis.mjs        rules for published lab files; writes their original version to explore/ and tp-fournis.json
    preparer-contenu.mjs  copies the allowed tools to .outils, with the manifest
    verifier-paquet.cjs   check of a built package (tools only)
    apres-empaquetage.cjs afterPack hook: makes the build fail
    catalogue.mjs         course archives and catalogue.json ("catalogue" release)
    accepter-proposition.mjs  adds a proposed course to the catalogue
    construire.mjs        Windows installer and AppImage (WSL), block maps
    construire-linux.sh   AppImage on Linux or in WSL
    carte-appimage.mjs    AppImage block map as a separate file
    release.mjs           publishing with the GitHub CLI (public repository releases)
    exporter-public.mjs   update of the public repository universal-learn-academy
    check.mjs             checks
  test/                   automated tests (node --test): content rules, catalogue manifests
  public/                 front page of the public repository (README.md in English, README.fr.md) and its CI (.github/workflows/ci.yml)
  build/                  installer icons
```

The host (`src/main.js`) publishes `global.studiesHote` and `ULA_RACINE` before loading the tools' program (`_outils/app/principal.js`, the same as `lancer-app.bat`): the window at launch, the "Settings" and "Check for updates" menu entries, the app id and the data root come from it. Without the host, the program behaves exactly as before (root = the folder that contains `_outils`).
