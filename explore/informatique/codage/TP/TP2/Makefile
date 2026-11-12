# MAKEFILE principal du TP_2 - Generateur pseudo-aleatoire
# (codeurs a longueur maximale, de Gold et JPL)
#
# Usage :
#   make all     compile les sous-dossiers puis l'executable generateur
#   make clean   nettoie les sous-dossiers puis la racine
#
# Sur ce PC, make s'appelle mingw32-make : run.bat et run.sh le trouvent seuls.
#
# Aucun fichier de code n'est fourni : le programme principal s'appelle
# generateur.c, a creer a la racine du TP. Pour un autre nom, remplacer
# "generateur" dans ce fichier, dans run.sh et dans run.bat.
#

#
# Directories
#
# top_dir DOIT etre defini avant les include (les include s'en servent).
#
top_dir = .
include $(top_dir)/Makefile.dir
include $(top_dir)/Makefile.compilation

#
# Object files
#
# Tout ce qu'il faut lier pour fabriquer l'executable generateur.
#
fich_obj_generateur = $(build_dir)/generateur.o

#
#-------- Mains ---------------
#
BIN = $(build_dir)/generateur

$(build_dir)/generateur : $(fich_obj_generateur)
	$(CCLNK) $(fich_obj_generateur) $(FLAGS) -o $(build_dir)/generateur -lm

# Le '|' rend $(build_dir) "order-only" : il doit exister avant la
# compilation, mais sa date de modification ne force pas a recompiler.
$(build_dir)/generateur.o : generateur.c | $(build_dir)
	$(CCOBJ) $(FLAGS) generateur.c -o $(build_dir)/generateur.o -I./

$(build_dir) :
	mkdir -p $(build_dir)

#
#-------- Modules externes -------------
#
# Apporte les regles qui savent reconstruire les .o des autres dossiers.
#
include $(top_dir)/Makefile.depend

#
#-------- All -------------
#
all : sous_dossiers $(BIN)

# Descente dans chaque sous-dossier. Une ligne par dossier a ajouter ici,
# par exemple :
#	$(MAKE) -C $(emetteur_dir) all
# $(MAKE) relance le meme make (mingw32-make ici), et -C echoue proprement
# si le dossier n'existe pas (alors que "cd x ; make" relancerait make
# dans le dossier courant, a l'infini).
# Modele de Makefile de sous-dossier : ../TP1_A/primitives/Makefile.
# Pour l'instant, pas de sous-dossier : rien a faire.
sous_dossiers :

#
#-------- Clean objects -------
#
clean :
	- rm -rf $(build_dir)

#
#-------- Tests -------
#
tests :

# Cibles qui ne produisent pas de fichier portant leur nom.
# Sans ceci, un jour ou un fichier/dossier s'appellera "tests" ou
# "sous_dossiers", make croira la cible deja a jour et ne fera rien.
.PHONY : all clean tests sous_dossiers
