classDiagram
direction BT
    class Decaleur {
	    -buffer  : un tableau
	    -largeur : un entier
	    +largeur() : un entier
	    +raz()
	    +decale(caractereEntrant) : un caractere
    }

	note for Decaleur "-Création d'un Decaleur en fournissant la largeur
  -Une méthode d'accès en lecture à la variable d'instance largeur
  -Pas d'accès à la variable d'instance buffer
  -On doit pouvoir afficher les objets de la classe Decaleur"
