top=.
include Makefile.dir
include Makefile.compilation

clean : 
	- rm *~
	cd $(DirCommun) ;  make $@
	cd $(DirCoord) ; make $@
	cd $(DirEcran) ;  make $@
	cd $(DirMoto) ; make $@
	cd $(DirMvt) ; make $@
	cd $(DirPiste) ; make $@
	cd $(DirJeu) ; make $@ 

all tests : 
ifeq ($(DEBUG),yes)
	@echo "Mode debug"
else
	@echo "Mode release"
endif

	cd $(DirCommun) ;  make $@
	cd $(DirCoord) ; make $@
	cd $(DirEcran) ;  make $@
	cd $(DirMoto) ; make $@
	cd $(DirMvt) ; make $@
	cd $(DirPiste) ; make $@
	cd $(DirJeu) ; make $@ 

#
#-- Tags sur les fonctions pour emacs 
#

tags : 
	etags --language=c  */*.[ch] --output=TRON.TAGS


#
#-- Documentation
#

doc :
	$(doxygen) config_doxygen
#	ln -sf $(DirDoc)/html/index.html $(DirDoc)/documentation.html

