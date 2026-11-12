#include <stdio.h>
#include <signal.h>
#include <unistd.h>
#include <stdlib.h>

static
void hand( int sig )
{
     static int n = 0 ;

     /*----------*/

     n++ ;
     printf("Entree dans handler (appel %d)\n",n);
     printf("   Signal recu (appel %d) = %d\n",n,sig);
     sleep(2);
     printf("Sortie de handler (appel %d)\n",n);
}

int
main( ) 
{
     int n = 0 ;
     char c ;

     /*----------*/

     sigset(SIGINT,hand);

     printf("Entrez n\n");
     n = read(0,&c,1);
     printf("Main : n=%d\n",n);

     printf("Entrez n\n");
     n = read(0,&c,1);
     printf("Main : n=%d\n",n);

     exit(0);
}
