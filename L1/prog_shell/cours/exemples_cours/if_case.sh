if ( test $# -eq 0 ) then 
    echo "Zero parametres" 
else
    if ( test $# -eq 1 ) then 
	echo "Un parametre"
    else
	if ( test $# -eq 2 ) then 
	    echo "Deux parametres "
	else
	    echo "De 0 a 2  parametres attendus (au lieu de $# [$*])"
	fi
    fi
fi
