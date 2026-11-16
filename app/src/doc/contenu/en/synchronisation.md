# Sync

There are two ways to find courses and progress again from one computer to another.

## A folder that is already synced

The simplest: choose as [data folder](parametres:donnees) a folder already synced by OneDrive, Google Drive, Dropbox or pCloud. The same folder is then chosen on each computer.

> **Warning** Avoid using the application on two computers at the same time in this mode: the sync service cannot merge two versions of the same attempt.

## A Git repository

When the data folder is a Git repository linked to a remote repository (GitHub…), the application offers once to sync it automatically. The setting then stays in [Settings › Sync](parametres:synchro).

When enabled, syncing happens:

- a few seconds after startup;
- every 30 minutes, even with the window closed;
- when the computer wakes up;
- when the application closes.

**Sync now** is available from the cloud button of the top bar, the menu of the notification area icon and the Sync card.

| Cloud dot | Meaning |
|---|---|
| Green | Up to date |
| Blue | Sync in progress |
| Red | Problem: one click opens the details |

### Setting up a repository

1. Install Git and connect once to the remote repository (Git Credential Manager, GitHub CLI or SSH key).
2. In the data folder: `git init`, a `.gitignore` file containing the line `explore/` (the catalogue can be downloaded again), `git remote add origin <address>`, a first commit, then `git push -u origin main`.
3. Restart the application: it recognises the repository and offers to sync it.

On another computer, clone the repository and choose it as the data folder.

### Conflicts

When the same file changed on two computers between two syncs:

- tutorial work is merged workshop by workshop, and a quiz attempt keeps its most recent version;
- for any other file, the local version stays and the other one is saved next to it (`name (conflit <date>).ext`), with a notification.

The application neither asks for nor keeps any credentials: Git uses those already saved on the computer. Technical details are in [Sync (technical)](page:synchro-technique).
