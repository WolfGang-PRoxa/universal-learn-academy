#!/bin/bash

# Saisie de 1 parametre dans $1
 i=1

# Pour avoir le contenu du parametre numero i 
eval "echo \$$i"

# Supposons que $1 --> "toto"
# Double interprétation de : "echo \$$i" --[1]--> echo $1 --[2]--> "toto"












