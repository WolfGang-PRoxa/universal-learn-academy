# Numérisation des scans

Un document papier scanné (photographié au téléphone, le plus souvent) ne reste pas une image : on le **numérise**.

- Un **énoncé** ou un **polycopié** est recomposé en vrai PDF, comme celui que l'enseignant a imprimé : texte sélectionnable, mêmes polices, même mise en page, mêmes coupures de ligne. Le PDF recomposé prend la place du scan, au même chemin, et le scan est archivé ici.
- Les **réponses écrites à la main** (sur l'énoncé, sur une feuille de brouillon) sont saisies dans le TD interactif de la page, avec l'atelier : voir `_outils/atelier/README.md`, « Travail fait sur papier ». Elles ne vont jamais dans le PDF recomposé, qui reste l'original vierge.

## Règles de fidélité

1. **Le texte de l'original, tel quel** : fautes d'orthographe, coquilles, ponctuation, apostrophes droites ou typographiques, majuscules. On ne corrige rien dans le PDF (les pages HTML du cours ou du TD, elles, corrigent les fautes évidentes).
2. **La même mise en page** : format (A4 portrait ou paysage, deux pages par feuille), marges, polices (Times New Roman, Arial, Courier New, Calibri…), corps, interligne, gras et italiques, cadres, tableaux, figures redessinées en vectoriel. Chaque ligne de l'original fait une ligne du PDF (`#fl` force une fin de ligne justifiée).
3. **Des mesures, pas des estimations** : les positions et les corps se mesurent sur le scan (redressé, ramené à l'échelle de la page) ; ce qu'une photo ne dit pas (épaisseur d'un trait, police exacte) se lit sur un PDF d'origine du même enseignant, quand il y en a un.
4. **Les réponses de l'étudiant n'y figurent pas** : une feuille de réponse (chronogrammes, graphes d'activités) est recomposée vierge.
5. Ce qui est illisible ou coupé sur le scan est signalé en commentaire dans la source, jamais inventé.

## Contenu du dossier

```
_outils/numerisation/
├── README.md          ce document
├── compiler.py        compile les sources en PDF, vérifie, produit des aperçus
├── gabarits/          mises en page communes, une par enseignant ou par série
│   ├── carlier.typ    sujets de TD de codage (F. Carlier)
│   └── poo.typ        TD de POO (P. Jacoboni, E. Delozanne) : livret A4 paysage, figure de la file circulaire
├── sources/           une source Typst par document, au chemin du PDF qu'elle produit
│   └── explore/informatique/codage/TD/TD1/TD1.typ  →  explore/informatique/codage/TD/TD1/TD1.pdf
└── scans/             les scans d'origine, archivés au même chemin que le PDF recomposé
```

Les sources sont écrites en [Typst](https://typst.app/docs/), un langage de composition sans installation : `uvx` télécharge le paquet Python `typst` au premier appel. Ni LaTeX ni pandoc ne sont nécessaires.

## Commandes

Depuis la racine (`ula/`) :

| Commande                                                                                              | Effet                                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `uvx --with typst python _outils/numerisation/compiler.py`                                            | compile toutes les sources ; chaque PDF va à son chemin dans le dossier du cours                                        |
| `uvx --with typst python _outils/numerisation/compiler.py _outils/numerisation/sources/L3/Codage`     | compile les sources d'un dossier (ou une source `.typ`)                                                                 |
| `uvx --with typst python _outils/numerisation/compiler.py --verifier`                                 | n'écrit rien : signale les PDF absents ou différents de leur source                                                     |
| `uvx --with typst --with pymupdf python _outils/numerisation/compiler.py --apercu DOSSIER SOURCE.typ` | écrit dans DOSSIER le PDF, une image par page et une planche « scan \| PDF » par page, sans toucher au dossier du cours |

Le compilateur refuse d'écraser un PDF qui ne vient pas de Typst : c'est sans doute le scan, à archiver d'abord dans `scans/`. Les PDF sont déterministes (pas de date dans les métadonnées) : `--verifier` compare les octets. Leurs métadonnées portent le titre, l'auteur et les mots-clés « recomposé d'après un scan, _outils/numerisation ».

## Numériser un nouveau scan : marche à suivre

1. **Archiver le scan** : le déplacer dans `scans/`, au même chemin relatif (`git mv` s'il est déjà suivi).
2. **Lire le scan en entier**, redressé et agrandi (PyMuPDF et Pillow : image native de la page, rotation, moitiés de page ; voir la note de mémoire sur les scans au téléphone). Séparer l'imprimé de ce qui est écrit à la main.
3. **Écrire la source** dans `sources/`, à partir d'un gabarit s'il en existe un pour cet enseignant (sinon en créer un dans `gabarits/` dès qu'un deuxième document le partagerait). Recopier le texte ligne par ligne, puis caler la mise en page par mesures.
4. **Comparer** avec `--apercu` jusqu'à ce que la planche « scan | PDF » se superpose ligne à ligne.
5. **Compiler** à la place définitive, puis `--verifier`.
6. **Les réponses manuscrites** : les saisir dans le TD interactif (`papier`), puis `node _outils/atelier/outils/saisir.js <page>`.
7. **Suivi** : cocher l'élément dans `TODO.md`, section « Numérisation des scans ».

## Documents numérisés

| PDF                                                          | Source                                             | Remarque                                                                                                                |
| ------------------------------------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `explore/informatique/codage/TD/TD1/TD1.pdf`                 | `sources/L3/Codage/TD/TD1/TD1.typ`                 | énoncé (11 pt) et feuille des chronogrammes vierge, en paysage                                                          |
| `explore/informatique/codage/TD/TD2/TD2.pdf`                 | `sources/L3/Codage/TD/TD2/TD2.typ`                 | 10 pt ; la copie papier était une impression réduite                                                                    |
| `explore/informatique/codage/TD/TD3/TD3_codes_cycliques.pdf` | `sources/L3/Codage/TD/TD3/TD3_codes_cycliques.typ` | sujet de 2018, matrice G redessinée                                                                                     |
| `explore/informatique/codage/TD/TD4/TD4_real_time.pdf`       | `sources/L3/Codage/TD/TD4/TD4_real_time.typ`       | 12 pt, figure des tâches redessinée, feuille des graphes d'activités vierge                                             |
| `explore/informatique/programmation-objet/TD/TD1/TD1.pdf`    | `sources/L3/POO/TD/TD1/TD1.typ`                    | livret : deux feuilles A4 paysage, deux pages réduites par face (sujets 1 à 4 ; rappels de syntaxe et extraits de `ri`) |
| `explore/informatique/programmation-objet/TD/TD2/TD2.pdf`    | `sources/L3/POO/TD/TD2/TD2.typ`                    | 2 pages A4 ; la première ligne d'en-tête, coupée sur la photo, est restituée                                            |

Les réponses manuscrites des TD 1 et 2 de codage et des TD 1 et 2 de POO sont saisies dans leurs TD interactifs (`generated_courses/td-0N-….html`, enregistrées dans `td_results/`).

## Historique

- **1.0**, 2 octobre 2026 : création, pour les scans du 1er octobre. Compilation Typst par `uvx`, gabarit des sujets de codage, quatre sujets recomposés.
- **1.1**, 9 octobre 2026 : ce README ; les réponses manuscrites passent par le champ `papier` de l'atelier (version 1.5) et `_outils/atelier/outils/saisir.js`. Gabarit des TD de POO ; les TD 1 et 2 de POO et le polycopié de programmation système recomposés : tous les scans du 1er octobre sont numérisés.
- **1.2**, 31 octobre 2026 : l'original du polycopié de programmation système, récupéré sur UMTICE (`L3/SE_PS/cours/cours_processus.pdf`), remplace sa recomposition, retirée avec sa source. Le scan reste archivé.
- **1.3**, 12 novembre 2026 : réorganisation ula. Les sources et les scans suivent les nouveaux chemins des cours (`sources/explore/<domaine>/<cours>/…` produit `explore/<domaine>/<cours>/…`).
