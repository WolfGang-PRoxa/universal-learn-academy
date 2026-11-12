#include <stdio.h>
#include <fcntl.h>
#include <errno.h>
#include <string.h>
#include <unistd.h>

#include <commun.h>

/* 
 * Pose d'un verrou interne sur un fichier par un ecrivain
 */

int
main( int nb_arg , char * tab_arg[] )
{
     int d_fich ;                   /* Descripteur du fichier partage */
     char ref_fichier[256] ;        /* Reference du fichier partage */
     struct flock  verrou  ;        /* Verrou interne */
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
     if( (d_fich = open( ref_fichier , O_RDWR|O_CREAT , 0666 )) == -1 )
     {
	  fprintf( stderr, "Pb open sur %s\n", ref_fichier);
	  exit(-1);
     }

     /* Construction du verrou interne : affectation d'une struct flock */
     verrou.l_type   = F_WRLCK ;			  /* verrou en ecriture (exclusif)*/
     verrou.l_whence = (short)0 ;			  /* a partir du debut du fichier */
     verrou.l_start  = (long)(SIZE_ENREG*id_enreg); /* debut de la portee du verrou */
     verrou.l_len    = (long)SIZE_ENREG;	  /* longueur de la portee (un enreg.) */

     /* 
      * Consultation du verrou interne
      * Tentative de pose d'un verrou Bloquant Exclusif 
      */
     printf("Ecrivain %c --> attente pose verrou interne consultatif\n" , lettre);

     if( fcntl( d_fich , F_SETLKW , &verrou ) == -1 )
     {
	  fcntl_error(errno);
	  fprintf(stderr, "Ecrivain: Pb sur pose verrou\n");
	  exit(-2);
     }

     /* Fin attente --> la pose du verrou est effectuee */

     printf("Ecrivain %c --> pose du verrou interne consultatif\n", lettre);

     /* 
      * Acces au fichier partage 
      */
     
     /* Ecriture */
     lseek( d_fich , verrou.l_start , 0 ) ;
     for( i=0; i<NB_LETTRES; i++)
	  write( d_fich , &lettre , sizeof(char) ) ;
     sprintf( buffer , "%02d" , id_enreg );
     write( d_fich , buffer , strlen(buffer) ) ;
     write( d_fich , "\n" , strlen("\n") );
     

     /* Pause */
     fprintf(stdout, "Ecrivain %c : Pause...\n" , lettre);
     fscanf(stdin,"%s", buffer) ;

     /* Levee du verrou (meme portee) */
     verrou.l_type   = F_UNLCK ;
     if( fcntl( d_fich , F_SETLKW , &verrou ) == -1 )
     {
	  fcntl_error(errno);
	  fprintf( stderr , "Ecrivain : Pb fcntl sur levee verrou\n");
	  exit(-1);
     }

     /* fermeture du fichier partage */
     close(d_fich);

     printf("Ecrivain %c --> levee du verrou interne consultatif\n" , lettre );

     exit(0);
} 






