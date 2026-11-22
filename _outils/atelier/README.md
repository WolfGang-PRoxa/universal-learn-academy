# Atelier : TD interactifs

L'atelier transforme les exercices qui se font **sur papier** en exercices **interactifs** dans une page web : dessiner un diagramme de classes, écrire un modèle relationnel, remplir une table, écrire du SQL et l'exécuter, construire un automate, un arbre de processus, un chronogramme, un diagramme de séquence ou de cas d'utilisation. Il sert à trois endroits :

- les **TD interactifs** (`td-NN-….html`), où chaque exercice reçoit un atelier sous son énoncé ;
- les **quiz** (`_outils/quiz/`), par le type de question `atelier` ;
- les **cours** (`_outils/charte/`), pour un exemple que l'on manipule ou un diagramme mis en page automatiquement.

Chaque atelier offre :

- deux saisies **synchronisées** : un **dessin** (souris, clavier) et une **vue texte** (syntaxe courte, colorée) ;
- **Vérifier** : contrôles de forme propres à l'éditeur, sans rien dévoiler (clé primaire manquante, multiplicité invalide, automate non déterministe…) ;
- **Comparer** : concordance avec la solution, écarts listés et surlignés sur le dessin ; langage reconnu pour un automate, résultat de l'exécution en SQL ;
- **Solution** (ou **Correction** quand elle vient de l'enseignant), après confirmation ;
- **Claude** (serveur local) : conversation sur l'exercice, ou correction complète avec appréciation et remarques posées sur les éléments du dessin ;
- l'**enregistrement** automatique du travail : dans le navigateur, et avec le serveur dans le dossier de la matière (`td_results/`).

> Pour voir chaque éditeur, ouvrir `demo.html` depuis le serveur local (`lancer.bat`, puis `http://127.0.0.1:5178/_outils/atelier/demo.html`). Exemple de TD réel : `explore/informatique/bases-de-donnees-3/generated_courses/td-01-modeles-entites-associations.html` (repérage d'erreurs, modèle corrigé, modèle relationnel, huit requêtes SQL sur deux jeux de données).

## Utilisation

- Le **serveur local** de l'outil de quiz fait aussi tourner l'atelier : `lancer.bat`. Il apporte Claude, l'exécution du SQL et l'enregistrement dans `td_results/`. Le portail affiche, pour chaque matière, les TD interactifs et leur avancement.
- Sans serveur, une page ouverte depuis le disque fonctionne quand même : dessin, contrôles, comparaison et solution. Le travail reste dans le navigateur, le SQL ne s'exécute pas, et « Claude » copie la demande pour claude.ai.
- Sur le dessin :
  - double-clic sur le fond : nouvel élément ; sur un élément : le modifier (formulaire) ;
  - « Relier », puis glisser d'un élément à l'autre ;
  - glisser un élément le déplace (grille de 10 px) ; glisser le fond déplace la vue ; Ctrl + molette, ou les boutons + − ⤢, zooment ;
  - clavier : Tab pour atteindre le dessin, flèches pour déplacer l'élément choisi, Entrée pour le modifier, Suppr pour l'effacer, Échap pour désélectionner ; Ctrl+Z et Ctrl+Y annulent et rétablissent.
- Affichage : **Dessin**, **Les deux** (côte à côte sur un écran large) ou **Texte** ; le choix est retenu par éditeur. Le menu ⋯ réorganise le dessin, le recadre, passe en plein écran, revient au départ ou copie le texte.
- Quand la vue texte contient une erreur, le dessin garde la dernière version valide et un bandeau le signale ; un clic sur l'erreur mène à la ligne.

## Contenu du dossier

```
_outils/atelier/
├── README.md               ce document
├── demo.html               chaque éditeur en situation (sert de modèle et de test)
├── modele-td.html          squelette d'un TD interactif
├── assets/
│   ├── atelier.js          point d'entrée : charge js/*.js dans l'ordre (listes LOGIQUE et INTERFACE)
│   ├── atelier.css         point d'entrée des styles : importe quiz.css et css/*.css
│   ├── css/                espace, canevas, formulaire, editeurs, impression
│   └── js/
│       ├── noyau.js, syntaxe.js          outils communs (noms comparables, multiplicités, score, lecture des lignes)
│       ├── editeurs/*.js                 LOGIQUE de chaque éditeur : lecture, écriture, contrôles, comparaison
│       ├── vues/*.js                     INTERFACE de chaque éditeur : dessin et édition
│       ├── canevas.js, disposition.js    surface SVG commune (zoom, sélection, liens), placement automatique
│       ├── formulaire.js, historique.js  formulaire flottant, annuler et rétablir
│       ├── espace.js                     espace de travail : barre, vues, résultats, synchronisation
│       ├── sauvegarde.js, claude.js      enregistrement, aide et correction par Claude
│       ├── quiz.js                       type de question « atelier » pour l'outil de quiz
│       └── demarrage.js                  création des ateliers de la page
├── serveur/
│   ├── extension.js        routes /api/atelier/… du serveur local (travail, aide, corriger)
│   └── prompts/            consignes données à Claude : aide.md, correction.md
└── outils/
    ├── verifier.js         contrôle des ateliers d'une page ou d'un quiz
    ├── saisir.js           enregistre dans td_results/ le travail fait sur papier (champ « papier »)
    ├── tests.js            tests de la logique des éditeurs
    └── charger.js          charge la logique dans Node (pour les deux précédents)
```

L'atelier s'appuie sur l'outil de quiz, qu'il charge s'il est absent : connexion au serveur, panneau de Claude, éditeur de code, Markdown. Ses couleurs et polices viennent de la charte.

## Où ranger les pages et le travail

| Élément            | Emplacement                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TD interactif      | `explore/<domaine>/<cours>/generated_courses/td-NN-<slug>.html`, par exemple `explore/informatique/bases-de-donnees-3/generated_courses/td-01-diagrammes-de-classes.html` ; `tp-NN-…` pour un TP |
| Travail enregistré | `<profil>/<cursus>/<cours>/td_results/<nom de la page>.json` (écrit par le serveur)                                                                                                              |

Un TD interactif est une page de la charte comme les autres : même en-tête, même vérificateur, lien depuis l'accueil de la matière (`index.html`, section des TD, badge `TD`). Il porte le nom du TD d'origine ; si une version papier mise en forme existe déjà, la version interactive la remplace ou s'appelle `td-NN-<slug>-interactif.html`.

### Fichier de travail

Un fichier par page, mis à jour à chaque changement :

| Champ                  | Contenu                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format`               | `studies-atelier/travail-1`                                                                                                                                                                                                                                                                                                                                                                           |
| `page`, `titre`, `maj` | page (chemin depuis `studies/`), titre, dernière modification                                                                                                                                                                                                                                                                                                                                         |
| `ateliers`             | pour chaque identifiant d'atelier : `editeur`, `modele` (le travail, structuré), `texte` (vue texte quand elle diffère du modèle), `resume` (`vide` ou `commencé`), `maj`, et selon les cas `annotations` (`[{ cible, texte }]`), `reponse`, `correction` (dernière correction de Claude : `note`, `commentaire`, `remarques`, `date`, `modele`), `conversation` (session avec Claude), `solutionVue` |

Ces fichiers sont lisibles par Claude : pour faire le point sur les TD d'une matière, les lire dans `td_results/`.

## Produire un TD interactif : marche à suivre

1. **Lire l'énoncé** du TD (PDF, document) en entier, et les pages de cours qu'il met en œuvre (`generated_courses/`).
2. **Choisir l'éditeur** de chaque question : ce que l'étudiant rendrait sur papier (voir le tableau des éditeurs). Une question qui se rédige prend l'éditeur `texte` ; une question de repérage d'erreurs sur un diagramme donné, le mode `annoter`.
3. **Rédiger la solution** de chaque atelier, dans la syntaxe texte de l'éditeur. Quand le TD n'en donne pas, la proposer (règle « compléter le cours » de la charte) ; `solution_source: "enseignant"` quand elle vient d'une correction officielle. Ajouter une `explication` : les choix faits et les erreurs fréquentes.
4. **Assembler** : copier `modele-td.html`, remplir l'en-tête, recopier fidèlement chaque énoncé dans un `div.bloc.exercice`, placer l'atelier juste après ; indices dans des `details.indice`, comme dans la charte.
5. **Contrôler** :
   - `python _outils/charte/outils/verifier.py <page>` ;
   - `node _outils/atelier/outils/verifier.js --executer <page>` : syntaxe, champs, solution qui passe ses propres contrôles, SQL exécuté ;
   - ouvrir la page depuis le serveur et faire au moins un exercice (thème clair et sombre, fenêtre étroite).
6. **Relier** : ajouter le TD à l'accueil de la matière, et le lier depuis le cours correspondant si besoin.

Règles :

- **Identifiants stables** : `id` de chaque atelier unique dans la page (`td1-ex2-classes`) ; il nomme le travail enregistré, on ne le change plus une fois le TD commencé.
- **Un atelier par réponse attendue** : une question en deux parties (diagramme puis traduction) reçoit deux ateliers.
- **L'énoncé reste au-dessus** : l'atelier le reçoit automatiquement (bloc exercice précédent) pour Claude ; `enonce` ne sert que si l'énoncé est ailleurs.
- **Une solution juste et complète** : c'est elle que « Comparer » utilise. Pour un modèle, une solution raisonnable parmi d'autres suffit : l'interface rappelle qu'un écart n'est pas forcément une erreur, et Claude juge sur le fond.

## Format des données

Un atelier est un bloc de la page :

```html
<div class="atelier" id="td1-ex2-classes" data-editeur="classes">
  <script type="application/json">
    {
      "options": { "bdd": true },
      "solution": [
        "classe Client",
        "  numero : int {PK}",
        "Client \"1\" -- \"*\" Commande : passe >",
        "classe Commande",
        "  numero : int {PK}"
      ],
      "explication": "<p>…</p>"
    }
  </script>
</div>
```

| Champ                     | Rôle                                                                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` (attribut)           | identifiant unique et stable dans la page                                                                                                                                        |
| `data-editeur` (attribut) | éditeur : voir le tableau ci-dessous                                                                                                                                             |
| `mode`                    | `exercice` (défaut), `exemple` (manipulable, rien n'est enregistré), `lecture` (dessin seul, non modifiable), `annoter` (relever les erreurs d'un départ)                        |
| `depart`                  | ce que l'étudiant trouve au départ, dans la syntaxe texte (texte, ou tableau de lignes)                                                                                          |
| `solution`                | solution de référence, même syntaxe                                                                                                                                              |
| `solution_source`         | `enseignant` : le bouton devient « Correction » ; sinon « Solution » (proposée)                                                                                                  |
| `explication`             | HTML affiché avec la solution                                                                                                                                                    |
| `options`                 | options de l'éditeur (tableau ci-dessous) ; `hauteur` (px) pour toutes                                                                                                           |
| `tests`                   | graphe : `{ "acceptes": [mots], "rejetes": [mots] }` ; SQL en mode script : `[{ "nom", "requete", "doit": "reussir" \| "echouer" }]` ou `{ "nom", "requete", "resultat": true }` |
| `titre`, `consigne`       | titre de la barre (défaut : nom de l'éditeur) ; consigne en HTML sous la barre                                                                                                   |
| `enonce`                  | énoncé transmis à Claude, quand il n'est pas dans le bloc exercice qui précède                                                                                                   |
| `vue`                     | affichage imposé au départ : `dessin`, `les-deux`, `texte`                                                                                                                       |
| `hauteur`                 | hauteur du dessin en pixels (380 par défaut)                                                                                                                                     |
| `disposition`             | positions imposées : `{ "Film": [430, 70] }` (classes, nœuds), pour le départ et pour le dessin de la solution ; les autres éléments sont placés automatiquement                 |
| `attendu`                 | mode annoter : erreurs à trouver, `[{ "cible": "Film.Genre", "texte": "…" }]`                                                                                                    |
| `question_reponse`        | mode annoter : libellé de la zone de réponse rédigée                                                                                                                             |
| `papier`                  | travail fait sur papier, saisi d'après un scan : sa syntaxe texte (texte ou tableau de lignes), ou `{ texte, source, date, note }` ; voir « Travail fait sur papier »            |

Les jeux de données SQL de la page vont dans `<head>` :

```html
<script type="application/json" id="atelier-jeux">
  { "dingo": { "titre": "Dingo Fringo", "description": "<p>…</p>", "script": "CREATE TABLE …; INSERT …;" } }
</script>
```

Écrire le JSON comme dans les quiz : attributs HTML entre apostrophes, `\n` pour un saut de ligne, jamais de `</script`. Les guillemets d'une syntaxe (`"1..*"`) s'échappent (`\"1..*\"`) ; un tableau de lignes est plus lisible qu'une longue chaîne.

### Cibles

Les contrôles, les écarts, les remarques de Claude et les `attendu` visent des éléments du dessin, qui sont alors surlignés :

| Éditeur                           | Cibles                                                        |
| --------------------------------- | ------------------------------------------------------------- |
| classes                           | `Classe`, `Classe.attribut`, `A--B` (lien entre deux classes) |
| relationnel                       | `Relation`, `Relation.attribut`                               |
| table                             | `ligne N`, `case L:C`, `colonne Nom`                          |
| graphe                            | `q0` (nœud ou étape), `q0->q1` (arc)                          |
| processus, chronogramme, séquence | nom du processus, de la ligne ou du participant               |
| cas                               | `Acteur`, `Cas`, `A--B` (lien entre deux éléments)            |

## Les éditeurs

| Éditeur        | Pour                                                                          | Comparaison                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `classes`      | diagramme de classes UML (conception, BDD, POO) et diagramme d'objets         | concordance des classes, attributs, identifiants, liens et multiplicités ; classes et valeurs des objets                    |
| `relationnel`  | modèle relationnel (schéma logique)                                           | concordance des relations, attributs, clés ; clés étrangères appariées par leur cible, leur nom étant libre                 |
| `table`        | table de données, table de vérité, matrice, plan d'adressage, emploi du temps | cases justes                                                                                                                |
| `sql`          | requête ou script SQL, exécuté (PostgreSQL)                                   | même résultat que la solution ; tests en mode script                                                                        |
| `graphe`       | graphe orienté ou non, pondéré, automate fini, PERT potentiel-étapes          | automate : égalité des langages, avec un mot qui les distingue ; graphe : concordance ; PERT : tâches, précédences et dates |
| `processus`    | arbre des processus créés par `fork()`, organigramme WBS ou PBS               | même forme d'arbre                                                                                                          |
| `chronogramme` | ordonnancement, exclusion mutuelle, signaux                                   | cases justes                                                                                                                |
| `sequence`     | diagramme de séquence UML                                                     | suite des messages                                                                                                          |
| `cas`          | diagramme de cas d'utilisation UML                                            | concordance des acteurs, des cas et des liens ; noms appariés sur leurs mots                                                |
| `texte`        | réponse rédigée                                                               | aucune : solution affichée et correction par Claude                                                                         |

La concordance est un score F1 pondéré sur les « faits » du modèle (une classe, un attribut, une clé, un lien…) ; les noms sont comparés sans casse, accents ni pluriel, et une classe au nom voisin est appariée à celle de la solution. Pour les choix de notation fins, voir `comparer` dans `assets/js/editeurs/`.

### classes

```
classe Vendeur
  id : int {PK}              identifiant : {PK}, ou _id_
  nom : varchar [1]          multiplicité d'attribut entre crochets
  + age() : int              méthode (des parenthèses)
classe abstraite Personne    aussi : interface, enumeration ; stéréotype « <<…>> »
Vendeur "1" -- "*" Article : vend >                 association, nom, sens de lecture
Vendeur "0..1 parrain" -- "* filleul" Vendeur : parraine
Acteur "2..*" -- "*" Film : joue [Distribution]     classe d'association
Voiture "1" *-- "4" Roue     composition ; o-- agrégation
Etudiant --|> Personne       héritage ; ..|> réalisation ; ..> dépendance ; --> navigable
objet c1 : Carre             objet d'un diagramme d'objets
  pleine = true              ses valeurs en retrait
c1 o-- r1                    lien entre objets, sans multiplicités
```

Options : `bdd` (contrôles du passage au relationnel : identifiant `{PK}` dans chaque classe, attributs atomiques et monovalués, pas de méthodes), `methodes` (le formulaire d'une classe propose aussi ses méthodes, pour la POO), `objets` (diagramme d'objets : « + Objet » et le double-clic créent des objets).

Les objets et les classes partagent le même dessin. Un objet porte un nom unique, souligné avec sa classe (`c1 : Carre`) ; la comparaison porte aussi sur sa classe et ses valeurs. Une contrainte sur un lien s'écrit comme son nom : `Chat --|> Animal : {incomplet, disjoint}`.

### relationnel

```
Vendeurs(_id_, nom, #id_parrain(Vendeurs.id))
Articles(_id_, nom, prix : numeric(6,2), #id_vendeur(Vendeurs))
Activite(_#id_mus_, _#id_orch_, date_debut)
```

Clé primaire soulignée `_a_`, clé étrangère `#a`, référence entre parenthèses quand le nom ne suffit pas : `(Table)`, `(Table.colonne)`. Une relation peut tenir sur plusieurs lignes. L'ordre des relations est celui de l'implémentation (table référencée d'abord). Options : `ordre` (`false` : ne pas le contrôler).

### table

```
| a | b | a ⊕ b |
|---|---|-------|
| 0 | 0 |       |
```

Options : `verrou` (`entetes` par défaut, `depart` : cases remplies au départ fixes, `aucun`), `lignes` (`false` : pas d'ajout de lignes), `colonnes` (`true` : ajout de colonnes), `ordre`, `casse`, `accents`, `tolerance`, `cles` (colonnes identifiantes), `types` (`{ "age": "entier" }` : `entier`, `nombre`, `date`, `booleen`), `mono`, `complet` (signaler les cases vides).

Deux cases sont égales si ce sont le même nombre (`0,5` et `0.50`), ou le même texte, sans casse ni accents. Une valeur qui commence par un zéro suivi d'un chiffre est un texte : le mot binaire `01010` n'est pas `1010`.

### sql

Le texte est du SQL. Options : `jeu` (jeu de données de la page ou du quiz), `mode` (`requete` par défaut ; `script` pour créer ou modifier des tables, éprouvé par les `tests`), `ordre`, `colonnes`, `lignes` (hauteur de l'éditeur). Chaque exécution part d'une base neuve créée par le jeu.

### graphe

```
automate                     (ou : oriente, non oriente)
initial q0
final q2
q0 -> q1 : a, b              arc et étiquettes (ε pour une ε-transition)
q1 -> q1 : a                 boucle
A -- B : 5                   arête d'un graphe non orienté, poids
```

Options : `deterministe`, `complet`, `afn` (plusieurs états initiaux permis), `alphabet` (`["a", "b"]`), `pondere`, `oriente`, `automate`, `pert`. `tests` : mots acceptés et rejetés, contrôlés par « Vérifier ».

PERT potentiel-étapes (option `pert`) :

```
etape Debut 0 0              étape, date au plus tôt, date au plus tard (facultatives)
etape E2 15 15
Debut -> E2 : T2 15          tâche : un arc avec son nom et sa durée
E2 -> E3 : fictive           tâche fictive, en pointillés
```

Une étape est un cercle partagé (nom, date au plus tôt, date au plus tard), le premier placement se fait en colonnes selon le rang de l'étape. « Vérifier » contrôle la forme sans donner les dates : étiquettes des arcs, tâche en double, deux tâches entre les deux mêmes étapes, circuit, début et fin uniques, dates incompatibles avec une durée. « Comparer » porte sur les tâches et non sur les étapes, dont les noms sont libres : durée, tâches qui la précèdent (à travers les fictives), date au plus tôt de son étape de départ, date au plus tard de son étape d'arrivée.

### processus

```
P1 : main
  P2 : fork() = 0            un fils en retrait sous son père ; étiquette après « : »
    P4
  P3
```

Options : `etiquettes` (comptent dans la comparaison), `ordre` (ordre des fils), `organigramme` (WBS, PBS : mêmes lignes, dessinées en colonnes sous la racine, avec les ressources et la durée en étiquette). La comparaison d'un organigramme ne regarde que la forme de l'arbre : le jugement sur le fond revient à Claude.

### chronogramme

```
temps 0..12
etat x Exécution             états par défaut : x Exécution, p Prêt, b Bloqué
P1 : x 0-3, p 3-5, x 5-7     segments « état début-fin », fin exclue
P2 : ..xxpp.x                ou un caractère par case
```

Sur la grille, choisir un état dans la palette puis cliquer ou glisser sur les cases. Options : `processeurs` (au plus autant de processus en exécution à la fois), `actif` (code de l'exécution), `durees` (`{ "P1": 3 }` : temps d'exécution attendu), `debut`, `fin`, `pas`, `etats`.

Quand une case ne vaut pas une unité, on donne sa durée : `temps 0..3000 pas 50` trace 60 cases de 50 (des microsecondes, par exemple). Segments, durées attendues, contrôles et écarts s'expriment alors dans l'unité de l'axe (`T1 : x 500-600`, `"durees": { "T1": 950 }`) ; l'écriture compacte garde un caractère par case. Au-delà de 25 cases, ou dès que la grille déborde de la page, les cases rétrécissent pour qu'elle tienne, et l'axe n'est gradué que sur des valeurs rondes. Au-delà de 120 cases (un Gantt sur 336 jours), la grille tient toujours, dense, sans trait entre les cases : elle se lit, mais se remplit par la vue texte.

Diagramme de Gantt : une ligne par tâche, un seul état (`etat x Tâche`), et l'option `durees` pour contrôler la longueur des barres.

**Tracé de signal** (codes en ligne : bipolaire, HDBn, NRZ, Manchester…) : l'option `niveaux` donne le niveau de chaque état, entre −1 et 1 (`{ "p": 1, "n": -1 }`), et chaque ligne se dessine alors comme un signal : un palier par case, un front vertical entre deux niveaux différents. Une case vide est au niveau `repos` (0 par défaut ; `false` : rien de tracé). `marques` écrit un repère sur l'impulsion d'un état (`{ "V": "V+", "b": "B−" }`), et `graduations` remplace les instants par les étiquettes des colonnes, les bits à coder (`"1 0 0 1"`, ou `"1001"`). Le modèle, la syntaxe et la comparaison ne changent pas : B+ et +V sont deux états, comparés comme tels. Exemples : `demo-chrono-signal` de `demo.html`, et le TD 1 de codage.

### sequence

```
acteur Client
objet g : Guichet
Client -> g : retirer(50)    synchrone ; ->> asynchrone ; --> retour
alt solde suffisant          fragments alt / sinon, boucle, opt, par, fermés par « fin »
  g --> Client : billets
sinon
  g --> Client : refus
fin
```

### cas

```
systeme Guichet automatique       frontière du système (facultative)
acteur Porteur                    acteur humain
acteur <<actor>> SA Visa          acteur non humain (rectangle stéréotypé)
cas Retirer de l'argent           les noms peuvent contenir des espaces
Porteur -- Retirer de l'argent    association (dans un sens ou dans l'autre)
SA Visa -- Retirer de l'argent : secondaire      étiquette sur l'association
Retirer de l'argent ..> Saisir son code : include
Imprimer un ticket ..> Retirer de l'argent : extend
Porteur Visa --|> Porteur         généralisation (entre acteurs ou entre cas)
```

Un nom utilisé sans être déclaré devient un cas. Premier placement en colonnes : acteurs principaux à gauche, cas au centre, cas inclus ou étendus à côté, et à droite les acteurs dont toutes les associations portent `secondaire`. `disposition` impose des positions, comme pour un graphe. Sur le dessin, relier un acteur à un cas crée une association ; relier deux cas ouvre le choix entre include, extend et généralisation. Deux noms de cas sont appariés quand ils partagent la majorité de leurs mots (« Retirer de l'argent » et « Retirer l'argent ») ; l'étiquette `secondaire` compte dans la comparaison.

### texte

Réponse libre. Options : `lignes`, `placeholder`.

Dans toutes les syntaxes, une ligne qui commence par `--` est un commentaire, ainsi que ce qui suit `//`.

## Travail fait sur papier

Un TD fait sur papier, puis scanné, se reprend dans sa page interactive comme s'il avait été fait sur le PC (`_outils/numerisation/README.md`). Chaque réponse est saisie **telle qu'elle est écrite**, fautes comprises, dans la syntaxe texte de l'éditeur, au champ `papier` de son atelier :

```json
"papier": {
  "texte": ["temps 0..8", "etat p +V", "etat n −V", "Bipolaire : p...n..."],
  "source": "TD1.pdf, scan du 1er octobre 2026",
  "date": "2026-10-01",
  "note": "une ligne « Clock » tracée à la main, non reprise ici."
}
```

- `texte` : la réponse (seul champ obligatoire ; `"papier": "…"` suffit) ; `source` : le scan ; `date` : celle du travail ou du scan ; `note` : ce que la copie contient et que l'atelier ne peut pas montrer (dessin en marge, ratures, fin de ligne coupée), affiché sous la consigne.
- La page s'ouvre avec ce travail tant que rien d'autre n'est enregistré pour l'atelier (navigateur ou serveur) ; le pied le signale (« Repris de ta copie papier »). Le menu ⋯ propose « Reprendre ma copie papier », et « Revenir au départ » rend l'exercice vierge.
- `node _outils/atelier/outils/saisir.js PAGE.html` écrit ces réponses dans `td_results/`, au format du serveur : le portail compte l'atelier comme commencé et Claude le lit. Un atelier modifié depuis dans la page n'est pas écrasé (`--forcer` pour le remplacer, `--essai` pour voir sans écrire).
- Une question laissée sans réponse sur la copie n'a pas de `papier`. Le vérificateur contrôle la syntaxe de chaque `papier`.

## Dans un quiz

Type de question `atelier` : mêmes champs qu'un bloc (`editeur` au lieu de l'attribut), plus `seuil` (concordance à partir de laquelle la réponse compte juste, 1 par défaut). La page du quiz charge `atelier.css` et `atelier.js` après `quiz.js`. Détails et exemples : `_outils/quiz/README.md` (« Questions d'atelier ») et les questions q17 et q18 de `_outils/quiz/demo.html`. `verifier_quiz.py` confie ces questions à `outils/verifier.js --quiz`.

## Dans un cours

Un exemple du cours peut devenir un atelier :

- `"mode": "exemple"` : l'étudiant manipule le diagramme ou la requête, rien n'est enregistré ;
- `"mode": "lecture"` : dessin seul, mis en page automatiquement (le menu ⋯ en copie la syntaxe texte) ; pratique pour un gros diagramme écrit en quelques lignes.

La page charge alors `atelier.css` et `atelier.js`, comme un TD.

## Claude dans l'atelier

- **Poser une question** : panneau de conversation de l'outil de quiz, avec des demandes toutes prêtes. Claude reçoit l'énoncé, le travail en cours (vue texte), les contrôles automatiques et la solution de référence, et peut lire les pages de cours de la matière ; il guide sans donner la réponse, sauf demande explicite. La conversation est enregistrée avec l'atelier.
- **Faire corriger** : Claude rend une appréciation (0, 0,25, 0,5, 0,75 ou 1), un commentaire et des remarques posées sur les éléments du dessin (cibles), qui s'affichent et se surlignent. La solution est une référence, pas la seule réponse juste.
- Consignes : `serveur/prompts/aide.md` et `correction.md` ; modèles et effort : réglages du serveur (usages « aide » et « correction »).

## Faire évoluer l'outil

- **Nouvel éditeur** :
  1. la logique dans `assets/js/editeurs/<nom>.js`, selon le contrat décrit en tête de `editeurs/texte.js` (`lire`, `ecrire`, `controler`, `comparer`, `options`…), sans rien toucher au DOM : elle tourne aussi dans Node ;
  2. la vue dans `assets/js/vues/<nom>.js` (`creer`, `statique`, et `libelleVue`, `aideVide` au besoin), sur le `Canevas` pour un diagramme ;
  3. les deux noms dans les listes `LOGIQUE` et `INTERFACE` de `assets/atelier.js`, les styles dans `css/editeurs.css` ;
  4. des tests dans `outils/tests.js`, un exemple dans `demo.html`, une section dans ce README.
- **Nouvelle option** : la déclarer dans `options` de l'éditeur (le vérificateur signale les options inconnues) et la documenter ici.
- **Nouveau contrôle ou nouvelle règle de comparaison** : dans l'éditeur, avec un test.
- **Nouvelle route** : dans `serveur/extension.js` ; la page l'appelle par `QuizApp.connexion` (`atelier/<route>`). Le serveur n'est pas à modifier : il charge l'extension au démarrage (redémarrer le serveur).
- Après une modification :
  - `node --check` sur les fichiers JavaScript modifiés ;
  - `node _outils/atelier/outils/tests.js` ;
  - `node _outils/atelier/outils/verifier.js --executer _outils/atelier/demo.html` et les dossiers `generated_courses/` qui ont des ateliers ;
  - `python _outils/quiz/outils/verifier_quiz.py --executer _outils/quiz/demo.html` ;
  - `demo.html` ouverte depuis le serveur, en thème clair et sombre et en fenêtre étroite.

## Historique

- **1.0**, 23 septembre 2026 : création. Neuf éditeurs (classes, relationnel, table, SQL, graphe et automate, processus, chronogramme, séquence, texte), dessin et vue texte synchronisés, contrôles, comparaison, solution, aide et correction par Claude, modes exercice, exemple, lecture et annoter, enregistrement dans `td_results/`, type de question `atelier` pour les quiz, extension du serveur local, vérificateur et tests.
- **1.1**, 23 septembre 2026 : premier TD réel (BDD, TD 1). Mode annoter : boutons « Comparer » et « Solution » sans solution de référence, remarques appariées plus strictement (même élément, lien dans un sens ou dans l'autre, classe d'un attribut). Clés étrangères résolues vers une clé primaire entière (plus d'avertissement sur la notation `stock(#id_objet, #id_visiteur, …)`). Classes d'association placées au milieu de leur association, boîtes écartées des traits qui les traversent, associations parallèles plus espacées. Énoncé général de la section transmis à Claude avec la question. Modèle relationnel lisible sur téléphone ; formulaire flottant recalé quand la fenêtre change de taille.
- **1.2**, 28 septembre 2026 : listes déroulantes et cases à cocher habillées par la charte (1.6) ; hauteur du dessin en rem, et cadrage automatique proportionnel à la taille de base de la page : le dessin grandit avec un quiz agrandi sur grand écran.
- **1.3**, 29 septembre 2026 : le fil d'Ariane du modèle de TD commence par « studies », lien vers l'accueil général (charte 1.9).
- **1.4**, 2 octobre 2026 : chronogramme à pas de temps (`temps 0..3000 pas 50`, option `pas`) : instants, durées, contrôles et écarts dans l'unité de l'axe, comparaison instant par instant entre deux grilles de pas différents, réglage du pas dans « Temps… » ; au-delà de 25 cases, cases resserrées et graduations sur des valeurs rondes. Table : une valeur à zéro de tête (`01010`) se compare comme un texte, et non plus comme un nombre.
- **1.5**, 9 octobre 2026 : travail fait sur papier (champ `papier`, menu « Reprendre ma copie papier », outil `outils/saisir.js` qui l'écrit dans `td_results/`), pour les copies scannées. Chronogramme : tracé de signal pour les codes en ligne (options `niveaux`, `repos`, `marques`, `graduations`), et cases resserrées dès que la grille déborde. Premiers TD repris d'une copie papier : TD 1 et 2 de codage.
- **1.6**, 1er novembre 2026 : éditeur `cas` (diagrammes de cas d'utilisation : acteurs humains ou non, frontière du système, include, extend, généralisation, étiquette `secondaire`), pour le TD 3 de génie logiciel.
- **1.7**, 1er novembre 2026 : objets dans l'éditeur `classes` (`objet c1 : Carre`, option `objets`, liens sans multiplicités, classe et valeurs comparées), pour le diagramme d'objets du TD 4 de génie logiciel. Boutons « + Classe » et « + Nœud » : le nouvel élément prend la première place libre, comme dans l'éditeur `cas` (`placeLibre`). Deux associations réflexives sur une classe se répartissent sur ses deux coins, une classe d'association réflexive se place à droite de sa boucle, les rôles longs ne passent plus sous les boîtes. Comparaison : écart de multiplicité d'une composition ou d'une agrégation corrigé (paire illisible, et signalé même quand le lien manquait).
- **1.8**, 1er novembre 2026 : option `pert` du graphe (PERT potentiel-étapes : étapes datées, tâches fictives, placement en colonnes, contrôles et comparaison sur les tâches) et option `organigramme` des arbres (WBS, PBS), pour le TD 5 de génie logiciel. Table : une liste se compare avec ou sans espace après la virgule. Chronogramme : grille dense au-delà de 120 cases, pour les Gantt. `disposition` s'applique aussi au dessin de la solution.
- **1.9**, 8 novembre 2026 : Ruby dans l'éditeur `code` : une définition préfixée (`private def …`, `protected def`, `public def`, `module_function def`) ouvre bien un bloc, et les commentaires `=begin … =end` sont ignorés dans le compte des `end`. Éditeur `classes` : les méthodes opérateurs de Ruby (`<=>(autre)`, `==`, `[]`, `+`) sont acceptées. Pour les TD 3 à 5 de POO.
- **1.10**, 12 novembre 2026 : réorganisation ula. Le travail enregistré va dans l'espace du profil actif (`<profil>/<cursus>/<cours>/td_results/`), jamais dans `explore/` ; `outils/saisir.js` aussi. `outils/verifier.js` accepte les liens écrits depuis la racine du serveur et lit `ULA_RACINE`.
