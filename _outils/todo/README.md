# Outil de suivi : TODO.md

La page `_outils/todo/index.html` met en forme le `TODO.md` du profil actif (`<profil>/TODO.md`) et permet de le gérer entièrement sans ouvrir l'éditeur : cocher, ajouter, modifier, déplacer et supprimer des tâches ; créer, renommer, déplacer et supprimer des listes, des paragraphes, des sections et des sous-sections. Chaque changement est écrit dans le fichier une demi-seconde plus tard. Elle suit la charte (`_outils/charte/`) : thème clair ou sombre, teinte de chaque matière, agrandissement sur grand écran.

On y arrive depuis l'accueil général (section « Outils ») et le pied de page des accueils de niveau.

## Utilisation

### Ouvrir la page

- **Avec le serveur local** (`lancer.bat`) : `http://127.0.0.1:5178/_outils/todo/index.html`. La page lit et écrit `TODO.md` d'elle-même. Le serveur charge l'outil à son démarrage : s'il tournait déjà quand l'outil a été ajouté, le relancer.
- **Sans serveur**, page ouverte depuis le disque : « Choisir TODO.md… » (Edge ou Chrome), puis choisir le `TODO.md` du dossier de ton profil (`ula/<profil>/TODO.md`). Le navigateur lit et écrit le fichier directement ; il demande ton accord à chaque visite (« Rouvrir TODO.md » s'en souvient). Si le serveur tourne, la page propose aussi de s'ouvrir par lui.

### Gérer les tâches

- **Cocher** une tâche ou une sous-tâche : la case. Une puce sans case (« - … ») est une note, qui ne se coche pas.
- **Ajouter** : le champ « Ajouter une tâche… » sous chaque liste, puis Entrée ; le champ reste prêt pour la suivante.
- **Modifier** : double-clic sur le texte, ou le crayon. La première ligne est la tâche, les suivantes ses détails ou ses sous-tâches (« - [ ] … »). On y change aussi le type (tâche ou note) et la liste. Ctrl+Entrée enregistre, Échap annule.
- **Déplacer** : glisser la poignée (à gauche de la tâche) vers une autre place, dans la même liste ou dans une autre ; au clavier, flèches haut et bas sur la poignée.
- **Supprimer** : la corbeille. Une liste vidée disparaît avec son titre.
- **Listes** (« Cours », « Quiz »…) : renommer, monter, descendre, supprimer (au survol de leur titre) ; « + Liste » en bas d'une section ou d'une sous-section en crée une, avec sa première tâche.
- **Paragraphes** (« Fait : … », tableaux, listes numérotées) : double-clic ou crayon pour modifier leur Markdown ; « + Paragraphe » en ajoute un.
- **Sections et sous-sections** : renommer, monter, descendre, supprimer avec tout leur contenu ; « + Sous-section » en bas d'une section, « + Nouvelle section » sous le plan.
- **Annuler, rétablir** : Ctrl+Z, Ctrl+Y (ou les flèches de la barre d'outils) ; cent pas en arrière.
- **Filtrer** : Tout, À faire (tâches ouvertes, ou avec une sous-tâche ouverte), Faites ; **chercher** dans le texte des tâches. **Replier** une section d'un clic sur son chevron (mémorisé), ou toutes.
- **Texte brut** : tout le fichier en Markdown, pour ce que la vue Tâches ne fait pas ; « Appliquer » l'enregistre.
- **Ctrl+S** enregistre tout de suite (utile après une erreur).

### Modifications faites ailleurs

Claude, l'éditeur ou une autre page peuvent modifier `TODO.md` pendant que la page est ouverte. Quand rien n'est en cours, la page relit le fichier toutes les 15 secondes et en revenant sur l'onglet, et se met à jour. Si elle doit écrire alors que le fichier a changé depuis sa lecture, elle ne l'écrase pas : un bandeau propose de charger la version du disque (Ctrl+Z retrouve la tienne) ou de garder tes changements.

## Ce que la page comprend de TODO.md

Le fichier est découpé en blocs, dans l'ordre (`assets/markdown-todo.js`) :

| Bloc | Forme |
|---|---|
| Titre | `# …` à `###### …` ; `##` ouvre une section, `###` une sous-section (une matière). Dans le titre d'une sous-section, « teinte \`se\` » donne sa couleur à la carte. |
| Liste | lignes `- …` ou `* …`, avec ou sans case `[ ]` / `[x]`, chacune suivie de ses lignes indentées (sous-tâches `  - [ ] …`, détails). Une ligne de texte collée au-dessus (sans ligne vide) est son titre : « Cours », « Quiz »… |
| Texte | tout le reste : paragraphes, tableaux, listes numérotées, séparateurs `---`, gardés tels quels. |

Chaque bloc retient le nombre de lignes vides qui le précèdent, et les fins de ligne du fichier (`\n` ou `\r\n`) sont conservées : ce que la page ne modifie pas reste identique, octet pour octet. Une liste créée par la page est précédée d'une ligne vide, comme dans le reste du fichier.

## Contenu du dossier

```
_outils/todo/
├── README.md             ce document
├── index.html            la page
├── assets/
│   ├── markdown-todo.js  lecture, écriture et opérations sur TODO.md (navigateur et Node)
│   ├── todo.js           la page : affichage, édition, glisser-déposer, enregistrement
│   └── todo.css          styles, sur les jetons de la charte
├── serveur/
│   └── extension.js      routes /api/todo/… du serveur local
└── outils/
    └── tests.js          tests : node _outils/todo/outils/tests.js
```

## API du serveur local

L'extension est chargée par `_outils/quiz/serveur/lib/extensions.js` (voir `_outils/quiz/README.md`, « Extensions du serveur »). Elle ne lit et n'écrit que `TODO.md`, à la racine (`ula/`).

| Route | Rôle |
|---|---|
| `GET /api/todo/fichier` | `{ texte, version }` : le contenu, et sa version (« date de modification-taille ») |
| `PUT /api/todo/fichier` `{ texte, version, forcer }` | écrit le fichier et renvoie `{ version }` ; `409 { erreur, texte, version }` si le fichier a changé depuis `version`, sauf avec `forcer` |

Comme pour toute écriture du serveur, la requête doit venir de la page servie par lui (même origine) et être en JSON.

## Faire évoluer l'outil

- Une nouvelle opération va dans `assets/markdown-todo.js` (exportée dans `TodoMarkdown`), avec un test dans `outils/tests.js` qui vérifie que le texte produit se relit à l'identique ; la page l'appelle par `changer(function () { … })`, qui gère l'annulation, l'affichage et l'enregistrement.
- La page se redessine entière à chaque changement : pas d'animation d'entrée sur ses éléments (elle rejouerait à chaque clic).
- Après une modification : `node _outils/todo/outils/tests.js`, `python _outils/charte/outils/verifier.py _outils/todo/index.html`, puis la page dans les deux thèmes, sur grand écran et sur téléphone.

## Historique

- **1.0**, 29 septembre 2026 : création. Vue Tâches (plan des sections avec compteurs, cartes de matière, listes, sous-tâches, notes), édition en place, glisser-déposer et déplacement au clavier, création et suppression de listes, paragraphes, sections et sous-sections, annuler et rétablir, filtres et recherche, vue Texte brut ; enregistrement par le serveur local ou directement sur le disque, détection des modifications faites ailleurs ; tests.
- **1.1**, 12 novembre 2026 : réorganisation ula. Le suivi est personnel : la page lit et écrit le `TODO.md` du profil actif (`<profil>/TODO.md`, `romain/TODO.md` pour Romain), et non plus celui de la racine.
