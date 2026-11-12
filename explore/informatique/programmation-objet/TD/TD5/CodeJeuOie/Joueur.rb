# ==============================================================================
# Fichier : Joueur.rb
# Modélisation d'un joueur du Jeu de l'Oie.
# ==============================================================================

# ==============================================================================
# Classe Joueur
# ==============================================================================
# Responsabilité :
#   - Représente un joueur (sa couleur, sa position courante et son statut).
#   - Lance les dés et délègue son déplacement à sa case courante.
#
# Ce qu'elle connaît :
#   - @couleur : Identifiant ou couleur distinctive du joueur (String)
#   - @case    : Case actuelle occupée par le joueur (Case)
#   - @statut  : État du joueur (:enjeu, :elimine, :gagnant)
# ==============================================================================
class Joueur
# les variables d'instances @couleur @case @statut '

attr :case,true
attr :statut, true
attr :couleur, false
  
  
   # retourne vrai si le joueur est elimine
  def estElimine?
    return  @statut == :elimine   
  end
   
  # Fait jouer son tour au joueur :
  # Tire les dés et demande à sa case actuelle de le faire avancer du résultat obtenu
  def joue
  # le joueur lance les des
      @case.faitAvancer(self,(self.tireLesDes)) if @statut == :enjeu
  end
  
   # Simule le jet de 2 dés à 6 faces (résultat entre 2 et 12, sans classe Dé)
   # @return [Integer] Le résultat obtenu
   def tireLesDes
     tt = (rand(6)+1) + (rand(6)+1)
     print "\n\nLe joueur " , @couleur , ' a fait : ' , tt
     return tt
   end
   
   # Représentation textuelle de l'état du joueur et de sa position
   def to_s
        "\njoueur " +@couleur+' a la case ' + @case.nom 
   end
    
   # Initialisation d'un joueur
   # @param uneCouleur [String] Le nom ou la couleur du joueur
   # @param unePosition [Case] La case initiale (généralement la case départ)
   def initialize(uneCouleur,unePosition)
      @couleur = uneCouleur
      @case = unePosition
      @statut = :enjeu
   end
end
