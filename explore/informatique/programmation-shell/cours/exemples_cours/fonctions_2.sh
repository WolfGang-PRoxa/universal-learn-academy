# Fonction ayant comme parametres 2 nombres n1 et n2
# renvoie 2 si erreur 
#         1 si n1 <= n2 
#         0 sinon 
inferieur()
{
    if( test $# -ne 2 ) then 
	return 2
    fi
    if( test $1 -le $2 ) then 
	return 1
    else
	return 0 
    fi
}

# Programme principal
# Les parametres du PP sont affectes aux parametres de la fonction
inferieur $* 
case $? in
0) echo "les deux nombres $* sont dans l'ordre decroissant" ;;
1) echo "les deux nombres $* sont dans l'ordre croissant" ;;
2) echo "erreur de parametre" ;;
*) echo "retour inconnu" ;;
esac

