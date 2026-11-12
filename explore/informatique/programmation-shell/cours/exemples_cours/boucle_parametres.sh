#!/bin/bash

if( test $# -eq 0 ) then 
    echo "Tests sur les boucles avec liste des parametres"
    echo "Usage : $0 <param1> <param2> ..."
    exit 1
fi

for v in $* ;  do 
   echo $v 
done


