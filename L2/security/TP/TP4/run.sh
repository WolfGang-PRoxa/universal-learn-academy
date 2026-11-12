#!/bin/bash
#
# TP 4 de securite informatique : gestionnaire de mots de passe v2 (HMAC).
# Seul annexe/memopwd.c est a modifier ; lib/ et test/ sont fournis par l'enseignant.
#
# Usage :
#   ./run.sh           compile memopwd et les tests (make dans annexe/ ; des warnings sont normaux)
#   ./run.sh test      compile, puis lance les tests fournis (AES128, SHA256, HMAC-SHA256)
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
        make -C annexe
        ;;
    test)
        make -C annexe
        cd annexe
        for t in test_AES128 test2_AES128 test_SHA256 test_HMAC_SHA256; do
            echo "== ./$t"
            "./$t"
            echo
        done
        ;;
    memopwd)
        make -C annexe memopwd
        cd annexe
        exec ./memopwd
        ;;
    clean)
        make -C annexe clean
        rm -f annexe/memopwd annexe/test_AES128 annexe/test2_AES128 annexe/test_SHA256 annexe/test_HMAC_SHA256
        ;;
    *)
        echo "Usage : $0 [test | memopwd | clean]" >&2
        exit 1
        ;;
esac
