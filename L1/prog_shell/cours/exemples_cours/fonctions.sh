# Fonction comptant le nb de car dans un mot
compteMot()
{
    n=`echo $1 | wc -c`
    n=`expr $n - 1`
    return $n
}

# Fonction comptant le nb de car dans une ligne
compteLigne()
{
    som=0
    for mot in $* ; do 
	compteMot $mot
	som=`expr $som + $?`
    done
    return $som
}

# Programme principal
while read -p "Entrez une ligne : " ligne ; do 
    compteLigne $ligne 
    echo "Nombre de car dans la ligne \"$ligne\" = $?"
done
