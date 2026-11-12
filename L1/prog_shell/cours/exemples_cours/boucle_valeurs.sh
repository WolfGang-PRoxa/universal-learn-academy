#!/bin/bash

if( test $# -ne 0 ) then 
    echo "Tests sur les boucles avec liste de valeurs"
    echo "Usage : $0 "
    exit 1
fi

for v in abc def "hi 12" 123 ;  do 
   echo $v 
done

