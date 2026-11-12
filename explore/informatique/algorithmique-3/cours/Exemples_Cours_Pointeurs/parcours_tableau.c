#include <stdio.h>
#include <sys/time.h>
#include <stdlib.h>

#define N 100000000

typedef struct chainon_s chainon_t ;

struct chainon_s
{
  unsigned long int val ;
} ; 

int main( int argc , char * argv[] )
{
  unsigned long int i = 0 ; 

  struct timeval tp_avant ;
  struct timeval tp_apres ;

  /* Creation liste chainee */
  gettimeofday(&tp_avant,NULL);
  chainon_t * liste = malloc( sizeof(chainon_t) * N ) ;
  gettimeofday(&tp_apres,NULL);

  fprintf( stdout , "\n %s Creation : %ld microsecondes \n" , 
	   argv[0] ,
	   (tp_apres.tv_sec  - tp_avant.tv_sec) *1000000L +  (tp_apres.tv_usec - tp_avant.tv_usec) ) ;
  
  /* Parcours de la liste */
  tp_avant = tp_apres ; 
  for( i=0 ; i<N ; i++ ) 
      liste[i].val = i ; 
  gettimeofday(&tp_apres,NULL);
  

 fprintf( stdout , "\n %s Parcours : %ld microsecondes \n" , 
	   argv[0] ,
	   (tp_apres.tv_sec  - tp_avant.tv_sec) *1000000L +  (tp_apres.tv_usec - tp_avant.tv_usec) ) ;
  
  return(0) ;
}
