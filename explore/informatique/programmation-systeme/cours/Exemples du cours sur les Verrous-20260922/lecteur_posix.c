#include <stdio.h>
#include <sys/file.h>
#include <errno.h>
#include <string.h>
#include <unistd.h>

#include <commun.h>

/* 
 * Pose d'un verrou posix sur un fichier par un lecteur 
 */

int
main( int nb_arg , char * tab_arg[] )
{
     int d_fich ;                   /* Descripteur du fichier partage */
     char ref_fichier[256];         /* Reference du fichier partage */
     char buffer[1024] ;
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
     /* Bien qu'on ne fasse que lire dans ce fichier, les verrous POSIX obligent d'ouvrir ce fichier soit en O_WRONLY soit en O_RDWR */
     if( (d_fich = open( ref_fichier , O_RDWR , 0666 )) == -1 )
     {
	  fprintf( stderr, "Pb open sur %s\n", ref_fichier);
	  exit(-1);
     }
    
     long verrou_start  = (long)(SIZE_ENREG*id_enreg); /* debut de la portee du verrou */

     /* 
      * Consultation du verrou 
      * Tentative de pose d'un verrou Bloquant Partage
      */

     printf("Lecteur --> attente pose verrou posix consultatif\n");
     /* Positionnement en debut de verroru */
     lseek( d_fich , verrou_start , SEEK_SET ) ;
     /* Bien qu'un lecteur ait besoin d'un verrou partage, les verrous POSIX obligent d'utiliser un verrou exclusif */
     if( lockf( d_fich , F_LOCK , SIZE_ENREG ) == -1 ) 
     {
	  fcntl_error(errno);
	  fprintf(stderr, "Lecteur: Pb sur pose verrou\n");
	  exit(-2);
     }

     /* Fin attente --> la pose du verrou est effectuee */

     printf("Lecteur --> pose du verrou posix consultatif\n");

     /* 
      * Acces au fichier partage 
      */
     
     /* Lecture */
     lseek( d_fich , verrou_start , 0 ) ;
     printf("Lecteur :\n");
     read( d_fich , buffer , SIZE_ENREG ) ;
     write( 1 , buffer , SIZE_ENREG );
     printf("\n");


     /* Pause */
     fprintf(stdout, "Lecteur : Pause...\n");
     fscanf(stdin,"%s", buffer) ;

     /* Levee du verrou posix (meme portee) */
     lseek( d_fich , verrou_start , SEEK_SET ) ;
     if( lockf( d_fich , F_ULOCK , SIZE_ENREG ) == -1 )
     {
	  fcntl_error(errno);
	  fprintf( stderr , "Lecteur : Pb fcntl sur levee verrou\n");
	  exit(-1);
     }

     /* fermeture du fichier partage */
     close(d_fich);

     printf("Lecteur --> levee du verrou posix consultatif\n");

     exit(0);

}
