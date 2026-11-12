#!/bin/bash
# Exemple de resultat de fonction par parametre resultat 

fonc()
{
    # un des parametres de fonc contient le nom de la variable ou l'on doit mettre le resultat
    resfonc=$1 

    res="abcdefghijklmnopqrstuvwxyz"
    eval "$resfonc=$res"
}

# Programme Principal

fonc resMain
echo "Le resulat de fonc est [$resMain]"
