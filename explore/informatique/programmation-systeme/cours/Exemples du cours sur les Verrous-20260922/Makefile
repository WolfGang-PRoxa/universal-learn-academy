# MAKEFILE for Examples of "Unix files" lesson
#
#

#
# Directories
#

#
# Object files
#

fich_obj_ecrivain = ecrivain.o 
fich_obj_lecteur = lecteur.o 

fich_obj_ecrivain_externe = ecrivain_externe.o 
fich_obj_lecteur_externe = lecteur_externe.o 

fich_obj_ecrivain_interne = ecrivain_interne.o commun.o
fich_obj_lecteur_interne = lecteur_interne.o commun.o

fich_obj_ecrivain_imperatif = ecrivain_imperatif.o commun.o
fich_obj_lecteur_imperatif = lecteur_imperatif.o commun.o

fich_obj_ecrivain_posix = ecrivain_posix.o commun.o
fich_obj_lecteur_posix = lecteur_posix.o commun.o


#
# Options for compilation
#

GCCOBJ = gcc -c -I.
GCC = gcc -I.


# Option for debugger
  opt = -g -Wall
# opt = -O2
#
#
#



#
#-------- Mains ---------------
#

ecrivain : $(fich_obj_ecrivain)
	$(GCC) $(fich_obj_ecrivain) $(opt) -o ecrivain

ecrivain.o : ecrivain.c 
	$(GCCOBJ) $(opt) ecrivain.c -o ecrivain.o 

lecteur : $(fich_obj_lecteur)
	$(GCC) $(fich_obj_lecteur) $(opt) -o lecteur

lecteur.o : lecteur.c 
	$(GCCOBJ) $(opt) lecteur.c -o lecteur.o 


ecrivain_externe : $(fich_obj_ecrivain_externe)
	$(GCC) $(fich_obj_ecrivain_externe) $(opt) -o ecrivain_externe

ecrivain_externe.o : ecrivain_externe.c commun.h
	$(GCCOBJ) $(opt) ecrivain_externe.c -o ecrivain_externe.o 

lecteur_externe : $(fich_obj_lecteur_externe)
	$(GCC) $(fich_obj_lecteur_externe) $(opt) -o lecteur_externe

lecteur_externe.o : lecteur_externe.c commun.h
	$(GCCOBJ) $(opt) lecteur_externe.c -o lecteur_externe.o 


ecrivain_interne : $(fich_obj_ecrivain_interne)
	$(GCC) $(fich_obj_ecrivain_interne) $(opt) -o ecrivain_interne

ecrivain_interne.o : ecrivain_interne.c commun.h
	$(GCCOBJ) $(opt) ecrivain_interne.c -o ecrivain_interne.o 

lecteur_interne : $(fich_obj_lecteur_interne)
	$(GCC) $(fich_obj_lecteur_interne) $(opt) -o lecteur_interne

lecteur_interne.o : lecteur_interne.c commun.h
	$(GCCOBJ) $(opt) lecteur_interne.c -o lecteur_interne.o 


ecrivain_imperatif : $(fich_obj_ecrivain_imperatif)
	$(GCC) $(fich_obj_ecrivain_imperatif) $(opt) -o ecrivain_imperatif

ecrivain_imperatif.o : ecrivain_imperatif.c commun.h
	$(GCCOBJ) $(opt) ecrivain_imperatif.c -o ecrivain_imperatif.o 

lecteur_imperatif : $(fich_obj_lecteur_imperatif)
	$(GCC) $(fich_obj_lecteur_imperatif) $(opt) -o lecteur_imperatif

lecteur_imperatif.o : lecteur_imperatif.c commun.h
	$(GCCOBJ) $(opt) lecteur_imperatif.c -o lecteur_imperatif.o 


ecrivain_posix : $(fich_obj_ecrivain_posix)
	$(GCC) $(fich_obj_ecrivain_posix) $(opt) -o ecrivain_posix

ecrivain_posix.o : ecrivain_posix.c commun.h
	$(GCCOBJ) $(opt) ecrivain_posix.c -o ecrivain_posix.o 

lecteur_posix : $(fich_obj_lecteur_posix)
	$(GCC) $(fich_obj_lecteur_posix) $(opt) -o lecteur_posix

lecteur_posix.o : lecteur_posix.c commun.h
	$(GCCOBJ) $(opt) lecteur_posix.c -o lecteur_posix.o 


#
#-------- Modules -------
#

commun.o : commun.c 
	$(GCCOBJ) $(opt) commun.c -o commun.o 
#
#-------- Clean objects -------
#

clean : 
	rm -f *.o 


#
#-------- All executables -------
#

all : ecrivain lecteur ecrivain_externe lecteur_externe  ecrivain_interne lecteur_interne ecrivain_imperatif lecteur_imperatif ecrivain_posix lecteur_posix 
