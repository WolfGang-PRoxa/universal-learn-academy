#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* Fonction de comparaison de 2 entiers  */
static 
int comparer_int( const int * i1 , const int * i2 )
{
/*   return( (*i1) - (*i2) ) ; /\* dans l'ordre croissant   *\/ */
  return( (*i2) - (*i1) ) ; /* dans l'ordre decroissant */
}

static 
int comparer_int_cb( const void * v1 , const void * v2 )
{
/*   const int * i1 = v1 ; */
/*   const int * i2 = v2 ; */

/*   return( comparer_int( i1 , i2 ) ) ; */
  return( comparer_int( v1 , v2 ) ) ;
}



/* Fonction d'affichage d'un tableau d'entiers */
static 
void afficher_int( int * T , const int N )
{
  int i = 0 ; 
  for( i=0 ; i<N ; i++ ) 
      printf( "%d " , T[i] ) ;
  printf("\n" ); 
}


/* Fonction d'encapsulation de comparaison de 2 pointeurs sur 2 chaines de car */
static 
int comparer_str(  char * const * s1 ,  char * const * s2 )
{
/* 
 * signature de strcmp : 
 * int strcmp(const char *s1, const char *s2);
 */
  return( strcmp( (*s1) , (*s2) ) ) ;
}



static
int comparer_str_cb( const void * s1 , const void * s2 )
{
  char * const * w1 = s1 ;
  char * const * w2 = s2 ;
  return( comparer_str( w1 , w2 ) ) ;
}

/* Fonction d'affichage d'un tableau de chaines de car */
static 
void afficher_str( char ** T , const int N )
{
  int i = 0 ; 
  for( i=0 ; i<N ; i++ ) 
      printf( "%s " , T[i] ) ;
  printf("\n" ); 
}


/* Programme d'appel de la fonction generique */
int 
main()
{
  int tab_i[10] = { 9 , 2 , 5 , 4 , 8 , 0 , 7 , 1 , 3 , 6 } ; 
  char * tab_s[5] = { "DDDD" , "AAA" , "ZZZZ" , "UUUU" , "II" } ;

  printf( "Tableau d'entiers AVANT le tri par qsort\n") ; 
  afficher_int( tab_i , 10 ) ;
  
  qsort( tab_i , 10 , sizeof(int) , comparer_int_cb ) ;

  printf( "Tableau d'entiers APRES le tri par qsort\n") ; 
  afficher_int( tab_i , 10 ) ;

  printf( "\nTableau de chaines de car AVANT tri:\n") ; 
  afficher_str( tab_s , 5 ) ;
  
  qsort( tab_s , 5 , sizeof(char *) , comparer_str_cb ) ;
  
  printf( "Tableau de chaines de car APRES tri:\n") ; 
  afficher_str( tab_s , 5 ) ;

  return(0);
}
