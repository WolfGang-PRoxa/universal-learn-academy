#!/bin/bash
# Exemple de resultat de fonction par echo

fonc()
{
    res="abcdefghijklmnopqrstuvwxyz"
    echo $res
}

# Programme Principal

resMain=`fonc`
echo "Le resulat de fonc est [$resMain]"
