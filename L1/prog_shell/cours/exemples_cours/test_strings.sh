#!/bin/bash

if( test $# -ne 2 ) then 
    echo "Tests sur les chaines de caracteres"
    echo "Usage  $0 <chaine1> <chaine2>"
    exit 1
fi

String1=$1 
String2=$2

if( test -z $String1 ) then 
    echo "$String1 est vide"
fi 
if( test -n $String1 ) then 
    echo "$String1 n'est pas vide"
fi 
if( test $String1 = $String2 ) then
    echo "$String1 est identique a $String2"
fi
if( test $String1 != $String2 ) then
    echo "$String1 est differente de $String2"
fi 
if( test $String1 \< $String2 ) then 
    echo "$String1 est avant $String2"
fi





