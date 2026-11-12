# Polycopiés de synthèse en PDF

Certains cours n'existent que sous forme de diapos (en images, ou trop longues à relire). On en tire alors un **polycopié de synthèse** en PDF A4, rangé à côté des sources du cours : c'est le cas des cours de POO (`explore/informatique/programmation-objet/cours/00 - … .pdf` à `04 - … .pdf`).

Mise en page commune (celle des cours 0 à 3 de POO) : couverture avec bandeau, sommaire, sections numérotées, encadrés (définition, remarque, à retenir, attention), tableaux à en-tête foncé, code Ruby colorié, en-tête courant et pagination « n / N ». Les compléments et les écarts avec le support sont signalés comme tels (« (complément) », « Remarque — écart avec le support »).

## Contenu

```
_outils/polycopies/
├── README.md        ce document
├── polycopie.css    la mise en page
├── imprimer.js      imprime une source en PDF (Playwright)
└── sources/         une source HTML par polycopié, au chemin du dossier du cours
    └── explore/informatique/programmation-objet/04 - Manipuler des données.html  →  explore/informatique/programmation-objet/cours/04 - Manipuler des données.pdf
```

Les polycopiés des cours 0 à 3 de POO ont été produits avant cet outil : leurs sources n'existent pas ici.

## Imprimer

Depuis la racine (`ula/`) :

```
node _outils/polycopies/imprimer.js "_outils/polycopies/sources/L3/POO/04 - Manipuler des données.html" "explore/informatique/programmation-objet/cours/04 - Manipuler des données.pdf"
```

Sous Windows, le script imprime avec Microsoft Edge, qui a les polices des cours 0 à 3 (Segoe UI, Cambria, Cascadia Mono). Sous Linux (session cloud), Chromium prend les polices de remplacement de `polycopie.css` : Inter, Caladea (mêmes métriques que Cambria) et JetBrains Mono ; la mise en page est la même, le rendu un peu différent.

## Écrire une source

- L'en-tête courant se déclare dans la source : `@page { @top-left { content: "Introduction à la programmation objet · Cours 4 — Manipuler des données"; } }`, suivi de `@page couverture { @top-left { content: none; } }` pour la couverture.
- Composants : `section.couverture`, `section.sommaire`, `h1.section` (avec `span.num`), `h2.sous-section`, `h3.titre`, `div.encadre` (`definition`, `methode`, `retenir`, `attention`, ou rien pour une remarque) avec `p.etiquette`, `div.code` (`div.entete`, `pre`, classes de coloration `k c s n v t y`), `div.code.sortie`, `table`, `div.colonnes`, `figure`.
- La source du cours 4 a été produite à partir de la page `explore/informatique/programmation-objet/generated_courses/cours-04-manipuler-des-donnees.html` (contenu vérifié en Ruby 3.4) : corriger l'une, c'est penser à l'autre.
