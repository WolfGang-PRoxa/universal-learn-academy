#!/bin/bash
#
# Compile tout le projet puis lance l'executable.
#
# Rappel : les dossiers du projet se declarent dans Makefile.dir,
# PAS ici. Un script shell ne peut pas definir de variable make.
#

set -e

cd "$(dirname "$0")"

# MinGW installe make sous le nom mingw32-make : on prend celui qui existe.
MAKE_CMD=$(command -v make || command -v mingw32-make) || {
    echo "Erreur : ni make ni mingw32-make dans le PATH." >&2
    exit 1
}

"$MAKE_CMD" all
./build/generateur
