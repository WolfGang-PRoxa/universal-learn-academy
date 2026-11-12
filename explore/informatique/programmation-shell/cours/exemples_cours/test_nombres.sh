#!/bin/bash

if( test $# -ne 2 ) then 
    echo "Tests sur les nombres"
    echo "Usage  $0 <Nombre1> <Nombre2>"
    exit 1
fi

N1=$1
N2=$2

if( test $N1 -eq $N2 ) then 
	echo "$N1 = $N2"
fi
if( test $N1 -ne $N2 ) then 
	echo "$N1 n'est pas egal a $N2"
fi
if( test $N1 -gt $N2 ) then 
	echo "$N1 > $N2"
fi
if( test $N1 -ge $N2 ) then 
	echo "$N1 >= $N2"
fi
if( test $N1 -le $N2 ) then 
    echo "$N1 <= $N2"
fi
