classDiagram
    direction TB

    class Cellule {
        -Object valeur
        -Cellule suivant
        +initialize(valeur: Object, suivant: Cellule)
        +valeur() Object
        +suivant() Cellule
        +suivant=(Cellule) void
        +to_s() String
    }

    class FileCirculaire {
        -Cellule en_tete
        +initialize()
        +vide?() Boolean
        +premier() Object
        +entrer(Object valeur) FileCirculaire
        +sortir() Object
        +to_s() String
        +taille() Integer
    }

    FileCirculaire "1" *-- "1" Cellule : -en_tete (sentinelle)
    FileCirculaire ..> Cellule : crée et manipule >
    Cellule "1" --> "0..1" Cellule : +suivant (chaînage)

    note for FileCirculaire "TDA File (FIFO : First In, First Out)
    Structure : Liste circulaire avec sentinelle
    Accès tête/queue en O(1)"
    note for Cellule "Maillon de la structure chaînée
    - valeur : immuable (attr_reader)
    - suivant : mutable (attr_accessor)"