# Studies

Cours, quiz et TD interactifs de licence informatique (Le Mans Université), mis en forme en pages HTML, avec un serveur local qui fait tourner les quiz, exécute le code des questions (SQL, Python, C, JavaScript) et fait appel à Claude pour l'aide, la correction et la génération de nouveaux quiz.

## Télécharger l'application

| Système | Fichier de la [dernière version](https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/latest) |
|---|---|
| Windows 10 ou 11 (x64) | `Studies-Setup-<version>.exe` : installation pour l'utilisateur courant, sans droits administrateur. L'application n'est pas signée : SmartScreen demande « Informations complémentaires », puis « Exécuter quand même ». |
| Linux (x64) | `Studies-<version>.AppImage` : le rendre exécutable (`chmod +x`), puis le lancer. |

L'application se met à jour d'elle-même au démarrage (option dans ses paramètres). Ses paramètres permettent aussi de régler la fenêtre au lancement, de créer des raccourcis et de connecter Claude.

## Connexion à Claude

Studies n'embarque aucun compte. Chaque utilisateur choisit dans les paramètres :

- **son compte Claude, via Claude Code** : installer [Claude Code](https://code.claude.com/docs/en/setup), puis s'y connecter (bouton « Se connecter… ») ; la connexion se fait chez Anthropic ;
- **sa propre clé d'API Anthropic**, chiffrée sur son poste ; l'usage est facturé à cette clé.

Sans Claude, les cours, les TD et les quiz s'affichent ; seules l'aide, la correction des réponses rédigées et la génération de quiz demandent Claude.

## Sans installation

Avec [Node.js](https://nodejs.org) 22 ou plus récent, depuis un clone de ce dépôt :

- `lancer.bat` (Windows) ou `lancer.sh` : serveur local et portail dans le navigateur ;
- `lancer-app.bat` ou `lancer-app.sh` : les mêmes pages dans une fenêtre d'application.

## Contenu

- `L1/`, `L2/`, `L3/` : une matière par dossier ; `generated_courses/` (cours, TD et TP mis en forme), `generated_quizzes/`, et les supports d'origine (`cours/`, `TD/`, `TP/`, `annales/`) ;
- `_outils/` : charte des pages, outil de quiz et son serveur, atelier des TD interactifs, suivi ;
- `app/` : l'application de bureau (Electron), voir `app/README.md`.

Les supports d'origine (polycopiés, diapositives, sujets de TD et de TP, annales) appartiennent à leurs auteurs, enseignants de Le Mans Université.

Ce dépôt est produit à partir d'un dépôt de travail privé : il ne contient que le contenu publiable (ni tentatives aux quiz, ni travail personnel dans les TD et les TP), et les fichiers de TP y sont dans leur version d'origine.
