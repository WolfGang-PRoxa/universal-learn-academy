# Application de bureau (Universal Learn Academy)

Le portail, les cours, les quiz, les TD et le suivi dans leur propre fenêtre : ni navigateur, ni terminal. Les pages et le serveur sont ceux de `lancer.bat` ; l'application ajoute la fenêtre, avec son icône dans le menu Démarrer et la barre des tâches.

Ce dossier est le programme de la fenêtre, lancé sans installation par `lancer-app.bat`. La copie construite par `lancer-app.bat` garde son nom technique d'origine, **Studies** (exécutable, raccourcis) ; l'application installée s'appelle **Universal Learn Academy**. La page de départ est l'accueil (profils, cursus, catalogue), servi par le serveur local à la place de `index.html`. Le même programme tourne dans **l'application installable** (`app/`, voir `app/README.fr.md`) : installeur Windows et AppImage Linux publiés en releases GitHub, mises à jour automatiques, paramètres. Celle-ci publie `global.studiesHote` avant de charger `principal.js` ; sans cet hôte, rien ne change ici.

## Utilisation

### Installer et lancer

Double-cliquer sur `lancer-app.bat`, à la racine d’`ula` (`lancer-app.sh` dans un terminal). Il faut Node.js 22.12 ou plus récent.

- La première fois, l'application s'installe en quelques minutes, puis s'ouvre. Elle crée les raccourcis **Studies** sur le Bureau et dans le menu Démarrer ; on peut l'épingler à la barre des tâches.
- Ensuite, on l'ouvre par ces raccourcis, ou par `lancer-app.bat`, qui l'ouvre directement.
- Elle s'installe dans `%LOCALAPPDATA%\studies-quiz\app`, hors de Google Drive : Electron y occupe plus de 300 Mo. Ses réglages sont dans `%APPDATA%\Studies`.
- `lancer-app.bat --reinstaller` refait l'installation. Fermer Studies avant : sinon elle s'arrête sans rien toucher.

Sur ce PC, tout a été essayé sous Windows. `lancer-app.sh` et le paquet Linux n'ont pas été essayés sous Linux, où un bureau et le bac à sable de Chromium sont nécessaires.

### Au quotidien

- L'application rouvre la dernière page, à la même position et au même zoom (dans l'application installée : à l'échelle choisie dans ses paramètres). Une seule instance tourne : la relancer ramène sa fenêtre devant.
- La barre du haut des pages porte **Précédent** et **Suivant**, à gauche du fil d'Ariane. Le menu complet apparaît avec la touche **Alt**.
- Un **PDF** s'ouvre dans sa propre fenêtre, dont la visionneuse occupe toute la place : la fermer ramène à la page.
- Un lien vers un autre site s'ouvre dans le navigateur du système.
- Quand une génération de quiz se termine, une notification Windows prévient, si Studies n'est pas au premier plan ; un clic ouvre le quiz.
- Fermer la dernière fenêtre arrête le serveur. Si une génération de quiz est en cours, l'application demande d'abord.

| Raccourci                                   | Effet                                                                                               |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Ctrl+N                                      | nouvelle fenêtre                                                                                    |
| Ctrl+F                                      | rechercher dans la page (Entrée : suivant, Maj+Entrée : précédent, Échap : fermer)                  |
| Alt+←, Alt+→, boutons latéraux de la souris | précédent, suivant                                                                                  |
| Alt+Début                                   | portail                                                                                             |
| Ctrl+P, Ctrl+Maj+S                          | imprimer, enregistrer en PDF                                                                        |
| Ctrl+Plus, Ctrl+Moins, Ctrl+0, Ctrl+molette | zoom (Ctrl+0 : taille normale, ou l'échelle choisie dans les paramètres de l'application installée) |
| F5, Ctrl+R                                  | recharger                                                                                           |
| F11, F12                                    | plein écran, outils de développement                                                                |
| Ctrl+W, Ctrl+Q                              | fermer la fenêtre, quitter                                                                          |

### Avec ou sans navigateur

Les deux restent possibles. `lancer.bat` ouvre le portail dans le navigateur ; si un serveur tourne déjà, l'application s'y raccorde et le laisse tourner en se fermant, et inversement. Le travail enregistré sur le serveur (tentatives, `td_results/`, `TODO.md`) est le même des deux côtés. Ce que chaque page garde dans le navigateur, comme le thème choisi, n'est pas partagé.

### En cas de problème

- **« Le dossier studies est introuvable »** (racine du dépôt, `ula` depuis le 12 novembre 2026) : le dossier noté dans `racine.json` n'existe plus (ou son lecteur n'est pas encore monté) ; attendre, puis « Réessayer ». Si `studies` a changé de place (il est passé de Google Drive à `C:\Users\piaur\Prog\studies` le 12 novembre 2026), relancer `lancer-app.bat` depuis le nouvel emplacement.
- **Le serveur s'arrête** : l'application propose de le relancer ou d'ouvrir son journal (`%LOCALAPPDATA%\studies-quiz\app\serveur.log`, aussi dans le menu Aide).

## Contenu du dossier

```
_outils/app/
├── README.md             ce document
├── package.json          versions de l'application et d'Electron
├── installer.js          installation et lancement (appelé par lancer-app.bat et lancer-app.sh)
├── amorce/               seul code embarqué dans l'exécutable
├── principal.js          démarrage, arrêt, raccourcis, notifications
├── serveur.js            lance le serveur local ou s'y raccorde, l'arrête, suit ses tâches
├── fenetres.js           fenêtres, liens, clic droit, recherche, impression, état mémorisé
├── menu.js               menu de l'application
├── textes.js             textes du menu, des dialogues et des notifications (français, anglais)
├── recherche.html        barre de recherche, et recherche-pont.js, sa passerelle
├── demarrage.html        écran affiché pendant le démarrage du serveur
└── assets/               icône (icone.svg est la source de icone.ico et icone.png)
```

## Fonctionnement

- **Electron**, parce que le serveur a besoin de Node de toute façon et qu'Electron embarque Chromium, son Node et la visionneuse PDF ; les pages tournent sur le moteur pour lequel elles sont écrites.
- **Exécutable et dépôt.** `Studies.exe` ne contient que `amorce/`. L'amorce lit `racine.json`, écrit à côté de l'exécutable par `installer.js`, et charge `_outils/app/principal.js` depuis `studies/`. Une modification du dépôt s'applique donc au lancement suivant, sans réinstaller.
- **Serveur.** C'est `_outils/quiz/serveur/serveur.js`, sans modification de logique, dans un processus à part, pour que les lectures sur Google Drive ne figent pas la fenêtre. Il tourne avec le Node d'Electron (`ELECTRON_RUN_AS_NODE`), si bien que `process.execPath` y reste un Node utilisable pour les questions de JavaScript, et que l'application n'a pas besoin du Node du PC une fois installée, sauf pour la première installation de PGlite.
- **Arrêt.** Sous Windows, tuer le processus ne laisserait pas au serveur le temps d'arrêter ses tâches : l'application lui envoie le message `arreter` et il s'arrête seul. Il s'arrête aussi si l'application disparaît (`disconnect`).
- **Sécurité.** Les pages tournent dans un rendu isolé (`sandbox`), sans accès à Node. Seule l'origine du serveur s'affiche dans les fenêtres. Les permissions se limitent au presse-papiers et au plein écran.
- **Reste d'un navigateur.** Electron ne fournit pas d'office le clic droit, le zoom à la molette, la recherche, l'impression au clavier, ni l'avertissement avant de quitter une page non enregistrée (`beforeunload`, qu'il applique sans rien afficher). `fenetres.js` les ajoute.

## Faire évoluer l'application

- **Modifier le programme** (`principal.js`, `fenetres.js`, `menu.js`…) : fermer et rouvrir Studies suffit.
- **Modifier l'amorce, l'icône ou changer de version d'Electron** : augmenter `version` ou `dependancesLocales.electron` dans `package.json`, puis `lancer-app.bat` réinstalle. Un raccourci ne vérifie pas les versions : il faut passer par `lancer-app.bat`.
- **Nouvelle commande** : l'ajouter à `menu.js`. Dans `demarrage.html` et `recherche.html`, les couleurs reprennent celles de la charte, sans la charger.
- **Précédent et Suivant** sont dans `_outils/charte/assets/cours.js` (`installerHistorique`), qui reconnaît l'application à son agent utilisateur (`Electron/`).
- Après une modification : `node --check` sur les fichiers modifiés, puis ouvrir Studies et faire le tour d'une page de cours, d'un quiz et du suivi.
- Pour piloter l'application dans un essai automatique : `Studies.exe --inspect=9229 --remote-debugging-port=9333` donne accès au processus principal et aux pages. Node attend la déconnexion de l'inspecteur pour quitter.

## Historique

- **1.0**, 31 octobre 2026 : création. Fenêtre, menu, raccourcis, recherche dans la page, impression et PDF, reprise de la dernière page, notifications de fin de génération, raccordement à un serveur déjà lancé, reprise après une panne du serveur.
- 12 novembre 2026 : le programme sert aussi à l'application installable (`app/`). Avec son hôte, la fenêtre s'ouvre selon le réglage « Fenêtre au lancement », le menu gagne « Paramètres de l'application… » (Ctrl+,) et « Rechercher une mise à jour », et la fenêtre des paramètres ne compte pas comme une fenêtre de cours. Sans hôte, aucun changement.
- **12 novembre 2026** : réorganisation ula. La page de départ est l'accueil (`index.html`, servi dynamiquement : profils, cursus, catalogue) ; menu **Aller** : Accueil, Mes révisions, Mon suivi ; le serveur reçoit la racine des données de l'hôte (`ULA_RACINE`) et refuse de se raccorder au serveur d'un autre dossier ; titres « Universal Learn Academy ».
- 20 novembre 2026 : l'entrée « Mon suivi » du menu **Aller** n'apparaît que si `_outils/todo/` existe (dépôt ula) : l'outil n'est plus livré avec l'application installée ni publié. Avec l'hôte 2.6.2, les paramètres s'ouvrent par-dessus la page, dans la fenêtre des cours.
