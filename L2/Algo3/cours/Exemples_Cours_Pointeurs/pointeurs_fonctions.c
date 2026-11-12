#include <stdio.h>

void F1() 
{
  printf("F1 : coucou \n");
}

int F2( int i1 , int i2 ) 
{
  return(i1+i2) ;
}

int
main()
{
  void (*p_f1)(void) = F1 ;
  int (*p_f2)(int , int) = F2 ;

  printf("Appel de F1\n") ; 
  p_f1() ; 

  printf("\nAppel de F2\n");
  printf( "Resultat de F2( 5 ,6 ) = %d\n" , p_f2( 5 , 6 ) ) ;

  printf("\nAppels alternatifs de F1\n");
  printf( "(*p_f1)() : " ) ; (*p_f1)()  ; 
  printf( "(*F1)()   : " ) ; (*F1)()    ;

 printf("\nAppels alternatifs de F2\n");
 printf( "Resultat de (*p_f2)(2,3) = %d\n" ,(*p_f2)(2,3) ) ; 
 printf( "Resultat de (*F2)(2,3)   = %d\n"   ,(*F2)(2,3) ) ;




  return(0) ;
}

