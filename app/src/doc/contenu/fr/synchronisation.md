# Synchronisation

Pour retrouver ses cours et sa progression d’un PC à l’autre, deux possibilités existent.

## Un dossier déjà synchronisé

Le plus simple : choisir comme [dossier des données](parametres:donnees) un dossier déjà synchronisé par OneDrive, Google Drive, Dropbox ou pCloud. Le même dossier est alors choisi sur chaque PC.

> **Attention** Éviter d’utiliser l’application en même temps sur deux PC avec ce mode : le service de synchronisation ne sait pas fusionner deux versions d’une même tentative.

## Un dépôt Git

Quand le dossier des données est un dépôt Git relié à un dépôt distant (GitHub…), l’application propose une fois de le synchroniser automatiquement. Le réglage reste ensuite dans [Paramètres › Synchronisation](parametres:synchro).

Activée, la synchronisation a lieu :

- quelques secondes après le lancement ;
- toutes les 30 minutes, même fenêtre fermée ;
- au réveil du PC ;
- à la fermeture de l’application.

**Synchroniser maintenant** est disponible par le bouton nuage de la barre du haut, le menu de l’icône de la zone de notification et la carte Synchronisation.

| Pastille du nuage | Signification                        |
| ----------------- | ------------------------------------ |
| Verte             | À jour                               |
| Bleue             | Synchronisation en cours             |
| Rouge             | Problème : un clic ouvre les détails |

### Mettre en place un dépôt

1. Installer Git et se connecter une fois au dépôt distant (Git Credential Manager, GitHub CLI ou clé SSH).
2. Dans le dossier des données : `git init`, un fichier `.gitignore` qui contient la ligne `explore/` (le catalogue se retélécharge), `git remote add origin <adresse>`, un premier commit, puis `git push -u origin main`.
3. Relancer l’application : elle reconnaît le dépôt et propose la synchronisation.

Sur un autre PC, cloner le dépôt puis le choisir comme dossier des données.

### Conflits

Quand un même fichier a changé sur deux PC entre deux synchronisations :

- le travail des TD est fusionné atelier par atelier, et une tentative de quiz garde sa version la plus récente ;
- pour un autre fichier, la version locale reste et l’autre est enregistrée à côté (`nom (conflit <date>).ext`), avec une notification.

L’application ne demande ni ne garde aucun identifiant : Git utilise ceux déjà enregistrés sur le poste. Les détails techniques sont dans [Synchronisation (technique)](page:synchro-technique).
