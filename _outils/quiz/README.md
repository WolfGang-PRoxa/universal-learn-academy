# Outil de quiz

Ce dossier produit et fait tourner des **quiz interactifs** sur les matières d’`ula/` : sur tout un cours, plusieurs cours ou un sujet précis, avec un seul type de question ou un mélange. Chaque quiz est une page HTML qui suit la charte des cours (`_outils/charte/`) : mêmes couleurs, thème clair ou sombre, teinte de la matière, code coloré, formules.

Un **serveur local** ajoute ce qu'une page ouverte depuis le disque ne peut pas faire seule :

- l'aide de **Claude**, par Claude Code avec l'abonnement du compte connecté : conversation sur une question, correction des questions ouvertes, évaluation détaillée d'une tentative, génération de nouveaux quiz ;
- l'**exécution du code** des questions : SQL avec PostgreSQL (PGlite), Python, JavaScript, C, et C POSIX (`fork`, `sigaction`…) ;
- l'**archivage des tentatives** dans le dossier de la matière, et la **reprise** d'un quiz interrompu.

Les questions de **modélisation** (diagramme de classes, modèle relationnel, table, automate, arbre de processus…) viennent de l'**atelier** (`_outils/atelier/`), l'outil des TD interactifs : type `atelier` ci-dessous. Le même serveur fait tourner l'atelier, par son mécanisme d'extensions.

> Pour voir tous les types de questions, ouvrir `demo.html` (de préférence depuis le serveur).

## Utilisation

### Lancer le serveur

Double-cliquer sur `lancer.bat`, à la racine d’`ula`, ou lancer `lancer.sh` dans un terminal. Il faut Node.js. Pour tout avoir dans sa propre fenêtre, sans navigateur ni terminal : `lancer-app.bat`, l'application Studies (`_outils/app/README.md`).

- Une fenêtre reste ouverte tant que le serveur tourne ; la fermer l'arrête.
- Le **portail** s'ouvre dans le navigateur (`http://127.0.0.1:5178/`). Il affiche les quiz à reprendre, puis, pour chaque matière, les cours générés et les quiz avec leurs résultats.
- Au premier lancement, PGlite (PostgreSQL pour les questions SQL) est installé dans `%LOCALAPPDATA%\studies-quiz`, hors de Google Drive. La première exécution y garde la copie d'une base vide (`pglite-base-<version>.tar`) : chaque exécution suivante part d'une base neuve en 2 à 3 s au lieu de 8.
- Claude Code est trouvé automatiquement, dans le PATH et dans l'extension VS Code : la version la plus récente est retenue. Un chemin indiqué dans les réglages a la priorité.

Sans serveur, une page de quiz ouverte depuis le disque fonctionne quand même, mais en **mode hors ligne** :

- la progression reste dans le navigateur ;
- le code ne s'exécute pas ;
- « Demander à Claude » copie la demande complète, contexte compris, et ouvre claude.ai.

### Faire un quiz

- **Accueil du quiz.**
  - Si un quiz est en cours, un bandeau propose de le reprendre.
  - Viennent ensuite les réglages : mode, thèmes, types de questions (pour ne faire que les QCM d'un quiz mixte, par exemple), nombre de questions, mélange.
  - En bas, l'historique des tentatives, avec la courbe des scores.
- **Deux modes.**
  - _Entraînement_ : correction et explication après chaque question.
  - _Examen_ : correction à la fin, avec chronomètre.
- **Navigation libre**, dans les deux modes. Les pastilles numérotées au-dessus de l'énoncé mènent à n'importe quelle question, et les flèches ‹ › qui les encadrent à la précédente ou à la suivante. En entraînement, « Passer » laisse une question sans la valider pour y revenir plus tard : la réponse commencée est gardée. Une question corrigée prend la couleur de son résultat (juste, en partie juste, fausse, à évaluer). « Terminer » corrige les questions restantes ; s'il en reste sans réponse, une confirmation propose d'y revenir.
- **Indices.** Certaines questions en ont : on les dévoile un par un. Un quiz peut retirer des points par indice (`penalite_indice`).
- **Demander à Claude.** Le bouton ouvre un panneau de conversation sur la question. Des demandes toutes prêtes s'affichent au-dessus du champ, et elles changent une fois la question corrigée (« Pourquoi ma réponse est fausse ? »…).
  - Claude reçoit la question, ta réponse du moment, les indices vus et l'extrait du cours correspondant.
  - Avant la correction, il guide sans donner la réponse, sauf si tu la lui demandes.
  - La conversation reprend là où elle s'était arrêtée, et elle est archivée avec la tentative.
- **Ateliers.** On construit la réponse sur un dessin ou dans sa vue texte, synchronisés ; « Vérifier » contrôle la forme avant de valider. La correction compare à la solution (en SQL, par exécution) et surligne les écarts.
- **Code.** L'éditeur colore le code, numérote les lignes et indente tout seul ; Ctrl+Entrée exécute.
  - La correction exécute ta réponse. En SQL, elle compare son résultat à celui de la solution ; en Python, JavaScript ou C, elle lance des tests.
  - Les exemples marqués « Essayer » dans les énoncés et les explications s'exécutent aussi.
- **Questions ouvertes.** Après ta rédaction, la réponse modèle et les points attendus s'affichent. Tu t'auto-évalues, ou tu fais corriger par Claude (note et commentaire).
- **Enregistrer et quitter.** La progression est enregistrée à chaque changement ; on peut fermer la page, faire un autre quiz, et reprendre plus tard depuis l'accueil du quiz ou le portail.

### Après le quiz

- **Évaluation classique** : score, note sur 20, justes, partielles, fausses et sans réponse, bilan par thème, correction détaillée (réponse donnée, réponse attendue, réponses acceptées, explication, lien vers le cours).
- **Évaluation détaillée par Claude** : bilan de ce qui est acquis, de ce qui coince et de ce qu'il faut réviser, avec des liens vers les sections du cours et des conseils pour la suite. On peut ensuite poser des questions sur ce bilan.
- **Refaire les questions ratées**, **recommencer**, **générer un quiz similaire** : même sujet, centré sur ses erreurs, ou autre sujet, avec les types, le nombre et la difficulté choisis. Claude Code écrit le nouveau quiz dans le dossier de la matière en quelques minutes ; son avancement s'affiche.
- **Réglages** (roue dentée dans la barre du haut) : modèle et effort de Claude pour chaque usage (aide, correction, évaluation, génération), chemin de Claude Code, quota de l'abonnement, langages disponibles. Dans l'application installée (`app/`), ces réglages sont réunis à ses paramètres : la roue dentée de la charte les ouvre, et le témoin « Claude » y mène aussi.

## Contenu du dossier

```
lancer.bat, lancer.sh       à la racine (ula/) : lancement du serveur local
_outils/quiz/
├── README.md               ce document
├── portail.html            page d'accueil du serveur : toutes les matières
├── demo.html               quiz de démonstration : les onze types, indices, code, ateliers
├── modele.html             squelette d'une page de quiz
├── reglages.json           modèles de Claude par usage, port (écrit par le serveur)
├── assets/
│   ├── quiz.css            point d'entrée des styles : importe css/*.css
│   ├── quiz.js             point d'entrée du script : charge js/*.js dans l'ordre
│   ├── css/                base, accueil, questions, code, resultats, claude, dialogues, portail, impression
│   └── js/                 outils, markdown, connexion, types, code, claude, dialogues, archives,
│                           moteur, ecran-accueil, ecran-question, ecran-resultats, portail, demarrage
├── serveur/
│   ├── serveur.js          serveur HTTP : fichiers de la racine des données (ula/) et des outils et API
│   ├── lib/                chemins, reglages, claude, executer (+ sql-worker), archives, catalogue,
│   │                       assistant (demandes à Claude), taches (génération), extensions
│   ├── prompts/            consignes données à Claude : aide, correction, evaluation, generation
│   └── outils/             verifier-solutions.js (appelé par verifier_quiz.py --executer)
└── outils/
    └── verifier_quiz.py    contrôle d'une page de quiz
```

## Où ranger les quiz et les archives

| Élément            | Emplacement                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quiz d'une matière | `explore/<domaine>/<cours>/generated_quizzes/quiz-<slug>.html`, par exemple `explore/informatique/bases-de-donnees-3/generated_quizzes/quiz-cours-02-sql.html` |
| Tentatives         | `<profil>/<cursus>/<cours>/quiz_results/<id du quiz>/<AAAA-MM-JJ_HH-MM-SS>.json` (écrites par le serveur)                                                      |

- Depuis `generated_quizzes/`, la charte est à `../../../../_outils/charte/` et l'outil à `../../../_outils/quiz/`, comme dans le modèle.
- Noms de fichiers : `quiz-cours-02-sql.html`, `quiz-formes-normales.html`, `quiz-sql-code.html`, `quiz-revision-generale.html`.

### Archives des tentatives

Une tentative est un fichier JSON créé dès la première question (`"statut": "en_cours"`), mis à jour à chaque changement, puis passé à `"terminee"` ; `"abandonnee"` si on l'abandonne après avoir répondu (sans réponse, elle est supprimée). Champs principaux :

| Champ                                          | Contenu                                                                                                                                                                                      |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format`, `id`, `statut`                       | `studies-quiz/tentative-1`, horodatage, état                                                                                                                                                 |
| `quiz`                                         | `id`, `titre`, `matiere`, `niveau`, `page`                                                                                                                                                   |
| `debut`, `fin`, `duree_ms`, `mode`, `reglages` | déroulement                                                                                                                                                                                  |
| `score`                                        | `pourcent`, `note20`, `justes`, `partielles`, `fausses`, `sans_reponse`, `a_evaluer`, `nb`                                                                                                   |
| `questions`                                    | pour chaque question : `enonce`, `reponse_texte`, `attendu_texte`, `acceptees`, `score`, `duree_ms`, `indices_vus`, `aide` (conversation avec Claude), `correction_claude`, `rapport` (code) |
| `evaluation`                                   | bilan de Claude : `texte` (Markdown), `modele`, `date`, `session`                                                                                                                            |
| `session`                                      | état interne complet, qui permet la reprise et la relecture                                                                                                                                  |

Ces fichiers sont lisibles par Claude : pour faire le point sur une matière, les lire dans `quiz_results/`.

## Produire un quiz : marche à suivre

1. **Fixer la portée** : toute la matière, un cours, ou le sujet demandé (« les jointures », « les formes normales »). Si l'on demande un seul type de questions (« que des QCM », « que du code »), le quiz n'utilise que ce type.
2. **Lire la matière** : d'abord les pages de `generated_courses/`, qui contiennent les compléments, puis les sources d'origine si besoin. Une question ne porte que sur ce que le cours enseigne, compléments compris. Les tentatives passées (`quiz_results/`) montrent ce qui a déjà été raté.
3. **Planifier** :
   - de 15 à 25 questions pour un cours, de 8 à 15 pour un sujet précis, de 30 à 40 pour une révision générale ;
   - de 3 à 6 thèmes, calqués sur les sections du cours ;
   - environ 40 % de questions faciles, 40 % moyennes, 20 % difficiles ;
   - dans un quiz mixte, des types variés : QCM majoritaires, mais aussi du code (dès que la matière s'y prête : SQL, C, Python…), des trous, des remises en ordre, des associations, et des questions ouvertes pour les questions de cours de l'examen ;
   - des indices (un ou deux) sur les questions moyennes et difficiles.
4. **Rédiger** selon les règles ci-dessous.
5. **Vérifier les réponses** : chaque bonne réponse est justifiée par le cours, et tout code est exécuté.
6. **Assembler** : copier `modele.html` à sa place, remplir l'en-tête, écrire les données JSON.
7. **Contrôler** : `python _outils/quiz/outils/verifier_quiz.py --executer <fichier>` doit finir sans erreur. Il exécute les solutions des questions de code et vérifie que chaque lien « Revoir » pointe vers une section existante.
8. **Relier** :
   - ajouter le quiz à l'accueil de la matière (`generated_courses/index.html`, section « Quiz », une entrée `a.chapitre` avec le badge `Quiz`) ;
   - dans l'en-tête de chaque page de cours couverte, ajouter `<link rel="quiz" href="../generated_quizzes/quiz-….html" title="Quiz · …">` : le cours affiche alors un bouton « Quiz » ;
   - relancer `python _outils/charte/outils/verifier.py` sur les pages modifiées.

## Format des données

Le bloc `<script type="application/json" id="quiz-donnees">` contient un objet :

| Champ             | Rôle                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | identifiant unique du quiz, en minuscules et tirets (`bd-cours-02-sql`) ; nomme le dossier des archives                           |
| `melanger`        | `true` par défaut : ordre des questions tiré au sort (modifiable à l'accueil)                                                     |
| `cours`           | cours couverts : `[{ "titre": "Cours 2 · Le langage SQL", "lien": "../generated_courses/cours-02-sql.html" }]`                    |
| `jeux`            | jeux de données des questions SQL : `{ "emp": { "titre": …, "description": "<p>…</p>", "script": "CREATE TABLE …; INSERT …;" } }` |
| `penalite_indice` | facultatif : part des points retirée par indice utilisé (0,25 = 25 %) ; 0 par défaut                                              |
| `questions`       | la liste des questions                                                                                                            |

Champs communs à toutes les questions :

| Champ         | Rôle                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| `id`          | identifiant unique dans le quiz (`q01`, `q02`…) ; il sert à la reprise : ne pas renuméroter un quiz déjà utilisé |
| `type`        | un des onze types ci-dessous                                                                                     |
| `theme`       | thème, pour le filtrage et le bilan (« Général » sinon)                                                          |
| `difficulte`  | 1 (facile), 2 (moyenne), 3 (difficile)                                                                           |
| `enonce`      | la question, en HTML                                                                                             |
| `consigne`    | remplace la consigne par défaut du type (facultatif)                                                             |
| `indices`     | liste d'indices en HTML, dévoilés un par un (facultatif)                                                         |
| `explication` | affichée après la réponse, en HTML ; obligatoire sauf pour une question ouverte                                  |
| `revoir`      | `{ "texte": "Cours 2 · La clause HAVING", "lien": "../generated_courses/cours-02-sql.html#la-clause-having" }`   |

Les types et leurs champs propres :

| Type             | Champs                                                                                                                    | Notation                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `qcm`            | `choix` (liste), `reponse` (indice à partir de 0), `melanger`                                                             | juste ou faux                                                                                                                           |
| `qcm-multi`      | `choix`, `reponses` (liste d'indices)                                                                                     | (bonnes cochées − mauvaises cochées) / nombre de bonnes                                                                                 |
| `vrai-faux`      | `reponse` (`true` ou `false`)                                                                                             | juste ou faux                                                                                                                           |
| `reponse-courte` | `reponses` (toutes les formes acceptées), `casse`, `accents`                                                              | juste ou faux, sans tenir compte de la casse ni des accents par défaut                                                                  |
| `numerique`      | `reponse` (nombre), `tolerance`, `unite`                                                                                  | juste si l'écart ≤ tolérance ; virgule ou point acceptés                                                                                |
| `trous`          | `texte` avec `{{0}}`, `{{1}}`…, `trous`, `code`                                                                           | part des trous justes                                                                                                                   |
| `association`    | `paires` (`[gauche, droite]`), `intrus`                                                                                   | part des paires justes                                                                                                                  |
| `ordre`          | `elements`, écrits dans le bon ordre                                                                                      | part des éléments bien placés                                                                                                           |
| `ouverte`        | `reponse_modele`, `criteres`                                                                                              | auto-évaluation ou correction par Claude : 1, 0,5 ou 0                                                                                  |
| `code`           | `langage`, `depart`, `solution`, et selon le langage `jeu`, `ordre`, `colonnes` (SQL) ou `tests`, `harnais` (programmes)  | SQL : juste si le résultat est celui de la solution ; programmes : part des tests réussis                                               |
| `atelier`        | `editeur`, `solution`, `depart`, `options`, `tests`, `seuil`, `mode`, `vue`, `hauteur`, `disposition`, `attendu`, `titre` | concordance avec la solution (juste à partir de `seuil`, 1 par défaut) ; SQL : comme `code` ; rédaction et annotation : auto-évaluation |

Pour `trous`, chaque entrée de `trous` est soit une saisie libre, `{ "reponses": ["HAVING"] }`, soit une liste déroulante, `{ "choix": ["GROUP BY", "WHERE"], "reponse": 0 }`. Avec `"code": true`, le texte s'affiche comme du code, les sauts de ligne étant écrits `\n`.

### Questions de code

- `langage` : `sql`, `python`, `javascript`, `c` ou `c-posix`. `depart` : code affiché au départ dans l'éditeur (souvent `SELECT ` ou un squelette de fonction). `solution` : solution de référence, montrée après la correction.
- **SQL** : la requête de l'étudiant et la `solution` sont exécutées sur une base neuve créée par le `script` du jeu `jeu` (champ `jeux` à la racine). Les résultats sont comparés sans tenir compte des noms de colonnes ni, par défaut, de l'ordre des lignes ; les nombres sont comparés à 10⁻⁶ près. `"ordre": true` quand l'énoncé demande un tri ; `"colonnes": true` pour exiger aussi les noms de colonnes. L'énoncé précise les colonnes attendues quand il y a une ambiguïté.
- **Programmes** : `tests` est une liste de `{ "nom": …, "entree": "texte envoyé sur l'entrée standard", "sortie": "sortie attendue" }`. Les sorties sont comparées aux espaces de fin de ligne près. Pour une fonction, `harnais` est ajouté après le code de l'étudiant pour l'appeler (lire l'entrée, afficher le résultat), comme dans `demo.html`. Chaque exécution est limitée à 8 secondes.
- **C ou C POSIX.** `c` compile avec le gcc du PC, qui sous Windows est MinGW : ni `fork`, ni `sigaction`, ni `sigsuspend`. `c-posix` passe par WSL sous Windows (gcc, `-std=gnu11`) et compile directement sous Linux ; il demande gcc dans WSL. Chaque exécution est limitée à 7 secondes, fils compris. Exemple : `explore/informatique/programmation-systeme/generated_quizzes/quiz-signaux-code.html`.
- **Des tests qui rejettent le vide.** Une fonction `int` sans `return` peut renvoyer son paramètre par hasard, et réussir des tests : faire afficher le résultat par la fonction, ou vérifier qu'un `depart` non complété échoue.
- **Des tests qui ne comptent pas sur le délai.** Le délai tue le programme, pas forcément ses fils : un fils qui attendait la fin d'un tube peut alors finir et écrire la sortie attendue. Le père du harnais vérifie donc lui-même que le fils a terminé (`waitpid` avec `WNOHANG`), et affiche un message sinon. La sortie n'est pas fiable non plus sur un octet nul : faire afficher un nombre d'octets. Un tube nommé se crée dans `/tmp`, le dossier d'exécution étant sur le disque Windows.
- Toujours vérifier avec `verifier_quiz.py --executer` : la solution SQL doit s'exécuter et renvoyer des lignes, la solution d'un programme doit passer tous ses tests.

### Questions d'atelier

- La page du quiz charge aussi l'atelier : `<link rel="stylesheet" href="../../../_outils/atelier/assets/atelier.css">` et `<script defer src="../../../_outils/atelier/assets/atelier.js"></script>`, après `quiz.js` (lignes en commentaire dans `modele.html`).
- `editeur` : `classes`, `relationnel`, `table`, `sql`, `graphe`, `processus`, `chronogramme`, `sequence`, `cas` ou `texte`. `solution` et `depart` s'écrivent dans la syntaxe texte de l'éditeur, en texte ou en tableau de lignes. Syntaxes, options et exemples : `_outils/atelier/README.md` et `_outils/atelier/demo.html`.
- `seuil` : concordance à partir de laquelle la réponse compte juste (0,9 tolère un détail) ; en dessous, la note est la concordance.
- `"mode": "annoter"` : l'étudiant relève les erreurs d'un `depart` fautif ; `attendu` liste les erreurs (`[{ "cible": "Film.acteurs", "texte": "…" }]`), montrées à la correction.
- En SQL, `options.jeu` désigne un jeu de `jeux` ; `"options": { "mode": "script" }` avec des `tests` pour les créations de tables.
- Le vérificateur passe ces questions au vérificateur de l'atelier (Node) : syntaxe, solution qui passe les contrôles de l'éditeur, SQL exécuté avec `--executer`.

### Extraits exécutables

Dans un énoncé ou une explication, un bloc `<pre data-executer='sql' data-jeu='emp'><code class='language-sql'>…</code></pre>` reçoit un bouton « Essayer » : l'étudiant peut modifier le code et l'exécuter. Langages : `sql` (avec `data-jeu`), `python`, `javascript`, `c`. Le vérificateur exécute aussi les extraits SQL.

Exemple de question SQL :

```json
{
  "id": "q09",
  "type": "code",
  "langage": "sql",
  "jeu": "emp",
  "theme": "Regroupement",
  "difficulte": 2,
  "enonce": "<p>Pour chaque département d'au moins 5 employés, afficher son identifiant, son nombre d'employés et le salaire le plus élevé.</p>",
  "depart": "SELECT ",
  "solution": "SELECT id_dep, count(*), max(sal) FROM emp GROUP BY id_dep HAVING count(*) >= 5;",
  "indices": ["<p>La condition « au moins 5 employés » porte sur un groupe : elle va dans <code>HAVING</code>.</p>"],
  "explication": "<p>…</p>",
  "revoir": { "texte": "Cours 2 · La clause HAVING", "lien": "../generated_courses/cours-02-sql.html#la-clause-having" }
}
```

### Écrire du HTML dans le JSON

- Attributs HTML entre apostrophes simples, pour ne pas échapper les guillemets du JSON : `<code class='language-sql'>`.
- Dans le HTML, `<`, `>` et `&` s'écrivent `&lt;`, `&gt;` et `&amp;` (mais pas dans `depart`, `solution`, `harnais` ni les `tests`, qui sont du texte brut). Un bloc de code s'écrit `<pre><code class='language-…'>`, comme dans les cours ; il reçoit la coloration et le bouton Copier.
- Formules : `\\(` et `\\)` (la barre oblique inverse est doublée en JSON).
- Saut de ligne : `\n`. Jamais de `</script` dans le JSON.
- Les classes utilisables sont celles de la charte et de `quiz.css` ; le vérificateur signale les autres.
- Les espaces insécables de la typographie française sont ajoutées à l'affichage : écrire des espaces ordinaires.

## Règles de rédaction des questions

- **Une question, une notion.** L'énoncé se comprend seul, sans avoir lu la question précédente.
- **Des questions autonomes.** L'étudiant navigue librement entre les questions, dans n'importe quel ordre, et l'ordre peut être tiré au sort : aucune question ne renvoie à une autre (« la question précédente », « la question suivante », « même urne », « avec le même code »…). Quand plusieurs questions portent sur les mêmes données (un graphe, une table, un code, une loi), chacune les redonne en entier. Pour une annale, le numéro de la question du sujet (« Ex. 1, q. 2 ») peut rester, mais pas « avec la question suivante ». `verifier_quiz.py` signale les renvois explicites à une autre question.
- **Des distracteurs plausibles** : les erreurs que font réellement les étudiants (confondre `WHERE` et `HAVING`, mettre la clé étrangère du côté `1`…), jamais des réponses absurdes. Les choix ont une forme et une longueur comparables. On évite « Toutes les réponses ci-dessus » ; si un choix doit rester en dernier, `"melanger": false`.
- **Pas de piège de formulation** : pas de double négation. Quand la négation est le sujet, elle est en gras : « laquelle n'est **pas** … ».
- **Des indices qui mettent sur la voie** : le premier rappelle la notion ou la méthode, le second resserre ; aucun ne donne la réponse.
- **Une explication qui enseigne** : pourquoi la bonne réponse est juste, et pourquoi le distracteur le plus tentant est faux. Deux à quatre phrases.
- **Toujours un lien « Revoir »** vers la section du cours. L'ancre est l'identifiant du titre h2 ou h3, calculé à partir de son texte : « La clause HAVING » donne `#la-clause-having`. Le vérificateur indique les ancres voisines en cas d'erreur.
- **Réponse courte** : lister toutes les formes acceptables. Si la réponse peut s'écrire de trop de façons, préférer un QCM.
- **Numérique** : une `tolerance` pour toute valeur calculée ou arrondie.
- **Questions ouvertes** : pour les questions de cours de l'examen (« Expliquer pourquoi… », « Définir… »). Une réponse modèle de deux à cinq phrases, et deux à quatre critères concrets, qui servent aussi à la correction par Claude.
- **Atelier** : pour ce qui se dessine sur papier en TD (diagramme, schéma, table à remplir, automate, arbre, chronogramme). L'énoncé donne tout ce qu'il faut pour une réponse unique au nom près ; `seuil` à 0,9 quand de petites variantes restent justes, mais jamais quand un seul détail est l'erreur visée : en normalisation, un attribut resté au mauvais endroit obtient encore 97 % de concordance.
- **Code** : un énoncé qui fixe sans ambiguïté le résultat attendu (colonnes, ordre, format de sortie) ; un jeu de données petit et lisible, décrit dans `description` ; des tests qui couvrent les cas limites (liste vide, zéro, valeur négative…).
- **Justesse** : chaque réponse est vérifiée ; le code est exécuté.

## Claude dans l'outil

- Le serveur lance Claude Code en mode non interactif (`claude -p`) avec le compte connecté : l'usage est décompté de l'abonnement, et l'interface affiche la part utilisée de la fenêtre de 5 heures. Avec Pro, Sonnet, Opus et Haiku sont disponibles ; Fable demande des crédits.
- Pour l'aide, la correction et l'évaluation, Claude reçoit une consigne dédiée (`serveur/prompts/`) et un contexte construit par la page et le serveur (question, réponse, extrait du cours, tentative, plan des cours). Il peut lire les fichiers d’`ula/`, mais pas les modifier. Les connecteurs (Gmail, Drive…) ne sont pas chargés, ce qui garde chaque demande légère.
- Les conversations sont des sessions Claude Code gardées dans `%LOCALAPPDATA%\studies-quiz\conversations` : c'est ce qui permet de les reprendre.
- La génération lance Claude Code dans la racine des données avec sa consigne complète (`serveur/prompts/generation.md`) : il lit ce README, écrit le quiz, le vérifie et le relie. Il peut créer et modifier des fichiers et lancer `python` et `node`, sans rien demander ; rien d'autre. La session apparaît dans l'historique de Claude Code, ce qui permet de la poursuivre à la main.
- Pour changer le ton ou les règles de Claude, modifier les fichiers de `serveur/prompts/` ; pour les modèles, les réglages.

## Faire évoluer l'outil

- **Nouveau type de question** : l'ajouter à `QuizApp.types` (fonctions `rendre`, `noter` ou `evaluer`, `resume`, `solution`, `details`) dans `assets/js/types.js` ou un nouveau module, ses styles dans `assets/css/questions.css`, son libellé dans `A.LIBELLES_TYPES` (`dialogues.js`), ses champs dans `CHAMPS` de `verifier_quiz.py`, un exemple dans `demo.html`, une ligne dans le tableau des types ci-dessus et dans `serveur/lib/taches.js`.
- **Nouveau module ou nouvelle feuille** : l'écrire dans `assets/js/` ou `assets/css/` et l'ajouter à la liste de `quiz.js` ou aux `@import` de `quiz.css`. Aucune page n'est à modifier.
- **Nouvelle route de l'API** : dans `serveur/serveur.js`, avec la logique dans `serveur/lib/` ; la page l'appelle par `QuizApp.connexion`.
- **Nouveau langage exécutable** : dans `serveur/lib/executer.js` (et `LANGAGES` du vérificateur, `NOMS` et `LANGUE_HLJS` de `code.js`).
- **Extensions du serveur** : un autre outil d’`ula/` ajoute ses routes sans toucher au serveur, par un fichier `_<outil>/serveur/extension.js` qui exporte `{ nom, api(route, req, res, outils), travauxMatiere(dossier, relatif) }`. Au démarrage, `serveur/lib/extensions.js` charge chaque extension trouvée ; les requêtes `/api/<nom>/…` lui sont confiées, avec les outils du serveur (`envoyerJson`, `lireCorps`, `claude`, `assistant`, `chemins`…). `travauxMatiere` alimente le portail. C'est ainsi que fonctionnent `_outils/atelier/` et `_outils/todo/` (suivi de `TODO.md`).
- **Rapports et types venus d'un autre outil** : `QuizApp.rapports[type]` affiche un rapport de correction propre à un outil ; un type ajouté à `QuizApp.types` peut fournir `blocModele(q)` (solution affichée pour l'auto-évaluation). `QuizApp.pret` est une promesse résolue quand le quiz est prêt ; si la page charge `atelier.js`, le démarrage attend l'atelier avant d'afficher le quiz.
- Après une modification : `node --check` sur les fichiers JavaScript, `verifier_quiz.py --executer` sur `demo.html` et les dossiers `generated_quizzes/`, puis un quiz complet dans chaque mode (clair, sombre, fenêtre étroite, avec et sans serveur).
- Les couleurs et polices viennent de la charte : on ne les redéfinit pas ici.

## Historique

- **1.0**, 21 septembre 2026 : création. Neuf types de questions, modes Entraînement et Examen, filtrage par thème, bilan détaillé, mémorisation des scores, vérificateur.
- **2.0**, 22 septembre 2026 : serveur local (Claude Code, exécution du code, archives) ; aide de Claude sur chaque question, correction des questions ouvertes, évaluation détaillée, génération de quiz ; type `code` (SQL, Python, JavaScript, C) et extraits exécutables ; indices ; reprise d'un quiz interrompu ; historique des tentatives ; portail ; réglages des modèles ; styles et scripts découpés en modules.
- **2.1**, 23 septembre 2026 : type `atelier` (questions de modélisation de `_outils/atelier/`) ; extensions du serveur (`/api/<outil>/…`) ; colonne « TD interactifs » du portail ; `QuizApp.pret` ; options `route` et `texteHorsLigne` du panneau de Claude, `hljs` de l'éditeur de code ; `QuizApp.rapports` ; exécution SQL trois fois plus rapide (copie d'une base initialisée).
- **2.2**, 28 septembre 2026 : sur grand écran (72rem et plus), l'en-tête du quiz passe dans une colonne à gauche, qui reste en vue, et la page prend la largeur de la barre du haut ; au-delà de 1 440 px, tout grandit avec la fenêtre (taille de base = largeur / 90), si bien que la page occupe tout l'écran ; cases à cocher, boutons radio et listes déroulantes habillés par la charte (1.6).
- **2.6**, 4 novembre 2026 : le serveur sert les plages d'octets (`Range`) et les types audio et vidéo (`.mp3`, `.m4a`, `.ogg`, `.wav`, `.mp4`, `.webm`) : on peut se déplacer dans une piste et n'en lire qu'un passage (`#t=début,fin`), pour les questions d'écoute en anglais.
- **2.5**, 31 octobre 2026 : langage `c-posix` : le C qui emploie `fork` ou `sigaction` s'exécute dans WSL sous Windows.
- **2.4**, 31 octobre 2026 : `lancer.bat` et `lancer.sh` passent à la racine de `studies` ; application de bureau (`_outils/app/`), qui lance le serveur et l'arrête par un message (`process.send`) ; Claude Code : la version la plus récente est retenue, et non la première trouvée (celle du PATH refusait `--permission-prompts`, et tous les appels à Claude échouaient).
- **2.3**, 29 septembre 2026 : le fil d'Ariane du modèle commence par « studies » (accueil général) ; l'icône maison de la barre, ajoutée par la charte (1.9), mène à l'accueil général ; le bouton du portail, avec le serveur, prend une icône de tableau de bord. L'agrandissement au-delà de 1 440 px vient désormais de la charte (1.10), pour toutes les pages ; le portail prend aussi la largeur de la barre du haut. Mouvement (charte 1.11) : chaque écran du quiz et du portail, la correction, les indices et la réponse modèle arrivent en fondu ; choix et boutons s'enfoncent au clic.
- **2.5**, 12 novembre 2026 : réorganisation ula. Les quiz du catalogue sont dans `explore/<domaine>/<cours>/generated_quizzes/` ; les tentatives s'écrivent dans l'espace du profil actif (`<profil>/<cursus>/<cours>/quiz_results/`, jamais dans `explore/`), et le cours est ajouté au cursus s'il n'y est pas (dossier « Cours suivis »). Le serveur sert la racine des données (le dossier qui contient `_outils`, ou `ULA_RACINE`) et les outils sous `/_outils/` ; `/` mène à l'accueil dynamique (`_outils/ula/accueil.html` : profils, cursus, catalogue) ; un fichier absent d'un cours est cherché dans le dossier de ce cours de l'espace du profil (TP, devoir) ; une page d'un cours non installé renvoie au catalogue. La génération écrit le nouveau quiz dans l'espace du profil, avec des liens depuis la racine du serveur, sans toucher au catalogue. Le portail ne montre que les cours du cursus du profil.
