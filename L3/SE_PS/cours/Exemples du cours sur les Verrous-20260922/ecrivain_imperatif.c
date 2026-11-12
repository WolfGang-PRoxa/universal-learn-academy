#include <stdio.h>
#include <fcntl.h>
#include <errno.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/stat.h>

#include <commun.h>

/* 
 * Pose d'un verrou interne imperatif sur un fichier par un ecrivain
 * Mac Marverick ne supporte la les verrous impératifs
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
     struct stat inoeud ;

     /*----------*/

     if( nb_arg != 4)
     {
          fprintf( stderr , "Usage : %s <reference fichier> <numero d'enregistrement> <lettre>\n" , tab_arg[0]);
          exit(-1);
     }

     strcpy(ref_fichier,tab_arg[1]);
     sscanf( tab_arg[2], "%d" , &id_enreg );
     lettre = tab_arg[3][0] ;

    

     /* Positionnement du set-gid ==> verrou imperatif */
     if( stat(ref_fichier, &inoeud) == -1 )
     {
	  perror("pb sur stat");
	  return(-2);
     }
     sprintf( buffer , "chmod g+s,g-x %s" , ref_fichier) ; 
     system( buffer ) ; 
     /* if( chmod( ref_fichier , inoeud.st_mode | S_ISGID ) == -1 ) */
     /* { */
     /* 	  perror("pb sur chmod 1"); */
     /* 	  return(-3); */
     /* } */
     printf("Ecrivain %c --> pose du verrou interne imperatif\n", lettre);

     /* Ouverture du fichier partage */
     if( (d_fich = open( ref_fichier , O_RDWR , 0666 )) == -1 )
     {
	  fprintf( stderr, "Pb open sur %s\n", ref_fichier);
	  exit(-1);
     }

     /* Construction du verrou interne : affectation d'une struct flock */
     verrou.l_type   = F_WRLCK ;			  /* verrou en ecriture (exclusif)*/
     verrou.l_whence = (short)0 ;			  /* a partir du debut du fichier */
/*      verrou.l_start  = (long)(SIZE_ENREG*id_enreg);	/\* debut de la portee du verrou *\/ */
/*      verrou.l_len    = (long)SIZE_ENREG;		/\* longueur de la portee (un enreg.) *\/   */
     /* Pose verrou sur tout le fichier */
     verrou.l_start  = 0 ; 
     verrou.l_len    = 0 ; 

     /* 
      * Consultation du verrou interne
      * Tentative de pose d'un verrou Bloquant Exclusif 
      */
     printf("Ecrivain %c --> pose verrou interne " , lettre); fflush(stdout); 

     if( fcntl( d_fich , F_SETLKW , &verrou ) == -1 )
     {
	  fcntl_error(errno);
	  fprintf(stderr, "Ecrivain: Pb sur pose verrou\n");
	  exit(-2);
     }
     printf("...OK\n") ; 

     /* Fin attente --> la pose du verrou est effectuee */

    

     /* 
      * Acces au fichier partage 
      */

     lseek( d_fich , (SIZE_ENREG*id_enreg) , 0 ) ; 
     /*lseek( d_fich , verrou.l_start , 0 ) ;*/
     /* Ecriture */
     for( i=0; i<NB_LETTRES ; i++)
	  write( d_fich , &lettre , sizeof(char) ) ;
     sprintf( buffer , "%02d" , i );
     write( d_fich , buffer , strlen(buffer) ) ;
     write( d_fich , "\n" , strlen("\n") );
     

     /* Pause */
     fprintf(stdout, "Ecrivain %c : Pause...\n" , lettre);
     fscanf(stdin,"%s", buffer) ;

     /* Suppression du set-gid */
     if( chmod( ref_fichier , inoeud.st_mode ) == -1 )
     {
	  perror("pb sur chmod 2");
	  return(-3);
     }

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

     printf("Ecrivain %c --> levee du verrou interne imperatif\n" , lettre );

     exit(0);
} 






