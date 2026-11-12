classDiagram
    class Afficheur {
	    -decaleur: Decaleur
	    +setMessage(unMessage)
	    +top()
    }

    class Decaleur {
	    +largeur: Integer
	    +raz()
	    +decale(caractereEntrant)
    }

    class Latence {
	    -latence: Integer
	    +setMessage(unMessage)
    }

    class Vitesse {
	    -vitesse: Integer
	    +top()
    }

	note "Pensez pour chacune des classes à :
    1) Réfléchir aux accès aux Vi
	2) Comment instancier
    3) Comment afficher les objets
    [4) Comment Comparer]"

    Afficheur "1" *-- "1" Decaleur
    Afficheur <|-- Latence
    Latence <|-- Vitesse
