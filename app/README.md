# Studies, application installable

Les cours, quiz et TD interactifs de `studies/` dans une application de bureau qui s'installe, se met à jour toute seule et se règle dans ses paramètres. Sur le modèle de CV Studio (Electron, electron-builder, electron-updater, publication par la GitHub CLI).

Le fonctionnement sans installation reste le même : `lancer.bat` (serveur et navigateur), `lancer-app.bat` (fenêtre construite sur le PC à partir du dépôt) et `git pull` pour retrouver ses cours et ses progressions d'un poste à l'autre.

## Installer

| Système | Fichier de la [dernière version](https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/latest) | Installation |
|---|---|---|
| Windows 10 ou 11 (x64) | `Studies-Setup-<version>.exe` | Pour l'utilisateur courant, sans droits administrateur. L'application n'est pas signée : SmartScreen demande « Informations complémentaires », puis « Exécuter quand même ». |
| Linux (x64) | `Studies-<version>.AppImage` | `chmod +x Studies-<version>.AppImage`, puis le lancer. |

Les versions suivantes s'installent d'elles-mêmes au démarrage (voir « Mises à jour »).

## Paramètres

Menu **Fichier › Paramètres de l'application…** (Ctrl+,). La barre de menus apparaît avec la touche Alt.

- **Mises à jour** (activées par défaut) : au démarrage, Studies cherche une nouvelle version dans les releases GitHub, la télécharge en arrière-plan (en différentiel, grâce aux fichiers `.blockmap`) et l'installe à la fermeture. « Redémarrer et installer » l'applique tout de suite.
- **Fenêtre au lancement** : grande fenêtre (agrandie, par défaut) ou taille et position personnalisées, réglées dans un cadre qui représente les écrans à l'échelle (souris ou clavier) ou par quatre champs. Si l'emplacement n'est plus visible (écran débranché), la fenêtre s'ouvre agrandie. Repris de CV Studio.
- **Raccourcis** : Bureau, menu Démarrer (menu des applications sous Linux), ou n'importe quel dossier choisi. Pour chaque emplacement, Studies dit ce qu'il trouve : rien (« Créer »), un raccourci valide, un raccourci vers une ancienne copie ou cassé (« Réparer »), un fichier qui ouvre autre chose (« Remplacer », après confirmation). Les raccourcis portent le nom de ceux de l'installeur : la désinstallation retire ceux du Bureau et du menu Démarrer. Sous Linux, ce sont des fichiers `.desktop` qui lancent l'AppImage.
- **Connexion à Claude** : voir ci-dessous.
- **Dossier des cours** : les cours livrés avec Studies, ou un dossier `studies` du poste (un clone git du dépôt).

## Connexion à Claude

Les quiz font appel à Claude (aide, correction des réponses rédigées, évaluation, génération de quiz) par Claude Code (`claude -p`, voir `_outils/quiz/serveur/lib/claude.js`).

Ce qu'autorise Anthropic, d'après la documentation de Claude Code relue le 12 novembre 2026 ([Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance), [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)) :

- une application tierce **ne peut pas** proposer la connexion avec un compte claude.ai, ni faire passer des requêtes par l'abonnement Free, Pro ou Max de ses utilisateurs, ni recueillir ou conserver leurs identifiants ou jetons de session ;
- elle **peut** utiliser la clé d'API de l'utilisateur, facturée à son compte ;
- rien n'empêche l'utilisateur de se connecter lui-même, avec son abonnement, au binaire de Claude Code non modifié.

Studies propose donc deux modes :

| Mode | Ce que fait Studies | Pour qui |
|---|---|---|
| **Mon compte Claude, via Claude Code** (par défaut) | Détecte Claude Code et affiche le compte connecté (`claude auth status`). « Se connecter… » ouvre un terminal sur `claude auth login` : la connexion se fait sur le site d'Anthropic, Studies ne voit jamais les identifiants. | Qui a un abonnement Claude. C'est le fonctionnement actuel de l'outil de quiz. |
| **Une clé d'API Anthropic** | La clé est vérifiée auprès d'Anthropic, chiffrée par le système (`safeStorage` : DPAPI sous Windows, trousseau sous Linux ; refusée s'il n'y a pas de trousseau), jamais renvoyée à l'interface. Au démarrage, elle est passée au serveur local dans `ANTHROPIC_API_KEY`, que Claude Code utilise. | Qui n'a pas d'abonnement : l'usage est facturé à la clé. |

Dans les deux cas, Claude Code doit être installé ; sans lui, les cours et les quiz s'affichent, mais sans l'aide de Claude. Studies ne s'appelle ni ne se présente comme un produit d'Anthropic.

## Cours et données personnelles

### Ce qui est livré

Les cours livrés sont les fichiers **suivis par git** dans `studies/`, moins ceux qu'écartent les règles de `scripts/contenu-regles.cjs` :

| Écarté | Pourquoi |
|---|---|
| `**/quiz_results/` | tentatives aux quiz |
| `**/td_results/` | travail enregistré dans les TD interactifs |
| `TODO.md` | suivi personnel |
| `L*/<matière>/TP/` | dossiers de TP : le code de l'étudiant y est mêlé aux fichiers fournis (voir ci-dessous) |
| `administratif/`, `Hop3x/`, `L1/Web_statique/Site Portfolio/`, `_outils/numerisation/scans/` | documents personnels, traces de TP, portfolio, scans |
| tout chemin contenant « romain » ou « piau » | nom de l'étudiant |
| `_outils/quiz/reglages.json`, `CLAUDE.md`, `.claude/` | réglages locaux |
| `app/`, fichiers de git, lanceurs, fichiers système | inutiles une fois installé |

**Fichiers de TP.** Un dossier de TP n'est jamais copié depuis le dossier de travail. Les consignes et les fichiers d'origine (énoncés, données, fichiers fournis, documentation, Makefile, lanceurs) sont listés dans `app/tp-fournis.json`, chacun avec le commit d'où tirer sa **version d'origine** (son premier commit à ce chemin ; le dernier pour `run.sh` et `run.bat`, qui ne contiennent que l'environnement) et son empreinte. Cette liste est produite par `node scripts/tp-fournis.mjs` d'après ses règles, TP par TP ; dans le doute, un fichier n'y est pas. `preparer-contenu.mjs` extrait ces versions de git, et le contrôle du paquet refuse tout fichier de TP absent de la liste ou différent de sa version d'origine. Après un nouveau TP, mettre les règles à jour et relancer `node scripts/tp-fournis.mjs`.

Ces données restent **versionnées** : le `git pull` à la fac en a besoin. Elles n'entrent jamais dans un exécutable :

1. `scripts/preparer-contenu.mjs` ne copie dans `app/.contenu/` que les fichiers autorisés, avec un manifeste (taille et empreinte de chaque fichier) ;
2. electron-builder les place dans `resources/cours/` ;
3. **contrôle** : après l'empaquetage et avant la création de l'installeur ou de l'AppImage, `scripts/apres-empaquetage.cjs` parcourt tout le paquet (cours, `app.asar`, ressources) ; un seul fichier personnel, ou un écart avec le manifeste, **fait échouer la construction**. `npm run check -- --paquet` refait ce contrôle sur `dist/win-unpacked`, et `npm run check` vérifie qu'un paquet piégé est bien refusé.

### Où l'application écrit

- **Cours livrés** : copiés au premier lancement dans `%LOCALAPPDATA%\Studies\cours` (`~/.local/share/Studies/cours` sous Linux), où le serveur peut écrire. À chaque nouvelle version, la copie est mise à jour d'après le manifeste : un fichier livré n'est remplacé ou supprimé que s'il n'a pas été modifié depuis sa copie ; ce que le serveur a écrit (tentatives, TD, quiz générés) n'est jamais touché. Les fichiers gardés tels quels sont listés dans `.studies-conserves.txt`.
- **Dossier studies du poste** (mode de l'étudiant) : le dépôt est utilisé tel quel, tentatives et progressions comprises, et `git pull` / `git push` les synchronisent comme avant.
- **Paramètres** : `%APPDATA%\Studies\parametres.json` (`~/.config/Studies`). La désinstallation les conserve.
- PGlite (questions SQL) est livré avec l'application et copié au besoin dans `%LOCALAPPDATA%\studies-quiz` : Node n'est pas nécessaire sur le poste.

### Dépôt public et dépôt de travail

Deux dépôts, depuis le 12 novembre 2026 :

| Dépôt | Visibilité | Contenu |
|---|---|---|
| `WolfGang-PRoxa/studies` (celui-ci) | privé | tout : cours, outils, application, et le travail de l'étudiant (tentatives, TD, TODO, TP). Sert au `git pull` d'un poste à l'autre. |
| [`WolfGang-PRoxa/universal-learn-academy`](https://github.com/WolfGang-PRoxa/universal-learn-academy) | public (à terme) | seulement le contenu publiable, et les releases de l'application. Les mises à jour automatiques le lisent. |

Le dépôt public n'est jamais modifié à la main : `npm run public` (aperçu) puis `npm run public -- --pousser` le met à jour depuis ce dépôt (`scripts/exporter-public.mjs`). Le contenu est celui des exécutables (mêmes règles, fichiers de TP dans leur version d'origine), plus les lanceurs de la racine, le code de `app/` (sans `tp-fournis.json`) et `app/public/README.md` comme page d'accueil ; il est contrôlé avant chaque commit (règles personnelles, empreintes des fichiers de TP, adresse électronique de l'étudiant). L'historique de ce dépôt privé ne part donc jamais dans le dépôt public. `npm run donnees-perso` liste les fichiers suivis que les règles tiennent pour personnels.

Les supports d'origine (polycopiés, diapositives, sujets, annales) sont publiés avec le contenu : leur redistribution reste à valider avec leurs auteurs.

## Mises à jour

electron-updater lit les releases de `universal-learn-academy`. **Aucun jeton n'est mis dans l'exécutable.** Tant que ce dépôt est privé, la lecture publique échoue (404) : l'application essaie alors le jeton de la GitHub CLI déjà connectée sur le poste (`gh auth token`), gardé en mémoire le temps de la recherche et du téléchargement. Sur le PC de l'étudiant, la mise à jour fonctionne donc ; pour tout autre utilisateur, elle fonctionnera dès que le dépôt sera public.

## Développement

Prérequis : Node.js 22 ou plus récent ; pour l'AppImage, WSL avec Node (`~/.local/node` suffit) ou un Linux.

```bash
cd app
npm install        # dépendances (si Electron n'est pas téléchargé : node node_modules/electron/install.js)
npm start          # lance l'application avec le dépôt comme dossier des cours
npm run check      # vérifications : syntaxe, règles de contenu, contrôle du paquet, copie des cours, raccourcis
npm run dist       # construit installeur Windows et AppImage dans dist/ sans les publier (-- --win ou -- --linux pour un seul)
```

En développement, le mode « cours intégrés » utilise le dépôt lui-même. `STUDIES_USER_DATA=<dossier>` lance l'application avec un autre dossier de paramètres (essais).

### Publier une version

1. Augmenter `version` dans `app/package.json` (les mises à jour comparent ce numéro), committer et pousser sur `main`, puis mettre à jour le dépôt public : `npm run public -- --pousser`.
2. Depuis le PC Windows :

   ```bash
   cd app
   npm ci
   npm run release
   ```

   Prérequis : GitHub CLI connectée (`gh auth login`), WSL pour l'AppImage.

Le script (`scripts/release.mjs`) :

- refuse de publier hors de `main`, avec des modifications locales (les cours livrés sont ceux du dernier commit), si `main` n'est pas à jour avec GitHub, ou si la version est déjà publiée ;
- construit (`scripts/construire.mjs`) : cours préparés et contrôlés, installeur NSIS x64 avec `electron-builder`, puis AppImage x64 dans WSL (`scripts/construire-linux.sh` : electron-builder ne sait pas faire d'AppImage sous Windows) ;
- extrait la carte de blocs intégrée à l'AppImage dans `Studies-<version>.AppImage.blockmap` (`scripts/carte-appimage.mjs`), au format de celle de Windows ;
- crée la release `v<version>` en brouillon, y envoie les six fichiers (installeur, AppImage, leurs `.blockmap`, `latest.yml`, `latest-linux.yml`), puis la publie et la marque « Latest » : une application installée ne voit jamais une release incomplète ;
- relit la release et vérifie la présence et la taille de chaque fichier. S'il en manque, relancer `npm run release` la répare.

Une nouvelle version de l'application est aussi le seul moyen de livrer de nouveaux cours aux utilisateurs des cours intégrés.

### Structure

```
app/
  package.json            version, dépendances, configuration d'electron-builder
  src/
    main.js               hôte : dossier des cours, PGlite, clé d'API, puis charge _outils/app/principal.js
    reglages.js           paramètres (parametres.json)
    mises-a-jour.js       electron-updater, jeton de gh pour un dépôt privé
    fenetre-lancement.js  taille et position de la fenêtre au lancement
    raccourcis.js         raccourcis Bureau, menu, dossiers choisis (Windows et Linux)
    raccourcis-regles.js  détection d'un raccourci existant, fichiers .desktop (vérifiés par check.mjs)
    claude.js             Claude Code (détection, compte), clé d'API chiffrée
    cours.js              cours intégrés ou dossier studies, mise à jour de la copie locale
    depot.js              dépôt GitHub et identifiant de l'application
    parametres/           page des paramètres (pont.cjs, index.html, parametres.js, cadre-fenetre.js…)
    assets/icone.png
  scripts/
    contenu-regles.cjs    ce qui entre dans les exécutables, et les données personnelles
    tp-fournis.mjs        règles des fichiers de TP livrés ; produit tp-fournis.json (versions d'origine)
    preparer-contenu.mjs  copie des cours autorisés dans .contenu, avec le manifeste
    verifier-paquet.cjs   contrôle d'un paquet construit
    apres-empaquetage.cjs crochet afterPack : fait échouer la construction
    construire.mjs        installeur Windows et AppImage (WSL), cartes de blocs
    construire-linux.sh   AppImage sous Linux ou dans WSL
    carte-appimage.mjs    carte de blocs de l'AppImage en fichier à part
    release.mjs           publication par la GitHub CLI (releases du dépôt public)
    exporter-public.mjs   mise à jour du dépôt public universal-learn-academy
    check.mjs             vérifications
  public/README.md        page d'accueil du dépôt public
  build/                  icônes de l'installeur
```

L'hôte (`src/main.js`) publie `global.studiesHote` avant de charger le programme du dossier des cours (`_outils/app/principal.js`, le même que `lancer-app.bat`) : la fenêtre au lancement, l'entrée « Paramètres » et « Rechercher une mise à jour » du menu, et l'identifiant de l'application en viennent. Sans hôte, le programme se comporte exactement comme avant.
