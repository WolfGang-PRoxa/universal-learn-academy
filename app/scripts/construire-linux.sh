#!/bin/sh
# Construit l'AppImage d'Universal Learn Academy sous Linux, ou dans WSL depuis Windows
# (electron-builder ne sait pas faire d'AppImage sous Windows).
#
#   sh scripts/construire-linux.sh <dossier app>
#
# Le programme (sans node_modules ni dist) et les outils préparés (.outils) sont
# copiés dans un dossier de travail Linux (~/.cache/studies-build), où les
# dépendances sont installées pour Linux ; l'AppImage, sa carte de blocs et
# latest-linux.yml reviennent ensuite dans <dossier app>/dist.
#
# Node : celui du PATH, ou ~/.local/node (installation sans droits administrateur).
set -eu

SOURCE=$(cd "${1:-$(dirname "$0")/..}" && pwd)
TRAVAIL="${STUDIES_BUILD:-$HOME/.cache/studies-build}"
PATH="$HOME/.local/node/bin:$PATH"
export PATH

command -v node >/dev/null 2>&1 || { echo "Node.js est introuvable dans Linux (ni dans le PATH, ni dans ~/.local/node)." >&2; exit 1; }
[ -f "$SOURCE/.outils/.ula-outils.json" ] || { echo "Outils non préparés : lancer d'abord npm run contenu." >&2; exit 1; }

echo "▸ Copie du programme et des outils dans $TRAVAIL"
rm -rf "$TRAVAIL/app"
mkdir -p "$TRAVAIL/app"
tar -C "$SOURCE" --exclude=./node_modules --exclude=./dist -cf - . | tar -C "$TRAVAIL/app" -xf -

cd "$TRAVAIL/app"
echo "▸ Dépendances pour Linux (node $(node --version))"
npm ci --no-audit --no-fund --loglevel=error

echo "▸ Construction de l'AppImage"
npx --no-install electron-builder --linux --publish never

mkdir -p "$SOURCE/dist"
for f in dist/*.AppImage dist/*.AppImage.blockmap dist/latest-linux.yml; do
  [ -f "$f" ] && cp -f "$f" "$SOURCE/dist/"
done
echo "✓ AppImage copiée dans $SOURCE/dist"
