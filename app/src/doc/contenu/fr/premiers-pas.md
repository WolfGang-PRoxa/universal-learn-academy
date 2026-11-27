# Premiers pas

## Installer

| Système                | Fichier                                       | Installation                                                                                                                                                                  |
| ---------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10 ou 11 (x64) | `Universal-Learn-Academy-Setup-<version>.exe` | Pour l’utilisateur courant, sans droits administrateur. L’application n’étant pas signée, SmartScreen demande « Informations complémentaires », puis « Exécuter quand même ». |
| Linux (x64)            | `Universal-Learn-Academy-<version>.AppImage`  | Rendre le fichier exécutable (`chmod +x`), puis le lancer.                                                                                                                    |

Les versions suivantes s’installent d’elles-mêmes (voir [Mises à jour](page:application#mises-a-jour)).

## Premier lancement

Au tout premier lancement, une petite fenêtre demande la **langue** de l’application. Celle du système est proposée ; les flèches du clavier et Entrée suffisent. Le choix reste modifiable à tout moment.

L’accueil s’ouvre ensuite et demande un **nom d’utilisateur**, prérempli avec celui de la session. C’est le nom du dossier où sera rangé tout le travail de ce profil. Deux options l’accompagnent :

- **Cursus exemple** : range d’un coup les cours d’une formation dans des dossiers (par exemple L1, L2, L3). « Aucun » laisse composer son cursus à la main.
- **Télécharger les cours maintenant** : les cours du cursus se téléchargent en arrière-plan, avec un bandeau de progression sur l’accueil. L’application reste utilisable pendant ce temps.

> **Astuce** Le [paramétrage guidé](guide:) reprend ces choix et ajoute les autres réglages utiles : Claude, taille de l’interface, fenêtre, raccourcis, dossier des données.

## Ajouter des cours

La section **Catalogue en ligne** de l’accueil liste tous les cours disponibles :

1. **Afficher le catalogue**, puis choisir un pack (tous les cours d’un niveau) ou un cours seul.
2. **Télécharger** : le cours est installé sur le poste.
3. L’application propose de le ranger dans un dossier du cursus.

Un cours installé apparaît aussi dans la section **Explorer**, classé par domaine. **Ajouter à mon cursus…** le range dans un dossier.

## Où va le travail

Tout ce qui est produit (tentatives de quiz, TD, TP, suivi) est écrit dans le dossier du profil, à l’intérieur du [dossier des données](parametres:donnees) (`%LOCALAPPDATA%\Universal Learn Academy\donnees` par défaut). Les cours téléchargés restent à part, en lecture seule : une mise à jour ou une suppression d’un cours ne touche jamais au travail.

```
<dossier des données>/
├── explore/<domaine>/<cours>/     cours téléchargés
└── <profil>/<dossier>/<cours>/    lien vers le cours et progression
```
