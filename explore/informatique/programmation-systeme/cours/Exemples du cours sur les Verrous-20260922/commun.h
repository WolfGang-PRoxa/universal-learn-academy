/* 
 * Types et fonctions communs aux 
 * processus petits et grands
 */

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>
#include <errno.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/mman.h>
#include <limits.h>
#include <signal.h>

#define NB_LETTRES 10
#define SIZE_ENREG 13

typedef enum bool { FAUX , VRAI } bool_t ;

extern
void
fcntl_error( const int no_err ) ;


