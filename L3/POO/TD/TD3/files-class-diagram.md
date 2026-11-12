classDiagram
    direction TB

    class Document {
        <<abstract>>
        - numeroCourant : int$
        - titre : String
        - numEnr : int
        + nouveau(unTitre : String)$ Document
        - new(...)$
        - initialize(titre : String)
        + titre() String
        + numEnr() int
        + to_s() String
    }

    class Livre {
        - auteur : String
        - nbPages : int
        + nouveau(titre : String, auteur : String, nbPages : int)$ Livre
        - initialize(titre : String, auteur : String, nbPages : int)
        + auteur() String
        + nbPages() int
        + to_s() String
    }

    class Dictionnaire {
        - langue : String
        - nbArticles : int
        + nouveau(titre : String, langue : String, nbArt : int)$ Dictionnaire
        - initialize(titre : String, langue : String, nbArt : int)
        + langue() String
        + nbArticles() int
        + to_s() String
    }

   
    %% Relations d'héritage
    Document <|-- Livre : hérite
    Document <|-- Dictionnaire : hérite