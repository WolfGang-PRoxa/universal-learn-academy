#include <commun.h>

extern
void
fcntl_error( const int no_err )
{
     switch( no_err )
     { 
	case EAGAIN  : printf(" --> EAGAIN\n");
	     break ;
	case EBADF : printf(" -->EBADF\n");
	     break ;
	case EFAULT : printf(" --> EFAULT \n");
	     break ;
	case EINTR : printf(" --> EINTR\n");
	     break ;
	case EINVAL: printf(" --> EINVAL\n");
	     break ;
	case EIO : printf(" -->  EIO\n");
	     break ;
	case EMFILE : printf(" --> EMFILE\n");
	     break ;
	case ENOLCK  : printf(" --> ENOLCK ; Desole, le nombre limite de verrous est atteint\n");
	     break ;
	case ENOLINK: printf(" --> ENOLINK\n");
	     break ;
	case EOVERFLOW: printf(" --> EOVERFLOW\n");
	     break ;
	case EDEADLK : printf(" --> EDEADLK\n");
	     break ;
	default :
	     printf(" --> Code erreur inconnu = %d\n" , no_err ) ;
	     break ;
     }
     return ;
}

