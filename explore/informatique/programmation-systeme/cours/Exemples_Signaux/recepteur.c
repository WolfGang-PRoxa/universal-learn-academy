#include <stdio.h>
#include <signal.h>
#include <unistd.h>
#include <stdlib.h>


int
main( ) 
{

     printf( "Recepteur : mon pid est le %d\n" , getpid() ) ;

     while(1)
       pause() ; 

     printf( "Recepteur : fin du processsus\n" ) ;
     exit(0);
}
