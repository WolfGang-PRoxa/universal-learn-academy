# Cours, cursus et quiz

## L’accueil

L’accueil (**Alt+Origine**, ou bouton maison de la barre du haut) réunit, de haut en bas :

| Section | Contenu |
|---|---|
| Profil | Le profil actif, le changement de profil, la création et le renommage |
| Mon cursus | Les dossiers du cursus et leurs cours, avec la progression de chacun |
| Explorer | Les cours installés sur ce poste, par domaine |
| Catalogue en ligne | Les cursus exemples, les packs et tous les cours à télécharger |
| Outils | Révisions, suivi, compilation C, notebooks Python, démonstrations |

## Le cursus

Le cursus est une arborescence libre de dossiers : L1, L2, Prépa, Perso… Chaque cours y est un **lien** vers le cours installé, pas une copie. La progression se range à côté du lien, si bien qu’un même cours peut être dans « L2 » pour un profil et dans « Réorientation » pour un autre.

Le bouton **⋯** d’un dossier ou d’un cours ouvre ses actions :

- **Ajouter un cours…** et **Nouveau sous-dossier…** (dossiers) ;
- **Renommer…** et **Déplacer…** ;
- **Retirer…** : un cours qui contient du travail ne peut pas être retiré, il faut le déplacer ; seul un dossier vide peut l’être ;
- **Ouvrir le dossier** dans l’explorateur de fichiers.

Un cours du cursus qui n’est pas encore installé affiche « à télécharger » : un clic le télécharge. **Tout télécharger** récupère tous les cours manquants d’un coup.

## Le catalogue

- **Cursus exemples** : plusieurs packs rangés dans des dossiers. **Ajouter à mon cursus…** crée les dossiers et les liens ; ce qui existe déjà reste en place.
- **Packs** : tous les cours d’un niveau. **Télécharger le pack** les installe un par un ; un cours en échec n’arrête pas les autres, et relancer le pack reprend seulement ceux qui manquent. **Ranger dans mon cursus…** les ajoute dans un dossier.
- **Cours** : chaque cours peut être téléchargé, mis à jour (« Mise à jour disponible ») ou supprimé. Supprimer retire les pages du cours, jamais le travail.

## Quiz, TD et TP

- **Quiz** : questions à choix, réponses rédigées, code, SQL… Chaque tentative est enregistrée. Avec [Claude](page:claude), une aide est disponible pendant le quiz et les réponses rédigées sont corrigées.
- **TD interactifs** : les exercices se font directement dans la page (éditeurs de code, tableaux, schémas). Le travail est enregistré au fur et à mesure dans le dossier du profil.
- **TP** : les fichiers fournis sont dans le cours ; le travail se fait dans le dossier du cours de l’espace du profil.

**Mes révisions** (menu **Aller**) regroupe les quiz à reprendre, les résultats et les TD des cours du cursus. **Mon suivi** est une liste de tâches du profil (`TODO.md`).

## Proposer un cours

Un cours créé dans l’espace d’un profil peut être proposé au catalogue : **⋯ › Proposer ce cours…**. L’application prépare une archive qui ne contient que les pages générées (ni sources d’enseignants, ni travail personnel), vérifie qu’aucune donnée personnelle n’y figure, puis ouvre une page GitHub où joindre l’archive.
