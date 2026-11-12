#include <stdio.h>
#include <fcntl.h>
#include <errno.h>
#include <string.h>
#include <unistd.h>

#include <commun.h>

/* 
 * Pose d'un verrou interne sur un fichier par un lecteur 
 * Les verrous imperatifs ne sont pas supportes par les Mac Os ni Windows
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
     if( (d_fich = open( ref_fichier , O_RDONLY , 0666 )) == -1 )
     {
	  fprintf( stderr, "Pb open sur %s\n", ref_fichier);
	  exit(-1);
     }

     /* 
      * Acces au fichier partage 
      */
     
     /* Lecture */

     lseek( d_fich , (SIZE_ENREG*id_enreg) , 0 ) ;
     printf("Lecteur :\n");
     read( d_fich , buffer , SIZE_ENREG ) ;
     write( 1 , buffer , SIZE_ENREG );
     printf("\n");


     /* Pause */
     fprintf(stdout, "Lecteur : Pause...\n");
     fscanf(stdin,"%s", buffer) ;

     /* fermeture du fichier partage */
     close(d_fich);


     exit(0);

}
