# ula : catalogue, profils et cursus

Universal Learn Academy sépare ce qui se publie de ce que chacun produit. Ce dossier contient ce qui organise les données : la structure, les profils, les cursus, le catalogue à la demande et « Proposer ce cours ». Il sert au serveur local (`lancer.bat`, `lancer-app.bat`) comme à l'application installée (`app/`).

## Structure

```
ula/                                  racine des données
├── index.html                        accueil statique (pages ouvertes depuis le disque)
├── explore/                          catalogue, en lecture seule
│   ├── packs/<id>.json               packs par niveau d'étude (ula-pack-1)
│   ├── cursus/<id>.json              cursus exemples : des packs rangés en dossiers (ula-cursus-1)
│   └── <domaine>/                    informatique, mathematiques, langues…
│       ├── index.html                accueil du domaine (index_niveau.py ; dynamique s'il manque)
│       └── <cours>/                  un cours : ula-cours.json, generated_courses/, generated_quizzes/,
│                                     sources publiables (cours/, TD/, annales/…), TP/ (fichiers fournis)
├── <profil>/                         espace d'un utilisateur (ula-profil.json)
│   ├── TODO.md                       son suivi
│   └── <cursus libre>/…/<cours>/     lien vers un cours du catalogue (ula-lien.json)
│       ├── quiz_results/             ses tentatives
│       ├── td_results/               son travail dans les TD interactifs
│       ├── generated_quizzes/        les quiz générés pour lui
│       └── TP/ …                     son travail de TP
├── propositions/                     archives préparées par « Proposer ce cours »
└── _outils/                          outils (dans le dépôt ; livrés à part avec l'application)
```

- **Fiche d'un cours** (`explore/<domaine>/<cours>/ula-cours.json`) : `id` (le nom du dossier, unique dans tout le catalogue), `titre`, `domaine`, `niveau`, `origine`, `teinte` (charte), `ue`, `description`.
- **Lien** (`ula-lien.json`) : `{ "cours": "<id>", "ajoute": "<date>" }`, rangé dans le dossier de cursus choisi. Ce n'est pas une copie : les pages restent dans `explore/`, la progression vit à côté du lien. Un même cours peut être dans « L2 » chez l'un et « Réorientation » chez l'autre.
- **Profil** (`<profil>/ula-profil.json`) : le dossier porte le nom d'utilisateur. Le profil actif est mémorisé sur le poste (`%LOCALAPPDATA%\studies-quiz\ula-profil-actif.json`), pour chaque racine ; sans choix, le seul profil existant.

Règle d'or : **rien de ce que l'utilisateur produit n'est écrit dans `explore/`**. Une mise à jour d'un cours ne touche jamais à son travail.

## Comment le serveur s'en sert

- Une page du catalogue (`explore/<d>/<cours>/…`) écrit son travail dans le dossier du lien vers ce cours, dans l'espace du profil actif. Si le cours n'est pas encore dans le cursus, un lien est ajouté dans `<profil>/Cours suivis/`.
- Un fichier absent d'un cours est cherché dans le dossier de ce cours de l'espace du profil : les liens relatifs des pages (`../TP/TP1/script.txt`) mènent ainsi au travail de l'utilisateur.
- `/index.html` est l'accueil dynamique (`accueil.html`) : profils, cursus, cours installés, catalogue en ligne, outils. Un accueil de domaine absent (cours téléchargés) l'est aussi, filtré sur le domaine.
- Une page d'un cours non installé renvoie au catalogue.

Routes de l'extension (`serveur/extension.js`) : `POST profils` (avec `cursus`, `telecharger`), `POST cursus/appliquer`, `POST catalogue/installer-tout`, `GET catalogue/travail`, `POST catalogue/installer-pack`, `POST cursus/ajouter-pack`, `GET etat`, `PUT profil`, `POST profils`, `POST profils/renommer`, `GET cursus`, `POST cursus/dossier|renommer|deplacer|retirer|ajouter`, `GET catalogue`, `POST catalogue/installer|supprimer`, `POST proposer`, `POST ouvrir`.

## Catalogue à la demande

Publié dans la release `catalogue` du dépôt public (en préversion, jamais « Latest » : les mises à jour de l'application ne la voient pas) : `catalogue.json` et une archive `<cours>.zip` par cours. L'accueil liste le catalogue, télécharge, met à jour ou supprime un cours ; l'empreinte SHA-256 de l'archive est vérifiée avant l'extraction, et la version installée notée dans `explore/<d>/<cours>/.ula-version.json`. Supprimer un cours ne touche pas au travail.

Accès : l'adresse publique de la release ; tant que le dépôt est privé, le jeton de la GitHub CLI du poste (`gh auth token`), gardé en mémoire le temps des requêtes. `ULA_CATALOGUE=<dossier>` lit un catalogue local (essais).

Dans le dépôt git d'ula (mode « source »), `explore/` est la source du catalogue : rien ne s'y télécharge. Publier : `cd app && npm run catalogue` (aperçu dans `app/.catalogue`), puis `npm run catalogue -- --publier` ; seules les archives des cours modifiés sont renvoyées.

## Packs par niveau d'étude

Un pack regroupe les cours d'un niveau (« Licence 1 informatique ») : `explore/packs/<id>.json`, format `ula-pack-1` (`id`, `titre`, `origine`, `dossier` proposé dans le cursus, par exemple `L1`, `description`, liste ordonnée `cours`). Un cours peut être dans plusieurs packs. Il n'y a pas d'archive de pack : `catalogue.json` publie les packs, et l'application télécharge les archives des cours (empreintes vérifiées).

Dans l'accueil, la section « Packs » est en tête du catalogue en ligne, avec le nombre de cours et la taille totale. « Télécharger le pack » installe les cours un par un, avec une progression globale ; un cours en échec n'arrête pas les autres, et relancer le pack ne reprend que ceux qui manquent. Puis « Ranger dans mon cursus » ajoute les cours dans un dossier (nom proposé modifiable, `L1`…) : un cours déjà dans le cursus reste où il est, rien n'est écrasé.

Packs actuels : Licence 1, 2 et 3 informatique (toutes les matières de chaque année, y compris mathématiques, langues, communication et projet). Un cours accepté se range dans un pack avec `npm run accepter-proposition -- <zip> --pack <id>` ; `npm run catalogue` vérifie que chaque pack ne cite que des cours existants.

## Cursus exemples

Un cursus exemple regroupe des packs, chacun rangé dans un dossier : `explore/cursus/<id>.json`, format `ula-cursus-1` (`id`, `titre`, `origine`, `description`, liste ordonnée `packs` de `{ pack, dossier }`). Aujourd'hui : « Informatique » = packs Licence 1, 2 et 3 informatique dans `L1`, `L2`, `L3`. Publié dans `catalogue.json` comme les packs.

À la création d'un profil (premier lancement, « Nouveau profil… » de l'accueil, ou paramètres de l'application) : choix « Cursus exemple » (aucun, ou un cursus du catalogue) et case « Télécharger les cours maintenant », cochée par défaut. Avec un cursus, les dossiers sont créés avec les liens vers tous les cours de chaque pack ; case cochée, les cours se téléchargent en arrière-plan (bandeau de progression sur l'accueil, l'application reste utilisable, un cours en échec n'arrête pas les autres, un cours déjà installé n'est pas retéléchargé) ; décochée, chaque cours du cursus affiche « à télécharger », avec « Tout télécharger » plus tard. Si le catalogue en ligne ne répond pas, le profil est créé quand même, avec un message ; le cursus s'ajoute ensuite depuis la section « Cursus exemples » du catalogue. Fonctionne pareil avec `lancer.bat` (même accueil, même serveur) ; dans le dépôt source, les liens sont créés et rien n'est téléchargé.

## Côté développeur : gérer packs et cursus

Les packs et les cursus exemples sont réservés au développeur du catalogue : l'application les lit dans `catalogue.json` (lecture seule), sans aucune interface pour les modifier. Un nouveau cursus, un pack ajouté à un cursus ou une matière ajoutée à un pack apparaît chez les utilisateurs dès la publication du catalogue, sans nouvelle version de l'application.

Depuis `app/` :

| Commande | Effet |
|---|---|
| `npm run catalogue -- pack-ajouter <id> "<titre>" [--dossier L1] [--origine "…"] [--description "…"]` | nouveau pack `explore/packs/<id>.json` (vide) |
| `npm run catalogue -- pack-ajouter-cours <pack> <cours> [<cours>…]` | ajoute des cours (ids de `explore/<domaine>/<cours>/`) à un pack |
| `npm run catalogue -- cursus-ajouter <id> "<titre>" [--origine "…"] [--description "…"]` | nouveau cursus `explore/cursus/<id>.json` (vide) |
| `npm run catalogue -- cursus-ajouter-pack <cursus> <pack> [dossier]` | ajoute un pack à un cursus, rangé dans `dossier` (par défaut celui du pack) |
| `npm run catalogue -- verifier` | vérifie tous les packs et cursus |

Chaque commande refuse un id inconnu (cours ou pack inexistant) ou un doublon, puis revérifie tout ; un pack ou un cursus encore vide est signalé et refusé à la publication. `npm run catalogue` (et `npm run check`) refont ces vérifications. Ensuite : committer, puis `npm run catalogue -- --publier`.

Exemple, un cursus « Mathématiques » avec un pack de licence 1 :

```bash
npm run catalogue -- pack-ajouter licence-1-mathematiques "Licence 1 mathématiques" --dossier L1 --origine "Le Mans Université"
npm run catalogue -- pack-ajouter-cours licence-1-mathematiques mathematiques-l1 anglais-l1
npm run catalogue -- cursus-ajouter mathematiques "Mathématiques" --origine "Le Mans Université"
npm run catalogue -- cursus-ajouter-pack mathematiques licence-1-mathematiques
```

## Proposer un cours

Un cours fait dans son espace (un dossier avec `generated_courses/` ou `generated_quizzes/`, sans lien) se propose depuis l'accueil (« Proposer ce cours… ») :

1. l'archive ne prend que les pages générées et la fiche du cours : ni sources d'enseignants (PDF, diapositives, sujets), ni travail, ni données personnelles ;
2. le contrôle est bloquant (`lib/proposition.js`, mêmes règles que les builds : `lib/regles.js`), avec en plus les types de fichiers (pages, styles, scripts, données, images), les chemins locaux (`C:\Users\…`, `/home/…`) et le nom du profil ;
3. l'archive est écrite dans `propositions/`, et une issue préremplie du dépôt public s'ouvre : on y joint l'archive.

Côté catalogue : `cd app && npm run accepter-proposition -- <archive.zip> [--domaine d] [--id id] [--essai]` refait les contrôles, range le cours dans `explore/<domaine>/<id>/` (liens depuis la racine du serveur rendus relatifs), lance les vérificateurs et refait les accueils de domaine.

## Contenu du dossier

```
_outils/ula/
├── README.md
├── accueil.html          accueil dynamique (servi à la place de index.html)
├── assets/               accueil.js, accueil.css, textes.js (textes de l'accueil en français et en anglais)
├── lib/
│   ├── espace.js         catalogue local, profils, cursus, dossier de travail d'une page
│   ├── catalogue.js      catalogue en ligne : lecture, téléchargement, installation
│   ├── proposition.js    « Proposer ce cours » : contrôle et archive
│   ├── regles.js         données personnelles : ce qui ne se publie jamais
│   └── zip.js            archives zip, sans dépendance
└── serveur/extension.js  routes /api/ula/… du serveur local
```

## Historique

- **1.0**, 12 novembre 2026 : création, avec la réorganisation de `studies` en `ula` : catalogue `explore/<domaine>/<cours>/`, profils et cursus libres, travail toujours écrit dans l'espace du profil, catalogue à la demande, « Proposer ce cours ».
- **1.1**, 12 novembre 2026 : packs par niveau d'étude (`explore/packs/`, section « Packs » du catalogue, rangement dans le cursus), domaine Communication et projet, catalogue complet (30 cours).
- **1.2**, 12 novembre 2026 : cursus exemples (`explore/cursus/`, « Informatique » = L1, L2, L3) proposés à la création d'un profil, téléchargements en arrière-plan avec progression, « à télécharger » et « Tout télécharger » dans le cursus.
- **1.3**, 12 novembre 2026 : outil du développeur pour les packs et cursus (`npm run catalogue -- pack-ajouter`, `pack-ajouter-cours`, `cursus-ajouter`, `cursus-ajouter-pack`, `verifier`) ; l'application les lit seulement.
