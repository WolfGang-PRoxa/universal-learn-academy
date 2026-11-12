#!/bin/bash
#
# TP Route : compile le TP, cree une route neuve, lance les voitures en
# arriere-plan, puis vision au premier plan.
#
# Usage :
#   ./run.sh [v1|v2] [nb voitures] [longueur route]   (defaut : v1 3 20)
#   ./run.sh arreter                                   arrete les voitures
#
# Les primitives POSIX du TP (verrous fcntl, signaux, processus) n'existent
# que sous Linux : a la fac, lancer ce script directement ; sous Windows,
# run.bat le lance dans WSL.
#

set -e

cd "$(dirname "$0")"

arreter() {
    # pkill rend 1 quand aucune voiture ne tourne : ce n'est pas une erreur
    pkill -x voiture_v1 || true
    pkill -x voiture_v2 || true
}

if [ "$1" = "arreter" ]; then
    arreter
    echo "Voitures arretees."
    exit 0
fi

type_voiture=${1:-v1}
nb_voitures=${2:-3}
longueur=${3:-20}

if [ "$type_voiture" != "v1" ] && [ "$type_voiture" != "v2" ]; then
    echo "Usage : $0 [v1|v2] [nb voitures] [longueur route]   ou   $0 arreter" >&2
    exit 1
fi

if ! command -v gcc >/dev/null || ! command -v make >/dev/null; then
    echo "Erreur : gcc ou make introuvable." >&2
    echo "Sous Ubuntu, et dans WSL : sudo apt install build-essential gdb" >&2
    exit 1
fi

# 1. Compilation de tous les dossiers, par le Makefile de l'enseignant
make -f Makefile all

cd Verrous

# 2. Voitures restees d'un lancement precedent
arreter

# 3. Route neuve
./init_fich_route ../Fichiers/route.bin "$longueur"

# 4. Voitures en arriere-plan : leurs traces vont dans un fichier, pour ne
#    pas se meler a l'affichage de vision
bash lancer_voitures.sh ../Fichiers/route.bin "$nb_voitures" "$type_voiture" > ../Fichiers/voitures.log 2>&1
echo "$nb_voitures voiture(s) $type_voiture lancee(s), traces dans Fichiers/voitures.log"
trap 'echo "Pour arreter les voitures qui roulent encore : ./run.sh arreter"' EXIT

# 5. Vision au premier plan (Ctrl+C pour quitter)
./vision ../Fichiers/route.bin
