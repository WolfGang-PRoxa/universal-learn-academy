# encoding: UTF-8

# Auteur : Jacoboni
# Version 1 : Date : Tue Sep 13 20:56:44 CEST 2022
#
# Université du Maine, Licence Informatique
# Module L2 - Introduction à la POO
# TD n° 2 : Introduction à la syntaxe Ruby
#
# Définition RUBY de la classe Compte Version 2
class Compte
# =============================================================================
# La Classe Compte du cours n°1 d'introduction à Ruby un peu moins rudimentaire 
#  avec un seuil de retrait et des fonctions d'accès générées par le "Coding 
#  Assistant". 
# Les objets de cette classe 
# 	1) sont caractérisés par leur numéro, leur titulaire et leur solde
#	2) sont capables de donner leur solde, de déposer une somme et de 
#        retirer une somme si le seuil de retrait n'est pas atteint. 
#        a) Par défaut le seuil est fixé à 0. 
#        b) La notion de seuil sera implémentée en définissant une méthode 
#            privée qui renvoie la valeur du seuil autorisée. (On aurait aussi 
#            pu utiliser une variable d'instance).
# 	3)Pour créer un objet de cette classe on envoie le message ouvrir à la 
#        classe Compte avec pour arguments le numero, le titulaire et le solde
#        du compte que l'on veut créer. Il n'est pas possible de modifier les
#        informations du compte (titulaire et numéro). Le solde ne peut être 
#        modifié que par les opérations de retrait et de dépôt prévues à 
#        l'interface.
# 	4)Faire le nécessaire pour pouvoir afficher un Compte avec les
# 	   instructions classique du système (puts, print, etc.)
# =============================================================================
#
# Les variables d'instances : Un compte est caractérisé par trois informations
#	@solde 	=> le solde du compte
#	@titulaire	=> le titulaire du compte (invariant)
#	@numero	=> le numéro du compte (invariant)
#
# On choisit d'implémenter la notion de seuil en définissant une méthode privée 
#  qui renvoie la valeur de seuil autorisée. On aurait aussi pu se contenter 
#  d'une variable d'instance.

# Géneration des méthodes numero et numero=
	attr :numero, true     
# Géneration des méthodes titulaire et titulaire=
	attr :titulaire, true	
# Géneration de la méthodes solde
	attr_reader :solde

# Création des instances de compte
# Pour empêcher l'utilisation de new on déclare cette méthode de classe privée
# Attention pas d'espace après :
  private_class_method :new

# Pour ouvrir un compte on ne peut utiliser que la méthode de classe ouvrir
#  avec 3 arguments  
# Pour spécifier que c'est une méthode de classe on précise le nom de la classe 
#  devant le nom de la méthode donc ici : Compte.ouvrir (...)
# La méthode ouvrir appelle la méthode privée new avec les mêmes arguments
# La méthode new crée l'objet compte et ensuite la méthode privée d'instance 
#  initialize est appelée explicitement sur cet objet. 
  def Compte.ouvrir (unNombre, unNom, uneSomme)
    new(unNombre, unNom, uneSomme)
  end
  
# La méthode d'initialisation d'un compte à trois arguments
# La méthode initialize est toujours privée même si on ne le spécifie pas.
# (elle ne peut donc pas être utilisée de l'extérieur de la classe)
  def initialize(unNombre, unNom, uneSomme)
      @numero, @titulaire, @solde= unNombre, unNom, uneSomme
  end
    
# Les méthodes qui suivent sont publiques (font parties de l'interface)
#  puisque on ne précise rien de particulier.
# Pour déposer une somme on incrémente la variable d'instance @solde  
  def depose (uneSomme)
  	@solde += uneSomme
  end

# Pour retirer une somme on décrémente la variable d'instance @solde si le 
#  seuil de retrait n'est pas atteint
  def retire (uneSomme)
  	 puts("\# Le solde est #{@solde}, Vous retirez : #{uneSomme}");
  	 if @solde - uneSomme > seuil()
  	    @solde -= uneSomme
  	    puts("\# \tOk pour le retrait de #{uneSomme} Nouveau Solde = #{@solde}");
  	 else
  	    puts("\# \t\tPlus de Sous je ne retire rien, votre solde est : #{@solde}");
  	 end
  end

# Afficher les informations relatives au compte receveur
  def to_s
    return "\n# Je suis le #{self.class} N°#{@numero}\n" +
             "#\tTitulaire : #{@titulaire}\n#\tSolde     : #{@solde}\n"
  end
  
# La méthode seuil ci-dessous n'a pas à être public, on ne veut pas qu'elle
#  soit utilisée à l'extérieur de la classe
  
# Le seuil de retrait est 0 (pas de découvert autorisé)
  def seuil ()
      puts "#\tJe suis la méthode seuil de Compte"
    	return 0
  end
# on précise que seuil est privée.
  private :seuil

end
# Test de la classe

puts "# =============== RÉSULTAT DU PROGRAMME DE TEST ==============="
monCompte = Compte.ouvrir(101232,'toto',2000)
# Test des méthodes créées parle coding assistant (attr)
print "# Test des méthodes créées parle coding assistant (attr)\n#  "
print monCompte.titulaire, "\t"
print monCompte.numero, "\t"
print monCompte.solde, "\n"

monCompte.titulaire="Pierre"
monCompte.numero=101322
# solde= n'a pas été créée par le coding assistant
#monCompte.solde=20000
#         Ruby2:110: undefined method `solde=' for #<Compte:0x6cedc8>(NameError)
print monCompte
monCompte.depose(3000)
print monCompte
# On constate dans la trace d'éxécution que ce retrait ne se fera pas
monCompte.retire(1500)
print monCompte
monCompte.retire(1000)
print monCompte
monCompte.retire(2000)
print monCompte
monCompte.retire(2000)
print monCompte
# on vérifie que seuil est bien privée
# print monCompte.seuil()

# =============== RÉSULTAT DU PROGRAMME DE TEST ===============
# Test des méthodes créées parle coding assistant (attr)
#  toto 101232  2000

# Je suis le Compte N°101322
#       Titulaire : Pierre
#       Solde     : 2000

# Je suis le Compte N°101322
#       Titulaire : Pierre
#       Solde     : 5000
# Le solde est 5000, Vous retirez : 1500
#       Je suis la méthode seuil de Compte
#       Ok pour le retrait de 1500 Nouveau Solde = 3500

# Je suis le Compte N°101322
#       Titulaire : Pierre
#       Solde     : 3500
# Le solde est 3500, Vous retirez : 1000
#       Je suis la méthode seuil de Compte
#       Ok pour le retrait de 1000 Nouveau Solde = 2500

# Je suis le Compte N°101322
#       Titulaire : Pierre
#       Solde     : 2500
# Le solde est 2500, Vous retirez : 2000
#       Je suis la méthode seuil de Compte
#       Ok pour le retrait de 2000 Nouveau Solde = 500

# Je suis le Compte N°101322
#       Titulaire : Pierre
#       Solde     : 500
# Le solde est 500, Vous retirez : 2000
#       Je suis la méthode seuil de Compte
#               Plus de Sous je ne retire rien, votre solde est : 500

# Je suis le Compte N°101322
#       Titulaire : Pierre
#       Solde     : 500
# CompteEpisode2.rb:133:in `<main>': private method `seuil' called for #<Compte:0x0000000101bfd608 @numero=101322, @titulaire="Pierre", @solde=500> (NoMethodError)
#
# print monCompte.seuil()
#                 ^^^^^^
