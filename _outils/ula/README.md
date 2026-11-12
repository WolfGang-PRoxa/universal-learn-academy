# ula : catalogue, profils et cursus

Universal Learn Academy sépare ce qui se publie de ce que chacun produit. Ce dossier contient ce qui organise les données : la structure, les profils, les cursus, le catalogue à la demande et « Proposer ce cours ». Il sert au serveur local (`lancer.bat`, `lancer-app.bat`) comme à l'application installée (`app/`).

## Structure

```
ula/                                  racine des données
├── index.html                        accueil statique (pages ouvertes depuis le disque)
├── explore/                          catalogue, en lecture seule
│   ├── packs/<id>.json               packs par niveau d'étude (ula-pack-1)
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

Routes de l'extension (`serveur/extension.js`) : `POST catalogue/installer-pack`, `POST cursus/ajouter-pack`, `GET etat`, `PUT profil`, `POST profils`, `POST profils/renommer`, `GET cursus`, `POST cursus/dossier|renommer|deplacer|retirer|ajouter`, `GET catalogue`, `POST catalogue/installer|supprimer`, `POST proposer`, `POST ouvrir`.

## Catalogue à la demande

Publié dans la release `catalogue` du dépôt public (en préversion, jamais « Latest » : les mises à jour de l'application ne la voient pas) : `catalogue.json` et une archive `<cours>.zip` par cours. L'accueil liste le catalogue, télécharge, met à jour ou supprime un cours ; l'empreinte SHA-256 de l'archive est vérifiée avant l'extraction, et la version installée notée dans `explore/<d>/<cours>/.ula-version.json`. Supprimer un cours ne touche pas au travail.

Accès : l'adresse publique de la release ; tant que le dépôt est privé, le jeton de la GitHub CLI du poste (`gh auth token`), gardé en mémoire le temps des requêtes. `ULA_CATALOGUE=<dossier>` lit un catalogue local (essais).

Dans le dépôt git d'ula (mode « source »), `explore/` est la source du catalogue : rien ne s'y télécharge. Publier : `cd app && npm run catalogue` (aperçu dans `app/.catalogue`), puis `npm run catalogue -- --publier` ; seules les archives des cours modifiés sont renvoyées.

## Packs par niveau d'étude

Un pack regroupe les cours d'un niveau (« Licence 1 informatique ») : `explore/packs/<id>.json`, format `ula-pack-1` (`id`, `titre`, `origine`, `dossier` proposé dans le cursus, par exemple `L1`, `description`, liste ordonnée `cours`). Un cours peut être dans plusieurs packs. Il n'y a pas d'archive de pack : `catalogue.json` publie les packs, et l'application télécharge les archives des cours (empreintes vérifiées).

Dans l'accueil, la section « Packs » est en tête du catalogue en ligne, avec le nombre de cours et la taille totale. « Télécharger le pack » installe les cours un par un, avec une progression globale ; un cours en échec n'arrête pas les autres, et relancer le pack ne reprend que ceux qui manquent. Puis « Ranger dans mon cursus » ajoute les cours dans un dossier (nom proposé modifiable, `L1`…) : un cours déjà dans le cursus reste où il est, rien n'est écrasé.

Packs actuels : Licence 1, 2 et 3 informatique (toutes les matières de chaque année, y compris mathématiques, langues, communication et projet). Un cours accepté se range dans un pack avec `npm run accepter-proposition -- <zip> --pack <id>` ; `npm run catalogue` vérifie que chaque pack ne cite que des cours existants.

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
├── assets/               accueil.js, accueil.css
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
