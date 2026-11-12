#!/bin/sh
# Ouvre Jupyter dans l'environnement Python commun des notebooks (cours, devoirs, TP).
# La première fois, crée l'environnement hors du dépôt (quelques minutes), puis le remet
# à jour quand _outils/environnements/python/requirements.txt change.
#   ./lancer-jupyter.sh                       Jupyter à la racine d’ula
#   ./lancer-jupyter.sh <dossier|notebook>    Jupyter sur ce dossier ou ce notebook
#   ./lancer-jupyter.sh --installer           crée ou met à jour l'environnement, sans lancer Jupyter
# Ctrl+C arrête Jupyter.
racine=$(cd "$(dirname "$0")" && pwd)
env="${XDG_DATA_HOME:-$HOME/.local/share}/studies-python"
req="$racine/_outils/environnements/python/requirements.txt"
py="$env/bin/python"

if [ ! -x "$py" ]; then
  if ! command -v python3 >/dev/null 2>&1; then
    echo "Python 3 est introuvable : l'installer (sudo apt install python3 python3-venv) puis relancer."
    exit 1
  fi
  echo "Création de l'environnement Python dans $env…"
  if ! python3 -m venv "$env"; then
    echo "Échec de python3 -m venv : installer python3-venv (sudo apt install python3-venv) puis relancer."
    rm -rf "$env"
    exit 1
  fi
fi

if ! cmp -s "$req" "$env/requirements.txt"; then
  echo "Installation des bibliothèques de requirements.txt (quelques minutes la première fois)…"
  "$py" -m pip install --upgrade --quiet pip
  "$py" -m pip install -r "$req" || { echo "Échec de l'installation : voir les messages ci-dessus."; exit 1; }
  cp "$req" "$env/requirements.txt"
fi

if [ "$1" = "--installer" ]; then
  echo "Environnement prêt : $env"
  "$py" --version
  exit 0
fi

# Sans argument, Jupyter s'ouvre sur la racine d’ula ; avec un dossier, sur ce dossier ;
# avec un notebook, sur la racine, notebook ouvert. Les arguments suivants vont à Jupyter.
cible="${1:-$racine}"
[ $# -gt 0 ] && shift
if [ -d "$cible" ]; then
  cible=$(cd "$cible" && pwd)
fi
exec "$py" -m jupyter notebook --ServerApp.root_dir="$racine" "$cible" "$@"
