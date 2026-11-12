case $# in 
    0) pwd ;;
    1) if( test -f $1 ) then 
        cat $1
        else
        echo "fichier $1 inexistant" 
        fi ;;

    2) if( test -f $2 ) then 
        echo "fichier $2 existant" 
        else
        cat $1 > $2
        fi ;;
        
    *) echo "2 parametres attendus (au lieu de $# [$*])";;
esac
