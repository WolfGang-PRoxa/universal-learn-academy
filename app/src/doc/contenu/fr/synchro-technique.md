# Synchronisation (technique)

La synchronisation automatique (`app/src/synchro.js` et `synchro-git.js`) s’applique quand le dossier des données est un dépôt Git dont la branche suit une branche distante.

## Un cycle

1. Rien si une commande Git est en cours (`index.lock`, fusion ou rebase inachevés) : nouvel essai au cycle suivant.
2. Commit de ce qui a changé dans le périmètre, avec un message « Progression du <date> à <heure> (<nom du PC>) » et l’identité Git du poste.
3. `git fetch`, puis fusion avec la branche suivie (`--autostash`).
4. `git push`, recommencé une fois si l’autre PC vient de pousser. Jamais de `--force`.

## Périmètre

| Dossier des données        | Ce qui est committé automatiquement                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Dépôt d’ula                | Seulement la progression écrite par l’application : `quiz_results/`, `td_results/`, `ula-lien.json`, `ula-profil.json` |
| Autre dossier devenu dépôt | Tout, sauf `explore/`, `_outils/` et les fichiers temporaires                                                          |

Un fichier de plus de 50 Mo n’est jamais committé (il est signalé dans la carte Synchronisation).

## Conflits

| Fichier                            | Résolution                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `td_results/<page>.json`           | Fusion atelier par atelier, le plus récent d’après `maj`                       |
| Tentative de quiz                  | Version enregistrée le plus récemment                                          |
| `ula-lien.json`, `ula-profil.json` | Version locale                                                                 |
| Autre fichier, dépôt d’ula         | Fusion annulée, à faire à la main (`git pull`)                                 |
| Autre fichier, autre dossier       | Version locale gardée, l’autre enregistrée à côté (`nom (conflit <date>).ext`) |

Un fichier supprimé d’un côté et modifié de l’autre est gardé.

## Identifiants

L’application n’en demande ni n’en garde aucun. Git ne peut rien demander pendant un cycle (`GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`, SSH en `BatchMode`) : un accès refusé est signalé, et il suffit de lancer une fois `git pull` à la main pour enregistrer les identifiants.

## Calendrier

Au lancement (une dizaine de secondes après), toutes les 30 minutes, au réveil du PC et à la fermeture (10 secondes au plus). Un `git pull` fait à la main pendant que l’application tourne est repéré (HEAD surveillé toutes les 5 secondes) et l’accueil se recharge. `ULA_SYNCHRO_INTERVALLE_MS` raccourcit l’intervalle pour les essais.
