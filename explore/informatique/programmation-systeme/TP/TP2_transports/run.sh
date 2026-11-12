#!/bin/bash
#
# TP Transports : compile le TP, lance une version avec son affichage, ou un
# programme d'exemple.
#
# Usage :
#   ./run.sh                          compile tout le TP (make -f Makefile all)
#   ./run.sh v2                       version 2 : vision, puis les transports
#   ./run.sh v4 [chariots] [wagons] [camions]   version 4 (defaut : 2 2 2)
#   ./run.sh exemple <nom> [args]     un programme de Exemples (ex_trajets...)
#   ./run.sh arreter                  arrete tous les processus du TP
#
# Les versions 1 et 3 n'ont pas de lanceur fourni : chaque programme se lance
# a la main, dans son propre terminal (voir la page du TP).
#
# Les signaux et les processus du TP n'existent que sous Linux : a la fac,
# lancer ce script directement ; sous Windows, run.bat le lance dans WSL.
#

set -e

cd "$(dirname "$0")"

PROGRAMMES="atelier entrepot chariot wagon camion vision"

arreter() {
    # Le script de l'enseignant d'abord, pour qu'il ne relance rien ;
    # pkill rend 1 quand aucun processus ne correspond : ce n'est pas une erreur
    pkill -f "lance_transport_V[24].sh" || true
    for p in $PROGRAMMES; do
        pkill -x "$p" || true
    done
}

verifier_outils() {
    if ! command -v gcc >/dev/null || ! command -v make >/dev/null; then
        echo "Erreur : gcc ou make introuvable." >&2
        echo "Sous Ubuntu, et dans WSL : sudo apt install build-essential gdb" >&2
        exit 1
    fi
    if [ ! -f /usr/include/ncurses.h ]; then
        echo "Erreur : la bibliotheque ncurses (affichage de vision et des exemples) manque." >&2
        echo "Sous Ubuntu, et dans WSL : sudo apt install libncurses-dev" >&2
        exit 1
    fi
}

# vision refuse de demarrer si la console est trop petite (Ecran/ecran.c) :
# le dire ici plutot que laisser son "Erreur creation Ecran"
verifier_console() {
    taille=$(stty size 2>/dev/null) || return 0
    lignes=${taille% *}
    colonnes=${taille#* }
    if [ "$colonnes" -lt 146 ] || [ "$lignes" -lt 23 ]; then
        echo "Console trop petite : $colonnes colonnes sur $lignes lignes, vision en demande 146 sur 23." >&2
        echo "Agrandir la fenetre (ou la passer en plein ecran), puis relancer." >&2
        exit 1
    fi
}

# Lance vision au premier plan et, des qu'on connait son pid, le script de
# l'enseignant en arriere-plan (traces dans Fichiers/transports_<version>.log).
# Quand on quitte vision, tous les processus du TP sont arretes.
lancer_version() {
    version=$1
    shift
    dossier=Signaux_$version
    script=lance_transport_$version.sh
    journal=../Fichiers/transports_$version.log
    fich_pid=../Fichiers/.vision.pid

    verifier_outils
    verifier_console
    # Dossier vide au depart : git ne le garde pas, il manque apres un clone
    mkdir -p Fichiers
    make -C "$dossier" -f Makefile all
    cd "$dossier"
    arreter

    rm -f "$fich_pid"
    (
        until [ -s "$fich_pid" ]; do sleep 0.2; done
        # Laisse a vision le temps d'installer ses gestionnaires de signaux
        sleep 1
        exec bash "$script" "$(cat "$fich_pid")" "$@"
    ) > "$journal" 2>&1 &
    lanceur=$!

    echo "vision au premier plan ; transports lances par $script, traces dans Fichiers/transports_$version.log"
    # vision garde le pid ecrit dans le fichier : celui que l'on passe au script.
    # Ctrl+C quitte vision, sans arreter ce script avant le menage.
    trap 'true' INT
    bash -c 'echo $$ > "$0" && exec ./vision "$1" "$2"' "$fich_pid" \
        ../Fichiers/atelier.bin ../Fichiers/entrepot.bin || true
    trap - INT
    kill "$lanceur" 2>/dev/null || true
    arreter
    rm -f "$fich_pid"
    echo "Processus du TP arretes."
}

case "${1:-}" in
    "")
        verifier_outils
        # Compilation de tous les dossiers, par le Makefile de l'enseignant
        make -f Makefile all
        ;;
    arreter)
        arreter
        echo "Processus du TP arretes."
        ;;
    v2)
        lancer_version V2
        ;;
    v4)
        lancer_version V4 "${2:-2}" "${3:-2}" "${4:-2}"
        ;;
    exemple)
        nom=${2:-}
        if [ -z "$nom" ] || [ ! -f "Exemples/$nom.c" ]; then
            echo "Usage : $0 exemple <nom> [arguments]" >&2
            echo "Exemples : $(cd Exemples && ls ex_*.c | sed 's/\.c$//' | tr '\n' ' ')" >&2
            exit 1
        fi
        shift 2
        verifier_outils
        make -C Exemples -f Makefile all
        cd Exemples
        exec "./$nom" "$@"
        ;;
    *)
        echo "Usage : $0 [v2 | v4 [chariots] [wagons] [camions] | exemple <nom> [args] | arreter]" >&2
        exit 1
        ;;
esac
