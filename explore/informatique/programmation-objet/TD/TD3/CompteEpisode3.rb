# Université du Maine	IUP MIME, Licence,
# Module L2 - Introduction à la POO
# Introduction à la syntaxe Ruby
#
# Chargement de la classe Compte du TD2
load "CompteEpisode2.rb"
# Contenu de ce document
# A partir de la classe Compte du cours 2, nous définissons deux sous-classes :
#  la classe CompteEpargne  et la classe CompteCourant. 

# Définition RUBY de la classe CompteCourant
class CompteCourant < Compte
# P.J. 2003, d'après E.D. ===============================================================
# La classe CompteCourant est une sous-classe de la classe Compte du cours n°2
# Un compte courant est un compte sur lequel des découverts sont autorisés.
# La classe CompteCourant fournit des services supplémentaires par rapport à la classe Compte.
# Elle possède :
# 	- une vi supplémentaire :  le montant du découvert maximum autorisé (nombre positif)
#	- une méthode d'accès en consultation et une méthode d'accès en modification à cette vi
#	- elle redéfinit les méthodes suivantes héritées de la classe Compte
#		* le seuil de retrait : qui n''est plus 0 mais -le découvert autorisé
#		* la méthode d''ouverture d''un compte : pour créer un compte il faut en plus
#			 définir le montant du découvert autorisé
# =====================================================================================

# Une Variable d'instance supplémentaire
# @decouvert    # Précise le découvert autorisé sur le compte
# Géneration des méthodes decouvert et decouvert=
	attr_accessor :decouvert     
 # Pour ouvrir un compte on ne peut utiliser que la méthode de classe ouvrir avec 4 arguments  
  def CompteCourant.ouvrir (unNombre, unNom, uneSomme, unDecouvert)
    new(unNombre, unNom, uneSomme, unDecouvert)
  end 
# La méthode d'initialisation d'un compteCourant à 4 arguments
  def initialize(unNombre, unNom, uneSomme, unDecouvert)
      # On réutilise en le rappelant le code déjà écrit dans la classe de base
      super(unNombre, unNom, uneSomme)
      @decouvert = unDecouvert
  end
  
  # Le seuil de retrait est - découvert autorisé
  # Méthode privée redéfinie de la classe compte
  private def seuil ()
        puts "Je suis la méthode seuil de CompteCourant"
        return -@decouvert 
  end

  #On complète la méthode de conversion
    def to_s()
      super+ "#\tDécouvert Autorisé : #{@decouvert}\n"
    end

end

 
# Définition RUBY de la classe CompteEpargne
class CompteEpargne < Compte
# P.J. 2003, d'après E.D. ===============================================================
# Un compte épargne est un compte qui rapporte des intérêts mensuels.
# La classe CompteEpargne fournit des services supplémentaires par rapport à la classe Compte.
# Elle possède :
#	- une vi supplémentaire :  le taux d'intérêts (c''est un pourcentage)
#	- une méthode d''accès en consultation et une méthode d''accès en modification à cette vi
#	- une méthode pour ajouter les intérêts mensuels
#	- elle redéfinit les méthodes suivantes héritées de la classe Compte
#		* la méthode d''ouverture d''un compte : pour créer un compte il faut en plus 
#                     définir le montant du taux d'intérêt
# =====================================================================================

# Une Variable d'instance supplémentaire
# @taux    Précise le taux de rémunération
# Géneration des méthodes taux et taux=
	attr :taux, true     

# Pour ouvrir un compte on ne peut utiliser que la 
#  méthode de classe ouvrir avec 4 arguments  
  def CompteEpargne.ouvrir (unNombre, unNom, uneSomme, unTaux)
    new(unNombre, unNom, uneSomme, unTaux)
  end
  
# La méthode qui verse les intérêts
    def verseToiTesInterets()
        @solde+=(@solde * @taux/100) / 12
      #	self.depose((@solde * @taux/100) / 12)
    end

  
# La méthode d'initialisation d'un compte à 4 arguments
  def initialize(unNombre, unNom, uneSomme, unTaux)
      # On réutilise en le rappelant le code déjà écrit   
      # dans la classe de base
      super(unNombre, unNom, uneSomme)
      @taux = unTaux
  end


#On complète la méthode de conversion
  def to_s
    super + "#\tTaux d'intérêts : #{@taux}\n"
  end
   
end


 
# =============== TEST DE LA CLASSE CompteCourant ===============
# En gras les réponses du système lors de l'évaluation
monCompte = CompteCourant.ouvrir(101232,'toto',2000,3000)
# Test des méthodes créées parle coding assistant (attr)
print "\n# "
print monCompte.titulaire, "\t"
print monCompte.numero, "\t"
print monCompte.solde, "\t"
print monCompte.decouvert, "\n"

monCompte.titulaire="Pierre"
monCompte.numero=101322
monCompte.decouvert=10000
print monCompte

monCompte.depose(3000)
print monCompte
# On constate dans la trace d'éxécution que ce retrait pourra se faire le découvert autorisé 
#  (10000) n'étant pas atteint
monCompte.retire(10000)
print monCompte
# =============== RESULTAT DU TEST DE LA CLASSE CompteCourant ===============
# toto	101232	2000	3000
# Je suis le Compte N°101322
#	  Titulaire : Pierre
#	  Solde     : 2000
#	  Découvert Autorisé : 10000
# Je suis le Compte N°101322
#	  Titulaire : Pierre
#	  Solde     : 5000
#	  Découvert Autorisé : 10000
# Je suis le Compte N°101322
#	  Titulaire : Pierre
#	  Solde     : -5000
#	  Découvert Autorisé : 10000


# =============== TEST DE LA CLASSE CompteEpargne ===============
#En gras les réponses du système lors de l'évaluation
#monCompte=Compte.ouvrir(101232,'toto',2000)
monCompteEpargne = CompteEpargne.ouvrir(101232,'toto',2000,3.3)
# Test des méthodes créées parle coding assistant (attr)
print "\n# "
print monCompteEpargne.titulaire, "\t"
print monCompteEpargne.numero, "\t"
print monCompteEpargne.solde, "\t"
print monCompteEpargne.taux, "\n"

monCompteEpargne.titulaire="Pierre"
monCompteEpargne.numero=101322
monCompteEpargne.taux=4
print monCompteEpargne

monCompteEpargne.depose(3000)
print monCompteEpargne
monCompteEpargne.verseToiTesInterets()
print monCompteEpargne

#print monCompte.seuil


# =============== RESULTAT DU TEST DE LA CLASSE CompteEpargne ===============
# toto	101232	2000	3.3
# Je suis le Compte N°101322
#	  Titulaire : Pierre
#	  Solde     : 2000
#	  Taux d'intérêts : 4
# Je suis le Compte N°101322
#	  Titulaire : Pierre
#	  Solde     : 5000
#	  Taux d'intérêts : 4
# Je suis le Compte N°101322
#	  Titulaire : Pierre
#	  Solde     : 5016
#	  Taux d'intérêts : 4


