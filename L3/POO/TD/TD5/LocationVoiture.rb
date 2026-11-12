# Module Critere
# Ce module définit l'interface pour tous les critères de sélection.
module Critere
  def correspond?(v)
    # Délègue la logique de correspondance à la méthode que chaque classe doit implémenter.
    return self.estSatisfaitPar?(v)
  end
end

# Question 1 : Donner le code de la classe Voiture
class Voiture
  attr_reader :marque, :nom_modele, :annee_production
  attr_accessor :prix_vente

  # On rend le constructeur `new` privé pour forcer l'utilisation de la méthode de fabrique `creer`.
  private_class_method :new

  def initialize(marque, nom_modele, annee_production, prix_vente)
    @marque = marque
    @nom_modele = nom_modele
    @annee_production = annee_production
    @prix_vente = prix_vente
  end

  # Méthode de fabrique (Factory Method) pour créer des instances de Voiture.
  def self.creer(marque, nom_modele, annee_production, prix_vente)
    new(marque, nom_modele, annee_production, prix_vente)
  end

  def to_s
    "Voiture: #{@marque} #{@nom_modele} (#{@annee_production}) - #{@prix_vente}€"
  end
end

# Question 2 & 5 : Donnez le code la classe Agence.
class Agence
  def initialize
    @voitures = []
  end

  def ajoute_voiture(voiture)
    # On s'assure que l'objet est bien une instance de Voiture et n'est pas nil
    unless voiture.is_a?(Voiture)
      raise ArgumentError, "Seules les instances de la classe Voiture peuvent être ajoutées."
    end
    @voitures << voiture
    self # Retourne l'instance de l'agence pour permettre le chaînage
  end

  # Question 5 : Méthode de sélection
  def selectionne(un_critere)
    @voitures.select { |v| un_critere.correspond?(v) }
  end
end

# Question 3 : Donnez le code de la classe CritereMarque
class CritereMarque
  include Critere

  def initialize(marque)
    @marque = marque
  end

  def estSatisfaitPar?(v)
    v.marque == @marque
  end

  def to_s()
    return "#{self.class} -> Marque : #{@marque}"
  end
  	
end

# Question 4 : Donnez le code de la classe CriterePrixInf
# class CriterePrixInf
#   include Critere
# 
#   def initialize(prix)
#     @prix = prix
#   end
# 
#   def estSatisfaitPar?(v)
#     v.prix_vente <= @prix
#   end
# end

# Question 4bis : Donnez le code de la classe CriterePrixSup
# class CriterePrixSup
#   include Critere
# 
#   def initialize(prix)
#     @prix = prix
#   end
# 
#   def estSatisfaitPar?(v)
#     v.prix_vente >= @prix
#   end
# end
 
# Refactorisation du code précédent des questions 4 et 4bis
#  avec une classe Abstraite pour les critères prix
#  Plus de duplication de code

class CriterePrix
	include Critere
	
	# @prix : Une Variable d'instance qui représente le prix

	#@param m marque 
	def initialize(lePrix)
		@prix = lePrix;
	end
	
	def estSatisfaitPar?(v)
		raise "méthode Abstraite"
	end
  
  def to_s()
    return "#{self.class} -> Prix : #{@prix}"
  end
end

# Question 4 : Donnez le code de la classe CriterePrixInf
class CriterePrixInf < CriterePrix
  # @prix représente le prix Maximum
	def estSatisfaitPar?(v)
		return v.prix_vente < @prix
	end
end

# Question 4bis : Donnez le code de la classe CriterePrixSup
class CriterePrixSup < CriterePrix
  # @prix représente le prix Minimum
	def estSatisfaitPar?(v)
		return v.prix_vente > @prix
	end
end
 
# Question 6 version 1
# class InterCritere
#   include Critere
#
#   # @lstCriteres: Une Variable d'instance pour representer
#   #              la liste des critères à satisfaire
#
#   def initialize()
#     @lstCriteres=Array.new()
#   end
#
#   def ajouteCritere(unCritere)
#     @lstCriteres<< unCritere
#     # Attention il faut y penser
#     return self
#   end
#
#   def estSatisfaitPar?(uneVoiture)
#     # Bof
#     # reponse =true
#     # @lstCriteres.each(){|c|
#     #   reponse=reponse && c.correspond?(uneVoiture)
#     # }
#     # return reponse
#
#     # C'est mieux
#     # return @lstCriteres.reduce(true) {|reponse, c| reponse && c.correspond?(uneVoiture)}
#
#      # C'est encore mieux
#       return @lstCriteres.all?()) {|critere| critere.correspond?(uneVoiture)}
#
#     # Plus Efficace
#     # @lstCriteres.each(){|c|
#     #   puts c
#     #   if (!c.correspond?(uneVoiture))
#     #     return false
#     #   end
#     # }
#     # return true
#   end
# end
 
# Question 7 : Version 1
# class InterCritere
#   include Critere
#
#   # @lstCriteres: Une Variable d'instance pour representer
#   #              la liste des critères à satisfaire
#
#   def initialize()
#     @lstCriteres=Array.new()
#   end
#
#   def ajouteCritere(unCritere)
#     @lstCriteres<< unCritere
#     # Attention il faut y penser
#     return self
#   end
#
#   def estSatisfaitPar?(uneVoiture)
#     # Bof
#     # reponse =true
#     # @lstCriteres.each(){|c|
#     #   reponse=reponse && c.correspond?(uneVoiture)
#     # }
#     # return reponse
#
#     # C'est mieux
#     return @lstCriteres.reduce(true) {|reponse, c| reponse && c.correspond?(uneVoiture)}
#     # C'est encore mieux
#     return @lstCriteres.any?() {|critere| critere.correspond?(uneVoiture)}
#
#     # Plus Efficace
#     # @lstCriteres.each(){|c|
#     #   puts c
#     #   if (!c.correspond?(uneVoiture))
#     #     return false
#     #   end
#     # }
#     # return true
#   end
# end

# Refactorisation du code précédent des questions 6 et 7
#  avec une classe Abstraite pour les critères composites
#  Plus de duplication de code

# Classe de base pour les critères qui en contiennent d'autres.
# Elle factorise le code commun à InterCritere and OuCritere.
class CritereComposite
  include Critere
  
  # @lstCriteres: Une Variable d'instance pour representer 
  # la liste des critères à satisfaire

  # Classe Abstraite
  private_class_method :new
  
  def initialize
    @lstCriteres = []
  end

  def ajouteCritere(critere)
    @lstCriteres << critere
    self # Permet de chaîner les appels
  end

  # Cette méthode est "abstraite". Les sous-classes DOIVENT la redéfinir.
  def estSatisfaitPar?(v)
    raise NotImplementedError, "La sous-classe doit implémenter cette méthode"
  end
end

# Question 6 : InterCritere (version refactorisée)
class InterCritere < CritereComposite
  # Classe concrete
  public_class_method :new
  
  def estSatisfaitPar?(v)
    # La voiture doit satisfaire TOUS les critères de la liste (logique "ET").
    @lstCriteres.all?() { |critere| critere.correspond?(v) }
  end
end

# Question 7 : OuCritere (version refactorisée)
class OuCritere < CritereComposite
  # Classe concrete
  public_class_method :new

  def estSatisfaitPar?(v)
    # La voiture doit satisfaire AU MOINS UN des critères de la liste (OU).
    @lstCriteres.any? { |critere| critere.correspond?(v) }
  end
end

# Question 8 : Négation d'un critère (NON Logique)
class NonCritere
  include Critere

  def initialize(critere_a_nier)
    @critere_a_nier = critere_a_nier
  end

  def estSatisfaitPar?(v)
    # On inverse le résultat du critère encapsulé.
    !@critere_a_nier.correspond?(v)
  end
end


# --- Exemple d'utilisation ---
agence = Agence.new()

agence.ajoute_voiture(Voiture.creer("Renault", "Captur", 2018, 20000))
      .ajoute_voiture(Voiture.creer("Citroen", "Picasso", 2017, 22000))
      .ajoute_voiture(Voiture.creer("Audi", "Q5", 2017, 32000))
      .ajoute_voiture(Voiture.creer("Citroen", "Xsara", 2015, 18000))
      .ajoute_voiture(Voiture.creer("Renault", "Scénic", 2014, 21000))
      .ajoute_voiture(Voiture.creer("BMW", "300", 2015, 20000))
      .ajoute_voiture(Voiture.creer("Renault", "Espace", 2015, 20000))
#      .ajoute_voiture(nil) # on ne peut pas ajouter autre chose que des Voitures

puts "\n--- Test Question 5 ---"
puts "\nLes voitures de Marques Renault"
monPremierCritere = CritereMarque.new("Renault")
agence.selectionne(monPremierCritere).each() { |v| puts v }
gets
puts "\nLes voitures inférieurs ou égaux à 20000"
monSecondCritere = CriterePrixInf.new(20000)
agence.selectionne(monSecondCritere).each() { |v| puts v }
gets
puts "\nLes voitures Supérieures ou égaux à 21000"
monTroisiemeCritere = CriterePrixSup.new(21000)
agence.selectionne(monTroisiemeCritere).each() { |v| puts v }
gets
puts "\n--- Test Question 6 ---"
puts "\nLes voitures Citroen inferieures à 20000"
ic1 = InterCritere.new()
ic1.ajouteCritere(CritereMarque.new("Citroen"))
ic1.ajouteCritere(CriterePrixInf.new(20000))
agence.selectionne(ic1).each() { |v| puts v }
gets
puts "\nLes voitures Renault superieures à 20000"
ic2 = InterCritere.new()
ic2.ajouteCritere(CritereMarque.new("Renault"))
ic2.ajouteCritere(CriterePrixSup.new(20000))
agence.selectionne(ic2).each() { |v| puts v }
gets
puts "\n--- Test Question 7 ---"
puts "\nLes voitures de marque Renault ou BMW"
critere_ou = OuCritere.new()
critere_ou.ajouteCritere(CritereMarque.new("Renault"))
critere_ou.ajouteCritere(CritereMarque.new("BMW"))
agence.selectionne(critere_ou).each(){|v| puts v}
gets
puts "\n--- Test Question 8 ---"
puts "\nToutes les voitures qui ne sont pas de marque Renault"
critere_non_renault = NonCritere.new(CritereMarque.new("Renault"))
agence.selectionne(critere_non_renault).each(){|v| puts v}
gets
# Question 9 : Combinaison de critères complexes
puts "\n--- Test Question 9 ---"
puts "\nLes voitures Citroën < 20000€ OU les BMW"
# 1. Critère pour (Citroën ET < 20000€)
critere_citroen_et_inf_20k = InterCritere.new
critere_citroen_et_inf_20k.ajouteCritere(CritereMarque.new("Citroen"))
critere_citroen_et_inf_20k.ajouteCritere(CriterePrixInf.new(20000))

# 2. Critère pour (BMW)
critere_bmw = CritereMarque.new("BMW")

# 3. On combine les deux avec un OU
critere_final_q9 = OuCritere.new
critere_final_q9.ajouteCritere(critere_citroen_et_inf_20k)
critere_final_q9.ajouteCritere(critere_bmw)

# 4. On sélectionne et on affiche
agence.selectionne(critere_final_q9).each() { |v| puts v }
gets
puts "\n--- COMPLEMENT : ATTENTION ! ---"
puts "\nCa serait cool d'avoir acccès à la liste des criteres de l'InterCritere !"
puts "Fastoche, j'ajoute un attr_reader sur @lstCriteres dans la classe InterCritere"
puts <<~TEXTE
class InterCritere
	attr_reader :lstCriteres
end
TEXTE
class InterCritere
	attr_reader :lstCriteres
end
puts "\nAffichage des criteres de ic1 du test de la question 6 (y'en a 2)"
puts ic1.lstCriteres

puts 'liste1=ic1.lstCriteres()'
liste1=ic1.lstCriteres()

puts "Vas y que j'ajoute un critère sans passer par l'interface !!!!!"
puts 'liste1<<CritereMarque.new("Renault")'
liste1<<CritereMarque.new("Renault")
puts "\nAffichage des criteres de ic1"
puts ic1.lstCriteres
puts "y'en a 3 maintenant, PAS GLOP, PAS GLOP !!"
gets

puts "\nla Bonne solution pour faire ca en évitant la poignée"
puts <<~TEXTE
class InterCritere
	# Defintion de la méthode d'accès en lecture
	# elle renvoie une copie de la liste,  ce qui règle le probleme
	def lstCriteres
		return @lstCriteres.clone()
	end
end
TEXTE

class InterCritere
	# Defintion de la méthode d'accès en lecture
	# elle renvoie une copie de la liste, ce qui règle le probleme
	def lstCriteres
		return @lstCriteres.clone()
	end
end
puts "\nAffichage des criteres de ic1 (y'en a 3)"
puts ic1.lstCriteres


puts 'liste1=ic1.lstCriteres()'
liste1=ic1.lstCriteres()

puts "\nVas y que j'ajoute un critère sans passer par l'interface !!!!!"
puts 'liste1=ic1.lstCriteres()'
liste1=ic1.lstCriteres()
puts 'liste1<<CritereMarque.new("Skoda")'
liste1<<CritereMarque.new("Skoda")

puts "\nDans Liste1 y'en a bien 4"
puts liste1

puts "\nAffichage des criteres de ic1 (y'en a toujours 3)"
puts ic1.lstCriteres
puts "Victoire"


























