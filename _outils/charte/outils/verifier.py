#!/usr/bin/env python3
"""Vérifie qu'une page HTML respecte la charte des cours (studies/_outils/charte).

Usage :
    python _outils/charte/outils/verifier.py CHEMIN [CHEMIN ...]

CHEMIN est un fichier .html ou un dossier. Un dossier est parcouru
récursivement et seules les pages qui chargent cours.css y sont vérifiées ;
les modèles (commentaire « MODÈLE — ») n'y sont vérifiés que s'ils sont
nommés explicitement.
Code de sortie : 1 s'il y a au moins une erreur, 0 sinon. Les avertissements
signalent un écart qui peut être volontaire.

Les classes et les matières autorisées sont lues dans assets/cours.css : une
classe absente de la feuille de style est une erreur (on n'invente pas de
classe dans une page, on l'ajoute d'abord à la charte).
"""

import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

CHARTE = Path(__file__).resolve().parent.parent
FEUILLE = CHARTE / "assets" / "cours.css"
SCRIPT = CHARTE / "assets" / "cours.js"

TYPES_BLOC = {"definition", "theoreme", "exemple", "methode", "attention",
              "astuce", "exercice", "retenir", "note", "complement"}
# Classes sans règle CSS propre, mais qui portent un sens pour le lecteur
CLASSES_SEMANTIQUES = {"preuve", "indice", "solution", "correction", "precedent",
                       "sans-sommaire"}  # sans-sommaire : lue par cours.js
PREFIXES_LIBRES = ("language-", "lang-", "hljs", "katex")
VIDES = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
         "meta", "source", "track", "wbr"}
COULEURS_PERMISES = {"none", "currentcolor", "transparent"}
DOSSIERS_IGNORES = {"vendor", "Documentation", ".git", "node_modules"}
# Dossiers d'outils de studies/ dont les scripts peuvent être chargés
DOSSIERS_OUTILS = ("_outils/",)
RACINE = CHARTE.parent.parent


def classes_css(fichier, vus=None):
    """Classes définies par une feuille de style, @import compris."""
    fichier = Path(fichier).resolve()
    vus = vus if vus is not None else set()
    if fichier in vus or not fichier.exists():
        return set()
    vus.add(fichier)
    css = fichier.read_text(encoding="utf-8")
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    classes = set()
    for m in re.finditer(r'@import\s+(?:url\()?\s*["\']?([^"\')\s]+)["\']?\s*\)?', css):
        classes |= classes_css(fichier.parent / m.group(1), vus)
    css = re.sub(r"@import[^;]*;", "", css)
    css = re.sub(r"url\([^)]*\)", "", css)
    return classes | set(re.findall(r"\.([A-Za-z][\w-]*)", css))


def lire_charte():
    css = FEUILLE.read_text(encoding="utf-8")
    matieres = set(re.findall(r'\[data-matiere="([\w-]+)"\]', css))
    return classes_css(FEUILLE), matieres


class Element:
    def __init__(self, tag, attrs, ligne, parent):
        self.tag = tag
        self.attrs = attrs
        self.classes = set((attrs.get("class") or "").split())
        self.ligne = ligne
        self.parent = parent
        self.enfants = []
        self.texte = ""             # texte propre à l'élément (fil d'Ariane)

    def ancetre(self, tag=None, classe=None):
        e = self.parent
        while e is not None:
            if (tag is None or e.tag == tag) and (classe is None or classe in e.classes):
                return e
            e = e.parent
        return None


class Analyseur(HTMLParser):
    """Construit un arbre minimal (balises, attributs, lignes, texte des titres)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.elements = []
        self.courant = None
        self.titres = []            # (niveau, element, texte)
        self._titre_en_cours = None
        self.titre_page = ""
        self.scripts_en_ligne = []

    def handle_starttag(self, tag, attrs):
        attrs = {k: (v if v is not None else "") for k, v in attrs}
        el = Element(tag, attrs, self.getpos()[0], self.courant)
        if self.courant is not None:
            self.courant.enfants.append(el)
        self.elements.append(el)
        if re.fullmatch(r"h[1-6]", tag):
            self._titre_en_cours = (el, [])
        if tag not in VIDES:
            self.courant = el

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VIDES and self.courant is not None and self.courant.tag == tag:
            self.courant = self.courant.parent

    def handle_endtag(self, tag):
        if tag in VIDES:
            return
        e = self.courant
        while e is not None and e.tag != tag:
            e = e.parent
        if e is None:
            return
        if self._titre_en_cours and self._titre_en_cours[0] is e:
            texte = " ".join("".join(self._titre_en_cours[1]).split())
            self.titres.append((int(tag[1]), e, texte))
            self._titre_en_cours = None
        self.courant = e.parent

    def handle_data(self, data):
        if self._titre_en_cours:
            self._titre_en_cours[1].append(data)
        c = self.courant
        if c is not None:
            c.texte += data
        if c is not None and c.tag == "title":
            self.titre_page += data
        if (c is not None and c.tag == "script" and "src" not in c.attrs and data.strip()
                and c.attrs.get("type") != "application/json"):
            self.scripts_en_ligne.append(c.ligne)


def verifier(chemin, classes_css_page, matieres, explicite):
    """Renvoie (erreurs, avertissements) ou None si la page n'utilise pas la charte."""
    try:
        source = chemin.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        # Page hors charte (projet d'étudiant…) dans un dossier parcouru : ignorée
        return ([(1, "fichier illisible en UTF-8")], []) if explicite else None
    a = Analyseur()
    a.feed(source)
    a.close()
    erreurs, avertis = [], []
    err = lambda l, m: erreurs.append((l, m))
    avert = lambda l, m: avertis.append((l, m))

    def resoudre(url):
        morceaux = urlsplit(url)
        if morceaux.scheme or morceaux.netloc or not morceaux.path:
            return None
        return (chemin.parent / unquote(morceaux.path)).resolve()

    def trouver(tag=None, classe=None):
        return [e for e in a.elements
                if (tag is None or e.tag == tag) and (classe is None or classe in e.classes)]

    # Page de la charte ? --------------------------------------------------
    feuilles = [e for e in trouver("link") if e.attrs.get("href", "").endswith("assets/cours.css")]
    if not feuilles:
        if explicite:
            err(1, "la page ne charge pas _outils/charte/assets/cours.css")
            return erreurs, avertis
        return None
    if not any(resoudre(e.attrs["href"]) == FEUILLE for e in feuilles):
        err(feuilles[0].ligne, f"chemin vers cours.css faux : « {feuilles[0].attrs['href']} »")

    scripts = trouver("script")
    script_charte = [e for e in scripts if e.attrs.get("src", "").endswith("assets/cours.js")]
    if not script_charte:
        err(1, "cours.js n'est pas chargé")
    else:
        s = script_charte[0]
        if resoudre(s.attrs["src"]) != SCRIPT:
            err(s.ligne, f"chemin vers cours.js faux : « {s.attrs['src']} »")
        if "defer" in s.attrs or "async" in s.attrs:
            avert(s.ligne, "cours.js doit être chargé sans defer (sinon le thème clignote)")
    for s in scripts:
        src = s.attrs.get("src", "")
        if src and not any(d in src for d in DOSSIERS_OUTILS) and not src.startswith(("vendor/", "assets/")):
            err(s.ligne, f"script hors charte : « {src} »")
        elif src and resoudre(src) is not None and not resoudre(src).exists():
            err(s.ligne, f"script introuvable : « {src} »")
    for ligne in a.scripts_en_ligne:
        err(ligne, "script en ligne interdit : le comportement va dans cours.js")

    # En-tête du document -------------------------------------------------
    html = trouver("html")
    racine = html[0] if html else None
    relatif = chemin.resolve().relative_to(RACINE) if RACINE in chemin.resolve().parents else None
    dans_charte = relatif is not None and relatif.parts[0].startswith("_")
    if racine is None or racine.attrs.get("lang") != "fr":
        err(racine.ligne if racine else 1, '<html lang="fr"> attendu')
    if racine is not None and not dans_charte:
        m = racine.attrs.get("data-matiere")
        if not m:
            err(racine.ligne, "data-matiere manquant sur <html>")
        elif m not in matieres:
            err(racine.ligne, f"matière inconnue « {m} » : l'ajouter dans cours.css (section 2) "
                              f"ou choisir parmi {', '.join(sorted(matieres))}")
    if not a.titre_page.strip() or "{{" in a.titre_page:
        err(1, "<title> vide ou non rempli")
    if not any(e.attrs.get("name") == "description" for e in trouver("meta")):
        avert(1, '<meta name="description"> manquant')
    # Le bloc de données d'un quiz contient des trous {{0}} légitimes : on le masque
    sans_json = re.sub(r'(<script[^>]*type="application/json"[^>]*>)(.*?)(</script>)',
                       lambda m: m.group(1) + re.sub(r"[^\n]", " ", m.group(2)) + m.group(3),
                       source, flags=re.S)
    if "{{" in sans_json:
        l = sans_json[:sans_json.index("{{")].count("\n") + 1
        err(l, "reste un emplacement {{…}} du modèle")
    if "MODÈLE —" in source:
        avert(1, "le commentaire du modèle est encore présent")

    # Styles, identifiants, classes --------------------------------------
    for e in trouver("style"):
        err(e.ligne, "<style> interdit : les styles vont dans cours.css")
    for e in a.elements:
        if "style" in e.attrs:
            err(e.ligne, f"attribut style interdit sur <{e.tag}>")
    vus = {}
    for e in a.elements:
        i = e.attrs.get("id")
        if i:
            if i in vus:
                err(e.ligne, f"id « {i} » déjà utilisé ligne {vus[i]}")
            vus.setdefault(i, e.ligne)
    connues = set(classes_css_page)
    for e in trouver("link"):
        cible = resoudre(e.attrs.get("href", "")) if "stylesheet" in e.attrs.get("rel", "") else None
        if cible is not None and cible.suffix == ".css" and cible.exists() and cible != FEUILLE:
            connues |= classes_css(cible)
    inconnues = {}
    for e in a.elements:
        for c in e.classes:
            if c in connues or c in CLASSES_SEMANTIQUES or c.startswith(PREFIXES_LIBRES):
                continue
            inconnues.setdefault(c, e.ligne)
    for c, l in sorted(inconnues.items(), key=lambda x: x[1]):
        err(l, f"classe « {c} » absente de la charte")

    # Structure de la page -------------------------------------------------
    cours = [e for e in trouver("main") if "cours" in e.classes]
    quiz = [e for e in trouver("main") if "quiz" in e.classes]
    portail = [e for e in trouver("main") if "portail" in e.classes]
    index = chemin.name == "index.html" or (cours and "sans-numeros" in cours[0].classes) or bool(portail)
    if not trouver(classe="barre"):
        err(1, "barre du haut (header.barre) manquante")
    # Fil d'Ariane : « studies » d'abord, lien vers l'accueil général (sauf sur celui-ci)
    fils = trouver(classe="fil")
    if fils and relatif is not None and relatif != Path("index.html"):
        crans = [e for e in fils[0].enfants if "pastille" not in e.classes]
        premier = crans[0] if crans else None
        if premier is None or premier.tag != "a" or premier.texte.strip() != "studies":
            err(fils[0].ligne, "fil d'Ariane : il doit commencer par « studies », lien vers l'accueil général "
                               "(index.html à la racine de studies/, ../../../index.html depuis generated_courses/)")
        elif not dans_charte:
            cible = resoudre(premier.attrs.get("href", ""))
            if cible != (RACINE / "index.html").resolve():
                err(premier.ligne, f"fil d'Ariane : « studies » doit mener à l'accueil général, "
                                   f"pas à « {premier.attrs.get('href', '')} »")
    principal = cours or quiz or portail
    if not principal:
        err(1, "<main class=\"cours\"> (ou class=\"quiz\", class=\"portail\") manquant")
    elif not principal[0].ancetre(classe="page"):
        err(principal[0].ligne, "main doit être dans div.page")
    if not trouver(classe="entete"):
        err(1, "en-tête (header.entete) manquant")
    if quiz:
        donnees = [e for e in trouver("script") if e.attrs.get("id") == "quiz-donnees"]
        if not donnees or donnees[0].attrs.get("type") != "application/json":
            err(1, "page de quiz sans <script type=\"application/json\" id=\"quiz-donnees\">")
    elif not index:
        for classe, quoi in (("chapeau", "chapeau"), ("meta", "métadonnées (dl.meta)"),
                             ("cadre-intro", "cadre Objectifs / Prérequis"),
                             ("pagination", "navigation entre chapitres")):
            if not trouver(classe=classe):
                avert(1, f"{quoi} manquant")
        if not any("data-duree-lecture" in e.attrs for e in a.elements):
            avert(1, "durée de lecture ([data-duree-lecture]) absente")
        if not any(e.attrs.get("src", "").endswith("katex.min.js") for e in scripts):
            avert(1, "KaTeX n'est pas chargé")
        if not any(e.attrs.get("src", "").endswith("highlight.min.js") for e in scripts):
            avert(1, "highlight.js n'est pas chargé")
        textes_h2 = [t.lower() for n, _, t in a.titres if n == 2]
        if not any("retenir" in t for t in textes_h2):
            err(1, "section « À retenir » manquante")
        if not any("auto-évaluation" in t or "auto-evaluation" in t for t in textes_h2):
            avert(1, "section « Auto-évaluation » manquante")

    # Titres -----------------------------------------------------------------
    h1 = [e for n, e, _ in a.titres if n == 1]
    if len(h1) != 1:
        err(h1[1].ligne if len(h1) > 1 else 1, f"{len(h1)} titre(s) h1 : il en faut exactement un")
    elif not h1[0].ancetre(classe="entete"):
        avert(h1[0].ligne, "le h1 doit être dans header.entete")
    precedent = 1
    for n, e, texte in a.titres:
        if n >= 5:
            err(e.ligne, f"h{n} interdit (h4 au plus)")
        if n > precedent + 1:
            err(e.ligne, f"saut de niveau h{precedent} → h{n} (« {texte[:40]} »)")
        if e.ancetre(classe="bloc"):
            err(e.ligne, "pas de titre h2–h4 dans un bloc : utiliser p.bloc-titre")
        precedent = n
    dernier_h2_sans_numero = False
    for n, e, texte in a.titres:
        if n == 2:
            dernier_h2_sans_numero = "sans-numero" in e.classes
        elif n == 3 and dernier_h2_sans_numero and "sans-numero" not in e.classes:
            err(e.ligne, "h3 sous un h2 sans-numero : lui mettre aussi la classe sans-numero")

    # Composants -----------------------------------------------------------
    for e in trouver(classe="bloc"):
        types = e.classes & TYPES_BLOC
        if len(types) != 1:
            err(e.ligne, f"bloc sans type ou à plusieurs types ({', '.join(sorted(types)) or 'aucun'})")
        premier = e.enfants[0] if e.enfants else None
        if premier is None or "bloc-titre" not in premier.classes:
            err(e.ligne, "le premier enfant d'un bloc doit être p.bloc-titre")
    for e in trouver("details"):
        if not e.enfants or e.enfants[0].tag != "summary":
            err(e.ligne, "<details> doit commencer par <summary>")
    for e in trouver("pre"):
        code = e.enfants[0] if e.enfants else None
        if code is None or code.tag != "code":
            err(e.ligne, "<pre> doit contenir directement <code>")
            continue
        langue = next((c for c in code.classes if c.startswith(("language-", "lang-"))), None)
        if langue is None and "terminal" not in e.classes:
            err(e.ligne, "bloc de code sans classe language-… (utiliser language-plaintext au besoin)")
        pseudo = langue == "language-pseudo"
        for d in code.enfants:
            if not (pseudo and d.tag in ("b", "i")):
                err(d.ligne, f"balise <{d.tag}> dans un bloc de code : échapper < > & (&lt; &gt; &amp;)")
    for e in trouver("img"):
        if not e.attrs.get("alt", "").strip():
            err(e.ligne, "image sans texte alternatif (alt)")
    for e in trouver("svg", "schema"):
        if "width" not in e.attrs:
            avert(e.ligne, "svg.schema sans attribut width (égal à la largeur du viewBox)")
        if not any(d.tag == "title" for d in e.enfants):
            avert(e.ligne, "svg.schema sans <title> (description pour les lecteurs d'écran)")
    for e in a.elements:
        if e.ancetre("svg") is not None or e.tag == "svg":
            for attr in ("fill", "stroke", "color", "stop-color"):
                v = e.attrs.get(attr, "").strip().lower()
                if v and v not in COULEURS_PERMISES and not v.startswith("url("):
                    err(e.ligne, f"couleur en dur dans un schéma ({attr}=\"{v}\") : utiliser les classes .schema")

    # Liens et fichiers locaux ------------------------------------------
    for e in a.elements:
        for attr in ("href", "src"):
            url = e.attrs.get(attr)
            if not url or url.startswith(("#", "mailto:", "data:")):
                continue
            cible = resoudre(url)
            if cible is not None and not cible.exists():
                message = f"fichier introuvable : « {url} »"
                (avert if e.tag == "a" else err)(e.ligne, message)

    # Formules ---------------------------------------------------------------
    for ouvrant, fermant in (("\\(", "\\)"), ("\\[", "\\]")):
        if sans_json.count(ouvrant) != sans_json.count(fermant):
            avert(1, f"délimiteurs {ouvrant} et {fermant} déséquilibrés "
                     f"({sans_json.count(ouvrant)} contre {sans_json.count(fermant)})")

    return erreurs, avertis


def pages(chemins):
    for brut in chemins:
        p = Path(brut)
        if p.is_dir():
            for f in sorted(p.rglob("*.html")):
                if DOSSIERS_IGNORES & set(f.parts) or any(x.endswith("_files") for x in f.parts):
                    continue
                if "MODÈLE —" in f.read_text(encoding="utf-8", errors="ignore")[:2000]:
                    continue   # modèle à trous {{…}} : vérifié seulement si on le nomme
                yield f, False
        elif p.suffix.lower() == ".html" and p.exists():
            yield p, True
        else:
            print(f"introuvable ou pas un .html : {brut}")


def main(argv):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    if not argv:
        print(__doc__.strip())
        return 2
    classes_css, matieres = lire_charte()
    total_err = total_avert = nb = 0
    for chemin, explicite in pages(argv):
        resultat = verifier(chemin, classes_css, matieres, explicite)
        if resultat is None:
            continue
        nb += 1
        erreurs, avertis = resultat
        total_err += len(erreurs)
        total_avert += len(avertis)
        etat = "OK" if not erreurs and not avertis else f"{len(erreurs)} erreur(s), {len(avertis)} avertissement(s)"
        print(f"{chemin} — {etat}")
        for ligne, message in sorted(erreurs):
            print(f"  ✗ l.{ligne:<4} {message}")
        for ligne, message in sorted(avertis):
            print(f"  ! l.{ligne:<4} {message}")
    print(f"\n{nb} page(s) vérifiée(s) : {total_err} erreur(s), {total_avert} avertissement(s).")
    return 1 if total_err else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
