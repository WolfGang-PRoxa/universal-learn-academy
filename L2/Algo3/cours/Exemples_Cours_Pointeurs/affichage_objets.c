#include <stdio.h>
#include <stdlib.h>

#include <string.h>

/* 
 * ------------
 * Objet ENTIER 
 * ------------
 */


typedef struct entier_s entier_t ;

struct entier_s
{
  /* Attributs */
  int i ; 
  /* Methodes */  
  void (*afficher)(entier_t *) ;
  void (*incrementer)(entier_t *) ;
  void (*decrementer)(entier_t *) ;
} ;

/* 
 * Corps des Methodes 
 */
static
void afficher_int( entier_t * entier ) 
{
  printf( "%d\n" , entier->i ) ; 
}

static
void decrementer_int( entier_t * entier ) 
{
  entier->i-- ; 
} 

static
void incrementer_int( entier_t * entier ) 
{
  entier->i++ ; 
} 

/*
 * Constructeur 
 */
static
entier_t * creer_entier( const int val ) 
{
  entier_t * obj = malloc(sizeof(entier_t)) ; 
  obj->i = val ; 
  obj->afficher = afficher_int ;
  obj->incrementer = incrementer_int ;
  obj->decrementer = decrementer_int ;
  return(obj) ; 
}

/* 
 * ------------
 * Objet STRUCTURE 
 * ------------
 */


typedef struct S_s S_t ; 

struct S_s
{
  /* Attributs */
  char c[10] ;
  int i ;
  /* Methodes */  
  void (*afficher)(S_t *) ;  
  void (*incrementer)(S_t *) ;  
  void (*decrementer)(S_t *) ;  
} ;

/*
 * Corps des methodes 
 */

static
void afficher_struct( S_t * structure ) 
{
  printf( "{ %s , %d } \n" , structure->c  , structure->i) ; 
} 

static
void incrementer_struct( S_t * structure ) 
{
  structure->i++ ; 
} 

static
void decrementer_struct( S_t * structure ) 
{
  structure->i-- ; 
} 

/* 
 * Constructeur 
 */
static
S_t * creer_struct( char * const string , const int val ) 
{
  S_t * obj = malloc(sizeof(S_t)) ; 
  strcpy( obj->c , string ) ;
  obj->i = val ; 
  obj->afficher = afficher_struct ;
  obj->incrementer = incrementer_struct ;
  obj->decrementer = decrementer_struct ;
  return(obj) ; 
}

/*
 * ------------------------------------------- 
 * Programme d'appel de la "methode" afficher
 * sur les 2 objets
 * -------------------------------------------
 */
int 
main()
{

  /* appel methodes d'un objet de type entier_t */
  entier_t * entier = creer_entier( 10 ) ;

  printf( "\nObjet entier = ") ; 
  entier->afficher(entier) ;
  entier->incrementer(entier) ; printf("+1 = ") ;
  entier->afficher(entier) ;
  entier->decrementer(entier) ; printf("-1 = ") ;
  entier->afficher(entier) ;
  
 /* appel methodes d'un objet de type S_t */
  S_t * S = creer_struct( "abcdef" , 99 ) ; 

  printf( "\nObjet S = ") ; 
  S->afficher(S) ;
  S->incrementer(S) ; printf("+1 = ") ;
  S->afficher(S) ;
  S->decrementer(S) ; printf("-1 = ") ;
  S->afficher(S) ;

  return(0);
}
