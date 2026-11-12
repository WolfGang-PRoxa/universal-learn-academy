#!/bin/bash
# Exemple de resultat de fonction par variable globale

fonc()
{
    res="abcdefghijklmnopqrstuvwxyz"
    resFonc=$res
}

# Programme Principal

fonc

echo "Le resulat de fonc est [$resFonc]"