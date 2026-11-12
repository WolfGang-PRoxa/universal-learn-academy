Tu travailles dans le dépôt studies (dossier courant). Génère un nouveau quiz interactif, à la demande de l'étudiant, depuis l'outil de quiz.

## Demande

{{demande}}

## Quiz de départ

- Page : {{page}}
- Titre : {{titre}}
- {{nb}} questions ; types : {{types}} ; thèmes : {{themes}}

{{tentative}}

## Marche à suivre

1. Lire en entier `_outils/quiz/README.md` et en suivre toutes les règles : format des données, rédaction des questions, vérification des réponses. Pour des questions de type « atelier » (diagrammes, schémas, tables à remplir…), lire aussi `_outils/atelier/README.md` : syntaxes des éditeurs et options.
2. Lire le quiz de départ, puis les pages de cours qu'il couvre, dans `{{matiere}}/generated_courses/`.
3. Écrire le nouveau quiz dans `{{matiere}}/generated_quizzes/`, sous un nom de fichier nouveau et avec un « id » nouveau. Ne jamais modifier ni écraser un quiz existant.
4. Lancer `python _outils/quiz/outils/verifier_quiz.py --executer <fichier>` et corriger jusqu'à zéro erreur.
5. Relier le quiz : l'ajouter à l'accueil de la matière (`{{matiere}}/generated_courses/index.html`, section « Quiz ») et ajouter une balise `<link rel="quiz">` dans l'en-tête de chaque page de cours couverte, comme l'explique le README.
6. Ne pas faire de commit git.
7. Terminer ta réponse par une ligne exactement de cette forme :

FICHIER: {{matiere}}/generated_quizzes/<nom-du-fichier>.html
