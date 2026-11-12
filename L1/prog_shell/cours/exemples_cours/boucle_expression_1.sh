#!/bin/bash

if( test $# -ne 0 ) then 
    echo "Tests sur les boucles avec liste issue d'une expression"
    echo "Usage : $0 "
    exit 1
fi

for v in `ls w*.sh` ; do
    echo $v 
done



