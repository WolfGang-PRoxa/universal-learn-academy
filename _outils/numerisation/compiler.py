#!/usr/bin/env python3
"""Compile les sources de _outils/numerisation/sources/ en PDF (studies/_outils/numerisation).

Usage, depuis studies/ :
    uvx --with typst python _outils/numerisation/compiler.py [--verifier] [SOURCE.typ | DOSSIER ...]
    uvx --with typst --with pymupdf python _outils/numerisation/compiler.py --apercu DOSSIER [SOURCE.typ ...]

Chaque source `sources/<chemin>.typ` produit `<chemin>.pdf` à la racine de studies/ :
`_outils/numerisation/sources/L3/Codage/TD/TD1/TD1.typ` donne `L3/Codage/TD/TD1/TD1.pdf`.
Sans argument, toutes les sources sont compilées.

--verifier        ne rien écrire : signaler les PDF absents ou différents de ce que donne
                  leur source (code de sortie 1 s'il y en a).
--apercu DOSSIER  ne pas toucher aux dossiers de cours : écrire dans DOSSIER le PDF, une image
                  PNG par page et, quand le scan est archivé (`scans/<chemin>.pdf`), une planche
                  scan | PDF par page, pour comparer. Il faut alors `--with pymupdf`.

Un PDF qui ne vient pas de Typst n'est jamais écrasé : c'est sans doute le scan, à archiver
d'abord dans `_outils/numerisation/scans/`, au même chemin.

Les polices viennent du système (Times New Roman, Arial…), de Typst (New Computer Modern,
Libertinus, DejaVu Sans Mono) et, s'il existe, du dossier `_outils/numerisation/polices/`.
"""

import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
RACINE = ICI.parent.parent
SOURCES = ICI / "sources"
SCANS = ICI / "scans"
POLICES = ICI / "polices"


def sources_demandees(arguments):
    if not arguments:
        return sorted(SOURCES.rglob("*.typ"))
    trouvees = []
    for a in arguments:
        p = Path(a)
        if not p.is_absolute():
            p = (Path.cwd() / p).resolve()
        if p.is_dir():
            trouvees.extend(sorted(p.rglob("*.typ")))
        elif p.suffix == ".typ" and p.is_file():
            trouvees.append(p)
        else:
            raise SystemExit(f"Source introuvable : {a}")
    for p in trouvees:
        if SOURCES not in p.parents:
            raise SystemExit(f"{p} n'est pas dans {SOURCES.relative_to(RACINE).as_posix()}/")
    return trouvees


def compiler(typst, source):
    """Renvoie (octets du PDF, avertissements)."""
    polices = [str(POLICES)] if POLICES.is_dir() else []
    pdf, avertissements = typst.compile_with_warnings(str(source), root=str(ICI), font_paths=polices, format="pdf")
    return pdf, [str(getattr(a, "message", a)) for a in avertissements]


def vient_de_typst(fichier):
    return b"Typst" in fichier.read_bytes()


def apercus(pdf, relatif, dossier):
    """Le PDF, une image par page, et une planche scan | PDF si le scan est archivé."""
    import pymupdf
    dossier.mkdir(parents=True, exist_ok=True)
    nom = relatif.stem
    (dossier / f"{nom}.pdf").write_bytes(pdf)
    doc = pymupdf.open(stream=pdf, filetype="pdf")
    scan = SCANS / relatif
    doc_scan = pymupdf.open(scan) if scan.is_file() else None
    for i, page in enumerate(doc):
        z = 1500 / max(page.rect.width, page.rect.height)
        image = page.get_pixmap(matrix=pymupdf.Matrix(z, z), alpha=False)
        image.save(dossier / f"{nom}-p{i + 1}.png")
        if doc_scan is not None and i < len(doc_scan):
            p = doc_scan[i]
            # Une feuille en paysage photographiée en portrait est redressée
            if (p.rect.width > p.rect.height) != (page.rect.width > page.rect.height):
                p.set_rotation((p.rotation + 270) % 360)
            zs = image.height / p.rect.height
            pix = p.get_pixmap(matrix=pymupdf.Matrix(zs, zs), alpha=False)
            planche = pymupdf.open()
            feuille = planche.new_page(width=pix.width + image.width + 30, height=image.height)
            feuille.insert_image(pymupdf.Rect(0, 0, pix.width, pix.height), pixmap=pix)
            feuille.insert_image(pymupdf.Rect(pix.width + 30, 0, pix.width + 30 + image.width, image.height), pixmap=image)
            feuille.get_pixmap(alpha=False).save(dossier / f"{nom}-p{i + 1}-comparaison.png")
    return len(doc)


def main(arguments):
    verifier = False
    dossier_apercus = None
    reste = []
    it = iter(arguments)
    for a in it:
        if a == "--verifier":
            verifier = True
        elif a == "--apercu":
            suivant = next(it, None)
            if not suivant:
                raise SystemExit("--apercu attend un dossier")
            dossier_apercus = Path(suivant).resolve()
        elif a in ("-h", "--help"):
            print(__doc__.strip())
            return 0
        else:
            reste.append(a)
    try:
        import typst
    except ImportError:
        raise SystemExit("Il manque Typst : lancer avec « uvx --with typst python _outils/numerisation/compiler.py … »")

    erreurs = 0
    liste = sources_demandees(reste)
    if not liste:
        print("Aucune source dans", SOURCES.relative_to(RACINE).as_posix())
    for source in liste:
        relatif = source.relative_to(SOURCES).with_suffix(".pdf")
        nom = relatif.as_posix()
        cible = RACINE / relatif
        try:
            pdf, avertissements = compiler(typst, source)
        except Exception as e:  # erreur de compilation : la montrer avec sa position, passer à la source suivante
            erreurs += 1
            detail = (getattr(e, "diagnostic", "") or str(e)).strip()
            print(f"✗ {nom}\n    " + detail.replace("\n", "\n    "))
            continue
        for a in avertissements:
            print(f"  ! {nom} : {a}")
        if dossier_apercus is not None:
            n = apercus(pdf, relatif, dossier_apercus)
            print(f"✓ {nom} : {n} page(s) en aperçu dans {dossier_apercus}")
            continue
        if verifier:
            if not cible.is_file():
                erreurs += 1
                print(f"✗ {nom} : PDF absent")
            elif cible.read_bytes() != pdf:
                erreurs += 1
                print(f"✗ {nom} : le PDF ne correspond plus à sa source (recompiler)")
            else:
                print(f"✓ {nom}")
            continue
        if cible.is_file() and not vient_de_typst(cible):
            erreurs += 1
            print(f"✗ {nom} : le fichier en place ne vient pas de Typst (un scan ?) ; l'archiver d'abord dans _outils/numerisation/scans/{nom}")
            continue
        cible.parent.mkdir(parents=True, exist_ok=True)
        change = not cible.is_file() or cible.read_bytes() != pdf
        if change:
            cible.write_bytes(pdf)
        print(f"✓ {nom} ({len(pdf) // 1024} Ko{'' if change else ', inchangé'})")
    print(f"{len(liste)} source(s), {erreurs} erreur(s).")
    return 1 if erreurs else 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    sys.exit(main(sys.argv[1:]))
