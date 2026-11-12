#!/usr/bin/env python3
"""Produit les accueils de domaine et l'accueil général du catalogue (_outils/charte).

Usage :
    python _outils/charte/outils/index_niveau.py                    (tous les domaines)
    python _outils/charte/outils/index_niveau.py informatique [...]

Pour chaque cours du domaine (explore/<domaine>/<cours>/, décrit par ula-cours.json),
la page reprend les listes de l'accueil du cours (generated_courses/index.html) :
cours, TD, TP, quiz, annales, avec les chapitres à venir. Un cours sans accueil
est listé avec les sources présentes dans son dossier. Le résultat est écrit dans
explore/<domaine>/index.html ; relancer l'outil après chaque nouvelle page.

L'accueil général (index.html à la racine) est refait à chaque lancement : les
domaines, et pour chaque cours un résumé de ce qui est mis en forme. Il sert aux
pages ouvertes depuis le disque : le serveur local le remplace par l'accueil
dynamique (_outils/ula/accueil.html : profils, cursus, catalogue en ligne).
"""

import datetime
import html
import json
import os
import posixpath
import re
import sys
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parent))
from typographie import corriger  # noqa: E402

RACINE = Path(__file__).resolve().parents[3]
EXPLORE = RACINE / "explore"
MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]

# Domaines du catalogue : nom affiché, chapeau. L'ordre est celui de l'accueil général.
DOMAINES = {
    "informatique": ("Informatique", "Programmation (C, shell, objet, système), bases de données, réseaux, sécurité, codage, génie logiciel."),
    "mathematiques": ("Mathématiques", "Analyse et algèbre, probabilités et statistiques, théorie des graphes, mathématiques pour l'IA."),
    "langues": ("Langues", "Anglais : compréhension orale, vocabulaire, préparation de l'oral."),
    "communication": ("Communication et projet", "Communication écrite et orale, projet personnel et professionnel, conduite de projet."),
}
ORDRE_NIVEAUX = ["Licence 3", "Licence 2", "Licence 1"]


def cours_du_domaine(domaine):
    """Cours du domaine : [(dossier, fiche)] triés par niveau (le plus récent d'abord), puis titre."""
    res = []
    d = EXPLORE / domaine
    if not d.is_dir():
        return res
    for c in d.iterdir():
        f = c / "ula-cours.json"
        if c.is_dir() and f.is_file():
            res.append((c, json.loads(f.read_text(encoding="utf-8"))))
    def cle(x):
        niveau = x[1].get("niveau", "")
        rang = next((i for i, n in enumerate(ORDRE_NIVEAUX) if niveau.startswith(n)), len(ORDRE_NIVEAUX))
        return (rang, x[1].get("titre", ""))
    return sorted(res, key=cle)


def domaines():
    connus = [d for d in DOMAINES if (EXPLORE / d).is_dir()]
    autres = sorted(p.name for p in EXPLORE.iterdir() if p.is_dir() and p.name not in DOMAINES and p.name not in ("packs", "cursus") and not p.name.startswith(".")) if EXPLORE.is_dir() else []
    return connus + autres


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


def niveau_court(fiche):
    n = fiche.get("niveau", "")
    m = re.match(r"Licence (\d)", n)
    return f"L{m.group(1)}" if m else n


def stats_sections(sections, stats):
    for titre, items in sections:
        n = sum(1 for it in items if it["href"] and not it["a_venir"])
        cle = titre.lower()
        if cle.startswith("cours"):
            stats["cours"] += n
        elif cle.startswith(("td", "tp")):
            stats["td"] += n
        elif cle.startswith("quiz"):
            stats["quiz"] += n


def date_du_jour():
    auj = datetime.date.today()
    return auj, f"{auj.day} {MOIS[auj.month - 1]} {auj.year}"


def generer(domaine):
    """Accueil d'un domaine : explore/<domaine>/index.html."""
    nom_domaine, chapeau_domaine = DOMAINES.get(domaine, (domaine.capitalize(), ""))
    blocs, stats = [], {"matieres": 0, "cours": 0, "td": 0, "quiz": 0}
    for chemin, fiche in cours_du_domaine(domaine):
        stats["matieres"] += 1
        accueil = chemin / "generated_courses" / "index.html"
        teinte = fiche.get("teinte", "")
        attr = f' data-matiere="{teinte}"' if teinte else ""
        infos = " · ".join(x for x in (fiche.get("niveau", ""), fiche.get("origine", ""), f"UE {fiche['ue']}" if fiche.get("ue") else "") if x)
        lignes = [f"  <section{attr}>", f"    <h2>{html.escape(fiche.get('titre', chemin.name))}</h2>"]
        if accueil.is_file():
            _, chapeau, sections = lire_accueil(accueil, f"{chemin.name}/generated_courses")
            lien = url(chemin.name, "generated_courses", "index.html")
            intro = (chapeau + " ") if chapeau else ""
            lignes.append(f'    <p>{intro}<a href="{lien}">Accueil du cours</a> · {html.escape(infos)}.</p>')
            for titre, items in sections:
                lignes.append(f"    <p><strong>{titre}</strong></p>")
                lignes.append('    <ol class="chapitres">')
                lignes.extend(item_html(it) for it in items)
                lignes.append("    </ol>")
            stats_sections(sections, stats)
        else:
            sources = compter_sources(chemin)
            detail = (" Sources dans <code>" + html.escape(f"explore/{domaine}/{chemin.name}/") + "</code> : " + ", ".join(sources) + ".") if sources else " Le dossier est vide pour l'instant."
            lignes.append(f"    <p>Pas encore mis en forme · {html.escape(infos)}.{detail}</p>")
        lignes.append("  </section>")
        blocs.append("\n".join(lignes))

    autres = []
    for d in domaines():
        if d != domaine:
            nd, ch = DOMAINES.get(d, (d.capitalize(), ""))
            autres.append(f'      <li>\n        <a class="chapitre" href="../{d}/index.html">\n          <span class="chapitre-num"></span>\n'
                          f'          <span><span class="chapitre-titre">{nd}</span><span class="chapitre-resume">{ch}</span></span>\n'
                          f'          <span class="badge">Domaine</span>\n        </a>\n      </li>')
    if autres:
        blocs.append("  <section>\n    <h2>Autres domaines</h2>\n    <ol class=\"chapitres\">\n" + "\n".join(autres) + "\n    </ol>\n"
                     "    <p>Avec le serveur local (<code>lancer.bat</code>) ou l'application, l'accueil montre aussi ton profil, ton cursus et le catalogue en ligne.</p>\n  </section>")

    auj, date = date_du_jour()
    entete = "\n".join([
        "<!DOCTYPE html>",
        "<!-- Page produite par _outils/charte/outils/index_niveau.py : ne pas la modifier à la main, relancer l'outil. -->",
        '<html lang="fr" data-matiere="licence">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        f"<title>{nom_domaine} · Universal Learn Academy</title>",
        f'<meta name="description" content="{nom_domaine} : les cours du catalogue d\'Universal Learn Academy et leurs pages de cours, TD, TP et quiz.">',
        '<link rel="stylesheet" href="../../_outils/charte/assets/cours.css">',
        '<script src="../../_outils/charte/assets/cours.js"></script>',
        "</head>",
        "<body>",
        "",
        '<header class="barre">',
        '  <nav class="fil" aria-label="Fil d\'Ariane">',
        '    <span class="pastille" aria-hidden="true"></span>',
        '    <a href="../../index.html">ULA</a>',
        f'    <span aria-current="page">{nom_domaine}</span>',
        "  </nav>",
        "</header>",
        "",
        '<div class="page">',
        '<main class="cours sans-numeros">',
        "",
        '  <header class="entete">',
        f'    <p class="surtitre"><span class="badge matiere">{nom_domaine}</span> Catalogue · Universal Learn Academy</p>',
        f"    <h1>{nom_domaine}</h1>",
        f'    <p class="chapeau">{chapeau_domaine} Pour chaque cours, les pages mises en forme, les TD interactifs, les TP et les quiz ; les chapitres pas encore traités restent listés, en pointillés.</p>',
        '    <dl class="meta">',
        f'      <div><dt>Cours</dt><dd>{stats["matieres"]}</dd></div>',
        f'      <div><dt>Chapitres mis en forme</dt><dd>{stats["cours"]}</dd></div>',
        f'      <div><dt>TD et TP</dt><dd>{stats["td"]}</dd></div>',
        f'      <div><dt>Quiz</dt><dd>{stats["quiz"]}</dd></div>',
        f'      <div><dt>Mise à jour</dt><dd><time datetime="{auj.isoformat()}">{date}</time></dd></div>',
        "    </dl>",
        "  </header>",
        "",
    ])
    pied = "\n".join([
        "",
        "</main>",
        "</div>",
        "",
        f'<footer class="pied">{nom_domaine} · <a href="../../index.html">Universal Learn Academy</a></footer>',
        "",
        "</body>",
        "</html>",
        "",
    ])
    page = entete + "\n" + "\n".join(blocs) + "\n" + pied
    sortie = EXPLORE / domaine / "index.html"
    sortie.write_text(corriger(page), encoding="utf-8", newline="\n")
    print(f"{sortie.relative_to(RACINE).as_posix()} : {stats['matieres']} cours, {stats['cours']} chapitres, {stats['td']} TD et TP, {stats['quiz']} quiz")


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



# Accueil général : domaines, puis outils
OUTILS = [
    ("_outils/quiz/portail.html", "Mes révisions",
     "Avec le serveur local (<code>lancer.bat</code>) ou l'application : quiz à reprendre, résultats et TD interactifs des cours de ton cursus."),
    ("_outils/todo/index.html", "Mon suivi",
     "Le <code>TODO.md</code> de ton profil, cours par cours : cocher, ajouter, modifier, glisser d'une liste à l'autre."),
    ("_outils/environnements/c.html", "Compiler un TP en C",
     "Sous Windows (MinGW, Git for Windows, WSL) et sous Linux : ce qui est installé sur le PC, ce qui manque, les commandes et les erreurs fréquentes."),
    ("_outils/environnements/python.html", "Les notebooks Python",
     "Un environnement Jupyter commun (numpy, pandas, scikit-learn…), installé par <code>lancer-jupyter.bat</code> ou <code>lancer-jupyter.sh</code> : ouvrir un notebook, ajouter une bibliothèque."),
    ("_outils/charte/composants.html", "Charte des cours",
     "Catalogue des composants des pages : blocs, code, formules, tableaux, schémas."),
    ("_outils/quiz/demo.html", "Quiz de démonstration",
     "Les onze types de questions de l'outil de quiz."),
    ("_outils/atelier/demo.html", "Atelier de démonstration",
     "Les éditeurs des TD interactifs : diagrammes, tables, SQL, automates, chronogrammes."),
]


def generer_racine():
    blocs, stats = [], {"matieres": 0, "cours": 0, "td": 0, "quiz": 0}
    liste_domaines = domaines()
    for domaine in liste_domaines:
        nom_domaine, chapeau = DOMAINES.get(domaine, (domaine.capitalize(), ""))
        lignes = ["  <section>", f"    <h2>{nom_domaine}</h2>",
                  f'    <p>{chapeau} <a href="explore/{domaine}/index.html">Accueil du domaine</a> : tous les chapitres, TD, TP et quiz.</p>',
                  '    <ol class="chapitres">']
        for chemin, fiche in cours_du_domaine(domaine):
            stats["matieres"] += 1
            teinte = fiche.get("teinte", "")
            attr = f' data-matiere="{teinte}"' if teinte else ""
            accueil = chemin / "generated_courses" / "index.html"
            titre = f'<span class="chapitre-titre">{html.escape(fiche.get("titre", chemin.name))}</span>'
            num = html.escape(niveau_court(fiche))
            if accueil.is_file():
                _, _, sections = lire_accueil(accueil, f"{chemin.name}/generated_courses")
                stats_sections(sections, stats)
                lien = html.escape(url("explore", domaine, chemin.name, "generated_courses", "index.html"), quote=True)
                lignes.append(f'      <li{attr}>\n        <a class="chapitre" href="{lien}">\n          <span class="chapitre-num">{num}</span>\n'
                              f'          <span>{titre}<span class="chapitre-resume">{resume_matiere(sections)}</span></span>\n        </a>\n      </li>')
            else:
                sources = compter_sources(chemin)
                resume = ("Pas encore mis en forme · sources : " + ", ".join(sources)) if sources else "Pas encore mis en forme"
                lignes.append(f'      <li class="a-venir"{attr}>\n        <span class="chapitre">\n          <span class="chapitre-num">{num}</span>\n'
                              f'          <span>{titre}<span class="chapitre-resume">{resume}</span></span>\n          <span class="badge">À venir</span>\n        </span>\n      </li>')
        lignes += ["    </ol>", "  </section>"]
        blocs.append("\n".join(lignes))
    outils = [f'      <li>\n        <a class="chapitre" href="{html.escape(url(lien), quote=True)}">\n          <span class="chapitre-num"></span>\n'
              f'          <span><span class="chapitre-titre">{titre}</span><span class="chapitre-resume">{resume}</span></span>\n        </a>\n      </li>'
              for lien, titre, resume in OUTILS if (RACINE / lien).is_file()]
    blocs = ['  <div class="annees">\n' + "\n".join(blocs) + "\n  </div>"]
    blocs.append("  <section>\n    <h2>Outils</h2>\n    <ol class=\"chapitres\">\n" + "\n".join(outils) + "\n    </ol>\n  </section>")

    auj, date = date_du_jour()
    entete = "\n".join([
        "<!DOCTYPE html>",
        "<!-- Page produite par _outils/charte/outils/index_niveau.py : ne pas la modifier à la main, relancer l'outil.",
        "     Servie par le serveur local, /index.html est remplacée par l'accueil dynamique (_outils/ula/accueil.html). -->",
        '<html lang="fr" data-matiere="licence">',
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        "<title>Universal Learn Academy · accueil</title>",
        '<meta name="description" content="Universal Learn Academy : le catalogue des cours (informatique, mathématiques, langues), avec les pages de cours, TD, TP et quiz.">',
        '<link rel="stylesheet" href="_outils/charte/assets/cours.css">',
        '<script src="_outils/charte/assets/cours.js"></script>',
        "</head>",
        "<body>",
        "",
        '<header class="barre">',
        '  <nav class="fil" aria-label="Fil d\'Ariane">',
        '    <span class="pastille" aria-hidden="true"></span>',
        '    <span aria-current="page">ULA</span>',
        "  </nav>",
        "</header>",
        "",
        '<div class="page">',
        '<main class="cours sans-numeros sans-sommaire">',
        "",
        '  <header class="entete">',
        '    <p class="surtitre"><span class="badge matiere">ULA</span> Universal Learn Academy · catalogue</p>',
        "    <h1>Universal Learn Academy</h1>",
        '    <p class="chapeau">Les cours du catalogue, par domaine, avec ce qui en est déjà mis en forme (cours, TD interactifs, TP, quiz). Avec le serveur local (<code>lancer.bat</code>) ou l\'application, l\'accueil montre aussi ton profil et ton cursus, où ta progression s\'enregistre. Les cours pas encore traités sont en pointillés.</p>',
        '    <dl class="meta">',
        f"      <div><dt>Domaines</dt><dd>{len(liste_domaines)}</dd></div>",
        f'      <div><dt>Cours</dt><dd>{stats["matieres"]}</dd></div>',
        f'      <div><dt>Chapitres mis en forme</dt><dd>{stats["cours"]}</dd></div>',
        f'      <div><dt>TD et TP</dt><dd>{stats["td"]}</dd></div>',
        f'      <div><dt>Quiz</dt><dd>{stats["quiz"]}</dd></div>',
        f'      <div><dt>Mise à jour</dt><dd><time datetime="{auj.isoformat()}">{date}</time></dd></div>',
        "    </dl>",
        "  </header>",
        "",
    ])
    pied = "\n".join([
        "",
        "</main>",
        "</div>",
        "",
        '<footer class="pied">Universal Learn Academy · <a href="_outils/todo/index.html">mon suivi</a></footer>',
        "",
        "</body>",
        "</html>",
        "",
    ])
    page = entete + "\n" + "\n".join(blocs) + "\n" + pied
    sortie = RACINE / "index.html"
    sortie.write_text(corriger(page), encoding="utf-8", newline="\n")
    print(f"index.html : {len(liste_domaines)} domaines, {stats['matieres']} cours, {stats['cours']} chapitres, {stats['td']} TD et TP, {stats['quiz']} quiz")


def main(args):
    liste = args or domaines()
    for d in liste:
        if not (EXPLORE / d).is_dir():
            print(f"Domaine inconnu : {d} ({', '.join(domaines())})")
            return 2
        generer(d)
    generer_racine()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
