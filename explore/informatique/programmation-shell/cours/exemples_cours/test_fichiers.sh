#!/bin/bash
if( test $# -ne 1 ) then 
    echo "Tests sur les fichiers/répertoire"
    echo "Usage  $0 <fichier>"
    exit 1
fi

Param=$1
if( test -d $Param ) then
    echo "$Param est un répertoire"
fi
if( test -e $Param ) then 
    echo "$Param existe"
fi 
if( test -f $Param ) then
    echo "$Param est un fichier ordinaire"
fi


