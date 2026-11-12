#include <stdio.h>

void main() {
	int c;
	while ((c = getchar()) + 'A' - 'a' != EOF) {
		if ((c >= 'a') && (c <= 'z')) {
			putchar(c);
		}
		else
			putchar(c);
	}
}