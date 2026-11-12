classDiagram
direction RL
    class Generateur {
	    -premierFiltre: Filtre
	    +lanceToi(unNombre: number)
    }

    class Filtre {
	    -valeur: number
	    -suivant: Filtre
	    +aToiDeTraiter(unNombre: number) : Filtre
    }

	note for Filtre "Un filtre est responsable  de 
	-	sa valeur, 
	-	la création du filtre qui le suit et de la communication avec celui-ci.
    A) Les Variables d'instances
      Il connait sa valeur (le nombre premier), 
       et un lien vers le filtre suivant s'il existe. 
       il possède deux variables d'instances : 
        -valeur (un entier)
        -suivant (unFiltre/nil si pas de suivant)
        Pas de méthodes d'accès, les filtres sont immuables et on ne peut que les afficher
	B) Les services
	   a) afficher son nombre premier 
	   b) traiter un nombre qu'il reçoit en paramêtre	
	C) Création des Filtres : on fournit la valeur du filtre	
	"
	note for Generateur "Le générateur est responsable de
    -	lancer la génération des filtres
    -	lancer l'affichage des filtres
    A) Les Variables d'instances
        Il connaît son premier filtre (variable d’instance premierFiltre) 
        de valeur 2 (plus petit des nombres premiers).
        -premierFiltre, initialisé avec un filtre de valeur 2
    B) Les services
        a) lancer la génération des filtres de valeur inférieur à unNombre (donné).
            lanceToi (unNombre)
        b) Il est capable d'afficher tous les filtres générés
    C) Création des Générateurs
        Pas de paramètre à la création d'un générateur
	"

    Generateur *-- Filtre : premierFiltre
    Filtre *-- Filtre : suivant
