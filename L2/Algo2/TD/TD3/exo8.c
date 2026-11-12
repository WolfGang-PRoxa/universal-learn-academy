#include <stdio.h>

void main() {
	int c, prevc = 0, nombre = 0;

	while ((c = getchar()) != EOF) {
		if ((c >= '0') && (c <= '9')) {
			nombre = nombre * 16 + c - '0';
		}
		else if ((prevc >= 'A') && (prevc <= 'F')) {
            nombre = nombre * 16 + c - 'A' + 10;
        }
        else if (((prevc >= '0') && (prevc <= '9')) || ((prevc >= 'A') && (prevc <= 'F'))) {
		    printf("=%i\n", nombre);
            nombre = 0;
		}
        prevc = c;
	}
}