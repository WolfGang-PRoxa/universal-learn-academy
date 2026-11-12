#include <stdio.h>

int 
main() 
{
  float x[2] = {100.10 , 200.20 }  ; 

  void * p = &x ; 

  printf("Taille d'un float = %lu\n" , sizeof(float) ) ; 

  /* Coimmile mais arithmetique pointeur ne marche pas */
  printf( "p initial   = %p\n" , p ) ;
  p++ ;
  printf( "p apres p++ = %p\n" , p ) ;
  p-- ; 
  printf( "p apres p-- = %p\n" , p ) ;

  /* Ne compile pas */
/*   printf( "Contenu variable pointee par p = %f\n" , (*p) ) ; */
}
