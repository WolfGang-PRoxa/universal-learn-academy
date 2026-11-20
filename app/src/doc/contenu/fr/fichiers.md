# Fichiers et dossiers

## Où l’application écrit

| Contenu | Windows | Linux |
|---|---|---|
| Dossier des données (par défaut) | `Documents\ULA` | `~/Documents/ULA` |
| Paramètres (`parametres.json`) | `%APPDATA%\Universal Learn Academy` | `~/.config/Universal Learn Academy` |
| Journaux (`logs/gels.log`) | `%APPDATA%\Universal Learn Academy\logs` | `~/.config/Universal Learn Academy/logs` |
| Copie locale des outils | `%LOCALAPPDATA%\Universal Learn Academy\outils` | `~/.local/share/Universal Learn Academy/outils` |
| Profil actif, fichiers temporaires du quiz | `%LOCALAPPDATA%\studies-quiz` | `~/.cache/studies-quiz` |

La désinstallation conserve les paramètres et le dossier des données.

## Dossier des données

```
<dossier des données>/
├── explore/                     catalogue téléchargé, en lecture seule
│   └── <domaine>/<cours>/       ula-cours.json, pages, quiz, .ula-version.json
├── <profil>/                    espace d’un profil (ula-profil.json)
│   └── <dossiers>/<cours>/      lien vers un cours (ula-lien.json)
│       ├── quiz_results/        tentatives
│       ├── td_results/          travail des TD interactifs
│       └── TP/                  travail de TP
└── propositions/                archives de « Proposer ce cours »
```

Règle d’or : rien de ce que l’utilisateur produit n’est écrit dans `explore/`. Un dépôt Git d’ula (il contient `_outils/app` et `explore/`) est aussi reconnu comme dossier des données : outils et catalogue sont alors ceux du dépôt.

## Clés de parametres.json

Une clé absente prend sa valeur par défaut.

| Clé | Valeur par défaut | Rôle |
|---|---|---|
| `langue` | `null` | `fr` ou `en` ; `null` tant qu’elle n’est pas choisie (la fenêtre de choix s’ouvre alors au lancement) |
| `miseAJourAuto` | `true` | Recherche et installation automatiques des mises à jour |
| `fenetre.mode` | `agrandie` | `agrandie` ou `personnalisee` (avec `fenetre.bornes`) |
| `affichage.echelle` | `0` | Échelle en % (0 : automatique) |
| `arrierePlan.fermeture` | `true` | La croix cache la fenêtre au lieu de quitter |
| `donnees.dossier` | vide | Dossier des données (vide : dossier par défaut) |
| `claude.mode` | `compte` | `compte` ou `cle` ; la clé est chiffrée par le système |
| `synchro.auto` | `null` | Synchronisation automatique ; `null` tant que la question n’a pas reçu de réponse |
| `raccourcis.dossiers` | `[]` | Dossiers où un raccourci a été demandé |

## Journaux

`gels.log` note chaque blocage du processus principal de plus de 150 ms et chaque page restée cachée alors que sa fenêtre est affichée. Il reste sous 512 Ko ; l’ancien passe en `gels.1.log`.
