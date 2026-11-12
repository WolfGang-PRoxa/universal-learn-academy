#include <stdio.h>
#include <signal.h>
#include <unistd.h>
#include <stdlib.h>



int
main( int argc , char * argv[] ) 
{
  
  if( argc != 3)
    {
      fprintf( stderr , "Envoi un signal a un processus\n" ) ;
      fprintf( stderr , "Usage : %s <pid processus recepteur> <numero signal>\n" , argv[0] ) ;
      fprintf( stderr , "%s : nombre d'arguments incorrect\n" , argv[0] ) ;
      exit(1) ; 
    }
  int pid = atoi(argv[1]) ;
  int numsig = atoi(argv[2]) ; 
  char mess[256] ;
  
  if( kill( pid , numsig ) == -1 )
    {
      sprintf(mess , "Pb envoi signal %d a pid %d" , numsig , pid ) ; 
      perror(mess) ;
    }
  
  exit(0);
}
