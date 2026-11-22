**Français** · [English](CHANGELOG.md)

# Journal des modifications

Les changements notables d'Universal Learn Academy sont notés dans ce fichier. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et les versions suivent `X.Y.Z` (une seule source : `app/package.json`, étiquette `vX.Y.Z` pour chaque release). Les cours sont publiés à part, dans le catalogue, et ne figurent pas ici.

## [Unreleased]

### Ajouts

- Licence : CC BY-NC-ND 4.0 (`LICENSE`), déclarée dans `app/package.json` et recopiée vers le dépôt public ; les supports d'origine restent la propriété de leurs auteurs.
- README en anglais avec sa traduction française (`README.fr.md`), pour le dépôt de travail, le dépôt public et la documentation technique de l'application.
- Ce journal des modifications, en anglais et en français, recopié vers le dépôt public.
- Premiers tests automatisés (`npm test`, lanceur de tests intégré à Node) : règles des données personnelles et manifestes des packs et cursus du catalogue.
- Prettier et ESLint (`npm run format`, `npm run lint`), lancés en premier par `npm run check` ; le code de l'application (`app/`) et des outils (`_outils/`) est formaté.
- Intégration continue à chaque push et pull request (`npm ci`, `npm run check`, `npm test`), dans le dépôt de travail et dans le dépôt public.
- Toute l'interface suit la langue choisie dans l'application (français ou anglais) : accueil, recherche, menus, pages d'erreur du serveur local, barre des cours (sommaire, boutons de copie), portail « Mes révisions », écrans des quiz (accueil, questions, corrections, résultats, panneau Claude, dialogues de génération et de suivi) et ateliers des TD (éditeurs, outils de dessin, contrôles, comparaison avec la solution, aide et correction de Claude). Claude répond en anglais quand l'application est en anglais. Le contenu des cours, quiz et TD reste pour l'instant dans sa langue d'origine.

### Améliorations

- `.gitignore` ignore les fichiers d'environnement locaux (`.env`).
- Les messages des ateliers des TD ne tutoient plus (« la requête », « l'automate proposé », « l'arbre dessiné »…).

## [2.6.2] - 2026-11-21

### Améliorations

- Les paramètres s'ouvrent dans la fenêtre des cours, par-dessus la page, comme ceux de Modding Manager : voile sombre et panneau centré au style de l'application (seul son contenu défile), fermés par la croix, Échap ou un clic à côté. Plus de fenêtre du système (réglage `fenetreParametres` retiré).

### Suppressions

- L'outil « Mon suivi » (TODO) n'est plus livré dans l'application installée, le catalogue ni le dépôt public : il reste dans le dépôt de travail, et ses liens (accueil, menu Aller) n'apparaissent que là où la page existe.

## [2.6.1] - 2026-11-16

### Corrections

- En-tête de la documentation adapté à la largeur de la fenêtre et à l'échelle : la recherche s'étire, le bouton « Paramétrage guidé » n'est jamais coupé et passe sous le titre si la place manque ; texte d'exemple de la recherche raccourci (« Rechercher… (Ctrl+F) »).

## [2.6.0] - 2026-11-16

### Ajouts

- Application en français et en anglais : langue choisie au premier lancement dans une petite fenêtre au style de l'application (langue du système proposée), modifiable dans Paramètres › Langue ; menus, paramètres, notifications, barre du haut des pages, accueil, documentation et guide traduits, changement appliqué tout de suite à toutes les fenêtres. Les cours, quiz et TD restent en français.
- Documentation intégrée (F1, bouton « ? », menu Aide, menu de l'icône, carte Aide) : guide d'utilisation et documentation technique en pages Markdown par langue, avec sommaire, recherche et liens vers les paramètres et le guide.
- Paramétrage guidé : les réglages un par un avec une courte explication (langue, profil et cursus exemple, Claude, échelle, fenêtre, fermeture, mises à jour, raccourcis, dossier des données, synchronisation), puis un récapitulatif.
- `npm run check` vérifie les dictionnaires (mêmes clés et variables dans les deux langues, aucune clé manquante) et la documentation (pages dans chaque langue, liens valides).

### Améliorations

- Accueil et paramètres au ton impersonnel ; l'accueil se recharge quand un profil est créé, choisi ou renommé depuis les paramètres ou le guide.

## [2.5.0] - 2026-11-16

### Ajouts

- Synchronisation automatique du dossier des données quand c'est un dépôt Git suivi : proposée une fois dans une fenêtre au style de l'application, puis au lancement, toutes les 30 minutes, au réveil du PC et en quittant (10 s au plus). Bouton nuage avec pastille d'état dans la barre des pages, entrée du menu de l'icône, carte Synchronisation des paramètres.
- Dans le dépôt d'ula, seule la progression écrite par l'application (tentatives aux quiz, travail des TD, liens du cursus, profils) est committée automatiquement ; ateliers d'un TD fusionnés un par un, tentative de quiz la plus récente gardée, autres conflits laissés à faire à la main. Jamais de `--force` ni de demande d'identifiants.
- L'accueil se recharge après un `git pull` fait à la main.

### Corrections

- Vérification de la synchronisation (`npm run check`) : fichiers comparés avec des fins de ligne ramenées à `\n`, Git for Windows (`core.autocrlf=true`) les réécrivant en CRLF après une fusion.

## [2.4.2] - 2026-11-15

### Corrections

- Carte Profil des paramètres au style des autres cartes (champs de saisie, liste des cursus, interrupteur de téléchargement), champs côte à côte qui passent l'un sous l'autre en carte étroite.
- Icône de la zone de notification de Windows prise dans le fichier `build/icon.ico` empaqueté au lieu d'être extraite de l'exécutable (elle ne s'affichait pas dans les icônes cachées).

## [2.4.1] - 2026-11-14

### Ajouts

- Bouton « Offrir un café » dans la barre du haut de l'application (Buy Me a Coffee), ouvert dans le navigateur du système ; tasse animée, immobile si le système réduit les animations, tasse seule en fenêtre étroite. Absent dans un navigateur.

## [2.4.0] - 2026-11-13

### Ajouts

- Arrière-plan comme Modding Manager : fermer la fenêtre garde l'application dans la zone de notification (instance unique, Quitter avec un avertissement si des générations de quiz sont en cours), avec un réglage pour le désactiver.
- Recherche des mises à jour toutes les 6 heures, au réveil et après que la fenêtre se cache, avec une notification et l'entrée « Redémarrer et installer » du menu de l'icône.
- Journal des gels (`gels.log`) dans le dossier des journaux de l'application.

### Améliorations

- Fenêtre des paramètres proportionnelle à l'écran et mémorisée, navigation sur le côté et cartes en 2 ou 3 colonnes sans trous ; échelle de l'interface appliquée aussi aux paramètres.
- Blocs de l'accueil sans trous : chaque dossier du cursus et chaque pack s'étend sur autant de colonnes qu'il a de cours, le dernier bloc d'une ligne s'élargit jusqu'au bord ; les dossiers sans cours ne prennent plus de bloc.

### Corrections

- Défilement sans gel : calcul des fenêtres masquées de Chromium désactivé sous Windows, plus aucun appel bloquant dans le processus principal, barre de recherche retirée à sa fermeture.
- Menu « ⋯ » des cours de l'accueil bien placé.

## [2.3.0] - 2026-11-13

### Ajouts

- Réglage « Échelle de l'interface » (Automatique ou 50 à 200 %), appliqué à toutes les fenêtres ; Ctrl+0 revient à l'échelle choisie.

### Améliorations

- Accueils pleine largeur dès 48rem, taille de base fluide de 15 à 16 px entre 768 et 1 440 px.
- Cursus et packs en blocs avec les cours en boutons (pastille de la matière, cours absent téléchargé au clic, actions dans un menu « ⋯ »).

## [2.2.0] - 2026-11-12

### Ajouts

- Cursus exemples (« Informatique » : packs Licence 1, 2 et 3 dans L1, L2, L3), proposés à la création d'un profil, avec la case « Télécharger les cours maintenant » ; téléchargements en arrière-plan avec progression et reprise, « à télécharger » et « Tout télécharger » dans le cursus.
- Outil du développeur pour les packs et cursus (`npm run catalogue -- pack-ajouter | pack-ajouter-cours | cursus-ajouter | cursus-ajouter-pack | verifier`), qui valide les ids et les doublons, lancé aussi par `npm run check` et à la publication. L'application ne fait que les lire.

## [2.1.0] - 2026-11-12

### Ajouts

- Packs par niveau d'étude (Licence 1, 2 et 3 informatique, toutes les matières de chaque année), publiés dans `catalogue.json` ; section « Packs » en tête du catalogue de l'accueil (téléchargement de tous les cours avec progression et reprise, rangement dans un dossier du cursus sans rien écraser).
- `npm run accepter-proposition -- --pack`.
- Toutes les matières du cursus ont leur cours dans le catalogue, même celles pas encore mises en forme ; nouveau domaine « Communication et projet ».

## [2.0.0] - 2026-11-12

### Ajouts

- Profils et cursus : nom d'utilisateur demandé au premier lancement (celui de la session proposé), plusieurs profils par poste, cours rangés librement sous forme de liens, progression toujours écrite dans l'espace du profil actif, jamais dans le catalogue.
- Catalogue en ligne : cours téléchargés à la demande depuis la release `catalogue`, empreinte vérifiée ; « Proposer ce cours » pour ses propres cours, acceptés par `npm run accepter-proposition`.
- Dossier des données (`Documents/ULA` ou un dépôt git d'ula), choisi dans les paramètres.
- Contrôles des paquets, archives du catalogue et propositions piégés, des espaces des profils et de la copie des outils dans `npm run check`.

### Améliorations

- Studies devient Universal Learn Academy. Même identifiant d'application : la mise à jour depuis 1.0.x est automatique, paramètres et raccourcis sont repris.
- L'installeur ne contient que l'application et ses outils (environ 100 Mo au lieu de 640) ; une copie locale des outils est mise à jour d'après un manifeste.

## [1.0.3] - 2026-11-12

### Améliorations

- Paramètres réunis sous une seule roue dentée dans l'application installée : les réglages de Claude des quiz (modèles par usage, chemin de Claude Code, exécution du code) passent dans les paramètres de l'application. Inchangé dans un navigateur.

## [1.0.2] - 2026-11-12

### Ajouts

- Bouton « Paramètres de l'application » dans la barre de toutes les pages, dans l'application installée seulement.

## [1.0.1] - 2026-11-12

### Ajouts

- Dépôt public `universal-learn-academy` : export du contenu publiable (`npm run public`) ; releases et mises à jour lues dans ce dépôt.

### Améliorations

- Fichiers de TP livrés sans le travail personnel, d'après une liste blanche (`app/tp-fournis.json`) qui donne la version d'origine de chaque fichier fourni ; le contrôle du paquet refuse tout fichier de TP absent de la liste ou modifié.

## [1.0.0] - 2026-11-12

### Ajouts

- Première application installable, nommée Studies (Electron, electron-builder, electron-updater) : mise à jour automatique au démarrage, fenêtre au lancement réglable, raccourcis Bureau, menu Démarrer ou dossier choisi, connexion à Claude par Claude Code ou par une clé d'API chiffrée. Installeur NSIS et AppImage avec leurs fichiers `.blockmap`, publiés par la GitHub CLI.
- Données personnelles exclues des exécutables, avec un contrôle qui fait échouer la construction.

[Unreleased]: https://github.com/WolfGang-PRoxa/universal-learn-academy/compare/v2.6.2...HEAD
[2.6.2]: https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/v2.6.2
[2.6.1]: https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/v2.6.1
[2.6.0]: https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/v2.6.0
[2.5.0]: https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/v2.5.0
[2.4.2]: https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/v2.4.2
[2.4.1]: https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/v2.4.1
[2.4.0]: https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/v2.4.0
[2.3.0]: https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/v2.3.0
[2.2.0]: https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/v2.2.0
[2.1.0]: https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/v2.1.0
[2.0.0]: https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/v2.0.0
[1.0.3]: https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/v1.0.3
[1.0.2]: https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/v1.0.2
[1.0.1]: https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/v1.0.1
