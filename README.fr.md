**Français** · [English](README.md)

# Universal Learn Academy

Des cours mis en forme en pages HTML, des quiz et des TD interactifs, avec un serveur local qui fait tourner les quiz, exécute le code des questions (SQL, Python, C, JavaScript) et fait appel à Claude pour l'aide, la correction et la génération de nouveaux quiz. Le catalogue de départ vient d'une licence informatique (Le Mans Université) : informatique, mathématiques, langues. L'application est en français ou en anglais, au choix.

## Télécharger l'application

| Système                | Fichier de la [dernière version](https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/latest)                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10 ou 11 (x64) | `Universal-Learn-Academy-Setup-<version>.exe` : installation pour l'utilisateur courant, sans droits administrateur. L'application n'est pas signée : SmartScreen demande « Informations complémentaires », puis « Exécuter quand même ». |
| Linux (x64)            | `Universal-Learn-Academy-<version>.AppImage` : le rendre exécutable (`chmod +x`), puis le lancer.                                                                                                                                         |

L'installeur ne contient que l'application et ses outils (environ 130 Mo). Les cours se téléchargent ensuite à la demande, un par un ou par pack de niveau (par exemple tout le pack « Licence 1 informatique » d'un coup), depuis l'accueil (« Catalogue en ligne ») : ils viennent de la release [`catalogue`](https://github.com/WolfGang-PRoxa/universal-learn-academy/releases/tag/catalogue) de ce dépôt, et leur empreinte est vérifiée avant l'installation.

Fermer la fenêtre garde l'application en arrière-plan, avec son icône dans la zone de notification (clic pour la rouvrir, clic droit › Quitter pour la quitter ; réglable). Ses paramètres permettent aussi de choisir la langue, son profil et le dossier des données, de régler la fenêtre au lancement, de créer des raccourcis et de connecter Claude. Une documentation intégrée (F1) et un paramétrage guidé accompagnent le premier lancement.

## Mises à jour

L'application se met à jour d'elle-même : nouvelle version cherchée au démarrage puis toutes les 6 heures, téléchargée en arrière-plan et installée en quittant l'application ; « Redémarrer et installer » l'applique tout de suite. Le réglage est dans Paramètres › Mises à jour. Les cours ne dépendent pas des versions de l'application : un cours nouveau ou corrigé apparaît dans le catalogue de l'accueil (« Mise à jour disponible »). Les changements de chaque version sont notés dans [CHANGELOG.fr.md](CHANGELOG.fr.md).

## Profils, cursus et emplacement des données

Au premier lancement, l'application demande la langue, puis un nom d'utilisateur (celui de la session est proposé) et propose un cursus exemple : « Informatique » range d'un coup les trois années de licence dans les dossiers L1, L2 et L3, et peut télécharger tous leurs cours en arrière-plan. Plusieurs profils peuvent partager un poste. Chacun range les cours du catalogue dans son cursus, avec les dossiers qu'il veut (L1, L2, Prépa, Perso…) : un cours y est un lien, et sa progression (tentatives, TD, TP, suivi) s'enregistre à côté, dans le dossier du profil. Une mise à jour d'un cours ne touche jamais au travail.

```
donnees/                     (%LOCALAPPDATA%\Universal Learn Academy\donnees par défaut, modifiable ou déplaçable dans les paramètres)
├── explore/<domaine>/<cours>/   cours téléchargés, en lecture seule
└── <profil>/<cursus>/<cours>/   lien vers le cours et progression
```

Les paramètres sont dans `%APPDATA%\Universal Learn Academy` (`~/.config/Universal Learn Academy` sous Linux) et sont conservés à la désinstallation ; la copie locale des outils est dans `%LOCALAPPDATA%\Universal Learn Academy\outils` (`~/.local/share/Universal Learn Academy/outils`).

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

## Développement

Le code de l'application est dans `app/` (Electron) ; sa documentation technique est dans [app/README.fr.md](app/README.fr.md).

```bash
cd app
npm ci          # installe les dépendances
npm start       # lance l'application
npm run check   # Prettier et ESLint, puis vérifications : syntaxe, traductions et documentation, règles de contenu, synchro, raccourcis
npm test        # tests automatisés
npm run dist    # construit l'installeur Windows et l'AppImage dans dist/
```

Ce dépôt est produit à partir d'un dépôt de travail privé, par un script : il ne contient que le contenu publiable (ni espace personnel, ni tentatives aux quiz, ni travail dans les TD et les TP), et les fichiers de TP y sont dans leur version d'origine. Les modifications ne s'y font donc pas directement.

## Contenu

- `explore/<domaine>/<cours>/` : le catalogue ; pour chaque cours, sa fiche `ula-cours.json`, `generated_courses/` (cours, TD et TP mis en forme), `generated_quizzes/`, et les supports d'origine (`cours/`, `TD/`, `TP/`, `annales/`) ;
- `_outils/` : charte des pages, outil de quiz et son serveur, atelier des TD interactifs, suivi, et `ula/` (profils, cursus, catalogue) ;
- `app/` : l'application de bureau (Electron).

## Licence

Universal Learn Academy © 2026 WolfGang-PRoxa, sous licence [CC BY-NC-ND 4.0](LICENSE) (Attribution, Pas d'utilisation commerciale, Pas de modification). Les supports d'origine (polycopiés, diapositives, sujets de TD et de TP, annales) appartiennent à leurs auteurs, enseignants de Le Mans Université, et ne sont pas couverts par cette licence.
