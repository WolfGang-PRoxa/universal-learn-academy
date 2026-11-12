#!/bin/sh
# Lance l'application Studies : le portail et les cours dans leur propre fenêtre.
# La première fois, l'installe (quelques minutes).
dossier=$(cd "$(dirname "$0")" && pwd)
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js est introuvable : l'installer depuis https://nodejs.org puis relancer."
  exit 1
fi
exec node "$dossier/_outils/app/installer.js" "$@"
