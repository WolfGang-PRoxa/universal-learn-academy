#!/bin/bash
#
# TP 3 de securite informatique : primitives cryptographiques.
# Seul annexe/memopwd.c est a modifier ; le reste est fourni par l'enseignant.
#
# Usage :
#   ./run.sh           compile memopwd, test et test2 (make all dans annexe/)
#   ./run.sh test      compile, puis lance les tests fournis : test, puis test2
#   ./run.sh memopwd   compile, puis lance le gestionnaire de mots de passe
#   ./run.sh clean     supprime les fichiers compiles (garde memopwd.data)
#
# Le code fourni lit /dev/urandom et compile avec le gcc de Linux : a la fac,
# lancer ce script directement ; sous Windows, run.bat le lance dans WSL.
#
set -e
cd "$(dirname "$0")"

verifier_outils() {
    if ! command -v gcc >/dev/null || ! command -v make >/dev/null; then
        echo "Erreur : gcc ou make introuvable." >&2
        echo "Sous Ubuntu, et dans WSL : sudo apt install build-essential" >&2
        exit 1
    fi
}

verifier_outils
case "${1:-}" in
    "")
        make -C annexe all
        ;;
    test)
        make -C annexe all
        cd annexe
        echo "== ./test (tous les tests doivent reussir)"
        ./test
        echo
        echo "== ./test2 (le texte dechiffre doit etre : Ceci est le texte en clair)"
        ./test2
        ;;
    memopwd)
        make -C annexe memopwd
        cd annexe
        exec ./memopwd
        ;;
    clean)
        make -C annexe clean
        rm -f annexe/memopwd annexe/test annexe/test2
        ;;
    *)
        echo "Usage : $0 [test | memopwd | clean]" >&2
        exit 1
        ;;
esac
