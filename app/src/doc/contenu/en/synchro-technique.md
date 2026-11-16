# Sync (technical)

Automatic sync (`app/src/synchro.js` and `synchro-git.js`) applies when the data folder is a Git repository whose branch tracks a remote branch.

## One cycle

1. Nothing if a Git command is in progress (`index.lock`, unfinished merge or rebase): new attempt at the next cycle.
2. Commit of what changed within the scope, with a message “Progression du <date> à <time> (<computer name>)” and the computer’s Git identity.
3. `git fetch`, then merge with the tracked branch (`--autostash`).
4. `git push`, retried once if the other computer has just pushed. Never `--force`.

## Scope

| Data folder | What is committed automatically |
|---|---|
| ula repository | Only the progress written by the application: `quiz_results/`, `td_results/`, `ula-lien.json`, `ula-profil.json` |
| Other folder turned into a repository | Everything except `explore/`, `_outils/` and temporary files |

A file larger than 50 MB is never committed (it is reported in the Sync card).

## Conflicts

| File | Resolution |
|---|---|
| `td_results/<page>.json` | Merged workshop by workshop, the most recent according to `maj` |
| Quiz attempt | Most recently saved version |
| `ula-lien.json`, `ula-profil.json` | Local version |
| Other file, ula repository | Merge cancelled, to be done by hand (`git pull`) |
| Other file, other folder | Local version kept, the other saved next to it (`name (conflit <date>).ext`) |

A file deleted on one side and modified on the other is kept.

## Credentials

The application neither asks for nor keeps any. Git cannot ask for anything during a cycle (`GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, SSH in `BatchMode`): a refused access is reported, and running `git pull` once by hand is enough to save the credentials.

## Schedule

At startup (about ten seconds later), every 30 minutes, when the computer wakes up and when the application closes (10 seconds at most). A `git pull` done by hand while the application runs is detected (HEAD watched every 5 seconds) and the home page reloads. `ULA_SYNCHRO_INTERVALLE_MS` shortens the interval for testing.
