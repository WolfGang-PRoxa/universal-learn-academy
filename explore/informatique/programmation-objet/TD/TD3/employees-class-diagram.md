classDiagram
    direction TB
    class Employe {
        <<abstract>>
        - matricule : String
        - nom : String
        + recruter(matricule : String, nom : String)$
        + matricule() String
        + nom() String
        + calculerSalaire()* double
        + to_s() String
    }

    class EmployeHoraire {
        <<abstract>>
        - nbHeures : double
        - tauxHoraire : double
        + recruter(matricule : String, nom : String, nbHeures : double, tauxHoraire : double)$
        + nbHeures() double
        + tauxHoraire() double
        + calculerPrime()* double
        + calculerSalaire() double
    }

    class Cadre {
        - salaireMensuel : double
        + recruter(matricule : String, nom : String, salaireMensuel : double)$
        + salaireMensuel() double
        + calculerSalaire() double
    }

    class Stagiaire {
        - gratificationFixe : double
        + recruter(matricule : String, nom : String, nbHeures : double, tauxHoraire : double, gratificationFixe : double)$
        + gratificationFixe() double
        + calculerPrime() double
    }

    class Interimaire {
        - tauxPrecarite : double
        + recruter(matricule : String, nom : String, nbHeures : double, tauxHoraire : double, tauxPrecarite : double)$
        + tauxPrecarite() double
        + calculerPrime() double
    }

    class Directeur {
        - bonusPerformance : double
        + recruter(matricule : String, nom : String, salaireMensuel : double, bonusPerformance : double)$
        + bonusPerformance() double
        + calculerSalaire() double
    }

    %% Relations d'héritage
    Employe <|-- EmployeHoraire : Niveau 2 (Abstraite)
    Employe <|-- Cadre : Niveau 2 (Concrète)

    EmployeHoraire <|-- Stagiaire : Niveau 3 (Concrète)
    EmployeHoraire <|-- Interimaire : Niveau 3 (Concrète)
    Cadre <|-- Directeur : Niveau 3 (Concrète)