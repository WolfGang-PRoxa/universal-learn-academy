# Universal Learn Academy, application installable

Les cours, quiz et TD interactifs d'ula dans une application de bureau qui s'installe, se met à jour toute seule, télécharge les cours à la demande et se règle dans ses paramètres. Sur le modèle de CV Studio (Electron, electron-builder, electron-updater, publication par la GitHub CLI). Jusqu'à la version 1.0.3, elle s'appelait **Studies** et livrait tous les cours dans son installeur.

Le fonctionnement sans installation reste le même : `lancer.bat` (serveur et navigateur), `lancer-app.bat` (fenêtre construite sur le PC à partir du dépôt) et `git pull` pour retrouver ses cours et ses progressions d'un poste à l'autre.

## Installer

| Système | Fichier de la [dernière version](https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/latest) | Installation |
|---|---|---|
| Windows 10 ou 11 (x64) | `Universal-Learn-Academy-Setup-<version>.exe` | Pour l'utilisateur courant, sans droits administrateur. L'application n'est pas signée : SmartScreen demande « Informations complémentaires », puis « Exécuter quand même ». |
| Linux (x64) | `Universal-Learn-Academy-<version>.AppImage` | `chmod +x Universal-Learn-Academy-<version>.AppImage`, puis le lancer. |

Les versions suivantes s'installent d'elles-mêmes au démarrage (voir « Mises à jour »). Le passage de Studies 1.0.x à 2.0.0 se fait aussi par la mise à jour automatique : l'identifiant de l'application (`fr.wolfgangproxa.studies`) et le nom du paquet (`studies`, donc le dossier d'installation `%LOCALAPPDATA%\Programs\studies`) sont gardés ; les paramètres de `%APPDATA%\Studies` sont repris dans `%APPDATA%\Universal Learn Academy`, et les anciens raccourcis « Studies » retirés.

## Premier lancement

L'accueil demande le nom d'utilisateur, prérempli avec celui de la session Windows ou Linux : c'est le nom du dossier de son espace. Puis le « Catalogue en ligne » de l'accueil propose les cours ; chaque cours téléchargé se range dans un dossier de son cursus (voir `_outils/ula/README.md`).

```
Documents/ULA/                    dossier des données (par défaut)
├── explore/<domaine>/<cours>/    cours téléchargés, en lecture seule
└── <profil>/<cursus>/<cours>/    lien vers le cours (ula-lien.json) et progression
```

## Paramètres

La roue dentée de la barre du haut, sur toutes les pages, ou Ctrl+, (menu **Fichier › Paramètres de l'application…**). Dans l'application installée, elle remplace la roue « Réglages » de l'outil de quiz, dont les réglages sont réunis ici ; dans un navigateur ou avec `lancer-app.bat`, la roue des quiz reste celle d'avant.

- **Mises à jour** (activées par défaut) : au démarrage, l'application cherche une nouvelle version dans les releases GitHub, la télécharge en arrière-plan (en différentiel, grâce aux fichiers `.blockmap`) et l'installe à la fermeture. « Redémarrer et installer » l'applique tout de suite.
- **Fenêtre au lancement** : grande fenêtre (agrandie, par défaut) ou taille et position personnalisées, réglées dans un cadre qui représente les écrans à l'échelle (souris ou clavier) ou par quatre champs. Si l'emplacement n'est plus visible (écran débranché), la fenêtre s'ouvre agrandie. Repris de CV Studio.
- **Raccourcis** : Bureau, menu Démarrer (menu des applications sous Linux), ou n'importe quel dossier choisi. Pour chaque emplacement, l'application dit ce qu'elle trouve : rien (« Créer »), un raccourci valide, un raccourci vers une ancienne copie ou cassé (« Réparer »), un fichier qui ouvre autre chose (« Remplacer », après confirmation). Les raccourcis portent le nom de ceux de l'installeur (« Universal Learn Academy ») : la désinstallation retire ceux du Bureau et du menu Démarrer. Sous Linux, ce sont des fichiers `.desktop` qui lancent l'AppImage.
- **Connexion à Claude** : voir ci-dessous.
- **Modèles de Claude et exécution du code** (ex-« Réglages » des quiz) : chemin de Claude Code, modèle et effort pour l'aide, la correction, l'évaluation et la génération de quiz (avec un bouton « Tester »), langages exécutables. Lus et enregistrés par l'API du serveur local (`_outils/quiz/reglages.json` des outils).
- **Profil** : le profil actif (mémorisé sur le poste), l'ajout et le renommage d'un profil. L'accueil permet aussi d'en changer.
- **Dossier des données** : `Documents/ULA` par défaut, ou un autre dossier. Un dépôt git d'ula (il contient `_outils/app` et `explore/`) est reconnu : c'est le « mode dépôt » de l'auteur du catalogue, où outils et catalogue sont ceux du dépôt et où `git pull` / `git push` synchronisent tout.

## Connexion à Claude

Les quiz font appel à Claude (aide, correction des réponses rédigées, évaluation, génération de quiz) par Claude Code (`claude -p`, voir `_outils/quiz/serveur/lib/claude.js`).

Ce qu'autorise Anthropic, d'après la documentation de Claude Code relue le 12 novembre 2026 ([Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance), [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)) :

- une application tierce **ne peut pas** proposer la connexion avec un compte claude.ai, ni faire passer des requêtes par l'abonnement Free, Pro ou Max de ses utilisateurs, ni recueillir ou conserver leurs identifiants ou jetons de session ;
- elle **peut** utiliser la clé d'API de l'utilisateur, facturée à son compte ;
- rien n'empêche l'utilisateur de se connecter lui-même, avec son abonnement, au binaire de Claude Code non modifié.

L'application propose donc deux modes :

| Mode | Ce que fait l'application | Pour qui |
|---|---|---|
| **Mon compte Claude, via Claude Code** (par défaut) | Détecte Claude Code et affiche le compte connecté (`claude auth status`). « Se connecter… » ouvre un terminal sur `claude auth login` : la connexion se fait sur le site d'Anthropic, l'application ne voit jamais les identifiants. | Qui a un abonnement Claude. |
| **Une clé d'API Anthropic** | La clé est vérifiée auprès d'Anthropic, chiffrée par le système (`safeStorage` : DPAPI sous Windows, trousseau sous Linux ; refusée s'il n'y a pas de trousseau), jamais renvoyée à l'interface. Au démarrage, elle est passée au serveur local dans `ANTHROPIC_API_KEY`, que Claude Code utilise. | Qui n'a pas d'abonnement : l'usage est facturé à la clé. |

Dans les deux cas, Claude Code doit être installé ; sans lui, les cours et les quiz s'affichent, mais sans l'aide de Claude. L'application ne s'appelle ni ne se présente comme un produit d'Anthropic.

## Catalogue, outils et données personnelles

### Ce qui est livré

- **L'installeur** ne contient que le programme (`app.asar`) et les **outils** : les fichiers suivis par git sous `_outils/`, moins ceux qu'écartent les règles (`_outils/ula/lib/regles.js` : scans, réglages locaux…). Plus aucun cours : environ 100 Mo au lieu de 640.
- **Les cours** se téléchargent à la demande depuis la release `catalogue` du dépôt public : `catalogue.json` et une archive par cours, produits par `npm run catalogue` (`scripts/catalogue.mjs`). Une archive contient les fichiers suivis par git du cours (`explore/<domaine>/<cours>/`), moins les données personnelles ; les fichiers de TP seulement s'ils sont dans la liste blanche, dans leur version d'origine.

Ce qui n'est **jamais** publié (ni dans un installeur, ni dans le catalogue, ni dans le dépôt public) : tout ce qui est hors de `explore/` et `_outils/` (les espaces des profils : `romain/` avec ses TP, ses tentatives, son TODO, son administratif, Hop3x…), les `quiz_results/` et `td_results/`, les fichiers de TP hors liste ou modifiés, les fiches d'anglais remplies, les notebooks de devoir maison, les scans, tout chemin contenant le nom de l'étudiant, et l'adresse électronique de l'identité git dans un fichier texte.

**Fichiers de TP.** Le dossier de TP de l'étudiant (`romain/<cursus>/<cours>/TP/`) mêle fichiers fournis et travail. Les consignes et fichiers d'origine (énoncés, données, fichiers fournis, documentation, Makefile, lanceurs) sont publiés dans `explore/<domaine>/<cours>/TP/`, dans leur **version d'origine** (premier commit ; le dernier pour `run.sh` et `run.bat`, qui ne contiennent que l'environnement), d'après les règles de `scripts/tp-fournis.mjs` ; `app/tp-fournis.json` garde pour chacun son fichier de travail, le commit d'origine et l'empreinte. Après un nouveau TP, mettre les règles à jour et relancer `node scripts/tp-fournis.mjs` : il écrit les versions d'origine dans `explore/` et met la liste à jour. Pour l'étudiant, un fichier absent d'un cours est cherché dans le dossier de ce cours de son espace (son TP).

### Contrôles bloquants

1. `scripts/preparer-contenu.mjs` ne copie dans `app/.outils/` que les outils autorisés, avec un manifeste (taille et empreinte de chaque fichier) ;
2. electron-builder les place dans `resources/outils/` ;
3. après l'empaquetage et avant la création de l'installeur ou de l'AppImage, `scripts/apres-empaquetage.cjs` parcourt tout le paquet (outils, `app.asar`, ressources) : un fichier personnel, un fichier de cours ou un écart avec le manifeste **fait échouer la construction** ;
4. `npm run catalogue` et `npm run public` contrôlent chaque fichier publié (règles, empreintes des fichiers de TP, adresse électronique) et refusent le tout au premier problème ;
5. `npm run check` vérifie qu'un paquet, une archive de cours et une proposition de cours piégés sont bien refusés.

### Où l'application écrit

- **Dossier des données** (`Documents/ULA` par défaut) : les cours téléchargés (`explore/`, versions dans `.ula-version.json`) et les espaces des profils. Rien de ce que l'utilisateur produit ne va dans `explore/` : une mise à jour ou une suppression d'un cours ne touche jamais à son travail.
- **Outils** : copiés au premier lancement, puis à chaque nouvelle version, dans `%LOCALAPPDATA%\Universal Learn Academy\outils` (`~/.local/share/Universal Learn Academy/outils` sous Linux), d'après le manifeste : un fichier modifié depuis sa copie (les réglages du quiz…) n'est jamais écrasé.
- **Dépôt git d'ula** (mode de l'étudiant) : le dépôt est utilisé tel quel, outils, catalogue et travail compris, et `git pull` / `git push` les synchronisent comme avant.
- **Paramètres** : `%APPDATA%\Universal Learn Academy\parametres.json` (`~/.config/Universal Learn Academy`). La désinstallation les conserve.
- **Profil actif** : `%LOCALAPPDATA%\studies-quiz\ula-profil-actif.json`, partagé avec `lancer.bat`.
- PGlite (questions SQL) est livré avec l'application et copié au besoin dans `%LOCALAPPDATA%\studies-quiz` : Node n'est pas nécessaire sur le poste.

### Dépôt public et dépôt de travail

| Dépôt | Visibilité | Contenu |
|---|---|---|
| `WolfGang-PRoxa/ula` (celui-ci, ex-`studies`) | privé | tout : catalogue, outils, application, et l'espace de l'étudiant (`romain/` : TP, tentatives, TD, TODO, administratif). Sert au `git pull` d'un poste à l'autre. |
| [`WolfGang-PRoxa/universal-learn-academy`](https://github.com/WolfGang-PRoxa/universal-learn-academy) | public (à terme) | seulement le contenu publiable, les releases de l'application et la release `catalogue`. Les mises à jour automatiques et le catalogue le lisent. |

Le dépôt public n'est jamais modifié à la main : `npm run public` (aperçu) puis `npm run public -- --pousser` le met à jour depuis ce dépôt (`scripts/exporter-public.mjs`) : le catalogue (les mêmes fichiers que ses archives) et ses accueils de domaine, les outils, l'accueil, les lanceurs, le code de `app/` (sans `tp-fournis.json`) et `app/public/README.md` comme page d'accueil. L'historique de ce dépôt privé ne part jamais dans le dépôt public. `npm run donnees-perso` liste les fichiers suivis que les règles tiennent pour personnels.

Les supports d'origine (polycopiés, diapositives, sujets, annales) sont publiés avec le catalogue : leur redistribution reste à valider avec leurs auteurs.

## Propositions de cours

« Proposer ce cours » (accueil, sur un cours de son espace) prépare une archive des seules pages générées, contrôlée, et ouvre une issue préremplie du dépôt public ; l'utilisateur y joint l'archive. Pour l'accepter : `npm run accepter-proposition -- <archive.zip> [--domaine d] [--id id] [--essai]` (mêmes contrôles, liens rendus relatifs, vérificateurs, accueils de domaine), puis committer et `npm run catalogue -- --publier`. Détails : `_outils/ula/README.md`.

## Mises à jour

electron-updater lit les releases de `universal-learn-academy`. **Aucun jeton n'est mis dans l'exécutable.** Tant que ce dépôt est privé, la lecture publique échoue (404) : l'application essaie alors le jeton de la GitHub CLI déjà connectée sur le poste (`gh auth token`), gardé en mémoire le temps de la recherche et du téléchargement. Le catalogue procède de même. Sur le PC de l'étudiant, tout fonctionne donc ; pour tout autre utilisateur, dès que le dépôt sera public.

La release `catalogue` est une préversion : elle n'est jamais « Latest », et l'API `releases/latest` que lit electron-updater ne la renvoie pas.

## Développement

Prérequis : Node.js 22 ou plus récent ; pour l'AppImage, WSL avec Node (`~/.local/node` suffit) ou un Linux.

```bash
cd app
npm install        # dépendances (si Electron n'est pas téléchargé : node node_modules/electron/install.js)
npm start          # lance l'application (outils du dépôt, dossier des données des paramètres)
npm run check      # vérifications : syntaxe, règles, paquet/catalogue/proposition piégés, profils, outils, raccourcis
npm run dist       # construit installeur Windows et AppImage dans dist/ sans les publier (-- --win ou -- --linux pour un seul)
npm run catalogue  # construit le catalogue dans app/.catalogue (-- --publier pour l'envoyer)
```

`ULA_USER_DATA=<dossier>` lance l'application avec un autre dossier de paramètres (essais) ; `ULA_CATALOGUE=<dossier>` lui fait lire un catalogue local (par exemple `app/.catalogue`).

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

- refuse de publier hors de `main`, avec des modifications locales (les outils livrés sont ceux du dernier commit), si `main` n'est pas à jour avec GitHub, ou si la version est déjà publiée ;
- construit (`scripts/construire.mjs`) : outils préparés et contrôlés, installeur NSIS x64 avec `electron-builder`, puis AppImage x64 dans WSL (`scripts/construire-linux.sh` : electron-builder ne sait pas faire d'AppImage sous Windows) ;
- extrait la carte de blocs intégrée à l'AppImage dans `Universal-Learn-Academy-<version>.AppImage.blockmap` (`scripts/carte-appimage.mjs`), au format de celle de Windows ;
- crée la release `v<version>` en brouillon, y envoie les six fichiers (installeur, AppImage, leurs `.blockmap`, `latest.yml`, `latest-linux.yml`), puis la publie et la marque « Latest » : une application installée ne voit jamais une release incomplète ;
- relit la release et vérifie la présence et la taille de chaque fichier. S'il en manque, relancer `npm run release` la répare.

Les cours ne dépendent plus des versions de l'application : un cours nouveau ou corrigé se publie par `npm run catalogue -- --publier`, et les utilisateurs le voient dans le catalogue de l'accueil (« Mise à jour disponible »).

### Structure

```
app/
  package.json            version, dépendances, configuration d'electron-builder
  src/
    main.js               hôte : dossier des données et des outils, PGlite, clé d'API, profils, puis charge _outils/app/principal.js
    donnees.js            dossier des données (Documents/ULA ou dépôt), copie locale des outils livrés
    reglages.js           paramètres (parametres.json)
    mises-a-jour.js       electron-updater, jeton de gh pour un dépôt privé
    fenetre-lancement.js  taille et position de la fenêtre au lancement
    raccourcis.js         raccourcis Bureau, menu, dossiers choisis (Windows et Linux)
    raccourcis-regles.js  détection d'un raccourci existant, fichiers .desktop (vérifiés par check.mjs)
    claude.js             Claude Code (détection, compte), clé d'API chiffrée
    depot.js              dépôt GitHub et identifiant de l'application
    parametres/           page des paramètres (pont.cjs, index.html, parametres.js, cadre-fenetre.js…)
    assets/icone.png
  scripts/
    contenu-regles.cjs    reprend _outils/ula/lib/regles.js (données personnelles)
    tp-fournis.mjs        règles des fichiers de TP publiés ; écrit leur version d'origine dans explore/ et tp-fournis.json
    preparer-contenu.mjs  copie des outils autorisés dans .outils, avec le manifeste
    verifier-paquet.cjs   contrôle d'un paquet construit (outils seuls)
    apres-empaquetage.cjs crochet afterPack : fait échouer la construction
    catalogue.mjs         archives des cours et catalogue.json (release « catalogue »)
    accepter-proposition.mjs  ajoute au catalogue un cours proposé
    construire.mjs        installeur Windows et AppImage (WSL), cartes de blocs
    construire-linux.sh   AppImage sous Linux ou dans WSL
    carte-appimage.mjs    carte de blocs de l'AppImage en fichier à part
    release.mjs           publication par la GitHub CLI (releases du dépôt public)
    exporter-public.mjs   mise à jour du dépôt public universal-learn-academy
    check.mjs             vérifications
  public/README.md        page d'accueil du dépôt public
  build/                  icônes de l'installeur
```

L'hôte (`src/main.js`) publie `global.studiesHote` et `ULA_RACINE` avant de charger le programme des outils (`_outils/app/principal.js`, le même que `lancer-app.bat`) : la fenêtre au lancement, l'entrée « Paramètres » et « Rechercher une mise à jour » du menu, l'identifiant de l'application et la racine des données en viennent. Sans hôte, le programme se comporte exactement comme avant (racine = le dossier qui contient `_outils`).
