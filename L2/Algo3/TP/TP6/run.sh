#!/bin/bash
#
# TP 6 d'Algorithmique 3 : arbres binaires (TDA ab_t, classification des animaux).
# Les primitives a ecrire sont dans TP6_AB/Exercice/noeud.c, ab.c et ab_animaux.c
# (marquees « A FAIRE »). Ce script ne fait que compiler et lancer les programmes
# de test fournis par l'enseignant.
#
# Usage :
#   ./run.sh                          compile tout (make all, version Linux)
#   ./run.sh tests                    compile, puis lance la cible « tests » du Makefile
#   ./run.sh <programme> [arguments]  compile, puis lance un programme
#   ./run.sh fuites <programme> [arguments]
#                                     idem sous valgrind, pour chercher les fuites de memoire
#   ./run.sh clean                    supprime les fichiers compiles
#
# Exemples :
#   ./run.sh test_noeud
#   ./run.sh test_ab_fractions 3 SYM
#   ./run.sh fuites test_ab_individus 3 PRE
#   ./run.sh animaux                  (fichier a donner : Fichiers/classif_animaux.txt)
#
# Le Makefile de l'enseignant vise macOS par defaut (ARCH=apple) : sous Linux,
# il faut ARCH=linux pour lier la bibliotheque mathematique, ce que fait ce script.
# A la fac, le lancer directement ; sous Windows, run.bat le lance dans WSL.
#
set -e
SCRIPT="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
cd "$(dirname "$0")/TP6_AB/Exercice"

if [ "$(uname)" = Darwin ]; then ARCH=apple; else ARCH=linux; fi

verifier_outils() {
    if ! command -v gcc >/dev/null || ! command -v make >/dev/null; then
        echo "Erreur : gcc ou make introuvable." >&2
        echo "Sous Ubuntu, et dans WSL : sudo apt install build-essential" >&2
        exit 1
    fi
}

compiler() {
    make -f Makefile ARCH=$ARCH all
}

verifier_outils
case "${1:-}" in
    "")
        compiler
        ;;
    tests)
        compiler
        make -f Makefile tests
        ;;
    clean)
        make -f Makefile clean
        ;;
    fuites)
        shift
        if ! command -v valgrind >/dev/null; then
            echo "Erreur : valgrind introuvable. Sous Ubuntu, et dans WSL : sudo apt install valgrind" >&2
            exit 1
        fi
        [ -n "${1:-}" ] || { echo "Usage : $0 fuites <programme> [arguments]" >&2; exit 1; }
        compiler >/dev/null
        programme="$1"; shift
        exec valgrind --leak-check=full "./$programme" "$@"
        ;;
    -h|--help|aide)
        sed -n '2,25p' "$SCRIPT" | sed 's/^# \{0,1\}//'
        ;;
    *)
        programme="$1"; shift
        compiler >/dev/null
        if [ ! -x "./$programme" ]; then
            echo "Erreur : programme « $programme » introuvable (voir le Makefile)." >&2
            exit 1
        fi
        exec "./$programme" "$@"
        ;;
esac
