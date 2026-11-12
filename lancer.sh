#!/bin/sh
# Lance le serveur local de l'outil de quiz et ouvre le portail dans le navigateur.
# Ctrl+C arrête le serveur.
dossier=$(cd "$(dirname "$0")" && pwd)
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js est introuvable : l'installer depuis https://nodejs.org puis relancer."
  exit 1
fi
exec node "$dossier/_outils/quiz/serveur/serveur.js" --ouvrir "$@"
