#include <stdio.h>
#include <setjmp.h>
#include <signal.h>
#include <unistd.h>
#include <stdlib.h>

jmp_buf env ;
static int n ;

static 
void affiche_masque( sigset_t masque )
{
     int i ;

#ifdef _SOLARIS_
     for( i=0 ; i<4 ; i++ )
	  printf("%u" , masque.__sigbits[i] );
#else
     int l = sizeof(masque)*8 ; 
     for( i=0 ; i<l ; i++ )
       {
	 printf( "%c" , (sigismember(&masque,i) ? '1' : '0') ) ;
       }
     printf("\n");
#endif

}

static 
int f( int * pi ) 
{
     n++ ;
     (*pi)++ ;
     return(0) ;
} 

static
void hand( int sig )
{
     sighold(sig);
     longjmp(env,sig);
}

int
main( ) 
{
     int i = 0 ;
     sigset_t set ;


     sigset(SIGINT,hand);
     sigset(SIGQUIT,hand);

     sigprocmask(SIG_BLOCK, NULL, &set);
     printf("Masque initial du processus %ld = ", (long)getpid() );
     affiche_masque(set);
     printf("\n");

     while(1)
     {
	  switch(setjmp(env))
	  {
	     case 0 :
		  while(1) 
		  {
		       f(&i);
		       sleep(5);
		  }

	     case SIGINT :
		  printf("Signal SIGINT recu : n=%d i=%d\n", n , i );     

		  sigprocmask(SIG_BLOCK, NULL, &set);
		  printf("Masque du processus %ld apres envoi SIGINT = ", 
			 (long)getpid() );
		  affiche_masque(set);
		  printf("\n");

		  break;
		  
	     case SIGQUIT :
		  printf("Signal SIGQUIT recu : n=%d i=%d\n", n , i );
		  exit(0);
		
	     default :
		  printf("Signal recu inconnu : n=%d i=%d\n", n , i );
		  exit(-1);
	  }
     }
}
