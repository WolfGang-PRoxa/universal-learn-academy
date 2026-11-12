# MAKEFILE for TP Transports
#
#

#
# Directories
#

top_dir = .
include $(top_dir)/Makefile.dir
include $(top_dir)/Makefile.compilation

all , clean :
	cd $(commun_dir) ; make -f Makefile $@
	cd $(ecran_dir) ; make -f Makefile $@
	cd $(stock_dir) ; make -f Makefile $@
	cd $(trajets_dir) ; make -f Makefile $@	
	cd $(exemples_dir) ; make -f Makefile $@
	cd $(pid_dir) ; make -f Makefile $@
	cd $(signaux_v1_dir) ; make -f Makefile $@
	cd $(signaux_v2_dir) ; make -f Makefile $@
	cd $(signaux_v3_dir) ; make -f Makefile $@
	cd $(signaux_v4_dir) ; make -f Makefile $@
