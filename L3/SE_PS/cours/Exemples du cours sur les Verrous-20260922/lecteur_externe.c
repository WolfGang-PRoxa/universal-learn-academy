#include <stdio.h>
#include <fcntl.h>
#include <errno.h>
#include <string.h>
#include <unistd.h>
#include <stdlib.h>


/* 
 * Pose d'un verrou externe sur un fichier par un lecteur 
 */

int
main( int nb_arg , char * tab_arg[] )
{
     int d_verrou ;                 /* Descripteur du fichier verrou */
     int d_fich ;                   /* Descripteur du fichier partage */
     char ref_verrou[256] ;         /* Reference du fichier verrou */
     char ref_fichier[256];         /* Reference du fichier partage */
     char buffer[1024] ;
     char mess[512];
     int i , nb_lus ;

     /*----------*/

     if( nb_arg != 2 )
     {
	  fprintf( stderr , "Usage : %s <reference fichier>\n" , tab_arg[0]);
	  exit(-1);

     }

     strcpy(ref_fichier, tab_arg[1]);

     /* construction du nom du fichier verrou */
     strcpy(ref_verrou, ref_fichier);
     strcat(ref_verrou, "_verrou" );

     /* Attente jusqu'a la pose du verrou externe */

     sprintf( mess , "Lecteur --> attente pose verrou externe %s\n" , ref_verrou);
     write( 1 , mess , strlen(mess) );

     while( ( ( d_verrou = open(ref_verrou, O_CREAT|O_EXCL,0)) == -1 ) &&
	    ( errno == EEXIST ) ) ;

     /* Fin attente --> la pose est effectuee 
      * Pas besoin du descripteur, juste de la ref. du verrou */
     close(d_verrou);

     sprintf( mess , "Lecteur --> pose du verrou externe %s\n", ref_verrou);
     write( 1 , mess , strlen(mess) );

     /* 
      * Lecture dans le fichier partage 
      */

     /* ouverture */
     if( (d_fich = open(ref_fichier, O_RDONLY , 744 )) == -1 )
     {
	  fprintf( stderr, "Pb open sur %s\n", ref_fichier );
	  exit(-2);
     }
     
     /* Lecture */
     i = 0;
     sprintf( mess , "Informations lues :\n");
     write( 1 , mess , strlen(mess) );

     while( (nb_lus = read( d_fich , buffer , sizeof(buffer) )) > 0  )
     {
	  write( 1 , buffer , nb_lus );
     }

     /* fermeture */
     close(d_fich);

     /* Levee du verou externe */
     unlink(ref_verrou);
     sprintf( mess , "\nLecteur --> levee du verrou externe %s\n", ref_verrou);
     write( 1 , mess , strlen(mess) );

     exit(0);

}
