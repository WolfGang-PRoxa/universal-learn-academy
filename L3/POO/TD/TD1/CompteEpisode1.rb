# encoding: UTF-8

# Université du Maine, Licence Informatique
# Module L3-175UD01 - Introduction à la POO
# Annexe du cours N° 1
# Introduction à Ruby
# Une classe Compte rudimentaire

# Définition RUBY de la classe

class Compte

# P.J. 2003, d'aprés E.D. ===============================================================
# Classe Compte du cours n°1 d'introduction à Ruby (ultra-rudimentaire)
# Les objets de cette classe
# 	1) sont caractérisés par leur numéro, leur titulaire et leur solde
#	2) sont capables de donner leur solde, de deposer une somme et de retirer une somme
#   3)à la création d'un compte on doit fournir un numéro, un nom de titulaire et un solde de départ.
#     Le numéro de compte et le nom du titulaire sont immuable.
# =====================================================================================

# Dans cette classe, 3 variables d'instances nommées : @solde, @titulaire, @numero
  #	@solde 	    => le solde du compte
  #	@titulaire  => le titulaire du compte (invariant)
  #	@numero     => le numéro du compte (invariant)

  # Pour accéder au solde il suffit de retourner la variable d'instance @solde
 
    attr_accessor :solde
    attr_reader  :numero,:titulaire

# Création des instances de compte
# Pour ouvrir un compte on ne peut utiliser que la méthode de classe ouvrir avec 3 arguments
# Pour spécifier que c'est une méthode de classe on précise le nom de la classe devant le
# nom de la méthode donc ici : Compte.ouvrir (...)
# La méthode ouvrir appelle la méthode privée new
# La méthode privée new va créer l'objet et lui envoyer le message d'intialisation qui provoquera l'appel de la méthode privée d'instance initialize qui initialisera les
# variables d'instances.
  def Compte.ouvrir(unNombre, unNom, uneSomme)
    new(unNombre, unNom, uneSomme)
  end
  
  

# Pour empécher l'utilisation de new on déclare cette méthode de classe privée
# Attention pas d'espace aprés :
private_class_method :new

# La méthode d'initialisation d'un compte à trois arguments
# La méthode initialize est toujours privée même si on ne le spécifie pas.
# (elle ne peut donc pas être utilisée de l'extérieur)
  def initialize(unNombre, unNom, uneSomme)    
      @numero, @titulaire, @solde= unNombre, unNom, uneSomme
  end

# Les méthodes qui suivent sont publiques puisque on ne précise rien de particulier.
# Pour déposer une somme on incrémente la variable d'instance @solde
  def depose(uneSomme)
  	@solde += uneSomme
  end

# Pour retirer une somme on décrémente la variable d'instance @solde
  def retire(uneSomme)
  	@solde -= uneSomme
  end

# Pour pouvoir utiliser les instructions d'affichage du langage (print, puts, etc.)
# on doit redéfinir la méthode to_s() qui donne une représentation "String" des Objets de la classe
  def to_s()
  	"\nTitulaire=#{@titulaire}"+
  	", Solde=#{@solde}" +
  	", Numero=#{@numero}"
  end
  
end
# Fin de classe



# Test de la classe


# On constate bien que l'on ne peut pas utiliser la méthode new. Seule notre méthode ouvrir
# permet de créer des comptes.












# ================================ TESTS ================================
# Pour tester que new ne marche Pas enlevez les commentaires
 # Compte.new(101232,'toto',2000)
#  Ruby2:6: private method `new' called for Compte:Class(NameError)

# Compte.new(101232,'toto',2000)
#	 Ruby2:6: private method `new' called for Compte:Class(NameError)

monCompte = Compte.ouvrir(101232,'toto',2000)
p  monCompte
#monCompte = Compte.new(101232,'toto',2000)

#monCompte.initialize(12,'titi',1000)

monCompte1 = Compte.ouvrir(101232,'toto',2000)
monCompte2 = Compte.ouvrir(101232,'toto',2000)
print("\n",monCompte.inspect(),"\n")
p monCompte
monCompte.depose(3000)
p monCompte
monCompte.retire(15000)
p monCompte
puts monCompte.solde()

#monCompte.solde=12
monCompte.solde=12
monCompte.solde=(12)
puts monCompte.titulaire()
#monCompte.titulaire="PIPO"
print("\n",monCompte.inspect(),"\n")
puts monCompte.numero()
#monCompte.initialize(12,'pipo',1000)

puts "print monCompte"
puts monCompte


	#<Compte:0x6cef60 @solde=2000, @titulaire="toto", @numero=101232>
	#<Compte:0x6cef60 @solde=5000, @titulaire="toto", @numero=101232>
	#<Compte:0x6cef60 @solde=-10000, @titulaire="toto", @numero=101232>
  #	-10000
