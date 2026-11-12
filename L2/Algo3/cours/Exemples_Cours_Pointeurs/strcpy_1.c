#include <stdio.h>
#include <sys/time.h>

#define N 100000000

static 
char * strcpy( char cible[] , char source[] ) 
{
  register int i = 0 ; 
  while( ( cible[i] = source[i] ) != '\0' ) 
    i++ ; 

  return(cible) ; 
}

int main( int argc , char * argv[] )
{
  char s1[27] = "abcdefghijklmnopqrstuvwxyz" ;
  char s2[27] ;

  unsigned long int i = 0 ; 

  struct timeval tp_avant ;
  struct timeval tp_apres ;

  gettimeofday(&tp_avant,NULL);
  for( i=0 ; i<N ; i++ ) 
    {
      strcpy( s2 , s1 ) ; 
    }
  gettimeofday(&tp_apres,NULL);
 
  fprintf( stdout , "\n Temps de %s en microsecondes = %ld\n" , 
	   argv[0] ,
	   (tp_apres.tv_sec  - tp_avant.tv_sec) * 1000000L + (tp_apres.tv_usec - tp_avant.tv_usec) ) ;

  return(0) ;
}
