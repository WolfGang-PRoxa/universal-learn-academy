Tu travailles dans la racine des données d'Universal Learn Academy (dossier courant : catalogue `explore/` et espaces des profils). Génère un nouveau quiz interactif, à la demande de l'étudiant, depuis l'outil de quiz.

## Demande

{{demande}}

## Quiz de départ

- Page : {{page}}
- Titre : {{titre}}
- {{nb}} questions ; types : {{types}} ; thèmes : {{themes}}

{{tentative}}

## Marche à suivre

1. Lire en entier `{{outils}}/quiz/README.md` et en suivre toutes les règles : format des données, rédaction des questions, vérification des réponses. Pour des questions de type « atelier » (diagrammes, schémas, tables à remplir…), lire aussi `{{outils}}/atelier/README.md` : syntaxes des éditeurs et options.
2. Lire le quiz de départ, puis les pages de cours qu'il couvre, dans `{{matiere}}/generated_courses/`.
   L'étudiant navigue librement entre les questions, dans n'importe quel ordre : chaque question doit se comprendre seule. Jamais de renvoi à une autre question (« la question précédente », « même urne », « avec le même code »…) ; quand plusieurs questions portent sur les mêmes données, chacune les redonne en entier.
3. Écrire le nouveau quiz dans `{{sortie}}/` (l'espace de l'étudiant : jamais dans `explore/`), sous un nom de fichier nouveau et avec un « id » nouveau. Ne jamais modifier ni écraser un quiz existant, ni aucun fichier de `explore/`.
4. Ce dossier peut être déplacé par l'étudiant : dans le nouveau quiz, tous les liens partent de la racine du serveur, avec une barre oblique au début. Feuilles de style et scripts : `/_outils/charte/…`, `/_outils/quiz/…` (au lieu de `../../../../_outils/…`) ; liens « revoir » vers les cours : `/{{matiere}}/generated_courses/<page>.html#<ancre>` ; fil d'Ariane : `<a href="/index.html">ULA</a>`, `<a href="{{domaine}}">` (domaine), `<a href="{{accueil}}">` (cours).
5. Lancer `python {{outils}}/quiz/outils/verifier_quiz.py --executer <fichier>` et corriger jusqu'à zéro erreur.
6. Ne pas modifier l'accueil du cours ni les pages de cours (le portail et l'accueil listent tout seuls les quiz de l'étudiant). Ne pas faire de commit git.
7. Terminer ta réponse par une ligne exactement de cette forme :

FICHIER: {{sortie}}/<nom-du-fichier>.html
