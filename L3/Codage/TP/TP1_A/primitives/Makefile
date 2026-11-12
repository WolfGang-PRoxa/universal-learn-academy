#
# MAKEFILE du dossier primitives
#
# Ce dossier est une brique : il ne fabrique aucun executable,
# seulement des .o que les autres dossiers viendront lier.
#

#
# Directories
#
top_dir = ..
include $(top_dir)/Makefile.dir
include $(top_dir)/Makefile.compilation

#
#-------- Modules -------------
#
# MOD = la liste des .o produits par CE dossier.
#
MOD = matrices.o

matrices.o : matrices.c matrices.h
	$(CCOBJ) $(FLAGS) matrices.c -o matrices.o -I./

#
#-------- All  -------
#
# 'all' en premier : c'est la cible par defaut si on tape 'make' tout court.
#
all : $(MOD)

#
#-------- Clean objects -------
#
# Le '-' devant rm dit a make d'ignorer l'erreur si le fichier n'existe pas.
#
clean :
	- rm -f *~
	- rm -f $(MOD)

#
#-------- Tests -------
#
tests :

.PHONY : all clean tests
