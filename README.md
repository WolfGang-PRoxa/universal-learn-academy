[Français](README.fr.md) · **English**

# Universal Learn Academy

Courses formatted as HTML pages, quizzes and interactive exercise sheets (TD), with a local server that runs the quizzes, executes the code in questions (SQL, Python, C, JavaScript) and calls Claude for hints, grading and new quizzes. The starting catalogue comes from a computer science bachelor's degree (Le Mans Université): computer science, mathematics, languages. The app is available in French or English.

## Download the app

| System                 | File from the [latest release](https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/latest)                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10 or 11 (x64) | `Universal-Learn-Academy-Setup-<version>.exe`: installs for the current user, no administrator rights needed. The app is not signed: SmartScreen asks for "More info", then "Run anyway". |
| Linux (x64)            | `Universal-Learn-Academy-<version>.AppImage`: make it executable (`chmod +x`), then run it.                                                                                               |

The installer only contains the app and its tools (about 130 MB). Courses are then downloaded on demand, one by one or as a level pack (for example the whole "Licence 1 informatique" pack at once), from the home page ("Online catalogue"): they come from this repository's [`catalogue`](https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/catalogue) release, and their checksum is verified before installation.

Closing the window keeps the app running in the background, with its icon in the notification area (click to reopen it, right-click › Quit to quit; configurable). Its settings also let users choose the language, their profile and the data folder, set the window size at launch, create shortcuts and connect Claude. Built-in documentation (F1) and a guided setup help with the first launch.

## Updates

The app updates itself: a new version is looked for at startup and then every 6 hours, downloaded in the background and installed when the app quits; "Restart and install" applies it right away. The option is in Settings › Updates. Courses do not depend on app versions: a new or corrected course appears in the home page catalogue ("Update available"). The changes in each version are listed in [CHANGELOG.md](CHANGELOG.md).

## Profiles, curricula and data location

On first launch, the app asks for the language, then for a user name (the session name is suggested) and offers an example curriculum: "Informatique" sorts the three years of the bachelor's degree into the L1, L2 and L3 folders at once, and can download all their courses in the background. Several profiles can share a computer. Each one sorts catalogue courses into their curriculum, with the folders they want (L1, L2, Prépa, Perso…): a course is a link there, and its progress (attempts, TD, labs, tracking) is saved next to it, in the profile folder. Updating a course never touches the work.

```
donnees/                     (%LOCALAPPDATA%\Universal Learn Academy\donnees by default, can be changed or moved in the settings)
├── explore/<domain>/<course>/   downloaded courses, read-only
└── <profile>/<curriculum>/<course>/   link to the course and progress
```

Settings are stored in `%APPDATA%\Universal Learn Academy` (`~/.config/Universal Learn Academy` on Linux) and are kept on uninstall; the local copy of the tools is in `%LOCALAPPDATA%\Universal Learn Academy\outils` (`~/.local/share/Universal Learn Academy/outils`).

A course made by a user (pages generated in their space) can be proposed to the catalogue from the home page: the app prepares an archive of the generated pages only, without teachers' sources or personal data, and opens a prefilled issue in this repository, to which the archive is attached.

## Connecting to Claude

The app ships with no account. Each user chooses in the settings:

- **their Claude account, through Claude Code**: install [Claude Code](https://code.claude.com/docs/en/setup), then sign in ("Sign in…" button); signing in happens on Anthropic's side;
- **their own Anthropic API key**, encrypted on their computer; usage is billed to that key.

Without Claude, courses, TD and quizzes are displayed; only hints, grading of written answers and quiz generation need Claude.

## Without installing

With [Node.js](https://nodejs.org) 22 or later, from a clone of this repository (which contains the whole catalogue):

- `lancer.bat` (Windows) or `lancer.sh`: local server and home page in the browser;
- `lancer-app.bat` or `lancer-app.sh`: the same pages in an app window.

The home page then asks for a profile, created at the root of the clone.

## Development

The app code is in `app/` (Electron); its technical documentation is in [app/README.md](app/README.md).

```bash
cd app
npm ci          # install dependencies
npm start       # start the app
npm run check   # Prettier and ESLint, then checks: syntax, translations and docs, content rules, sync, shortcuts
npm test        # automated tests
npm run dist    # build the Windows installer and the AppImage in dist/
```

This repository is generated from a private working repository by a script: it only contains the publishable content (no personal space, quiz attempts, or work in TD and labs), and lab files are in their original version. Changes are therefore not made here directly.

## Contents

- `explore/<domain>/<course>/`: the catalogue; for each course, its `ula-cours.json` record, `generated_courses/` (formatted courses, TD and labs), `generated_quizzes/`, and the original materials (`cours/`, `TD/`, `TP/`, `annales/`);
- `_outils/`: page style, quiz tool and its server, interactive TD workshop, tracking, and `ula/` (profiles, curricula, catalogue);
- `app/`: the desktop app (Electron).

## License

Universal Learn Academy © 2026 WolfGang-PRoxa, licensed under [CC BY-NC-ND 4.0](LICENSE) (Attribution, NonCommercial, NoDerivatives). The original course materials (lecture notes, slides, exercise and lab sheets, past exams) belong to their authors, teachers at Le Mans Université, and are not covered by this license.
