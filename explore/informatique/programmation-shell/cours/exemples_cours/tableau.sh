#!/bin/bash
Tab=(il fait beau n\'est ce pas \?)

echo "Element Tab[2]    = ${Tab[2]}"
echo "Tous les elements = ${Tab[*]}"
echo "Nombre d'elements = ${#Tab[*]}" 

# Erreurs de syntaxe 
echo $Tab[1]


