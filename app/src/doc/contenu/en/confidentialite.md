# Data and privacy

## What stays on the computer

Work (attempts, tutorials, labs, tracking) and settings stay on the computer, in the data folder and the settings folder. The application sends nothing to a service of its own: there is no Universal Learn Academy account and no analytics.

## What leaves the computer, and when

| Exchange              | Destination                         | Content                                                                              |
| --------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ |
| Catalogue and courses | GitHub (public repository releases) | Download only                                                                        |
| Updates               | GitHub (public repository releases) | Download only                                                                        |
| Claude                | Anthropic, through Claude Code      | The questions, answers and course extracts needed for help, correction or generation |
| Sync                  | The chosen Git repository           | The files within the sync scope                                                      |
| Proposing a course    | GitHub, by the user                 | The archive of generated pages, attached by hand                                     |

## Credentials and keys

- **Claude account**: signing in happens in Claude Code, on Anthropic’s website; the application never sees the credentials.
- **API key**: encrypted by the system (DPAPI on Windows, keyring on Linux; refused without a keyring), never sent back to the interface. It is only passed to Claude Code when the local server starts.
- **GitHub**: no token is stored in the application. While the public repository is private, the computer’s GitHub CLI token is read for the duration of a request, then forgotten.
- **Git**: credentials remain Git’s own on the computer.

## Personal data and publishing

Neither the installer, nor the catalogue, nor the public repository contains personal data. Blocking checks ensure it:

1. only allowed tools are copied into the installer, with a manifest of checksums;
2. after packaging, the whole package is scanned: a personal file or a course file makes the build fail;
3. publishing the catalogue and the public repository checks every file (rules, checksums of lab files, email address);
4. “Submit this course” only keeps the generated pages, refuses an archive containing personal data, and never sends the profile name, a path on the computer or a conversation with the AI;
   the submission service (`ula.romainpiau.dev`) only receives the archive, the manifest and a random installation key; the IP address is only kept as a salted hash, long enough to limit the rate;
5. `npm run check` verifies that trapped packages, archives and proposals are refused.

The rules are in `_outils/ula/lib/regles.js`.
