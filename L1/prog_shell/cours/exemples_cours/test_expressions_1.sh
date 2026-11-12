#!/bin/bash

if( test $# -ne 0 ) then 
    echo "Tests sur les expressions"
    echo "Usage  $0"
    exit 1
fi

echo -n "( test 12 -eq 12 ) --> " 
if( test 12 -eq 12 ) then  echo VRAI ; else echo FAUX; fi

echo -n "( ! test 12 -eq 12 ) --> "
if( ! test 12 -eq 12 ) then echo VRAI ; else echo FAUX; fi

echo -n "( ! test 13 -eq 12 ) --> " 
if( ! test 13 -eq 12 ) then echo VRAI ; else echo FAUX; fi

echo -n "( test abc = abc -a 12 -eq 12 ) --> "
if( test abc = abc -a 12 -eq 12 ) then echo VRAI ; else echo FAUX; fi

echo -n "( test abc = abc -a 13 -eq 12 ) --> "
if( test abc = abc -a 13 -eq 12 ) then echo VRAI ; else echo FAUX; fi

echo -n "( test abc = abc -o 13 -eq 12 ) --> "
if( test abc = abc -o 13 -eq 12 ) then echo VRAI ; else echo FAUX; fi

echo -n "( test abc = zbc -o 13 -eq 12 ) --> "
if( test abc = zbc -o 13 -eq 12 ) then echo VRAI ; else echo FAUX; fi


