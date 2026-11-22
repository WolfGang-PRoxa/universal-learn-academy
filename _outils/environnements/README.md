# Environnements communs

Pages communes à plusieurs matières sur les outils de travail, au PC comme à la fac : ce qui est installé, ce qui manque, les commandes de chaque système. Une page par langage ou par outil.

| Page          | Contenu                                                                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `c.html`      | Compiler un TP en C sous Windows et sous Linux : MinGW, `mingw32-make` et le `sh` de Git for Windows pour le C standard ; WSL pour le C POSIX ; lanceurs `run.bat` et `run.sh` ; erreurs fréquentes.                            |
| `python.html` | Les notebooks Python : environnement commun décrit par `python/requirements.txt`, installé hors de Drive par `lancer-jupyter.bat` et `lancer-jupyter.sh` (racine de `studies`) ; ajouter une bibliothèque ; erreurs fréquentes. |

## Règles

- Les pages suivent la charte (`_outils/charte/README.md`) ; depuis ce dossier, la charte est à `../../_outils/charte/`.
- L'état du PC (outils, versions, emplacements) se relève par des commandes (`where`, `--version`, `command -v`), il ne se suppose pas. La page donne la date du relevé (« État du PC ») et se met à jour quand il change.
- Chaque commande et chaque message d'erreur cités sont essayés sur le PC avant d'être publiés.
- Liens : l'accueil général liste chaque page (liste `OUTILS` de `_outils/charte/outils/index_niveau.py`, puis relancer l'outil) ; les accueils des matières concernées y renvoient par un paragraphe sous leur liste de TP, que l'outil ne compte pas comme un chapitre.
- Vérifier : `python _outils/charte/outils/verifier.py _outils/environnements/`.
