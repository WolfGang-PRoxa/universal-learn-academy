case $# in 
    0) echo "Zero parametres" ;;
    1) echo "Un parametre" ;;
    2) echo "Deux parametres " ;; 
    *) echo "De 0 a 2  parametres attendus (au lieu de $# [$*])";;
esac
