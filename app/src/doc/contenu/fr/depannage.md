# Dépannage

## L’accueil affiche « Le serveur local ne répond pas »

Le serveur local démarre avec l’application. Recharger la page (**F5**). Si le message reste, redémarrer l’application ([Paramètres › À propos](parametres:a-propos) › Redémarrer).

## Un cours ne se télécharge pas

- Vérifier la connexion à Internet, puis **Actualiser** le catalogue.
- Relancer le téléchargement : un pack ou « Tout télécharger » reprend seulement les cours manquants.
- Tant que le dépôt des versions est privé, seule une session GitHub CLI connectée sur le poste (`gh auth login`) permet de lire le catalogue.

## Claude ne répond pas

Voir [Claude](page:claude#si-claude-ne-repond-pas).

## La mise à jour ne s’installe pas

Une version téléchargée s’installe à la fermeture de l’application : passer par **Quitter** (icône de la zone de notification, ou **Ctrl+Q**) plutôt que par la croix, qui ne fait que cacher la fenêtre. **Redémarrer et installer** l’applique tout de suite.

## La synchronisation échoue

| Message                  | Que faire                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Accès refusé             | Lancer une fois `git pull` à la main dans le dossier des données pour enregistrer les identifiants |
| Hors ligne               | Rien : nouvel essai au cycle suivant                                                               |
| Fusion à faire à la main | Ouvrir le dossier des données et lancer `git pull`, puis résoudre le conflit                       |
| Git n’est pas installé   | L’installer depuis git-scm.com                                                                     |

## La fenêtre s’ouvre hors de l’écran

Si l’emplacement mémorisé n’est plus visible, la fenêtre s’ouvre agrandie. Sinon, choisir **Grande fenêtre** dans [Paramètres › Fenêtre](parametres:fenetre).

## Le défilement se fige

L’application tient un journal des blocages, `gels.log`, dans le dossier des journaux ([Paramètres › À propos](parametres:a-propos) › Ouvrir le dossier des journaux). Le joindre à un signalement aide à trouver la cause.

## Tout remettre à zéro

Les paramètres sont dans `parametres.json`, dans le dossier des paramètres (voir [Fichiers et dossiers](page:fichiers)). Supprimer ce fichier, application fermée, rétablit tous les réglages par défaut ; la langue est alors redemandée au lancement. Les cours et le travail ne sont pas touchés.
