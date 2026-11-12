#include <stdio.h>
#include <fcntl.h>
#include <errno.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <stdlib.h>

#include <commun.h>

/* 
 * Lecteur sans verrou
 */

int
main( int nb_arg , char * tab_arg[] )
{
     int d_fich ;  /* Descripteur du fichier ressource */
     char buffer[1024] ;
     int i ;

     /*----------*/

     srandom(getpid());

     if( nb_arg != 2 )
     {
	  fprintf( stderr , "Usage : %s <reference fichier>\n" , tab_arg[0]);
	  exit(-1);

     }

     printf("Lecteur %d --> debut lecture dans %s\n", getpid() , tab_arg[1] );

     /* 
      * Lecture dans le fichier partage 
      */

     /* ouverture au debut */
     if( (d_fich = open(tab_arg[1], O_RDONLY , 744 )) == -1 )
     {
	  fprintf( stderr, "Pb open sur %s\n", tab_arg[1] );
	  exit(-2);
     }
     
     /* Lecture */
     i = 0;
     printf("Lecteur %d :\n" , getpid() );
     while( read( d_fich , buffer , sizeof(buffer) ) > 0  )
     {
	  write( 1 , buffer , strlen(buffer) );
	  sleep(random()%2);
     }

     /* fermeture */
     close(d_fich);


     printf("Lecteur %d --> Fin lecture dans %s\n", getpid() ,  tab_arg[1] );

     exit(0);

}
