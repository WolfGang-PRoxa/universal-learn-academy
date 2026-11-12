#include <stdio.h>
#include <stdlib.h>
#include <fcntl.h>
#include <errno.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/stat.h>

#include <commun.h>

/* 
 * Ecrivain sans verrou
 */

int
main( int nb_arg , char * tab_arg[] )
{
     int d_fich ;  /* Descripteur du fichier ressource */
     int i , j ; 
     char buffer[10];

     /*----------*/


     if( nb_arg != 3 )
     {
	  fprintf( stderr , "Usage : %s <reference fichier> <lettre>\n" , tab_arg[0]);
	  exit(-1);

     }

     srandom(getpid());

     printf("Ecrivain %s --> Debut ecriture dans  %s\n", tab_arg[2] , tab_arg[1]);

     /* 
      * Ecriture dans le fichier partage 
      */

     /* ouverture en fin de fichier */
     if( (d_fich = open(tab_arg[1], O_RDWR|O_CREAT , 0666 )) == -1 )
     {
	  fprintf( stderr, "Pb open sur %s\n", tab_arg[1] );
	  exit(-2);
     }
     
     /* Ecriture */
     for( i=0; i<NB_LETTRES ; i++)
     {
	  for( j=0;j<10;j++)
	       write( d_fich , tab_arg[2] , strlen(tab_arg[2]) ) ;
	  sprintf( buffer , "%02d" , i );
	  write( d_fich , buffer , strlen(buffer) ) ;
	  write( d_fich , "\n" , strlen("\n") );

	  sleep(random()%3);
	  
     }

     /* fermeture */
     close(d_fich);

     printf("Ecrivain %s --> Fin ecriture dans %s\n", tab_arg[2] , tab_arg[1]);

     exit(0);

}
