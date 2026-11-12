#include <stdio.h>
#include <fcntl.h>
#include <errno.h>
#include <string.h>
#include <unistd.h>
#include <stdlib.h>

#include <commun.h>

/* 
 * Pose d'un verrou externe sur un fichier  par un ecrivain
 */
int
main( int nb_arg , char * tab_arg[] )
{
     int d_verrou ;                 /* Descripteur du fichier verrou interne */
     int d_fich ;                   /* Descripteur du fichier partage */
     char ref_verrou[256] ;         /* Reference du fichier verrou interne */
     char ref_fichier[256] ;        /* Reference du fichier partage */
     int i , j ;
     char lettre , buffer[1024] ;
     /*----------------------------*/

     if( nb_arg != 3  )
     {
	  fprintf( stderr , "Usage : %s <reference fichier> <lettre>\n" , tab_arg[0]);
	  exit(-1);
     }

     strcpy(ref_fichier,tab_arg[1]);
     lettre = tab_arg[2][0];

     /* construction du verrou externe : creation du nom du fichier verrou */
     strcpy(ref_verrou, ref_fichier);
     strcat(ref_verrou, "_verrou" );

     /* 
      * Consultation du verrou externe : 
      * Attente jusqu'a ce qu'on puisse poser le verrou 
      */

     printf("Ecrivain %c --> attente pose verrou externe %s\n" , lettre , ref_verrou);

     while( ( ( d_verrou = open(ref_verrou, O_CREAT|O_EXCL,0)) == -1 ) &&
	    ( errno == EEXIST ) ) ;


     /* Fin attente --> la pose est effectuee 
      * Pas besoin du descripteur, juste de la ref. du verrou */
     close(d_verrou);

     printf("Ecrivain %c --> pose du verrou externe %s\n", lettre, ref_verrou);

     /* 
      * Ecriture dans le fichier partage 
      */
     /* -- Ouverture */
     if( (d_fich = open(ref_fichier, O_RDWR|O_CREAT , 0666 )) == -1 )
     {
	  fprintf( stderr, "Pb open sur %s\n", ref_fichier );
	  exit(-2);
     }
     
     /* -- Ecriture */
     for( i=0; i<100 ; i++)
     {
	  for( j=0;j<NB_LETTRES;j++)
	       write( d_fich , &lettre , sizeof(char) ) ;
	  sprintf( buffer , "%02d" , i );
	  write( d_fich , buffer , strlen(buffer) ) ;
	  write( d_fich , "\n" , strlen("\n") );
     }

     /* -- Fermeture */
     close(d_fich);

     /* Pause */
     fprintf(stdout, "Ecrivain %c : Pause...\n" , lettre);
     fscanf(stdin,"%s", buffer) ;

     /* Levee du verou externe */
     unlink(ref_verrou);
     printf("Ecrivain %c --> levee du verrou externe %s\n", lettre , ref_verrou);

     exit(0);
}
