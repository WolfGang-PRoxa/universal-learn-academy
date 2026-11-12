# Fonction redefinissant pwd (interdit)
pwd()
{
    echo "	...je suis perdu... ! "
}

# Fonction redefinissant la commande ls
ls()
{
    echo "-----"
    for f in $* ; do 
	file $f  
    done
    echo "-----"
}

# Programme principal

# test de la nouvelle commande ls
read -p "Entrez le nom d'un repertoire : " dir
cd $dir

echo "Execution de la fonction redefinissant \"ls\""
ls *


# test de la nouvelle commande pwd
echo "Execution de la fonction redefinissant \"pwd\""
pwd


