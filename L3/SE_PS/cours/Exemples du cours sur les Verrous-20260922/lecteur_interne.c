#include <stdio.h>
#include <fcntl.h>
#include <errno.h>
#include <string.h>
#include <unistd.h>

#include <commun.h>

/* 
 * Pose d'un verrou interne sur un fichier par un lecteur 
 */

int
main( int nb_arg , char * tab_arg[] )
{
     int d_fich ;                   /* Descripteur du fichier partage */
     char ref_fichier[256];         /* Reference du fichier partage */
     char buffer[1024] ;
     struct flock  verrou  ;        /* Verrou interne */
     int id_enreg ; 

     /*----------*/

     if( nb_arg != 3)
     {
          fprintf( stderr , "Usage : %s <reference fichier> <numero d'enregistrement>\n" , tab_arg[0]);
          exit(-1);
     }

     strcpy(ref_fichier,tab_arg[1]);
     sscanf( tab_arg[2], "%d" , &id_enreg );

     /* Ouverture du fichier partage */
     if( (d_fich = open( ref_fichier , O_RDONLY , 0666 )) == -1 )
     {
	  fprintf( stderr, "Pb open sur %s\n", ref_fichier);
	  exit(-1);
     }

     /* Construction du verrou interne : affectation d'une struct flock */
     verrou.l_type   = F_RDLCK ;			  /* verrou en lecture (partage) */
     verrou.l_whence = (short)0 ;			  /* a partir du debut du fichier */
     verrou.l_start  = (long)(SIZE_ENREG*id_enreg); /* debut de la portee du verrou */
     verrou.l_len    = (long)SIZE_ENREG;	      /* longueur de la portee (un enreg.) */

     /* 
      * Consultation du verrou interne
      * Tentative de pose d'un verrou Bloquant Partage
      */

     printf("Lecteur --> attente pose verrou interne consultatif\n");

     if( fcntl( d_fich , F_SETLKW , &verrou ) == -1 )
     {
	  fcntl_error(errno);
	  fprintf(stderr, "Lecteur: Pb sur pose verrou\n");
	  exit(-2);
     }

     /* Fin attente --> la pose du verrou est effectuee */

     printf("Lecteur --> pose du verrou interne consultatif\n");

     /* 
      * Acces au fichier partage 
      */
     
     /* Lecture */
     lseek( d_fich , verrou.l_start , 0 ) ;
     printf("Lecteur :\n");
     read( d_fich , buffer , SIZE_ENREG ) ;
     write( 1 , buffer , SIZE_ENREG );
     printf("\n");


     /* Pause */
     fprintf(stdout, "Lecteur : Pause...\n");
     fscanf(stdin,"%s", buffer) ;

     /* Levee du verrou interne (meme portee) */
     verrou.l_type   = F_UNLCK ;
     if( fcntl( d_fich , F_SETLKW , &verrou ) == -1 )
     {
	  fcntl_error(errno);
	  fprintf( stderr , "Lecteur : Pb fcntl sur levee verrou\n");
	  exit(-1);
     }

     /* fermeture du fichier partage */
     close(d_fich);

     printf("Lecteur --> levee du verrou interne consultatif\n");

     exit(0);

}
