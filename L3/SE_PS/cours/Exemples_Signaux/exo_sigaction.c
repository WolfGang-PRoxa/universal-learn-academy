#include <stdio.h>
#include <signal.h>
#include <unistd.h>
#include <stdlib.h>

static
void hand_int( int sig )
{
     static int n = 0 ;

     n++ ;
     printf("Entree dans handler INT (appel %d)\n",n);
     printf("   Signal recu (appel %d) = %d\n",n,sig);
     sleep(2);
     kill( getpid() , SIGUSR1 );
     kill( getpid() , SIGUSR2 );
     sleep(3);
     printf("Sortie de handler INT (appel %d)\n",n);
}

static
void hand_usr1( int sig )
{
     static int n = 0 ;

     n++ ;
     printf("Entree dans handler USR1 (appel %d)\n",n);
     printf("   Signal recu (appel %d) = %d\n",n,sig);
     sleep(3);
     printf("Sortie de handler USR1(appel %d)\n",n);
}

static
void hand_usr2( int sig )
{
     static int n = 0 ;

     n++ ;
     printf("Entree dans handler USR2 (appel %d)\n",n);
     printf("   Signal recu (appel %d) = %d\n",n,sig);
     sleep(5);
     printf("Sortie de handler USR2(appel %d)\n",n);
}

static
void hand_quit( int sig )
{
     static int n = 0 ;

     n++ ;
     printf("Entree dans handler QUIT (appel %d)\n",n);
     printf("   Signal recu (appel %d) = %d\n",n,sig);
     sleep(3);
     printf("Sortie de handler QUIT(appel %d)\n",n);
}

int
main( ) 
{
     int n = 0 ;
     char c ;
     struct sigaction action ;


     /* Capture du signal INT */
     action.sa_flags = SA_RESTART ;
     action.sa_handler = hand_int ;
     sigemptyset( &action.sa_mask ) ;
     sigaddset( &action.sa_mask , SIGUSR1 );
     sigaction(SIGINT, &action , NULL );

     /* Capture du signal USR1 */
     action.sa_flags = SA_RESETHAND | SA_NODEFER ;
     action.sa_handler = hand_usr1 ;
     sigemptyset( &action.sa_mask ) ;
     sigaction(SIGUSR1, &action , NULL );

     /* Capture du signal USR2 */
     action.sa_flags = 0 ;
     action.sa_handler = hand_usr2 ;
     sigemptyset( &action.sa_mask ) ;
     sigaction(SIGUSR2, &action , NULL );
     
     /* Capture signal QUIT */
     action.sa_flags = 0 ;
     action.sa_handler = hand_quit ;
     sigemptyset( &action.sa_mask ) ;
     sigaction(SIGQUIT, &action , NULL );

     printf("Entrez n\n");
     n = read(0,&c,1);
     printf("Main : retour de read, n=%d\n",n);

     kill( getpid() , SIGUSR1 );

     while(1) ;
     exit(0);
}

