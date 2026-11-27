# Files and folders

## Where the application writes

| Content                              | Windows                                          | Linux                                            |
| ------------------------------------ | ------------------------------------------------ | ------------------------------------------------ |
| Data folder (default)                | `%LOCALAPPDATA%\Universal Learn Academy\donnees` | `~/.local/share/Universal Learn Academy/donnees` |
| Settings (`parametres.json`)         | `%APPDATA%\Universal Learn Academy`              | `~/.config/Universal Learn Academy`              |
| Logs (`logs/gels.log`)               | `%APPDATA%\Universal Learn Academy\logs`         | `~/.config/Universal Learn Academy/logs`         |
| Local copy of the tools              | `%LOCALAPPDATA%\Universal Learn Academy\outils`  | `~/.local/share/Universal Learn Academy/outils`  |
| Active profile, quiz temporary files | `%LOCALAPPDATA%\studies-quiz`                    | `~/.cache/studies-quiz`                          |

Uninstalling keeps the settings and the data folder.

## Data folder

```
<data folder>/
├── explore/                     downloaded catalogue, read-only
│   └── <domain>/<course>/       ula-cours.json, pages, quizzes, .ula-version.json
├── <profile>/                   a profile’s space (ula-profil.json)
│   └── <folders>/<course>/      link to a course (ula-lien.json)
│       ├── quiz_results/        attempts
│       ├── td_results/          interactive tutorial work
│       └── TP/                  lab work
├── propositions/                archives from “Propose this course” (up to version 2.8)
├── soumissions/                 “Submit this course”: tracking and archive of each submission
└── soumissions-recues/          administrator only: received archives, reviews, decisions
```

Golden rule: nothing the user produces is written in `explore/`. A Git repository of ula (it contains `_outils/app` and `explore/`) is also recognised as a data folder: tools and catalogue are then those of the repository.

## Keys of parametres.json

A missing key takes its default value.

| Key                     | Default    | Role                                                                        |
| ----------------------- | ---------- | --------------------------------------------------------------------------- |
| `langue`                | `null`     | `fr` or `en`; `null` until chosen (the choice window then opens at startup) |
| `miseAJourAuto`         | `true`     | Automatic search and installation of updates                                |
| `fenetre.mode`          | `agrandie` | `agrandie` (maximised) or `personnalisee` (with `fenetre.bornes`)           |
| `affichage.echelle`     | `0`        | Scale in % (0: automatic)                                                   |
| `arrierePlan.fermeture` | `true`     | The close button hides the window instead of quitting                       |
| `donnees.dossier`       | empty      | Data folder (empty: default folder)                                         |
| `claude.mode`           | `compte`   | `compte` (account) or `cle` (key); the key is encrypted by the system       |
| `synchro.auto`          | `null`     | Automatic sync; `null` until the question has been answered                 |
| `raccourcis.dossiers`   | `[]`       | Folders where a shortcut was requested                                      |

## Logs

`gels.log` records each block of the main process longer than 150 ms and each page still hidden while its window is shown. It stays under 512 KB; the old one becomes `gels.1.log`.
