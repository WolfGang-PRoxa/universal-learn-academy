#include <stdio.h>

int
main()
{
  /* Declaration d'une constante qui ne devrait pas changer */
  const int x = 45 ;
  /* Pointeur sur cette constante */
  const int * p = &x  ;
  printf( "constante x AVANT = %d\n" , x ) ; 
  /* Or ceci passe sur certains compilateurs */
  (*(int *)p) = 67 ;
  printf( "constante x APRES = %d\n" , x ) ;

  /* AVANTAGES: warning ou erreur a la compilation si mauvaise utilisation */
/*   int * p2 = &x ; /\* Warning *\/ */
/*   (*p) = 56 ;     /\* Erreur *\/ */
  /* MORALITE: cast a utiliser en connaissance de cause */
  return(0) ; 
}
