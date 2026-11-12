#include <stdio.h>
#include <sys/time.h>

#define N 1000
#define T 100000

typedef struct S_s
{
  char champ[2048] ; 
  double d ; 
  float f ; 
} S_t ;

S_t s1[T] ;
S_t s2[T] ;

static 
S_t * structcpy( S_t * cible , S_t * source, const int n ) 
{
  register int i = 0 ; 
  register S_t * c = cible ; 
  register S_t * s = source ; 
  for( i=0 ; i<n ; i++ ) 
    *c++ = *s++ ; 

  return(cible) ; 
}

int main( int argc , char * argv[] )
{
/*   S_t s1[T] ; */
/*   S_t s2[T] ; */


  unsigned long int i = 0 ; 

  struct timeval tp_avant ;
  struct timeval tp_apres ;



  gettimeofday(&tp_avant,NULL);
  for( i=0 ; i<N ; i++ ) 
    {
      structcpy( s2 , s1 , T ) ; 
    }
  gettimeofday(&tp_apres,NULL);
 
  fprintf( stdout , "\n Temps de %s en microsecondes = %ld\n" , 
	   argv[0] ,
	   (tp_apres.tv_sec  - tp_avant.tv_sec) * 1000000L + (tp_apres.tv_usec - tp_avant.tv_usec) ) ;

  return(0) ;
}
