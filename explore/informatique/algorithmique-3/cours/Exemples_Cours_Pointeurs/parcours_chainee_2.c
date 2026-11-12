#include <stdio.h>
#include <sys/time.h>
#include <stdlib.h>

#define N 100000000

typedef struct chainon_s chainon_t ;

struct chainon_s
{
  unsigned long int val ;
  chainon_t * suivant ;
} ; 

static
void * code_diabolique_1() 
{
  return(malloc(sizeof(chainon_t)*N)) ;
}


static
void code_diabolique_2( void * pointeur ) 
{
  free(pointeur) ;
}

static
chainon_t * creer( )
{
  chainon_t * chainon = NULL ; 
  if( ( chainon = malloc( sizeof( chainon_t ) ) ) == NULL )
    {
      fprintf( stderr , "fonction creer: debordement memoire\n" ) ; 
      return(NULL) ; 
    }
  return(chainon) ; 
}

int main( int argc , char * argv[] )
{
  unsigned long int i = 0 ; 
  chainon_t * chainon = NULL ;
  chainon_t * chainon_prec = NULL ;

  struct timeval tp_avant ;
  struct timeval tp_apres ;

  void * pt = NULL ; 

  /* Creation liste chainee */
  gettimeofday(&tp_avant,NULL);
  chainon_t * liste = creer() ;
  chainon_prec = liste ;
  for( i=1 ; i<N ; i++ ) 
    {
      if( i%2) pt = code_diabolique_1() ; 
      chainon = creer() ;
      if( i%2 ) code_diabolique_2(pt) ; 
      chainon_prec->suivant = chainon ;
      chainon_prec = chainon ; 
    }
  gettimeofday(&tp_apres,NULL);

  fprintf( stdout , "\n %s Creation : %ld microsecondes \n" , 
	   argv[0] ,
	   (tp_apres.tv_sec  - tp_avant.tv_sec) *1000000L +  (tp_apres.tv_usec - tp_avant.tv_usec) ) ;
  
  /* Parcours de la liste */
  tp_avant = tp_apres ; 
  chainon = liste ; 
  while( chainon != NULL ) 
    {
      chainon->val = i ; 
      chainon = chainon->suivant ; 
    }
  gettimeofday(&tp_apres,NULL);
  

 fprintf( stdout , "\n %s Parcours : %ld microsecondes \n" , 
	   argv[0] ,
	   (tp_apres.tv_sec  - tp_avant.tv_sec) *1000000L +  (tp_apres.tv_usec - tp_avant.tv_usec) ) ;
  
  return(0) ;
}
