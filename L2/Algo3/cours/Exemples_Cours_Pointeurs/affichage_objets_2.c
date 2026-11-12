#include <stdio.h>
#include <stdlib.h>

#include <string.h>

/* 
 * ------------
 * Objet de base (hérité de tous les objets)
 * ------------
 */


typedef enum message_s { AFFICHER , INCREMENTER , DECREMENTER } message_t ;

typedef struct objet_s objet_t ;

struct objet_s
{
  /* Attributs (vide) */
  /* Methodes (1 seule : aiguillage) */
  void (*switching)(objet_t * , message_t) ;
} ;

/*
 * Corps des methodes 
 */
static
void message_envoyer( objet_t * objet , message_t message )
{
  objet->switching( objet , message ) ; 
}

/* 
 * ------------
 * Objet ENTIER 
 * ------------
 */



typedef struct entier_s entier_t ;

struct entier_s
{
  /* Heritage de objet_t */
  void (*switching)(objet_t * , message_t) ;
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

/* Corps aiguillage specifique a entier_t */
static
void switching_int( objet_t * self , message_t message ) 
{
  switch(message)
    {
    case AFFICHER :
      ((entier_t *)self)->afficher((entier_t *)self) ;
      break ; 
   case INCREMENTER :
      ((entier_t *)self)->incrementer((entier_t *)self) ;
      break ; 
    case DECREMENTER :
      ((entier_t *)self)->decrementer((entier_t *)self) ;
      break ; 
    }
} 

/* Constructeur */
static
entier_t * creer_entier( const int val ) 
{
  entier_t * obj = malloc(sizeof(entier_t)) ; 
  obj->switching = switching_int ;
  obj->i = val ; 
  obj->afficher    = afficher_int ;
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
  /* Heritage de objet_t */
  void (*switching)(objet_t * , message_t) ;
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

/* Corps aiguillage specifique a S_t */
static
void switching_struct( objet_t * self , message_t message ) 
{
  switch(message)
    {
    case AFFICHER :
      ((S_t *)self)->afficher((S_t *)self) ;
      break ;
    case INCREMENTER :
      ((S_t *)self)->incrementer((S_t *)self) ;
      break ; 
    case DECREMENTER :
      ((S_t *)self)->decrementer((S_t *)self) ;
      break ; 
    }
} 

/*
 * Constructeur 
 */
static
S_t * creer_struct( char * const string , const int val ) 
{
  S_t * obj = malloc(sizeof(S_t)) ;
  obj->switching = switching_struct ;
  strcpy( obj->c , string ) ;
  obj->i = val ; 
  obj->afficher    = afficher_struct ;
  obj->incrementer = incrementer_struct ;
  obj->decrementer = decrementer_struct ;
  return(obj) ; 
}

/*
 *---------------------------------------------- 
 * Programme d'appel de la "methode" afficher 
 * sur les 2 objets 
 *---------------------------------------------- 
 */
int 
main()
{

  entier_t * entier = creer_entier( 10 ) ;
  S_t * S = creer_struct( "abcdef" , 99 ) ; 

  /* Envoi messages vers une instance entier_t */
  printf( "\nObjet entier = ") ; 
  message_envoyer( (objet_t*)entier , AFFICHER ) ; 
  message_envoyer( (objet_t*)entier , INCREMENTER ) ; printf("+1 = ") ;
  message_envoyer( (objet_t*)entier , AFFICHER ) ;
  message_envoyer( (objet_t*)entier , DECREMENTER ) ; printf("-1 = ") ;
  message_envoyer( (objet_t*)entier , AFFICHER ) ;


  /* Envoi messages vers une instance S_t */
  printf( "\nObjet S = ") ;
  message_envoyer( (objet_t*)S , AFFICHER ) ;
  message_envoyer( (objet_t*)S , INCREMENTER ) ;  printf("+1 = ") ;
  message_envoyer( (objet_t*)S , AFFICHER ) ;
  message_envoyer( (objet_t*)S , DECREMENTER ) ;  printf("-1 = ") ;
  message_envoyer( (objet_t*)S , AFFICHER ) ;

  return(0);
}
