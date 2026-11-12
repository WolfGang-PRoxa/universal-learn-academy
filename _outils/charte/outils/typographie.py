#!/usr/bin/env python3
"""Applique la typographie française aux pages de cours (_outils/charte).

Usage :
    python _outils/charte/outils/typographie.py FICHIER.html [FICHIER.html ...]

Remplace l'espace ordinaire par une espace insécable (U+00A0) avant : ; ? ! %
et à l'intérieur des guillemets « », dans le texte seulement : les balises,
et le contenu de <pre>, <script> et <style>, ne sont pas touchés. L'opération
peut être relancée sans risque.
"""

import re
import sys
from pathlib import Path

INSECABLE = " "


def corriger(html):
    morceaux = re.split(r"(<[^>]+>)", html)
    protege = 0
    for i, m in enumerate(morceaux):
        if m.startswith("<"):
            balise = m.lower()
            if re.match(r"<(pre|script|style)\b", balise):
                protege += 1
            elif re.match(r"</(pre|script|style)>", balise):
                protege -= 1
            continue
        if protege:
            continue
        m = re.sub(r" ([:;?!])(?=[\s<]|$)", INSECABLE + r"\1", m)
        m = re.sub(r"(\d) %", r"\1" + INSECABLE + "%", m)
        m = m.replace("« ", "«" + INSECABLE).replace(" »", INSECABLE + "»")
        morceaux[i] = m
    return "".join(morceaux)


def main(fichiers):
    if not fichiers:
        print(__doc__.strip())
        return 2
    for f in map(Path, fichiers):
        avant = f.read_text(encoding="utf-8")
        apres = corriger(avant)
        if apres != avant:
            f.write_text(apres, encoding="utf-8", newline="\n")
        print(f"{f} : {apres.count(INSECABLE) - avant.count(INSECABLE)} espace(s) insécable(s) ajoutée(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
