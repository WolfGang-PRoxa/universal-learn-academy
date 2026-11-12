#!/bin/bash
#
# Compile tout le projet puis lance l'executable.
#
# Rappel : les dossiers du projet se declarent dans Makefile.dir,
# PAS ici. Un script shell ne peut pas definir de variable make.
#

set -e

cd "$(dirname "$0")"

make all
./build/hadamard
