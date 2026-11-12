# Universal Learn Academy

Des cours mis en forme en pages HTML, des quiz et des TD interactifs, avec un serveur local qui fait tourner les quiz, exécute le code des questions (SQL, Python, C, JavaScript) et fait appel à Claude pour l'aide, la correction et la génération de nouveaux quiz. Le catalogue de départ vient d'une licence informatique (Le Mans Université) : informatique, mathématiques, langues.

## Télécharger l'application

| Système | Fichier de la [dernière version](https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/latest) |
|---|---|
| Windows 10 ou 11 (x64) | `Universal-Learn-Academy-Setup-<version>.exe` : installation pour l'utilisateur courant, sans droits administrateur. L'application n'est pas signée : SmartScreen demande « Informations complémentaires », puis « Exécuter quand même ». |
| Linux (x64) | `Universal-Learn-Academy-<version>.AppImage` : le rendre exécutable (`chmod +x`), puis le lancer. |

L'installeur ne contient que l'application et ses outils (environ 130 Mo). Les cours se téléchargent ensuite à la demande, un par un ou par pack de niveau (par exemple tout le pack « Licence 1 informatique » d'un coup), depuis l'accueil (« Catalogue en ligne ») : ils viennent de la release [`catalogue`](https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/catalogue) de ce dépôt, et leur empreinte est vérifiée avant l'installation.

L'application se met à jour d'elle-même au démarrage (option dans ses paramètres). Ses paramètres permettent aussi de choisir son profil et le dossier des données, de régler la fenêtre au lancement, de créer des raccourcis et de connecter Claude.

## Profils et cursus

Au premier lancement, l'application demande un nom d'utilisateur (celui de la session est proposé). Plusieurs profils peuvent partager un poste. Chacun range les cours du catalogue dans son cursus, avec les dossiers qu'il veut (L1, L2, Prépa, Perso…) : un cours y est un lien, et sa progression (tentatives, TD, TP, suivi) s'enregistre à côté, dans le dossier du profil. Une mise à jour d'un cours ne touche jamais au travail.

```
ULA/                         (Documents/ULA par défaut)
├── explore/<domaine>/<cours>/   cours téléchargés, en lecture seule
└── <profil>/<cursus>/<cours>/   lien vers le cours et progression
```

Un cours fait par soi-même (pages générées dans son espace) se propose au catalogue depuis l'accueil : l'application prépare une archive des seules pages générées, sans sources d'enseignants ni données personnelles, et ouvre une issue préremplie de ce dépôt, à laquelle on joint l'archive.

## Connexion à Claude

L'application n'embarque aucun compte. Chaque utilisateur choisit dans les paramètres :

- **son compte Claude, via Claude Code** : installer [Claude Code](https://code.claude.com/docs/en/setup), puis s'y connecter (bouton « Se connecter… ») ; la connexion se fait chez Anthropic ;
- **sa propre clé d'API Anthropic**, chiffrée sur son poste ; l'usage est facturé à cette clé.

Sans Claude, les cours, les TD et les quiz s'affichent ; seules l'aide, la correction des réponses rédigées et la génération de quiz demandent Claude.

## Sans installation

Avec [Node.js](https://nodejs.org) 22 ou plus récent, depuis un clone de ce dépôt (qui contient tout le catalogue) :

- `lancer.bat` (Windows) ou `lancer.sh` : serveur local et accueil dans le navigateur ;
- `lancer-app.bat` ou `lancer-app.sh` : les mêmes pages dans une fenêtre d'application.

L'accueil demande alors son profil, créé à la racine du clone.

## Contenu

- `explore/<domaine>/<cours>/` : le catalogue ; pour chaque cours, sa fiche `ula-cours.json`, `generated_courses/` (cours, TD et TP mis en forme), `generated_quizzes/`, et les supports d'origine (`cours/`, `TD/`, `TP/`, `annales/`) ;
- `_outils/` : charte des pages, outil de quiz et son serveur, atelier des TD interactifs, suivi, et `ula/` (profils, cursus, catalogue) ;
- `app/` : l'application de bureau (Electron), voir `app/README.md`.

Les supports d'origine (polycopiés, diapositives, sujets de TD et de TP, annales) appartiennent à leurs auteurs, enseignants de Le Mans Université.

Ce dépôt est produit à partir d'un dépôt de travail privé : il ne contient que le contenu publiable (ni espace personnel, ni tentatives aux quiz, ni travail dans les TD et les TP), et les fichiers de TP y sont dans leur version d'origine.
