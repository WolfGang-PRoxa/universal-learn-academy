#include <stdio.h>

void main() {
	int c, nsp, ntab, nl = 0;
	while ((c = getchar()) != EOF) {
		if (c == ' ') {
			nsp += 1;
		}
		if (c == '\t') {
			ntab += 1;
		}
		if (c == '\n') {
			nl += 1;
		}
	}
	printf("%d espaces, %d tabulations, %d lignes dans stdin\n", nsp, ntab, nl);
}