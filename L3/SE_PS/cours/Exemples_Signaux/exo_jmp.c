#include <stdio.h>
#include <setjmp.h>
#include <signal.h>
#include <unistd.h>
#include <stdlib.h>

jmp_buf env ;
static int n ;

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
  signal(SIGINT,hand);
  longjmp(env,sig);
}

int
main( ) 
{
     int i = 0 ;
     
     n = 0 ;
     signal(SIGINT,hand);
     signal(SIGQUIT,hand);
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
