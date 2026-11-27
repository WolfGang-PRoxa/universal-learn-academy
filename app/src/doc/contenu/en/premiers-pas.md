# Getting started

## Installing

| System                 | File                                          | Installation                                                                                                                               |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Windows 10 or 11 (x64) | `Universal-Learn-Academy-Setup-<version>.exe` | For the current user, without administrator rights. As the application is not signed, SmartScreen asks for “More info”, then “Run anyway”. |
| Linux (x64)            | `Universal-Learn-Academy-<version>.AppImage`  | Make the file executable (`chmod +x`), then run it.                                                                                        |

Later versions install themselves (see [Updates](page:application#updates)).

## First launch

On the very first launch, a small window asks for the application’s **language**. The system language is suggested; the arrow keys and Enter are enough. The choice can be changed at any time.

The home page then opens and asks for a **user name**, prefilled with the session’s name. It is the name of the folder where all of this profile’s work will be stored. Two options come with it:

- **Sample curriculum**: places a programme’s courses into folders in one go (for example L1, L2, L3). “None” leaves the curriculum to be built by hand.
- **Download the courses now**: the curriculum’s courses download in the background, with a progress bar on the home page. The application stays usable meanwhile.

> **Tip** The [guided setup](guide:) goes through these choices and adds the other useful settings: Claude, interface size, window, shortcuts, data folder.

## Adding courses

The **Catalogue** section of the home page, **All courses** tab, lists every available course:

1. Choose a pack (all the courses of a level) or a single course.
2. **Download**: the course is installed on the computer.
3. The application offers to place it in a folder of the curriculum.

An installed course also appears in the **Installed on this computer** tab, sorted by domain. **Add to my curriculum…** places it in a folder.

## Where the work goes

Everything produced (quiz attempts, tutorials, labs, tracking) is written in the profile’s folder, inside the [data folder](parametres:donnees) (`%LOCALAPPDATA%\Universal Learn Academy\donnees` by default). Downloaded courses stay apart, read-only: updating or deleting a course never touches the work.

```
<data folder>/
├── explore/<domain>/<course>/     downloaded courses
└── <profile>/<folder>/<course>/   link to the course and progress
```
