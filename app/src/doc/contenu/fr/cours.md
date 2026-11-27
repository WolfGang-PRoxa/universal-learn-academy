# Cours, cursus et quiz

## L’accueil

L’accueil (**Alt+Origine**, ou bouton maison de la barre du haut) réunit :

| Section         | Contenu                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Profils (volet) | À gauche : les profils, le changement de profil, la création et le renommage. Le bouton ☰ de la barre replie le volet      |
| Mon cursus      | Les dossiers du cursus et leurs cours, avec la progression de chacun                                                        |
| Catalogue       | Deux onglets : **Installés sur ce poste** (par domaine) et **Tous les cours** (cursus exemples, packs, cours à télécharger) |
| Outils          | Révisions, compilation C, notebooks Python, démonstrations                                                                  |

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

## Le sommaire

Dans les pages des cours et des quiz, le bandeau de gauche (sommaire) se replie et se déplie par le premier bouton de la barre du haut, à gauche ; la page prend alors toute la largeur. Le choix est retenu d’une page à l’autre. Sur un écran étroit, le même bouton ouvre le sommaire par-dessus la page. La documentation et les paramètres ont le même bouton.

## Quiz, TD et TP

- **Quiz** : questions à choix, réponses rédigées, code, SQL… Chaque tentative est enregistrée. En mode entraînement, on navigue librement entre les questions : les pastilles numérotées et les flèches ‹ › mènent à n’importe quelle question, **Passer** laisse une question pour plus tard, et la couleur de chaque pastille indique son état (à faire, répondue, juste, partielle, fausse). Avec un [assistant IA](page:claude) (Claude, ChatGPT ou Gemini), une aide est disponible pendant le quiz et les réponses rédigées sont corrigées.
- **TD interactifs** : les exercices se font directement dans la page (éditeurs de code, tableaux, schémas). Le travail est enregistré au fur et à mesure dans le dossier du profil.
- **TP** : les fichiers fournis sont dans le cours ; le travail se fait dans le dossier du cours de l’espace du profil.

**Mes révisions** (menu **Aller**) regroupe les quiz à reprendre, les résultats et les TD des cours du cursus.

## Proposer un cours

Un cours créé dans l’espace d’un profil peut être soumis au catalogue : **⋯ › Soumettre ce cours…**. Le formulaire reprend la fiche du cours et ce que l’application a mesuré de sa génération (IA, modèle, effort, durée, ressources lues) ; on y précise ce qui a été fait hors de l’application (IA, modèle, effort, temps passé, ressources), un pseudonyme facultatif, et on accepte la licence CC BY-NC-ND 4.0.

Le cours est ensuite vérifié sur le poste, étape par étape : fichiers (seulement les pages générées, aucune donnée personnelle), informations de génération, charte des pages, quiz, ateliers, archive. Un petit cadre en bas à droite suit l’avancement ; il se réduit en pastille d’un clic.

Si une vérification échoue, ou ne peut pas tourner (Python absent), la soumission est **suspendue** : rien ne part. Dans **Mes soumissions** (accueil), trois choix : **Corriger avec mon IA** (l’IA corrige les problèmes signalés, puis la vérification reprend), **J’ai corrigé : revérifier**, ou **Annuler la soumission**. Chaque soumission y garde son historique complet et daté, ses vérifications et les informations envoyées.

Une fois la vérification réussie, la soumission part d’elle-même au service de soumission (`ula.romainpiau.dev`), qui refait ses propres contrôles et lui donne un numéro. Sans réseau, elle reste **prête** : **Réessayer l’envoi** la fait repartir. Ensuite, **Mes soumissions** et le cadre suivent son état chez l’administrateur : reçue, en analyse, acceptée ou refusée, avec son message. L’état est relu toutes les 10 minutes, ou tout de suite avec **Actualiser l’état**.

### Soumissions reçues (administrateur)

Avec le jeton d’administration enregistré ([Paramètres › Soumissions reçues](parametres:administration)), l’accueil montre la section **Soumissions reçues** : à traiter, acceptées, refusées. Pour chaque soumission : la fiche, ce que l’application de l’auteur a mesuré et ce qu’il a déclaré, ses vérifications, et l’historique.

- **Analyser** (une soumission, la sélection, ou toutes celles à analyser) avec l’IA choisie dans la liste (Claude, ChatGPT ou Gemini, sans relais vers une autre) : l’archive est téléchargée dans `soumissions-recues/`, les vérifications sont refaites sur le poste, puis l’IA relit le cours sans rien modifier et rend une recommandation (accepter, corriger, refuser), un résumé, des points précis et une note. L’auteur voit la recommandation et le résumé.
- **Accepter** : en mode dépôt, le cours entre dans `explore/` (mêmes contrôles que le catalogue, pack au choix) ; ailleurs, l’archive reste dans `soumissions-recues/`. **Refuser** demande un message pour l’auteur. **Bloquer l’auteur** refuse les prochaines soumissions de son installation.

Rien n’est accepté sans votre décision.
