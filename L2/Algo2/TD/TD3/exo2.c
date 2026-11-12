#include <stdio.h>

void main() {
	int c;
	int n;
	while ((c = getchar()) != EOF) {
		putchar(c);
		n += 1;
	}
	printf("%d", n);
}