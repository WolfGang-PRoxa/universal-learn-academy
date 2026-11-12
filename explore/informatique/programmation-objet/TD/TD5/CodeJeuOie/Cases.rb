# ==============================================================================
# Fichier : Cases.rb
# Modélisation des cases du Jeu de l'Oie sous forme de liste doublement chaînée.
# Chaque case est un maillon autonome qui sait propager le déplacement.
# ==============================================================================

# ==============================================================================
# Classe Case : Comportement de base du maillon (et case neutre)
# ==============================================================================
# Responsabilité :
#   - Représente une case neutre sans effet particulier à l'arrêt.
#   - Assure le chaînage bidirectionnel (caseSuivante / casePrecedente).
#   - Gère la propagation récursive du déplacement (avancer et reculer).
#
# Ce qu'elle connaît :
#   - @nom            : Intitulé de la case (String)
#   - @casePrecedente : Référence vers la case précédente (Case)
#   - @caseSuivante   : Référence vers la case suivante (Case)
# ==============================================================================
class Case
  # Les variables d'instances sont :
  #        @nom @casePrecedente @caseSuivante
  
  # Génération de la méthode d'accès en lecture au nom
  attr :nom,false
  # Génération des méthodes d'accès en écriture à caseSuivante et casePrécedente (pour ajouterCase du Jeu) 
  attr_writer :caseSuivante,:casePrecedente
  # Génération de la méthode d'accès en lecture à caseSuivante (pour ajouterCase du Jeu) 
  attr_reader :caseSuivante
  
  # Initialisation d'une case avec son intitulé
  # @param unNom [String] Le nom de la case
  def initialize(unNom)
    @nom = unNom
  end

  # Affichage textuel de la case
  def to_s
     @nom+"\n"
  end
  
  # Permet d'afficher récursivement toutes les cases du plateau à partir de celle-ci
  # @return [String] La concaténation des noms de toutes les cases restantes
  def afficheTout
    retour=self.to_s   
      if @caseSuivante != nil
         retour+=@caseSuivante.afficheTout()
      end
      return retour
  end
  
  # Fait avancer le joueur de n cases par récursion terminale
  # - À chaque étape, met à jour la position du joueur sur self.
  # - Si nCases > 0 : transmet l'ordre à la caseSuivante avec (nCases - 1).
  # - Si nCases == 0 : point d'arrêt atteint, déclenche l'action traite(unJoueur).
  # @param unJoueur [Joueur] Le joueur en train d'avancer
  # @param nCases [Integer] Le nombre de cases restant à parcourir
  # @return [Case] self
  def faitAvancer(unJoueur,nCases)
      unJoueur.case=self
      if (nCases >0)
        @caseSuivante.faitAvancer(unJoueur,(nCases-1))
      else
        self.traite(unJoueur)
      end
      return self
  end
  
  # Fait reculer un joueur de n cases par récursion terminale
  # - À chaque étape, met à jour la position du joueur sur self.
  # - Si nCases > 0 : transmet l'ordre à la casePrecedente avec (nCases - 1).
  # - Si nCases == 0 : point d'arrêt atteint, déclenche l'action traite(unJoueur).
  # @param unJoueur [Joueur] Le joueur en train de reculer
  # @param nCases [Integer] Le nombre de cases restant à reculer
  # @return [Case] self
  def faitReculer(unJoueur,nCases)
      unJoueur.case=self
      if (nCases > 0)
        @casePrecedente.faitReculer(unJoueur,(nCases - 1))
      else
        self.traite(unJoueur)
      end
      return self
  end
  
  # Traitement d'un joueur terminant son déplacement sur cette case.
  # Comportement par défaut (neutre) : affiche la nouvelle position du joueur.
  # @param unJoueur [Joueur] Le joueur arrivé sur la case
  # @return [Case] self
  def traite(unJoueur)
      print unJoueur
      return self
  end
end 
# Fin de la classe Case

# ==============================================================================
# Classe CaseDepart : Première case du parcours
# ==============================================================================
# Responsabilité :
#   - Agit comme butoir au départ : si un joueur recule jusqu'ici, il s'arrête.
# ==============================================================================
class CaseDepart < Case
  # On ne peut reculer au-delà de la case départ (règle du jeu de l'oie).
  # Intercepte tout recul supplémentaire et maintient le joueur sur place.
  def faitReculer(unJoueur,nCases)
      # ne rien faire : le recul s'arrête net ici
      unJoueur.case=self
      return self
  end
end

# ==============================================================================
# Classe CasePerdu : Case piège éliminatoire
# ==============================================================================
# Responsabilité :
#   - Élimine le joueur dès qu'il atterrit dessus.
# ==============================================================================
class CasePerdu < Case
  # Le traitement positionne le statut du joueur à :elimine
  def traite(unJoueur)
     # le joueur a perdu
     super(unJoueur)
     unJoueur.statut=:elimine
     return self
  end
end 

# ==============================================================================
# Classe CaseDeplacer : Classe abstraite pour déplacements forcés
# ==============================================================================
# Responsabilité :
#   - Modélise une case qui impose un déplacement relatif de n cases.
# Ce qu'elle connaît :
#   - @nbDeCases : Nombre de cases dont le joueur doit bouger (Integer)
# ==============================================================================
class CaseDeplacer < Case 
  
  # une Vi Suppélentaire : le nb de case du déplacement @nbDeCases
  def initialize(unNom,unEntier)
    super(unNom)
    @nbDeCases=unEntier
  end
  
end

# ==============================================================================
# Classe CaseAvancer : Case bonus avançant de n cases
# ==============================================================================
class CaseAvancer < CaseDeplacer
  # À l'atterrissage, force le joueur à avancer à nouveau de @nbDeCases
  def traite(unJoueur)
    # le traitement est aussi modifié
    super(unJoueur)
    self.faitAvancer(unJoueur,@nbDeCases)
    return self
  end

end

# ==============================================================================
# Classe CaseReculer : Case malus reculant de n cases
# ==============================================================================
class CaseReculer < CaseDeplacer
    # À l'atterrissage, force le joueur à reculer de @nbDeCases
    def traite(unJoueur)
      super(unJoueur)
      self.faitReculer(unJoueur,@nbDeCases)
      return self
    end
end

# ==============================================================================
# Classe CaseAllerA : Téléportation vers une case cible
# ==============================================================================
# Responsabilité :
#   - Téléporte instantanément le joueur sur une case prédéfinie (@enCase).
# Ce qu'elle connaît :
#   - @enCase : La case destination (Case)
# ==============================================================================
class CaseAllerA < Case
# Variable d'instance supplémentaire @enCase
  def initialize(unNom,uneCase)
    super(unNom)
    @enCase=uneCase
  end
  
  # Téléporte le joueur sur la case cible et exécute son traitement
  def traite(unJoueur)
     super(unJoueur)
     unJoueur.case=@enCase
     @enCase.traite(unJoueur)
     return self
  end
  
end

# ==============================================================================
# Classe CaseArrivee : Case finale du parcours
# ==============================================================================
# Responsabilité :
#   - Gère la victoire d'un joueur (si jet exact).
#   - Gère le rebond en arrière si le lancer de dés est supérieur au reste à faire.
#   - Notifie le jeu du vainqueur.
# Ce qu'elle connaît :
#   - @leJeu : Instance du jeu pour désigner le vainqueur (Jeu)
# ==============================================================================
class CaseArrivee < Case

# Variable d'instance supplémentaire @leJeu
  def initialize(unNom,unJeu)
    super(unNom)
    @leJeu=unJeu
  end
   
   # Dans le cas de l'arrivée :
   # Si le joueur doit encore avancer (nCases > 0), il rebrousse chemin en reculant.
   # Si nCases == 0, le joueur atterrit pile sur l'arrivée.
   def faitAvancer(unJoueur,nCases)
     unJoueur.case=self
     self.faitReculer(unJoueur,nCases)
     return self
   end
   
   # Le joueur s'arrête pile sur l'arrivée : il gagne la partie !
   def traite(unJoueur)
     super(unJoueur)
     unJoueur.statut=:gagnant
     @leJeu.leJoueurGagnant=unJoueur
     return self
   end
   
end
