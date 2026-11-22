# Troubleshooting

## The home page shows “The local server is not answering”

The local server starts with the application. Reload the page (**F5**). If the message stays, restart the application ([Settings › About](parametres:a-propos) › Restart).

## A course does not download

- Check the Internet connection, then **Refresh** the catalogue.
- Start the download again: a pack or “Download all” only retries the missing courses.
- While the releases repository is private, only a GitHub CLI session signed in on the computer (`gh auth login`) can read the catalogue.

## Claude does not answer

See [Claude](page:claude#if-claude-does-not-answer).

## The update does not install

A downloaded version installs when the application closes: use **Quit** (notification area icon, or **Ctrl+Q**) rather than the close button, which only hides the window. **Restart and install** applies it immediately.

## Sync fails

| Message              | What to do                                                             |
| -------------------- | ---------------------------------------------------------------------- |
| Access refused       | Run `git pull` once by hand in the data folder to save the credentials |
| Offline              | Nothing: new attempt at the next cycle                                 |
| Merge to do by hand  | Open the data folder and run `git pull`, then resolve the conflict     |
| Git is not installed | Install it from git-scm.com                                            |

## The window opens off screen

If the remembered position is no longer visible, the window opens maximised. Otherwise, choose **Large window** in [Settings › Window](parametres:fenetre).

## Scrolling freezes

The application keeps a log of freezes, `gels.log`, in the logs folder ([Settings › About](parametres:a-propos) › Open the logs folder). Attaching it to a report helps find the cause.

## Resetting everything

The settings are in `parametres.json`, in the settings folder (see [Files and folders](page:fichiers)). Deleting this file while the application is closed restores every default setting; the language is then asked again at startup. Courses and work are not touched.
