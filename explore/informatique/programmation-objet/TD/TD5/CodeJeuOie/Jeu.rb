# ==============================================================================
# Fichier : Jeu.rb
# Classe principale orchestrant une partie de Jeu de l'Oie.
# ==============================================================================
load "Cases.rb"
load "Joueur.rb"

# ==============================================================================
# Classe Jeu
# ==============================================================================
# Responsabilité :
#   - Crée et configure le plateau (chaînage des cases) et les joueurs.
#   - Anime la boucle de jeu tour par tour en mode round-robin (file d'attente).
#   - Gère les conditions de victoire et de fin de partie.
#
# Ce qu'elle connaît :
#   - @caseDepart      : Première case du plateau (CaseDepart)
#   - @listeDeJoueurs  : File des joueurs encore en lice (Array de Joueur)
#   - @leJoueurGagnant : Le joueur ayant atteint l'arrivée (Joueur)
# ==============================================================================
class Jeu
# Les variables d'instances sont @listeDeCases, @listeDeJoueurs, @leJoueurGagnant
  
  attr :leJoueurGagnant,true
  
  # affichage des cases du jeu
  def to_s
   "Le Jeu est composé des cases suivantes : \n"+ @caseDepart.afficheTout
  end
  
  # Initialisation du plateau et de la liste des joueurs
  # @param listeCase [Array<Case>] La liste ordonnée des cases à chaîner
  # @param listeJoueur [Array<Joueur>] La liste des joueurs au départ
private  def initialiseToi(listeCase,listeJoueur)
     @listeDeJoueurs=listeJoueur     
     listeCase.map &->(c){ajouteCase(c)}
  end
   
   # Ajoute une case en fin de parcours en maintenant le double chaînage
   # (mise à jour de caseSuivante de la dernière case et casePrecedente de la nouvelle).
   # @param uneCase [Case] La case à insérer
   def ajouteCase(uneCase)
     if (@caseDepart==nil)
       @caseDepart=uneCase
     else
       caseCourante=@caseDepart
       while(caseCourante.caseSuivante != nil)
         caseCourante=caseCourante.caseSuivante
       end
       caseCourante.caseSuivante=uneCase
       uneCase.casePrecedente=caseCourante
     end
  end
  
  # Initialise le jeu avec un parcours enrichi (environ 25 cases) et 3 joueurs
  def initialize()
    caseDepart = CaseDepart.new("Case Départ")
    caseBosquet = Case.new("Le Bosquet (Case Neutre 12)")

    initialiseToi([
        caseDepart,
        Case.new("Case Neutre 1"),
        CaseAvancer.new("Le Pont (Avancer de 4)", 4),
        Case.new("Case Neutre 3"),
        CaseReculer.new("Vent contraire (Reculer de 2)", 2),
        CaseAllerA.new("Passage secret vers le Bosquet", caseBosquet),
        Case.new("L'Auberge (Case Neutre 6)"),
        CaseAvancer.new("Coup de vent (Avancer de 2)", 2),
        CasePerdu.new("Le Puits (Perdu)"),
        Case.new("Case Neutre 9"),
        CaseReculer.new("Fausse manoeuvre (Reculer de 3)", 3),
        Case.new("Case Neutre 11"),
        caseBosquet,
        CaseAllerA.new("Le Labyrinthe (Retour au Départ)", caseDepart),
        Case.new("Case Neutre 14"),
        CaseAvancer.new("L'Oie blanche (Avancer de 3)", 3),
        Case.new("Case Neutre 16"),
        CasePerdu.new("Le Piège (Perdu)"),
        CaseReculer.new("Brouillard (Reculer de 4)", 4),
        Case.new("Case Neutre 19"),
        CaseAvancer.new("Sprint final (Avancer de 2)", 2),
        Case.new("Case Neutre 21"),
        CaseAllerA.new("Bourrasque (Retour au Bosquet)", caseBosquet),
        Case.new("Dernière halte (Case Neutre 23)"),
        CaseArrivee.new("Case Arrivée", self)
        ], [
          Joueur.new("Rouge", caseDepart),
          Joueur.new("Vert", caseDepart),
          Joueur.new("Bleu", caseDepart)
        ]
      )
  end
  
  # Boucle principale de jeu (tour par tour) :
  # - Récupère le joueur en tête de file (shift).
  # - Le fait jouer (lancer de dés et déplacement).
  # - Le réinsère en queue de file s'il n'est pas éliminé (push).
  # - Arrêt dès qu'il y a un gagnant ou plus aucun joueur.
  def lanceToi
    # Execution du jeu

    while (@leJoueurGagnant == nil) && (@listeDeJoueurs.empty? == false)
      # Je retire le premier joueur
      joueur=@listeDeJoueurs.shift
      joueur.joue
      # joueur.afficheToi
      @listeDeJoueurs.push(joueur) unless joueur.estElimine?
    end
    if @listeDeJoueurs.empty?
      print "\n\n !!!!! Tous les joueurs sont éliminés !!!!!\n"
    else 
      print "\n\n !!!!! Le joueur ", @leJoueurGagnant.couleur, " a gagne !!!!!\n"
    end

  end
end
