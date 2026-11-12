#!/bin/bash

read cmd
exec $cmd

# Tout ce aui suit ne sera pas exécuté
# car le code de $cmd a remplacé celui ci 
echo ligne 1
echo ligne 2
echo ligne 3
