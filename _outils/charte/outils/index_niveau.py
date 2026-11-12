#!/usr/bin/env python3
"""Produit les pages d'accueil des niveaux et l'accueil général (studies/_outils/charte).

Usage :
    python _outils/charte/outils/index_niveau.py            (L1, L2 et L3)
    python _outils/charte/outils/index_niveau.py L3 [L2 …]

Pour chaque matière du niveau, la page reprend les listes de l'accueil de la
matière (<Niveau>/<Matière>/generated_courses/index.html) : cours, TD, TP,
quiz, annales, avec les chapitres à venir. Une matière sans accueil est listée
avec les sources présentes dans son dossier. Le résultat est écrit dans
<Niveau>/index.html ; relancer l'outil après chaque nouvelle page.

L'accueil général (index.html à la racine de studies/) est refait à chaque
lancement : il regroupe L1, L2 et L3, avec pour chaque matière un résumé de ce
qui est mis en forme et un lien vers son accueil. Le fil d'Ariane des accueils
de niveau y remonte par « studies ».
"""

import datetime
import html
import os
import posixpath
import re
import sys
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parent))
from typographie import corriger  # noqa: E402

RACINE = Path(__file__).resolve().parents[3]
MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]

# Dossier -> (nom affiché, teinte, code de l'UE). L'ordre est celui de la page.
MATIERES = {
    "L3": [
        ("SE_PS", "Programmation système", "se", "175UD03"),
        ("BDD", "Bases de données 3", "bd", "175UD18"),
        ("Codage", "Codage", "codage", "175UD04"),
        ("POO", "Introduction à la POO", "poo", "175UD01"),
        ("Graph_theory", "Théorie des graphes", "maths", "175UD02"),
        ("Complexity_&_data_structure", "Complexité et structures de données", "maths", "175UD16"),
        ("Anglais", "Anglais", "anglais", "175UL02"),
    ],
    "L2": [
        ("BDD", "Bases de données (SGBD 1)", "bd", ""),
        ("probabilites_statistiques", "Probabilités et statistiques", "maths", ""),
        ("Algo3", "Algorithmique 3 : programmation avancée en C", "c", ""),
        ("Algo2", "Algorithmique 2 : langage C", "c", ""),
        ("analyse_algebre", "Analyse et algèbre 2", "maths", ""),
        ("security", "Sécurité informatique", "securite", "174UD06"),
        ("network", "Réseau", "reseau", ""),
        ("conduite_de_projet", "Conduite de projet", "communication", ""),
        ("communication", "Communication", "communication", ""),
        ("Anglais", "Anglais", "anglais", ""),
    ],
    "L1": [
        ("prog_shell", "Programmation shell", "unix", ""),
        ("UNIX", "Unix", "unix", ""),
        ("Intro_Prog", "Introduction à la programmation", "c", ""),
        ("Archi_des_ordis", "Architecture des ordinateurs", "archi", ""),
        ("maths", "Mathématiques", "maths", ""),
        ("web_statique", "Web statique", "web", ""),
        ("Objets_Connectes", "Objets connectés", "reseau", ""),
        ("Communication", "Communication", "communication", ""),
        ("PPP", "Projet personnel et professionnel", "communication", ""),
        ("Anglais", "Anglais", "anglais", ""),
    ],
}

NIVEAUX = {
    "L3": ("Licence 3", "2026–2027 · semestre 5 en cours",
           "La troisième année de licence informatique au Mans : toutes les matières, et pour chacune les cours mis en forme, les TD interactifs, les TP et les quiz. Les chapitres qui n'ont pas encore eu lieu ou pas encore été traités restent listés, en pointillés."),
    "L2": ("Licence 2", "2025–2026 · année terminée, pages de révision",
           "La deuxième année de licence informatique : les cours mis en forme pour réviser, et les matières dont les supports attendent encore d'être traités. Les chapitres à venir sont en pointillés."),
    "L1": ("Licence 1", "2024–2025 · année terminée, pages de révision",
           "La première année de licence informatique : les matières et leurs supports. Les pages de révision y sont ajoutées au fil du temps ; les matières sans page listent les sources présentes dans leur dossier."),
}

SOURCES = [("cours", "cours"), ("TD", "TD"), ("TP", "TP"), ("annales", "annales"), ("Annales", "annales")]


def url(*morceaux):
    return "/".join(quote(m) for m in "/".join(morceaux).split("/"))


def lire_accueil(chemin, prefixe):
    """Sections à chapitres de l'accueil d'une matière, liens recalés depuis le niveau."""
    s = chemin.read_text(encoding="utf-8")
    h1 = re.search(r"<h1>(.*?)</h1>", s, re.S)
    chapeau = re.search(r'<p class="chapeau">(.*?)</p>', s, re.S)
    sections = []
    for m in re.finditer(r"<section>\s*<h2>(.*?)</h2>(.*?)</section>", s, re.S):
        titre, corps = m.group(1).strip(), m.group(2)
        items = []
        for li in re.finditer(r'<li( class="a-venir")?>(.*?)</li>', corps, re.S):
            bloc = li.group(2)
            if 'class="chapitre' not in bloc:
                continue
            lien = re.search(r'<a class="chapitre" href="([^"]+)"', bloc)
            champ = lambda c: re.search(r'<span class="' + c + r'"[^>]*>(.*?)</span>', bloc, re.S)
            num, tit, res, badge = (champ(c) for c in ("chapitre-num", "chapitre-titre", "chapitre-resume", "badge"))
            href = None
            if lien and not lien.group(1).startswith(("http:", "https:", "#")):
                href = posixpath.normpath(posixpath.join(prefixe, lien.group(1)))
            items.append({
                "a_venir": bool(li.group(1)),
                "href": href,
                "num": num.group(1).strip() if num else "",
                "titre": tit.group(1).strip() if tit else "",
                "resume": res.group(1).strip() if res else "",
                "badge": badge.group(1).strip() if badge else "",
            })
        if items:
            sections.append((titre, items))
    return (h1.group(1).strip() if h1 else None, chapeau.group(1).strip() if chapeau else None, sections)


def compter_sources(dossier):
    parts, vus = [], set()
    for sous, nom in SOURCES:
        d = dossier / sous
        # annales/ et Annales/ désignent le même dossier sous Windows : ne le compter qu'une fois
        cle = os.path.normcase(str(d.resolve())) if d.is_dir() else None
        if cle and cle not in vus:
            vus.add(cle)
            fichiers = [f for f in d.rglob("*") if f.is_file() and not f.name.startswith(".")]
            if fichiers:
                parts.append(f"{nom} ({len(fichiers)} fichier{'s' if len(fichiers) > 1 else ''})")
    autres = [f for f in dossier.iterdir() if f.is_file() and f.name.lower() != "readme.md"]
    notes = [f for f in autres if f.suffix in (".gdoc", ".gslides", ".gsheet", ".gform")]
    docs = [f for f in autres if f not in notes]
    if notes:
        parts.append(f"{len(notes)} document{'s' if len(notes) > 1 else ''} Google")
    if docs:
        parts.append(f"{len(docs)} autre{'s' if len(docs) > 1 else ''} fichier{'s' if len(docs) > 1 else ''}")
    # Autres sous-dossiers (projets, rendus…) : cités par leur nom
    connus = {s.lower() for s, _ in SOURCES}
    sous = sorted(d.name for d in dossier.iterdir() if d.is_dir() and d.name.lower() not in connus
                  and not d.name.startswith((".", "_", "generated_")) and d.name not in ("quiz_results", "td_results"))
    if sous:
        parts.append(("dossier " if len(sous) == 1 else "dossiers ") + ", ".join(f"<code>{html.escape(s)}/</code>" for s in sous))
    return parts


def item_html(it):
    num = f'<span class="chapitre-num">{it["num"]}</span>'
    texte = f'<span><span class="chapitre-titre">{it["titre"]}</span>'
    if it["resume"]:
        texte += f'<span class="chapitre-resume">{it["resume"]}</span>'
    texte += "</span>"
    badge = f'<span class="badge">{it["badge"]}</span>' if it["badge"] else ""
    if it["href"] and not it["a_venir"]:
        corps = f'<a class="chapitre" href="{html.escape(url(it["href"]), quote=True)}">\n          {num}\n          {texte}\n          {badge}\n        </a>'
        return f"      <li>\n        {corps}\n      </li>"
    corps = f'<span class="chapitre">\n          {num}\n          {texte}\n          {badge}\n        </span>'
    return f'      <li class="a-venir">\n        {corps}\n      </li>'


def liste_matieres(niveau):
    """Matières du niveau, dans l'ordre de MATIERES, puis les dossiers inconnus."""
    connus = {d for d, *_ in MATIERES[niveau]}
    inconnus = sorted(p.name for p in (RACINE / niveau).iterdir() if p.is_dir() and p.name not in connus and not p.name.startswith(("_", ".")))
    return MATIERES[niveau] + [(d, d.replace("_", " "), "", "") for d in inconnus]


def generer(niveau):
    dossier_niveau = RACINE / niveau
    nom_niveau, periode, chapeau_niveau = NIVEAUX[niveau]
    blocs, stats = [], {"matieres": 0, "cours": 0, "td": 0, "quiz": 0}
    for dossier, nom, teinte, code in liste_matieres(niveau):
        chemin = dossier_niveau / dossier
        if not chemin.is_dir():
            continue
        stats["matieres"] += 1
        accueil = chemin / "generated_courses" / "index.html"
        attr = f' data-matiere="{teinte}"' if teinte else ""
        code_txt = f" · UE {code}" if code else ""
        lignes = [f"  <section{attr}>", f"    <h2>{html.escape(nom)}</h2>"]
        if accueil.is_file():
            _, chapeau, sections = lire_accueil(accueil, f"{dossier}/generated_courses")
            lien = url(dossier, "generated_courses", "index.html")
            intro = (chapeau + " ") if chapeau else ""
            lignes.append(f'    <p>{intro}<a href="{lien}">Accueil de la matière</a>{code_txt}.</p>')
            for titre, items in sections:
                lignes.append(f"    <p><strong>{titre}</strong></p>")
                lignes.append('    <ol class="chapitres">')
                lignes.extend(item_html(it) for it in items)
                lignes.append("    </ol>")
                faits = [it for it in items if it["href"] and not it["a_venir"]]
                cle = titre.lower()
                if cle.startswith("cours"):
                    stats["cours"] += len(faits)
                elif cle.startswith(("td", "tp")):
                    stats["td"] += len(faits)
                elif cle.startswith("quiz"):
                    stats["quiz"] += len(faits)
        else:
            sources = compter_sources(chemin)
            detail = " Sources dans le dossier <code>" + html.escape(f"{niveau}/{dossier}/") + "</code> : " + ", ".join(sources) + "." if sources else " Le dossier est vide pour l'instant."
            lignes.append(f"    <p>Pas encore mise en forme{code_txt}.{detail}</p>")
        lignes.append("  </section>")
        blocs.append("\n".join(lignes))

    autres = []
    for n in ("L1", "L2", "L3"):
        if n != niveau and (RACINE / n).is_dir():
            nn, per, _ = NIVEAUX[n]
            autres.append(f'      <li>\n        <a class="chapitre" href="../{n}/index.html">\n          <span class="chapitre-num">{n}</span>\n          <span><span class="chapitre-titre">{nn}</span><span class="chapitre-resume">{per}</span></span>\n          <span class="badge">Niveau</span>\n        </a>\n      </li>')
    blocs.append("  <section>\n    <h2>Autres années</h2>\n    <ol class=\"chapitres\">\n" + "\n".join(autres) + "\n    </ol>\n    <p>Avec le serveur local (<code>studies/lancer.bat</code>), le portail <code>http://127.0.0.1:5178/</code> montre aussi l'avancement des quiz et des TD interactifs.</p>\n  </section>")

    auj = datetime.date.today()
    date = f"{auj.day} {MOIS[auj.month - 1]} {auj.year}"
    page = f"""<!DOCTYPE html>
<!-- Page produite par _outils/charte/outils/index_niveau.py : ne pas la modifier à la main, relancer l'outil. -->
<html lang="fr" data-matiere="licence">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{nom_niveau} informatique · accueil</title>
<meta name="description" content="{nom_niveau} informatique (Le Mans Université) : toutes les matières et leurs pages de cours, TD, TP et quiz.">
<link rel="stylesheet" href="../_outils/charte/assets/cours.css">
<script src="../_outils/charte/assets/cours.js"></script>
</head>
<body>

<header class="barre">
  <nav class="fil" aria-label="Fil d'Ariane">
    <span class="pastille" aria-hidden="true"></span>
    <a href="../index.html">studies</a>
    <span aria-current="page">{niveau}</span>
  </nav>
</header>

<div class="page">
<main class="cours sans-numeros">

  <header class="entete">
    <p class="surtitre"><span class="badge matiere">{niveau}</span> Licence informatique · Le Mans Université · {periode}</p>
    <h1>{nom_niveau} informatique</h1>
    <p class="chapeau">{chapeau_niveau}</p>
    <dl class="meta">
      <div><dt>Matières</dt><dd>{stats["matieres"]}</dd></div>
      <div><dt>Cours mis en forme</dt><dd>{stats["cours"]}</dd></div>
      <div><dt>TD et TP</dt><dd>{stats["td"]}</dd></div>
      <div><dt>Quiz</dt><dd>{stats["quiz"]}</dd></div>
      <div><dt>Mise à jour</dt><dd><time datetime="{auj.isoformat()}">{date}</time></dd></div>
    </dl>
  </header>

{chr(10).join(blocs)}

</main>
</div>

<footer class="pied">{nom_niveau} informatique · <a href="../_outils/todo/index.html">ce qu'il reste à faire</a></footer>

</body>
</html>
"""
    sortie = dossier_niveau / "index.html"
    sortie.write_text(corriger(page), encoding="utf-8", newline="\n")
    print(f"{sortie.relative_to(RACINE)} : {stats['matieres']} matières, {stats['cours']} cours, {stats['td']} TD et TP, {stats['quiz']} quiz")


def resume_matiere(sections):
    """« 2 cours, 3 quiz, 1 annale · 4 à venir » d'après les listes de l'accueil d'une matière."""
    faits, a_venir = [], 0
    for titre, items in sections:
        n = sum(1 for it in items if it["href"] and not it["a_venir"])
        a_venir += sum(1 for it in items if it["a_venir"])
        if n:
            nom = re.sub(r"<[^>]+>", "", titre).strip()
            nom = nom if nom.isupper() else nom.lower()
            if nom.endswith("s") and n == 1 and nom not in ("cours", "quiz"):
                nom = nom[:-1]
            faits.append(f"{n} {nom}")
    texte = ", ".join(faits) if faits else "accueil créé, rien de mis en forme encore"
    return texte + (f" · {a_venir} à venir" if a_venir else "")


# Accueil général : années, de la plus récente à la plus ancienne, puis outils
ORDRE_NIVEAUX = ["L3", "L2", "L1"]
OUTILS = [
    ("_outils/quiz/portail.html", "Portail des quiz et des TD",
     "Avec le serveur local (<code>studies/lancer.bat</code>) : quiz à reprendre, résultats et TD interactifs de chaque matière."),
    ("_outils/todo/index.html", "Ce qu'il reste à faire",
     "Les tâches de TODO.md, matière par matière : cocher, ajouter, modifier, glisser d'une liste à l'autre, organiser les listes ; dates des examens."),
    ("_outils/environnements/c.html", "Compiler un TP en C",
     "Sous Windows (MinGW, Git for Windows, WSL) et sous Linux : ce qui est installé sur le PC, ce qui manque, les commandes et les erreurs fréquentes."),
    ("_outils/environnements/python.html", "Les notebooks Python",
     "Un environnement Jupyter commun (numpy, pandas, scikit-learn…), installé hors de Drive par <code>lancer-jupyter.bat</code> ou <code>lancer-jupyter.sh</code> : ouvrir un notebook, ajouter une bibliothèque."),
    ("_outils/charte/composants.html", "Charte des cours",
     "Catalogue des composants des pages : blocs, code, formules, tableaux, schémas."),
    ("_outils/quiz/demo.html", "Quiz de démonstration",
     "Les onze types de questions de l'outil de quiz."),
    ("_outils/atelier/demo.html", "Atelier de démonstration",
     "Les éditeurs des TD interactifs : diagrammes, tables, SQL, automates, chronogrammes."),
]


def generer_racine():
    blocs, stats = [], {"matieres": 0, "cours": 0, "td": 0, "quiz": 0}
    for niveau in ORDRE_NIVEAUX:
        if not (RACINE / niveau).is_dir():
            continue
        nom_niveau, periode, _ = NIVEAUX[niveau]
        lignes = [f"  <section>", f"    <h2>{nom_niveau}</h2>",
                  f'    <p>{periode}. <a href="{niveau}/index.html">Accueil de la {niveau}</a> : tous les chapitres, TD, TP et quiz de l\'année.</p>',
                  '    <ol class="chapitres">']
        for dossier, nom, teinte, _code in liste_matieres(niveau):
            chemin = RACINE / niveau / dossier
            if not chemin.is_dir():
                continue
            stats["matieres"] += 1
            attr = f' data-matiere="{teinte}"' if teinte else ""
            accueil = chemin / "generated_courses" / "index.html"
            titre = f'<span class="chapitre-titre">{html.escape(nom)}</span>'
            if accueil.is_file():
                _, _, sections = lire_accueil(accueil, f"{dossier}/generated_courses")
                for t, items in sections:
                    n = sum(1 for it in items if it["href"] and not it["a_venir"])
                    cle = t.lower()
                    if cle.startswith("cours"):
                        stats["cours"] += n
                    elif cle.startswith(("td", "tp")):
                        stats["td"] += n
                    elif cle.startswith("quiz"):
                        stats["quiz"] += n
                lien = html.escape(url(niveau, dossier, "generated_courses", "index.html"), quote=True)
                lignes.append(f'      <li{attr}>\n        <a class="chapitre" href="{lien}">\n          <span class="chapitre-num"></span>\n'
                              f'          <span>{titre}<span class="chapitre-resume">{resume_matiere(sections)}</span></span>\n        </a>\n      </li>')
            else:
                sources = compter_sources(chemin)
                resume = "Pas encore mise en forme · sources : " + ", ".join(sources) if sources else "Pas encore mise en forme · dossier vide"
                lignes.append(f'      <li class="a-venir"{attr}>\n        <span class="chapitre">\n          <span class="chapitre-num"></span>\n'
                              f'          <span>{titre}<span class="chapitre-resume">{resume}</span></span>\n          <span class="badge">À venir</span>\n        </span>\n      </li>')
        lignes += ["    </ol>", "  </section>"]
        blocs.append("\n".join(lignes))
    outils = [f'      <li>\n        <a class="chapitre" href="{html.escape(url(lien), quote=True)}">\n          <span class="chapitre-num"></span>\n'
              f'          <span><span class="chapitre-titre">{titre}</span><span class="chapitre-resume">{resume}</span></span>\n        </a>\n      </li>'
              for lien, titre, resume in OUTILS if (RACINE / lien).is_file()]
    # Les années côte à côte sur grand écran (div.annees), puis les outils
    blocs = ['  <div class="annees">\n' + "\n".join(blocs) + "\n  </div>"]
    blocs.append("  <section>\n    <h2>Outils</h2>\n    <ol class=\"chapitres\">\n" + "\n".join(outils) + "\n    </ol>\n  </section>")

    auj = datetime.date.today()
    date = f"{auj.day} {MOIS[auj.month - 1]} {auj.year}"
    page = f"""<!DOCTYPE html>
<!-- Page produite par _outils/charte/outils/index_niveau.py : ne pas la modifier à la main, relancer l'outil. -->
<html lang="fr" data-matiere="licence">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Licence informatique · accueil général</title>
<meta name="description" content="Licence informatique (Le Mans Université) : les trois années, L1, L2 et L3, et leurs matières, avec les pages de cours, TD, TP et quiz.">
<link rel="stylesheet" href="_outils/charte/assets/cours.css">
<script src="_outils/charte/assets/cours.js"></script>
</head>
<body>

<header class="barre">
  <nav class="fil" aria-label="Fil d'Ariane">
    <span class="pastille" aria-hidden="true"></span>
    <span aria-current="page">studies</span>
  </nav>
</header>

<div class="page">
<main class="cours sans-numeros sans-sommaire">

  <header class="entete">
    <p class="surtitre"><span class="badge matiere">L1 · L2 · L3</span> Licence informatique · Le Mans Université</p>
    <h1>Licence informatique</h1>
    <p class="chapeau">Les trois années de licence réunies : pour chacune, ses matières et ce qui en est déjà mis en forme (cours, TD interactifs, TP, quiz). La L3 est en cours ; la L1 et la L2 servent aux révisions. Les matières pas encore traitées sont en pointillés.</p>
    <dl class="meta">
      <div><dt>Années</dt><dd>{len([n for n in ORDRE_NIVEAUX if (RACINE / n).is_dir()])}</dd></div>
      <div><dt>Matières</dt><dd>{stats["matieres"]}</dd></div>
      <div><dt>Cours mis en forme</dt><dd>{stats["cours"]}</dd></div>
      <div><dt>TD et TP</dt><dd>{stats["td"]}</dd></div>
      <div><dt>Quiz</dt><dd>{stats["quiz"]}</dd></div>
      <div><dt>Mise à jour</dt><dd><time datetime="{auj.isoformat()}">{date}</time></dd></div>
    </dl>
  </header>

{chr(10).join(blocs)}

</main>
</div>

<footer class="pied">Licence informatique · <a href="_outils/todo/index.html">ce qu'il reste à faire</a></footer>

</body>
</html>
"""
    sortie = RACINE / "index.html"
    sortie.write_text(corriger(page), encoding="utf-8", newline="\n")
    print(f"index.html : {stats['matieres']} matières, {stats['cours']} cours, {stats['td']} TD et TP, {stats['quiz']} quiz")


def main(args):
    niveaux = args or ["L1", "L2", "L3"]
    for n in niveaux:
        if n not in NIVEAUX:
            print(f"Niveau inconnu : {n} (L1, L2 ou L3)")
            return 2
        generer(n)
    generer_racine()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
