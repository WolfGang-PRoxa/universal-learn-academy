#!/bin/bash

if( test $# -ne 2 ) then 
    echo "Tests sur les expressions"
    echo "Usage  $0 <expression1> <expression2>"
    exit 1
fi

Exp1=$1
Exp2=$2

echo -n "( test $Exp1 ) --> " 
if( test $Exp1 ) then  echo VRAI ; else echo FAUX; fi

echo -n "( test $Exp2 ) --> "
if( test $Exp2 ) then echo VRAI ; else echo FAUX; fi

echo -n "( test $Exp1 -a $Exp2 ) --> "
if( test $Exp1 -a $Exp2 ) then echo VRAI ; else echo FAUX; fi

echo -n "( test $Exp1 -o $Exp2 ) --> "
if( test $Exp1 -o $Exp2 ) then echo VRAI ; else echo FAUX; fi
