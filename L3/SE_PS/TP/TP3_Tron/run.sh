#!/bin/bash
#
# TP Tron : compile le TP, lance les tests fournis par l'enseignant, ou le jeu.
#
# Usage :
#   ./run.sh                                       compile tout le TP (make -f Makefile all)
#   ./run.sh tests                                 compile, puis les tests unitaires (make tests)
#   ./run.sh jouer [hauteur] [largeur] [motos] [L|M|R]   compile Jeu, puis ./tron (defaut : 10 30 5 M)
#   ./run.sh arreter                               arrete les tron restes en vie, remet le terminal
#
# Le jeu se programme dans Jeu/tron.c : ce script ne fait que le compiler et
# le lancer. Les processus et les outils de communication du TP n'existent
# que sous Linux : a la fac, lancer ce script directement ; sous Windows,
# run.bat le lance dans WSL.
#

set -e

cd "$(dirname "$0")"

verifier_outils() {
    if ! command -v gcc >/dev/null || ! command -v make >/dev/null; then
        echo "Erreur : gcc ou make introuvable." >&2
        echo "Sous Ubuntu, et dans WSL : sudo apt install build-essential gdb" >&2
        exit 1
    fi
    if [ ! -f /usr/include/ncurses.h ]; then
        echo "Erreur : la bibliotheque ncurses (affichage de la piste) manque." >&2
        echo "Sous Ubuntu, et dans WSL : sudo apt install libncurses-dev" >&2
        exit 1
    fi
}

# La piste s'affiche dans un cadre (2 lignes, 2 colonnes) au-dessus d'une
# fenetre de messages (3 lignes). Dans une console trop petite, ncurses coupe
# l'affichage sans rien dire : on le signale avant.
verifier_console() {
    besoin_lignes=$1
    besoin_colonnes=$2
    if [ ! -t 0 ] || [ ! -t 1 ]; then
        echo "Erreur : il faut un vrai terminal (ncurses y dessine la piste, le pilote y lit le clavier touche par touche)." >&2
        exit 1
    fi
    taille=$(stty size 2>/dev/null) || return 0
    lignes=${taille% *}
    colonnes=${taille#* }
    if [ "$colonnes" -lt "$besoin_colonnes" ] || [ "$lignes" -lt "$besoin_lignes" ]; then
        echo "Console trop petite : $colonnes colonnes sur $lignes lignes, il en faut $besoin_colonnes sur $besoin_lignes." >&2
        echo "Agrandir la fenetre (ou reduire la piste), puis relancer." >&2
        exit 1
    fi
}

# Le pilote passe le clavier en mode brut (Jeu/tron.c, stdin_set_raw) : si le
# programme s'arrete avant de le remettre, le terminal n'affiche plus ce
# qu'on tape. ncurses peut aussi laisser le curseur cache.
remettre_terminal() {
    if [ -t 0 ]; then
        stty sane 2>/dev/null || true
        tput cnorm 2>/dev/null || true
    fi
}

case "${1:-}" in
    "")
        verifier_outils
        # Compilation de tous les dossiers, par le Makefile de l'enseignant
        make -f Makefile all
        ;;
    tests)
        verifier_outils
        # Les tests d'affichage ouvrent des pistes jusqu'a 5 x 30
        verifier_console 10 32
        make -f Makefile all
        make -f Makefile tests
        remettre_terminal
        echo "Tests de l'enseignant termines sans erreur."
        ;;
    jouer)
        hauteur=${2:-10}
        largeur=${3:-30}
        motos=${4:-5}
        vitesse=${5:-M}
        verifier_outils
        verifier_console $((hauteur + 5)) $((largeur + 2))
        # Les modules d'abord (objets dont tron a besoin), puis le jeu
        make -f Makefile all
        cd Jeu
        set +e
        ./tron "$hauteur" "$largeur" "$motos" "$vitesse"
        code=$?
        set -e
        remettre_terminal
        # Un processus du jeu reste en vie (pilote ou course qui attend l'autre) ?
        if pgrep -x tron >/dev/null; then
            echo "Des processus tron tournent encore : ./run.sh arreter les arrete." >&2
        fi
        exit $code
        ;;
    arreter)
        # pkill rend 1 quand aucun tron ne tourne : ce n'est pas une erreur
        pkill -x tron || true
        remettre_terminal
        # Fichiers des erreurs redirigees par l'ecran (Ecran/ecran.c), restes
        # quand le jeu a ete interrompu
        rm -f Jeu/*_stderr
        echo "Processus tron arretes."
        if command -v ipcs >/dev/null && ipcs -q | grep -q "^0x"; then
            echo "Files de messages encore presentes (ipcrm -q <msqid> pour en supprimer une) :"
            ipcs -q
        fi
        ;;
    *)
        echo "Usage : $0 [tests | jouer [hauteur] [largeur] [motos] [L|M|R] | arreter]" >&2
        exit 1
        ;;
esac
