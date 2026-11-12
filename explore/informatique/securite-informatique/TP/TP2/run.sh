#!/bin/bash
#
# TP 2 de securite informatique : implementation du chiffre RC4.
# RC4.c est a ecrire dans implementation/ ; RC4.h et test_RC4.c sont fournis.
#
# Usage :
#   ./run.sh         compile test_RC4 (make dans implementation/)
#   ./run.sh test    compile puis lance le programme de test
#   ./run.sh clean   supprime le programme compile
#
# Le TP se compile avec le gcc de Linux : a la fac,
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
        make -C implementation
        ;;
    test)
        make -C implementation test
        ;;
    clean)
        make -C implementation clean
        ;;
    *)
        echo "Usage : $0 [test | clean]" >&2
        exit 1
        ;;
esac
