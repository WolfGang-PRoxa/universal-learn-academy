#include <stdio.h>

#include <errno.h>
#include <string.h>
#include <unistd.h>
#include <sys/file.h>

#include <commun.h>

/* 
 * Pose d'un verrou posix sur un fichier par un ecrivain
 */

int
main( int nb_arg , char * tab_arg[] )
{
     int d_fich ;                   /* Descripteur du fichier partage */
     char ref_fichier[256] ;        /* Reference du fichier partage */
     int id_enreg ; 
     char lettre ;
     int i ;
     char buffer[1024] ;

     /*----------*/

     if( nb_arg != 4)
     {
          fprintf( stderr , "Usage : %s <reference fichier> <numero d'enregistrement> <lettre>\n" , tab_arg[0]);
          exit(-1);
     }

     strcpy(ref_fichier,tab_arg[1]);
     sscanf( tab_arg[2], "%d" , &id_enreg );
     lettre = tab_arg[3][0] ;

     /* Ouverture du fichier partage */
     if( (d_fich = open( ref_fichier , O_WRONLY , 0666 )) == -1 )
     {
	  fprintf( stderr, "Pb open sur %s\n", ref_fichier);
	  exit(-1);
     }

     /* Construction du verrou posix : affectation d'une struct flock */

     long verrou_start  = (long)(SIZE_ENREG*id_enreg); /* debut de la portee du verrou */


     /* 
      * Consultation du verrou posix
      * Tentative de pose d'un verrou Bloquant Exclusif 
      */
     printf("Ecrivain %c --> attente pose verrou posix consultatif\n" , lettre);
     
     /* Positionement au debut du verrou */
     lseek( d_fich , verrou_start , SEEK_SET ) ;
     
     /* Pose du verrou */
     if( lockf(d_fich, F_LOCK , SIZE_ENREG) == -1 )
     {
	  perror("Pb pose verrou posix");
	  exit(-2);
     }

     /* Fin attente --> la pose du verrou est effectuee */

     printf("Ecrivain %c --> pose du verrou posix consultatif\n", lettre);

     /* 
      * Acces au fichier partage 
      */
     
     /* Ecriture */
     lseek( d_fich , verrou_start , SEEK_SET ) ;
     for( i=0; i<NB_LETTRES; i++)
	  write( d_fich , &lettre , sizeof(char) ) ;
     sprintf( buffer , "%02d" , id_enreg );
     write( d_fich , buffer , strlen(buffer) ) ;
     write( d_fich , "\n" , strlen("\n") );
     

     /* Pause */
     fprintf(stdout, "Ecrivain %c : Pause...\n" , lettre);
     fscanf(stdin,"%s", buffer) ;

     /* Levee du verrou */
     lseek( d_fich , verrou_start , SEEK_SET ) ;
     if( lockf(d_fich, F_ULOCK , SIZE_ENREG) == -1 )
     {
	  perror("Pb levee verrou" );
	  exit(-1);
     }

     /* fermeture du fichier partage */
     close(d_fich);

     printf("Ecrivain %c --> levee du verrou posix consultatif\n" , lettre );

     exit(0);
} 






