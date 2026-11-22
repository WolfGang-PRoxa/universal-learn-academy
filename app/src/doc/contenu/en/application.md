# Windows and shortcuts

## Background

By default, closing the window (the close button, **Ctrl+W**) does not quit the application: the window hides, the icon stays in the notification area (bottom right of the screen), and a quiz generation in progress runs to completion.

- **Reopen**: click the icon, or start the application again. Only one instance runs: the window reopens on the same page.
- **Icon menu** (right click): Open, Documentation, Check for updates, Quit.
- **Quit**: the icon’s Quit entry, or **Ctrl+Q**. If a quiz generation is in progress, the application asks for confirmation first.

This behaviour can be turned off in [Settings › Background](parametres:arriere-plan). On Linux, it depends on the desktop having a notification area; without one, the close button quits the application.

## Updates

New versions are published on GitHub. The application looks for them at startup, every 6 hours and when the computer wakes up, downloads them in the background, announces them with a notification, then installs them when it closes. **Restart and install** (settings or icon menu) applies them immediately. See [Settings › Updates](parametres:mises-a-jour).

## Keyboard shortcuts

| Keys              | Action                     |
| ----------------- | -------------------------- |
| F1                | Documentation              |
| Ctrl+,            | Settings                   |
| Alt+Home          | Home page                  |
| Alt+← and Alt+→   | Previous and next page     |
| Ctrl+F            | Find in the page           |
| Ctrl+N            | New window                 |
| Ctrl+P            | Print                      |
| Ctrl+Shift+S      | Save the page as PDF       |
| F5 or Ctrl+R      | Reload                     |
| Ctrl + and Ctrl − | Zoom in and out            |
| Ctrl+0            | Return to the chosen scale |
| F11               | Full screen                |
| Ctrl+W            | Close the window           |
| Ctrl+Q            | Quit                       |

In the documentation, **Ctrl+F** moves the cursor to the search box. In the guided setup, **Enter** goes to the next step and **Escape** closes the guide.

## The top bar

On every page, the top bar gives access to the home page, the light or dark theme, the settings (gear), the help (**?**) and, when sync is set up, the cloud button.
