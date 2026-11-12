# MAKEFILE principal du TP_1A - Codage de Hadamard
#
# Usage :
#   make all     compile les sous-dossiers puis l'executable hadamard
#   make clean   nettoie les sous-dossiers puis la racine
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
# Tout ce qu'il faut lier pour fabriquer l'executable hadamard.
#
fich_obj_hadamard = hadamard.o \
	$(primitives_dir)/matrices.o

#
#-------- Mains ---------------
#
BIN = hadamard

hadamard : $(fich_obj_hadamard)
	$(CCLNK) $(fich_obj_hadamard) $(FLAGS) -o hadamard

hadamard.o : hadamard.c $(primitives_dir)/matrices.h
	$(CCOBJ) $(FLAGS) hadamard.c -o hadamard.o -I./ \
	-I$(primitives_dir)

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

# Descente dans chaque sous-dossier. Une ligne par dossier a ajouter ici.
sous_dossiers :
	cd $(primitives_dir) ; make -f Makefile all

#
#-------- Clean objects -------
#
clean :
	cd $(primitives_dir) ; make -f Makefile clean
	- rm -f *.o
	- rm -f $(BIN)

#
#-------- Tests -------
#
tests :

# Cibles qui ne produisent pas de fichier portant leur nom.
# Sans ceci, un jour ou un fichier/dossier s'appellera "tests" ou
# "sous_dossiers", make croira la cible deja a jour et ne fera rien.
.PHONY : all clean tests sous_dossiers
