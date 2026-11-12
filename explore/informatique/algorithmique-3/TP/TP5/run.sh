#!/bin/bash
#
# TP 5 d'Algorithmique 3 : le loup et la bergerie (MinMax, NegaMax).
# Le code est celui de l'enseignant ; les fonctions a ecrire sont dans
# Jeu/MinMax.c (marquees « A FAIRE »). Ce script ne fait que compiler et lancer.
#
# Usage :
#   ./run.sh                          compile tout (make all)
#   ./run.sh clean                    supprime les fichiers compiles
#   ./run.sh <programme> [arguments]  compile, puis lance un programme de Jeu/ ou d'Exemples/
#
# Exemples :
#   ./run.sh JoueurVsJoueur_stdio 8 1 B
#   ./run.sh JoueurVsOrdi_stdio_V1 8 1 B
#   ./run.sh OrdiVsOrdi_stdio_V1 8 1 B 2
#   ./run.sh Ordi ../Fichiers/sauv_7X7.fich 2
#   ./run.sh OrdiVsOrdi_stdio_V2 ./Ordi ./MasterSheep 8 1 N 6   (tournoi)
#   ./run.sh JoueurVsOrdi_stdio_V1 --help
#
# Les programmes sont lances depuis leur dossier : les fichiers de parties
# fournis s'y nomment ../Fichiers/<nom>.fich.
#
# A la fac (Linux), lancer ce script directement ; sous Windows, run.bat le
# lance dans WSL ; sur Mac, il prend la version Darwin.
#
set -e
SCRIPT="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
cd "$(dirname "$0")"

DOSSIER="TP_Loup_Bergerie_$(uname)/TP_Loup_Bergerie"
if [ ! -d "$DOSSIER" ]; then
    echo "Erreur : pas de version du TP pour le systeme $(uname) (Linux ou Darwin seulement)." >&2
    exit 1
fi

verifier_outils() {
    if ! command -v gcc >/dev/null || ! command -v make >/dev/null; then
        echo "Erreur : gcc ou make introuvable." >&2
        echo "Sous Ubuntu, et dans WSL : sudo apt install build-essential" >&2
        exit 1
    fi
    if [ "$(uname)" = Linux ] && ! echo '#include <ncurses.h>' | gcc -E - >/dev/null 2>&1; then
        echo "Erreur : la bibliotheque ncurses manque (versions _ecran)." >&2
        echo "Sous Ubuntu, et dans WSL : sudo apt install libncurses-dev" >&2
        exit 1
    fi
}

verifier_outils
case "${1:-}" in
    "")
        make -C "$DOSSIER" all
        ;;
    clean)
        make -C "$DOSSIER" clean
        ;;
    -h|--help|aide)
        sed -n '2,25p' "$SCRIPT" | sed 's/^# \{0,1\}//'
        ;;
    *)
        programme="$1"; shift
        make -s -C "$DOSSIER" all >/dev/null
        # Les binaires fournis (OrdiVsOrdi_*_V2, MasterSheep) perdent leur droit
        # d'execution sur le Drive : on le leur rend.
        chmod +x "$DOSSIER"/Jeu/OrdiVsOrdi_*_V2 "$DOSSIER"/Jeu/MasterSheep 2>/dev/null || true
        for sous in Jeu Exemples; do
            if [ -f "$DOSSIER/$sous/$programme" ]; then
                cd "$DOSSIER/$sous"
                exec "./$programme" "$@"
            fi
        done
        echo "Erreur : programme « $programme » introuvable dans Jeu/ ni dans Exemples/." >&2
        exit 1
        ;;
esac
