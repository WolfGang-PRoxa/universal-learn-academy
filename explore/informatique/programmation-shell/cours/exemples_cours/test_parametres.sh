#!/bin/bash

if( test $# -ne 4 ) then 
    echo "Tests sur les parametres"
    echo "Usage : $0 <un repertoire> <un fichier> <nombre1> <nombre2> (avec nombre1 < nombre2)"
    exit 1
fi

if ( ! test -d $1  ) then 
	echo "Erreur: $1 n'est pas un repertoire"
	exit 1
fi
if ( ! test -f $2 ) then 
	echo "Erreur: $2 n'est pas un fichier"
	exit 1
fi
if ( test $3 -ge $4 ) then 
	echo "Erreur: le 1er nombre ($3) doit etre inferieur au 2ieme ($4)"
	exit 1
fi
echo "Tous les parametres sont corrects"