#!/bin/bash

if( test $# -ne 1 ) then 
    echo "Tests sur les boucles avec liste issue d'une expression"
    echo "Usage : $0 <expression>"
    exit 1
fi

Expr=$1
for v in `$Expr` ; do
    echo "--- $v ---"
done



