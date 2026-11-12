# Charte des cours HTML

Ce dossier fixe **une seule apparence et une seule structure** pour tous les cours que Claude met en forme en HTML à partir des supports de cours : diapos PDF, documents, énoncés de TD et de TP.

Principe : une page de cours ne contient que du contenu balisé avec les composants décrits ici. Toute l'apparence vient de `assets/cours.css`, tout le comportement de `assets/cours.js`. Pour changer le rendu de tous les cours, on modifie ces deux fichiers, jamais une page.

> Pour voir chaque composant rendu, ouvrir `composants.html` dans un navigateur. Le bouton en haut à droite bascule entre thème clair et thème sombre.

## Contenu du dossier

```
_outils/charte/
├── README.md               ce document : règles et marche à suivre
├── composants.html         catalogue visuel de tous les composants (modèle de balisage)
├── assets/
│   ├── cours.css           feuille de style unique : jetons, thèmes, composants
│   └── cours.js            comportements : thème, sommaire, code, maths…
├── modeles/
│   ├── cours.html          squelette d'une page de cours, de TD ou de TP
│   └── index-matiere.html  squelette de la page d'accueil d'une matière
├── outils/
│   ├── verifier.py         contrôle automatique d'une page ou d'un dossier
│   ├── typographie.py      espaces insécables de la typographie française
│   └── index_niveau.py     accueils des niveaux (L1/index.html, L2/…, L3/…) et accueil général (index.html)
└── vendor/                 bibliothèques locales, pour lire les cours hors ligne
    ├── katex/              KaTeX 0.16.47 : formules
    └── highlight/          highlight.js 11.12.0 : coloration du code (+ langues/)
```

## Où ranger les pages produites

| Élément | Emplacement |
|---|---|
| Pages d'une matière | `<Niveau>/<Matière>/generated_courses/`, par exemple `L3/Codage/generated_courses/` |
| Accueil de la matière | `…/generated_courses/index.html`, à partir de `modeles/index-matiere.html` |
| Accueil d'un niveau | `<Niveau>/index.html`, produit par `outils/index_niveau.py` à partir des accueils de matière (jamais modifié à la main) |
| Accueil général | `index.html` à la racine de `studies/` : L1, L2 et L3 et leurs matières, produit par le même outil (jamais modifié à la main) |
| Cours n° N | `cours-NN-<slug>.html`, par exemple `cours-01-hadamard.html` |
| TD ou TP n° N | `td-NN-<slug>.html`, `tp-NN-<slug>.html` |
| Images extraites d'une source | `…/generated_courses/img/<page>-<n>.png` |

- `NN` sur deux chiffres. Le slug est court, en minuscules, sans accents, avec des tirets entre les mots.
- Les sources (PDF, énoncés) restent où elles sont. La page y renvoie par un lien relatif, par exemple `../cours/L3_INFO_C1.pdf`.
- Depuis `<Niveau>/<Matière>/generated_courses/`, la charte se trouve à `../../../_outils/charte/`, et c'est le chemin écrit dans les modèles. À une autre profondeur (par exemple `lycée/Mathématiques/Terminale/generated_courses/`, qui demande `../../../../_outils/charte/`), il faut ajuster le nombre de `../`. `verifier.py` signale un chemin faux.

## Traiter un cours : marche à suivre

1. **Lire toute la source** avant d'écrire.
   - PDF : outil Read, par tranches de 20 pages au plus.
   - Diapos enregistrées en HTML (par exemple `L3/POO/Cours 01 (89 diapos).html`) : le contenu est dans les images `…_files/Diapositive*.png`, à lire une par une.
   - `.docx` : compétence docx.
   - `.gdoc` et `.gslides` : simples raccourcis Google Drive, illisibles sur le disque. Les lire avec le connecteur Google Drive, ou demander un export PDF.
2. **Établir le plan** : regrouper les diapos en parties (h2, de 3 à 8 par page) et en sous-parties (h3), en notant les numéros de diapos de chacune.
3. **Copier le modèle** `modeles/cours.html` à sa place et remplir l'en-tête : matière, titre, source, enseignant, date.
4. **Rédiger** en suivant les règles ci-dessous, avec les composants du tableau « Quel composant pour quel contenu ».
5. **Terminer** par « À retenir » puis « Auto-évaluation ».
6. **Relier la page** : créer ou mettre à jour `index.html` de la matière, et la pagination des chapitres voisins ; puis régénérer les accueils de niveau : `python _outils/charte/outils/index_niveau.py`.
7. **Vérifier** : lancer `python _outils/charte/outils/typographie.py <pages>`, puis `python _outils/charte/outils/verifier.py <page ou dossier>`, qui doit finir sans erreur. Relire aussi les avertissements. Quand c'est possible, ouvrir la page pour contrôler les schémas et les formules.
8. **Rendre compte** : ce qui a été ajouté (blocs Complément), ce qui reste douteux (badges À vérifier), ce qui n'a pas pu être lu.

## Règles de rédaction

### Fidélité à la source

- Tout le contenu de l'enseignant est repris : définitions, propriétés, exemples, schémas, code, remarques. Si quelque chose est omis, on le dit.
- Les puces des diapos deviennent des phrases complètes, reliées entre elles. L'ordre du cours est conservé.
- **Compléter le cours** : quand la source laisse un trou (notion employée sans être définie, diapo trop elliptique, question posée sans réponse, exemple manquant), on ajoute l'explication, l'exemple ou l'exercice qui manque. On reste dans le périmètre du chapitre : on prépare l'examen de ce module, pas un cours plus large.
- **Ce qui ne vient pas de la source doit se voir** : un bloc `complement` pour une explication, un exemple ou un contexte ajouté ; le badge `ajout` en tête d'une phrase ajoutée à l'intérieur d'un bloc issu de la source ; le badge `hors-programme` pour une ouverture au-delà du cours.
- **Dire en tête de page la part de Claude** : quand la source est mince (cours plus accessible d'une année passée, notes personnelles, vidéo non visionnée, poly très condensé) ou que les ajouts font environ un tiers du texte ou plus, les métadonnées de l'en-tête portent une ligne `<div><dt>Part de Claude</dt><dd>…</dd></div>`, juste après la source, qui dit quelle part du texte est de Claude et ce que suit le reste. Quand Claude est la source principale (aucun support de l'enseignant), la ligne Source commence par « Claude, pour l'essentiel », le surtitre porte le badge `<span class="badge ajout">Rédigé par Claude</span>`, le chapeau le dit dès sa première phrase, et l'accueil de la matière l'indique dans le titre du chapitre.
- Dans un exercice, le dépliant s'intitule « Correction » quand la correction vient de l'enseignant, « Solution proposée » quand Claude l'a rédigée.
- Un passage illisible, ambigu ou qui semble faux n'est jamais corrigé en silence. Soit on reprend la source telle quelle, soit on la corrige en citant la version d'origine ; dans les deux cas, badge `a-verifier` et courte explication.
- Chaque h2 indique les diapos qu'il couvre (`<span class="ref">diapos 4–9</span>`). Un bloc peut aussi porter sa référence.
- Ce que l'enseignant annonce comme évalué reçoit le badge `examen`.

### Langue et ton

- Français, registre de cours écrit, tournures impersonnelles (« on »). Ni tutoiement ni vouvoiement.
- Phrases courtes. Un paragraphe porte une seule idée et fait au plus cinq lignes.
- Chaque h2 s'ouvre sur une ou deux phrases qui posent le problème, avant le premier bloc.
- Un terme technique est balisé `<dfn>` à sa première apparition, en français, suivi de l'anglais : `(<span class="en" lang="en">spread spectrum</span>)`. Quand le cours emploie le terme anglais (thread, pipe), on le garde.
- Typographie française : espace insécable avant `: ; ? ! %` et à l'intérieur des guillemets `« »`. On écrit des espaces ordinaires, et `outils/typographie.py` les remplace. Dans le texte, `≈ → × …` plutôt que leurs approximations ASCII.

### Structure d'une page

L'ordre est fixe, c'est celui du modèle :

1. `header.barre` : fil d'Ariane (studies › Niveau › Matière › page), comme dans le modèle. « studies » mène à l'accueil général (`../../../index.html` depuis `generated_courses/`, `generated_quizzes/` ou `annales/`), le niveau à l'accueil du niveau (`../../index.html`). Toute page commence ainsi, y compris les pages d'outils (« studies › Quiz › … ») ; `verifier.py` le contrôle. `cours.js` ajoute à droite une icône maison qui mène au même accueil général (la cible du premier lien du fil) : rien à écrire dans la page.
2. `header.entete` : surtitre, h1, chapeau, métadonnées (`dl.meta`).
3. `div.cadre-intro` : objectifs et prérequis.
4. Les sections numérotées : un `<section>` par h2, avec des h3 si besoin. Un h4 reste rare, et on ne descend jamais plus bas.
5. `h2.sans-numero` « À retenir » : un bloc `retenir` de 5 à 10 points qui se comprennent seuls.
6. `h2.sans-numero` « Auto-évaluation » : de 4 à 8 cartes, qui mêlent définitions, raisonnement et pièges.
7. Facultatif : `h2.sans-numero` « Références », quand la source en cite.
8. `nav.pagination`, puis `footer.pied`. Tant que le chapitre voisin n'existe pas, le lien correspondant pointe vers `index.html` ou est omis.

`cours.js` produit la numérotation, le sommaire, les ancres, la durée de lecture, la barre de progression, le bouton de thème, et l'habillage des blocs de code et des tableaux. On ne les écrit pas à la main.

Quand un quiz porte sur la page (voir `_outils/quiz/README.md`), l'en-tête `<head>` contient `<link rel="quiz" href="../generated_quizzes/quiz-….html" title="Quiz · …">` : `cours.js` ajoute alors un bouton « Quiz » dans la barre, ou un menu s'il y a plusieurs quiz.

Variantes :

- **TD** : le cadre d'introduction devient « Objectifs / Notions utilisées ». Un h2 par exercice ou groupe d'exercices. L'énoncé, fidèle, va dans un bloc `exercice`, suivi du ou des indices et de la correction ou de la solution proposée. « À retenir » rassemble les méthodes.
  - Un TD **interactif** remplace la réponse sur papier par un **atelier** : sous l'énoncé, un `div.atelier` où l'on dessine le diagramme, remplit la table, écrit le SQL… avec contrôles, comparaison à la solution et aide de Claude. Modèle : `_outils/atelier/modele-td.html` ; règles : `_outils/atelier/README.md`. La page charge alors `atelier.css` et `atelier.js`, et se vérifie aussi avec `node _outils/atelier/outils/verifier.js`.
  - Un cours peut aussi contenir un atelier en mode `exemple` (diagramme que l'on manipule) ou `lecture` (diagramme mis en page automatiquement).
- **TP** : le cadre devient « Objectifs / À rendre ». La démarche va dans `ol.etapes`, le code porte `data-fichier`, les commandes vont dans un terminal.

### Quel composant pour quel contenu

| Contenu | Composant |
|---|---|
| Définition d'une notion | `div.bloc.definition` |
| Théorème, propriété, lemme, corollaire | `div.bloc.theoreme`, avec `details.preuve` |
| Exemple, cas concret, application | `div.bloc.exemple` |
| Méthode, algorithme décrit en mots | `div.bloc.methode` |
| Procédure en étapes ordonnées | `ol.etapes` |
| Piège, erreur fréquente, comportement dangereux | `div.bloc.attention` |
| Astuce pratique, raccourci | `div.bloc.astuce` |
| Remarque, précision secondaire | `div.bloc.note` |
| Ajout absent de la source | `div.bloc.complement` |
| Synthèse de fin de page | `div.bloc.retenir` |
| Exercice : énoncé, indice, solution | `div.bloc.exercice`, avec `details.indice` et `details.solution` |
| Comparaison, avantages et limites | `div.colonnes`, avec `div.colonne.pour` / `.contre` |
| Vocabulaire du chapitre | `dl.glossaire` |
| Programme, extrait de code | `<pre><code class="language-…">` |
| Commandes et sortie d'un terminal | `<pre class="terminal"><code>` |
| Algorithme en pseudo-code | `<pre><code class="language-pseudo">` |
| Formule | `\( … \)` en ligne, `\[ … \]` en bloc, `div.encadre` pour un résultat central |
| Schéma relationnel (bases de données) | `div.relations` : une relation par `<p>`, nom en `<b>`, clé primaire en `<u>`, clé étrangère préfixée par `#` |
| Données en lignes et colonnes | `<table>` avec `<caption>` ; variantes `mono`, `centre`, `compact` sur un `div.tableau` |
| Schéma, diagramme | `figure.figure` contenant un `svg.schema` |
| Piste audio ou vidéo fournie (langues : écoute, TOEIC, accents) | `figure.ecoute` : `figcaption` (titre, source en `<small>`), `<audio controls preload="metadata">` (ou `<video controls>`), transcription dans un `details.depliant` ; `#t=début,fin` sur le chemin pour un passage |
| Exercice à faire sur un dessin ou une grille (diagramme de classes, modèle relationnel, table à remplir, automate, arbre de processus, chronogramme, séquence, cas d'utilisation, SQL) ; diagramme de cours que l'on explore | `div.atelier` de l'atelier (`_outils/atelier/README.md`) |
| Digression longue et facultative | `details.depliant` |
| Question de révision | `details.carte` dans `div.cartes` |
| Statut d'un passage | badges `examen`, `hors-programme`, `a-verifier`, `ajout` |
| Renvoi à la source | `span.ref` (« diapo 12 », « p. 4 ») |
| Matière dans une liste (accueil général) | `li` d'`ol.chapitres` avec `data-matiere` et un `span.chapitre-num` vide : pastille de la matière |
| Case à cocher, bouton radio, liste déroulante (outils seulement : quiz, atelier) | `input` et `select` sans classe : la charte les habille |

Le balisage exact de chaque composant est dans `composants.html` : on le copie depuis là. Les plus courants :

```html
<div class="bloc definition">
  <p class="bloc-titre">Définition <span>Nom de la notion</span></p>
  <p>…</p>
</div>

<div class="bloc theoreme">
  <p class="bloc-titre">Propriété <span>Nom</span></p>
  <p>…</p>
  <details class="preuve"><summary>Preuve</summary><p>…</p></details>
</div>

<div class="bloc exercice">
  <p class="bloc-titre">Exercice 2 <span>Titre court</span></p>
  <p>Énoncé fidèle à la source.</p>
  <details class="indice"><summary>Indice</summary><p>…</p></details>
  <details class="solution"><summary>Solution proposée</summary><p>…</p></details>
</div>

<pre data-fichier="main.c"><code class="language-c">#include &lt;stdio.h&gt;
…</code></pre>
```

Le libellé d'un bloc est écrit dans le HTML : `theoreme` sert aussi pour « Lemme » ou « Corollaire », `methode` pour « Algorithme ». Un bloc ne contient ni titre h2–h4 ni autre bloc.

### Code

- Toujours une classe de langage : `c`, `cpp`, `ruby`, `python`, `java`, `sql`, `bash`, `shell`, `makefile`, `javascript`, `html`, `css`, `json`, `yaml`… Pour du texte brut, `language-plaintext`. Pour du pseudo-code, `language-pseudo`, avec les mots-clés en `<b>` et les commentaires en `<i>`.
- Échapper `<`, `>` et `&` en `&lt;`, `&gt;` et `&amp;`. Sinon, `#include <stdio.h>` disparaît de la page.
- Mettre `data-fichier="nom.c"` sur le `<pre>` quand le nom du fichier est connu.
- Le code en ligne (`<code>` dans le texte) sert aux fragments courts : un nom, une clause, une commande brève. Il passe à la ligne sur un écran étroit, mais une requête complète ou un message d'erreur se lit mieux dans un bloc `<pre>`.
- Quand la source donne un programme complet, il reste complet et compilable. Les coupures sont marquées `/* … */`.
- Quand c'est possible, on exécute les exemples avant de les publier, et on reporte les résultats obtenus. Pour le SQL, PostgreSQL tourne sans installation grâce à PGlite (`npm install @electric-sql/pglite` dans le dossier temporaire, puis un petit script Node). Un écart entre la source et l'exécution se signale avec le badge `a-verifier`.
- Dans un terminal, chaque commande commence par `$ ` et la sortie suit telle quelle. Le bouton Copier ne copie que les commandes.
- Langages hors du paquet de base (`x86asm`, `mipsasm`, `armasm`, `ocaml`, `haskell`, `prolog`, `scheme`, `vhdl`, `verilog`, `pgsql`, `powershell`, `dos`, `latex`) : ajouter leur script après `highlight.min.js`, par exemple `<script defer src="../../../_outils/charte/vendor/highlight/langues/x86asm.min.js"></script>`.

### Formules

- Uniquement `\( … \)` et `\[ … \]`. Jamais `$`, qui entre en conflit avec le shell.
- Dans une formule, écrire `\lt`, `\gt`, `\le` et `\ge` plutôt que `<` et `>`, que le navigateur prendrait pour une balise (`a<b`).
- Macros disponibles : `\N \Z \Q \R \C \F` pour les ensembles, `\xor` pour ⊕.
- Un résultat central s'encadre : `<div class="encadre">\[ … \]</div>`.

### Schémas et images

- Redessiner en SVG dans la page plutôt que copier une capture : `<svg class="schema" viewBox="0 0 W H" width="W" role="img" aria-labelledby="…">`, avec un `<title>` qui décrit le schéma.
- Classes de dessin : `boite`, `boite-accent`, `trait`, `pointille`, `accent`, `plein`, `plein-accent`. Classes de texte : `t2` (secondaire), `mono`, `gras`, `accent`. Jamais de couleur en dur, pour que le schéma suive le thème.
- Les identifiants de marqueurs sont uniques dans la page : `fleche-<schéma>`.
- Quand le redessin est impossible (photo, capture d'un logiciel), extraire l'image dans `generated_courses/img/`, avec un `alt` qui dit ce qu'elle montre.

## Teintes des matières

`data-matiere` sur `<html>` donne sa teinte à la page : numéros de sections, liens, sommaire, bloc « À retenir ».

| `data-matiere` | Matière | Teinte |
|---|---|---|
| `codage` | Codage | indigo |
| `bd` | Bases de données | vert |
| `se` | Systèmes d'exploitation, programmation système | orange |
| `poo` | Programmation orientée objet | rubis |
| `anglais` | Anglais | magenta |
| `c` | Langage C | bleu |
| `reseau` | Réseau | cyan |
| `securite` | Sécurité informatique | sarcelle |
| `archi` | Architecture des ordinateurs | ocre |
| `gl` | Génie logiciel | olive |
| `unix` | Unix, shell | vert-jaune |
| `web` | Web | violet |
| `maths` | Mathématiques | pourpre |
| `communication` | Communication, PPP | rose |
| `licence` | Page d'accueil d'un niveau (`L1/index.html`…) | ambre |

Pour une nouvelle matière, ajouter une ligne dans la section 2 de `cours.css`, dans ce tableau et dans le nuancier de `composants.html`.

## Faire évoluer la charte

- Aucune page ne contient `<style>`, d'attribut `style=""` ni de script en ligne. Un besoin nouveau devient un composant de la charte.
- Ajouter un composant : écrire ses règles dans la section adéquate de `cours.css`, un exemple dans `composants.html`, une ligne dans le tableau « Quel composant ». `verifier.py` lit les classes dans `cours.css`, il n'y a rien d'autre à modifier.
- Après toute modification, ouvrir `composants.html` (thème clair, thème sombre, fenêtre étroite, aperçu avant impression), puis relancer `verifier.py` sur les dossiers `generated_courses/` existants.
- Les couleurs sont des jetons OKLCH (section 1 de `cours.css`). Le thème sombre ne redéfinit que les jetons, jamais les composants.
- Le mouvement vient de la charte (section 12 de `cours.css`, bascule du thème dans `cours.js`) : défilement doux, arrivée de l'en-tête, apparition des blocs au défilement, dépliants animés, micro-interactions, fondu entre les pages. Une page n'a rien à écrire pour en profiter. Un nouvel effet va dans cette section, dans `@media screen and (prefers-reduced-motion: no-preference)`, pour qu'il soit coupé à l'impression et quand le système demande moins d'animations ; jamais sur un atelier, dont les dessins sont mesurés par script.
- Les tailles sont en `rem` (ou en `em`), jamais en pixels : au-delà de 1 440 px, la taille de base suit la largeur de la fenêtre (section 4 de `cours.css`), et toute la page grandit d'un bloc. Une taille en pixels ne suivrait pas. Les accueils sans sommaire prennent alors la largeur de la barre du haut, fiches sur plusieurs colonnes ; la colonne de lecture d'un cours garde sa mesure (46rem).
- Mettre à jour les bibliothèques : `npm pack katex @highlightjs/cdn-assets`, puis recopier les mêmes fichiers dans `vendor/`. Pour KaTeX, seules les polices `.woff2` sont conservées.

## Historique

- **1.0**, 21 septembre 2026 : création. Thèmes clair et sombre, 10 types de blocs, code, formules, schémas, modèles, vérificateur.
- **1.1**, 21 septembre 2026 : règle « compléter le cours », composant `relations`, badge `ajout`, section « Références » facultative, outil `typographie.py`.
- **1.2**, 21 septembre 2026 : les pages produites vont dans `<Niveau>/<Matière>/generated_courses/` (et non plus `html/`).
- **1.3**, 21 septembre 2026 : `cours.js` expose `window.Charte` (code, tableaux, liens, formules) pour les autres outils ; `verifier.py` reconnaît les pages de quiz (`_outils/quiz/`) ; section « Quiz » dans le modèle d'accueil d'une matière.
- **1.4**, 22 septembre 2026 : bouton « Quiz » dans la barre d'un cours (`<link rel="quiz">`) ; les `pre.brut` et les éditeurs de code ne sont pas habillés ; `verifier.py` suit les `@import` des feuilles de style et reconnaît le portail des quiz.
- **1.5**, 23 septembre 2026 : le code en ligne passe à la ligne au lieu de déborder de la colonne (téléphone, cartes, colonnes) ; le nuancier renvoie le nom de la matière à la ligne quand la pastille est trop étroite.
- **1.6**, 28 septembre 2026 : contrôles de formulaire des outils (cases à cocher, boutons radio, listes déroulantes) aux couleurs de la charte, liste des options comprise là où le navigateur le permet (`appearance: base-select`).
- **1.7**, 29 septembre 2026 : accueils de niveau (`L1/index.html`, `L2/index.html`, `L3/index.html`) produits par `outils/index_niveau.py`, teinte `licence` ; le niveau du fil d'Ariane de chaque page y renvoie.
- **1.8**, 29 septembre 2026 : accueil général (`index.html` à la racine), produit par le même outil : L3, L2 et L1 et leurs matières, résumé de ce qui est mis en forme ; « studies » en tête du fil d'Ariane des accueils de niveau et des pages d'outils y renvoie ; un `span.chapitre-num` vide affiche la pastille de la matière ; les dossiers `annales/` et `Annales/` ne sont plus comptés deux fois sous Windows.
- **1.9**, 29 septembre 2026 : le fil d'Ariane de toutes les pages commence par « studies », lien vers l'accueil général (modèles et pages existantes), et `verifier.py` l'exige ; icône maison à droite de la barre, ajoutée par `cours.js` ; sur une fenêtre étroite, les maillons longs se raccourcissent et, sur téléphone, la page courante (le titre juste en dessous) laisse la place aux autres ; `verifier.py` ignore les pages non UTF-8 d'un dossier parcouru.
- **1.10**, 29 septembre 2026 : au-delà de 1 440 px, toutes les pages grandissent avec la fenêtre (taille de base = largeur / 90, à l'écran seulement), et non plus les seuls quiz et accueil général ; sur grand écran, les accueils de matière prennent la largeur de la barre du haut, fiches sur deux colonnes, de même hauteur par rangée.
- **1.11**, 29 septembre 2026 : mouvement (section 12 de `cours.css`) : défilement doux sur toutes les pages, en-tête qui monte en fondu à l'arrivée, blocs, figures, tableaux et fiches qui apparaissent au défilement (animation liée au défilement, sans script), dépliants qui s'ouvrent en douceur, survol des fiches et des liens, boutons qui s'enfoncent, fondu enchaîné entre les pages (serveur local), bascule du thème en cercle depuis le bouton (`cours.js`) ; tout est coupé à l'impression et si le système réduit les animations.
- **1.12**, 16 octobre 2026 : teinte `gl` (génie logiciel, olive, 108°), entre `archi` et `unix`.
- **1.13**, 31 octobre 2026 : boutons Précédent et Suivant à gauche du fil d'Ariane, dans l'application de bureau seulement (`_outils/app/`) ; rien ne change dans un navigateur.
- **1.14**, 4 novembre 2026 : composant `ecoute` (piste audio ou vidéo de l'enseignant, légende, transcription dépliable), pour les cours et les quiz d'anglais ; le lecteur est masqué à l'impression.
- **1.15**, 4 novembre 2026 : teinte `securite` (sécurité informatique, sarcelle, 181°), entre `bd` et `reseau`.
- **1.16**, 9 novembre 2026 : ligne « Part de Claude » dans l'en-tête des pages à source mince ou très complétées, badge « Rédigé par Claude » quand Claude est la source principale.
- **1.6**, 23 septembre 2026 : TD interactifs et exemples manipulables avec l'atelier (`_outils/atelier/`) : ligne du tableau « Quel composant », variante TD ; `verifier.py` reconnaît les pages de l'atelier et ignore les modèles quand il parcourt un dossier.
