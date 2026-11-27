#!/usr/bin/env python3
"""Vérifie une page de quiz (_outils/quiz).

Usage :
    python _outils/quiz/outils/verifier_quiz.py [--executer] CHEMIN [CHEMIN ...]

CHEMIN est un fichier .html ou un dossier, parcouru récursivement : seules
les pages qui contiennent un bloc <script id="quiz-donnees"> sont vérifiées.

La vérification comprend :
  - les contrôles communs de la charte (_outils/charte/outils/verifier.py) ;
  - le chargement de quiz.css et de quiz.js ;
  - le format des données JSON : types, champs obligatoires, indices des
    bonnes réponses, identifiants uniques, champs inconnus (fautes de frappe),
    jeux de données et tests des questions de code ;
  - le HTML des questions : classes connues, code non échappé, formules ;
  - les liens « revoir » et « cours » : fichier existant, ancre présente ;
  - l'autonomie des questions : l'étudiant navigue librement entre elles, et
    l'ordre peut être tiré au sort, donc aucune ne renvoie à une autre
    (« la question précédente », « la question suivante ») ;
  - les questions de type « atelier » (diagrammes, schémas, tables…), par le
    vérificateur de l'atelier (_outils/atelier/outils/verifier.js, qui demande Node) ;
    la page doit alors charger atelier.css et atelier.js.
Avec --executer, les solutions des questions de code sont exécutées (SQL
sur leur jeu de données, programmes sur leurs tests), ainsi que les extraits
exécutables des énoncés : il faut Node et, pour le SQL, PGlite (installé au
premier lancement du serveur local).
Code de sortie : 1 s'il y a au moins une erreur, 0 sinon.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import unicodedata
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

QUIZ = Path(__file__).resolve().parent.parent
OUTILS = QUIZ.parent
# Racine des données : le dossier qui contient _outils (dépôt), ou ULA_RACINE (application installée)
RACINE = Path(os.environ["ULA_RACINE"]).resolve() if os.environ.get("ULA_RACINE") else OUTILS.parent
sys.path.insert(0, str(OUTILS / "charte" / "outils"))
import verifier as charte  # noqa: E402  (vérificateur de la charte)

FEUILLES = [OUTILS / "charte" / "assets" / "cours.css", QUIZ / "assets" / "quiz.css"]

CHAMPS_COMMUNS = {"id", "type", "theme", "difficulte", "enonce", "consigne", "explication", "revoir", "indices"}
LANGAGES = {"sql", "python", "javascript", "c", "c-posix"}
CHAMPS = {
    "code": {"langage", "depart", "solution", "jeu", "ordre", "colonnes", "tests", "harnais", "entree", "sortie", "lignes"},
    "qcm": {"choix", "reponse", "melanger"},
    "qcm-multi": {"choix", "reponses", "melanger"},
    "vrai-faux": {"reponse"},
    "reponse-courte": {"reponses", "casse", "accents"},
    "numerique": {"reponse", "tolerance", "unite"},
    "trous": {"texte", "trous", "code", "casse", "accents"},
    "association": {"paires", "intrus", "melanger"},
    "ordre": {"elements"},
    "ouverte": {"reponse_modele", "criteres"},
    # Détail des champs et contrôles : _outils/atelier/outils/verifier.js (--quiz)
    "atelier": {"editeur", "mode", "titre", "depart", "solution", "options", "tests", "hauteur", "vue",
                "disposition", "attendu", "seuil"},
}
CHAMPS_RACINE = {"id", "titre", "description", "melanger", "questions", "cours", "jeux", "penalite_indice"}
SOLUTIONS = QUIZ / "serveur" / "outils" / "verifier-solutions.js"
# Renvois à une autre question du quiz : interdits, la navigation est libre et l'ordre peut être mélangé
RENVOI = re.compile(
    r"\b(?:questions?|q\.)\s+(?:pr[ée]c[ée]dentes?|suivantes?|d'avant|ci-dessus|ci-dessous)\b"
    r"|\b(?:previous|next|preceding|following)\s+questions?\b",
    re.IGNORECASE,
)
ATELIER = OUTILS / "atelier" / "outils" / "verifier.js"


# Ancres des pages de cours : même calcul que cours.js ------------------------

def slug(texte):
    t = unicodedata.normalize("NFD", texte)
    t = "".join(c for c in t if not 0x300 <= ord(c) <= 0x36F).lower()
    t = re.sub(r"\\\(|\\\)|\\\[|\\\]", " ", t)
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:60]
    return t or "section"


class Titres(HTMLParser):
    """Relève les id explicites et le texte des h2/h3 d'une page de cours."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.titres = []            # (id explicite ou None, texte)
        self.pile = []              # (tag, exclu, dans_entete)
        self.en_cours = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            self.ids.add(a["id"])
        classes = set((a.get("class") or "").split())
        exclu = bool(classes & {"ref", "badge", "ancre"}) or bool(self.pile and self.pile[-1][1])
        entete = "entete" in classes or bool(self.pile and self.pile[-1][2])
        if tag in charte.VIDES:
            return
        self.pile.append((tag, exclu, entete))
        if tag in ("h2", "h3") and not entete:
            self.en_cours = [a.get("id"), [], len(self.pile)]

    def handle_endtag(self, tag):
        if tag in charte.VIDES:
            return
        while self.pile:
            t = self.pile.pop()
            if self.en_cours and len(self.pile) < self.en_cours[2]:
                self.titres.append((self.en_cours[0], " ".join("".join(self.en_cours[1]).split())))
                self.en_cours = None
            if t[0] == tag:
                break

    def handle_data(self, data):
        if self.en_cours and not (self.pile and self.pile[-1][1]):
            self.en_cours[1].append(data)


_ancres = {}


def ancres(fichier):
    if fichier not in _ancres:
        p = Titres()
        p.feed(fichier.read_text(encoding="utf-8"))
        pris = set(p.ids)
        resultat = set(p.ids)
        for explicite, texte in p.titres:
            if explicite:
                continue
            base = slug(texte)
            ident, i = base, 2
            while ident in pris:
                ident = f"{base}-{i}"
                i += 1
            pris.add(ident)
            resultat.add(ident)
        _ancres[fichier] = resultat
    return _ancres[fichier]


# HTML des questions -------------------------------------------------------------

class Fragment(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.classes = set()
        self.pile = []
        self.problemes = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.classes |= set((a.get("class") or "").split())
        # Seuls les blocs <pre><code> doivent être échappés ; <u> ou <b> dans un <code> en ligne est permis
        if len(self.pile) >= 2 and self.pile[-1][0] == "code" and self.pile[-2][0] == "pre":
            pseudo = "language-pseudo" in self.pile[-1][1]
            if not (pseudo and tag in ("b", "i")):
                self.problemes.append(f"balise <{tag}> dans du code : échapper < > & (&lt; &gt; &amp;)")
        if tag not in charte.VIDES:
            self.pile.append((tag, set((a.get("class") or "").split())))

    def handle_endtag(self, tag):
        while self.pile:
            if self.pile.pop()[0] == tag:
                break


def verifier_fragment(texte, ou, connues, err, avert):
    if not isinstance(texte, str):
        return
    f = Fragment()
    f.feed(texte)
    for p in f.problemes:
        err(f"{ou} : {p}")
    for c in sorted(f.classes):
        if c not in connues and not c.startswith(charte.PREFIXES_LIBRES):
            err(f"{ou} : classe « {c} » absente de la charte et de quiz.css")
    for o, fe in (("\\(", "\\)"), ("\\[", "\\]")):
        if texte.count(o) != texte.count(fe):
            err(f"{ou} : délimiteurs {o} {fe} déséquilibrés")
    if "$" in texte and re.search(r"\$[^$]+\$", texte) and "<code" not in texte:
        avert(f"{ou} : « $…$ » n'est pas rendu ; écrire les formules entre \\( et \\)")


# Données du quiz -------------------------------------------------------------------

def est_texte(x):
    return isinstance(x, str) and x.strip() != ""


def liste_textes(x, minimum):
    return isinstance(x, list) and len(x) >= minimum and all(est_texte(e) for e in x)


def verifier_donnees(d, page, connues, err, avert):
    if not isinstance(d, dict):
        err("les données doivent être un objet JSON")
        return
    for k in d:
        if k not in CHAMPS_RACINE:
            avert(f"champ inconnu à la racine : « {k} »")
    if not (isinstance(d.get("id"), str) and re.fullmatch(r"[a-z0-9][a-z0-9-]*", d["id"])):
        err("« id » manquant ou invalide (minuscules, chiffres et tirets) : il sert de clé de mémorisation")
    if "penalite_indice" in d and not (isinstance(d["penalite_indice"], (int, float)) and 0 <= d["penalite_indice"] <= 1):
        err("« penalite_indice » doit être un nombre entre 0 et 1 (part des points retirée par indice)")
    cours = d.get("cours", [])
    if not isinstance(cours, list):
        err("« cours » doit être une liste de {\"titre\": …, \"lien\": …}")
        cours = []
    for i, c in enumerate(cours):
        if not (isinstance(c, dict) and est_texte(c.get("titre")) and est_texte(c.get("lien"))):
            err(f"cours[{i}] : il faut « titre » et « lien »")
        else:
            verifier_lien(c["lien"], page, f"cours[{i}]", err, avert)
    jeux = d.get("jeux", {})
    if not isinstance(jeux, dict):
        err("« jeux » doit être un objet { nom: { script, titre, description } }")
        jeux = {}
    for nom, j in jeux.items():
        if not (isinstance(j, dict) and est_texte(j.get("script"))):
            err(f"jeu « {nom} » : « script » (SQL de création des tables) manquant")
        elif "description" in j:
            verifier_fragment(j["description"], f"jeu « {nom} », description", connues, err, avert)
    qs = d.get("questions")
    if not isinstance(qs, list) or not qs:
        err("« questions » doit être une liste non vide")
        return
    vus = set()
    for n, q in enumerate(qs, 1):
        if not isinstance(q, dict):
            err(f"question {n} : doit être un objet")
            continue
        ou = f"question {n} ({q.get('id', 'sans id')})"
        t = q.get("type")
        if t not in CHAMPS:
            err(f"{ou} : type inconnu « {t} » ; types possibles : {', '.join(CHAMPS)}")
            continue
        if not est_texte(q.get("id")):
            err(f"{ou} : « id » manquant")
        elif q["id"] in vus:
            err(f"{ou} : id « {q['id']} » déjà utilisé")
        vus.add(q.get("id"))
        for k in q:
            if k not in CHAMPS_COMMUNS | CHAMPS[t]:
                avert(f"{ou} : champ « {k} » inconnu pour le type {t}")
        if t != "trous" and not est_texte(q.get("enonce")):
            err(f"{ou} : « enonce » manquant")
        if "difficulte" in q and q["difficulte"] not in (1, 2, 3):
            err(f"{ou} : « difficulte » vaut 1, 2 ou 3")
        if "theme" in q and not est_texte(q["theme"]):
            err(f"{ou} : « theme » doit être un texte")
        if t != "ouverte" and not est_texte(q.get("explication")):
            avert(f"{ou} : pas d'« explication » (elle s'affiche après la réponse)")

        # Champs propres à chaque type
        if t in ("qcm", "qcm-multi"):
            ch = q.get("choix")
            if not liste_textes(ch, 2):
                err(f"{ou} : « choix » doit contenir au moins 2 textes")
                ch = []
            elif len(set(ch)) != len(ch):
                err(f"{ou} : deux choix identiques")
            if t == "qcm":
                r = q.get("reponse")
                if not (isinstance(r, int) and not isinstance(r, bool) and 0 <= r < len(ch)):
                    err(f"{ou} : « reponse » doit être l'indice (à partir de 0) d'un choix")
            else:
                r = q.get("reponses")
                if not (isinstance(r, list) and r and all(isinstance(i, int) and 0 <= i < len(ch) for i in r)
                        and len(set(r)) == len(r)):
                    err(f"{ou} : « reponses » doit lister les indices distincts des bons choix")
                elif len(r) == len(ch):
                    avert(f"{ou} : tous les choix sont bons")
        elif t == "vrai-faux":
            if not isinstance(q.get("reponse"), bool):
                err(f"{ou} : « reponse » doit valoir true ou false")
        elif t == "reponse-courte":
            if not liste_textes(q.get("reponses"), 1):
                err(f"{ou} : « reponses » doit lister au moins une réponse acceptée")
        elif t == "numerique":
            r = q.get("reponse")
            if not (isinstance(r, (int, float)) and not isinstance(r, bool)):
                err(f"{ou} : « reponse » doit être un nombre")
            tol = q.get("tolerance", 0)
            if not (isinstance(tol, (int, float)) and tol >= 0):
                err(f"{ou} : « tolerance » doit être un nombre positif")
        elif t == "trous":
            texte, trous = q.get("texte"), q.get("trous")
            if not est_texte(texte):
                err(f"{ou} : « texte » manquant")
                texte = ""
            if not isinstance(trous, list) or not trous:
                err(f"{ou} : « trous » doit être une liste non vide")
                trous = []
            places = sorted({int(k) for k in re.findall(r"\{\{(\d+)\}\}", texte)})
            if places != list(range(len(trous))):
                err(f"{ou} : les trous du texte ({places}) ne correspondent pas aux {len(trous)} entrées de « trous »")
            for k, tr in enumerate(trous):
                if not isinstance(tr, dict):
                    err(f"{ou}, trou {k} : doit être un objet")
                elif "choix" in tr:
                    if not liste_textes(tr["choix"], 2):
                        err(f"{ou}, trou {k} : « choix » doit contenir au moins 2 textes")
                    elif not (isinstance(tr.get("reponse"), int) and 0 <= tr["reponse"] < len(tr["choix"])):
                        err(f"{ou}, trou {k} : « reponse » doit être l'indice d'un choix")
                elif not liste_textes(tr.get("reponses"), 1):
                    err(f"{ou}, trou {k} : il faut « reponses » (saisie libre) ou « choix » + « reponse » (liste)")
        elif t == "association":
            paires = q.get("paires")
            if not (isinstance(paires, list) and len(paires) >= 2
                    and all(isinstance(p, list) and len(p) == 2 and all(est_texte(x) for x in p) for p in paires)):
                err(f"{ou} : « paires » doit être une liste d'au moins 2 couples [gauche, droite]")
            else:
                droites = [p[1] for p in paires] + list(q.get("intrus", []))
                if len(set(droites)) != len(droites):
                    err(f"{ou} : deux éléments de droite identiques (paires ou intrus)")
                if any("\\(" in x for x in droites):
                    avert(f"{ou} : les formules ne sont pas rendues dans les listes déroulantes")
            if "intrus" in q and not liste_textes(q["intrus"], 1):
                err(f"{ou} : « intrus » doit être une liste de textes")
        elif t == "ordre":
            el = q.get("elements")
            if not liste_textes(el, 3):
                err(f"{ou} : « elements » doit contenir au moins 3 textes, dans le bon ordre")
            elif len(set(el)) != len(el):
                err(f"{ou} : deux éléments identiques")
        elif t == "ouverte":
            if not est_texte(q.get("reponse_modele")):
                err(f"{ou} : « reponse_modele » manquante")
            if "criteres" in q and not liste_textes(q["criteres"], 1):
                err(f"{ou} : « criteres » doit être une liste de textes")
        elif t == "code":
            lang = q.get("langage")
            if lang not in LANGAGES:
                err(f"{ou} : « langage » doit valoir {', '.join(sorted(LANGAGES))}")
            if not est_texte(q.get("solution")):
                avert(f"{ou} : pas de « solution » : la question ne pourra pas être corrigée automatiquement")
            if lang == "sql":
                if q.get("jeu") and q["jeu"] not in jeux:
                    err(f"{ou} : jeu de données « {q['jeu']} » absent de « jeux »")
                if not q.get("jeu"):
                    avert(f"{ou} : pas de « jeu » : la requête s'exécutera sur une base vide")
                if "tests" in q or "harnais" in q:
                    avert(f"{ou} : « tests » et « harnais » ne servent pas en SQL (la réponse est comparée à la solution)")
            elif lang in LANGAGES:
                tests = q.get("tests")
                if tests is not None:
                    if not (isinstance(tests, list) and tests and all(isinstance(x, dict) and isinstance(x.get("sortie"), str) for x in tests)):
                        err(f"{ou} : « tests » doit être une liste de {{\"entree\": …, \"sortie\": …}} (sortie obligatoire)")
                elif not isinstance(q.get("sortie"), str):
                    avert(f"{ou} : ni « tests » ni « sortie » : la réponse ne pourra pas être vérifiée automatiquement")
                if "ordre" in q or "colonnes" in q:
                    avert(f"{ou} : « ordre » et « colonnes » ne servent qu'en SQL")
            for k in ("depart", "solution", "harnais"):
                if k in q and not isinstance(q[k], str):
                    err(f"{ou} : « {k} » doit être un texte")

        # Indices
        ind = q.get("indices")
        if ind is not None and not liste_textes(ind, 1):
            err(f"{ou} : « indices » doit être une liste de textes (HTML)")
        for i, x in enumerate(ind or []):
            verifier_fragment(x, f"{ou}, indices[{i}]", connues, err, avert)

        # HTML des champs textuels
        for k in ("enonce", "explication", "reponse_modele", "texte", "consigne"):
            verifier_fragment(q.get(k), f"{ou}, {k}", connues, err, avert)
        for k in ("choix", "criteres", "elements", "intrus"):
            for i, x in enumerate(q.get(k) or []):
                verifier_fragment(x, f"{ou}, {k}[{i}]", connues, err, avert)
        for i, p in enumerate(q.get("paires") or []):
            for x in (p if isinstance(p, list) else []):
                verifier_fragment(x, f"{ou}, paires[{i}]", connues, err, avert)

        # Autonomie : pas de renvoi à une autre question
        for k in ("enonce", "texte", "consigne", "explication"):
            v = q.get(k)
            if isinstance(v, str):
                m = RENVOI.search(re.sub(r"<[^>]+>", " ", v))
                if m:
                    err(f"{ou}, {k} : renvoi à une autre question (« {m.group(0)} ») ; "
                        "chaque question doit se comprendre seule, les données redonnées en entier")
        for i, x in enumerate(q.get("indices") or []):
            if isinstance(x, str) and RENVOI.search(re.sub(r"<[^>]+>", " ", x)):
                err(f"{ou}, indices[{i}] : renvoi à une autre question ; chaque question doit se comprendre seule")

        # Lien vers le cours
        rv = q.get("revoir")
        if rv is not None:
            if not (isinstance(rv, dict) and est_texte(rv.get("texte")) and est_texte(rv.get("lien"))):
                err(f"{ou} : « revoir » doit être {{\"texte\": …, \"lien\": …}}")
            else:
                verifier_lien(rv["lien"], page, ou, err, avert)


def verifier_lien(lien, page, ou, err, avert):
    morceaux = urlsplit(lien)
    if morceaux.scheme or morceaux.netloc:
        return
    chemin = unquote(morceaux.path)
    if chemin.startswith("/_outils/"):
        cible = (OUTILS / chemin[len("/_outils/"):]).resolve()
    elif chemin.startswith("/"):
        cible = (RACINE / chemin.lstrip("/")).resolve()
    else:
        cible = (page.parent / chemin).resolve() if chemin else page.resolve()
    if not cible.exists():
        err(f"{ou} : lien « revoir » vers un fichier introuvable : {lien}")
        return
    if morceaux.fragment and cible.suffix == ".html":
        if unquote(morceaux.fragment) not in ancres(cible):
            proches = sorted(a for a in ancres(cible) if morceaux.fragment[:6] in a)[:3]
            err(f"{ou} : ancre « #{morceaux.fragment} » absente de {cible.name}"
                + (f" (voisines : {', '.join(proches)})" if proches else ""))


# Programme principal ---------------------------------------------------------------

def verifier_ateliers(donnees, executer, err, avert):
    """Questions « atelier » : vérifiées par le script Node de l'atelier (et exécutées avec --executer)."""
    node = shutil.which("node")
    if not node:
        avert("questions « atelier » non vérifiées : Node est introuvable")
        return
    try:
        r = subprocess.run([node, str(ATELIER), "--quiz"] + (["--executer"] if executer else []),
                           input=json.dumps(donnees), capture_output=True, text=True, encoding="utf-8", timeout=600)
    except subprocess.TimeoutExpired:
        err("questions « atelier » : la vérification dépasse 10 minutes")
        return
    if r.returncode != 0:
        err("questions « atelier » : échec du vérificateur de l'atelier : " + r.stderr.strip()[-500:])
        return
    for x in json.loads(r.stdout or "[]"):
        m = f"question {x['id']} : {x['message']}"
        if x["ok"] is False:
            err(m)
        elif x["ok"] is None:
            avert(m)
        else:
            print(f"  ✓ {m}")


def executer_solutions(donnees, err, avert):
    """Exécute les solutions des questions de code (script Node du serveur local)."""
    node = shutil.which("node")
    if not node:
        avert("--executer : Node est introuvable, solutions non exécutées")
        return
    try:
        r = subprocess.run([node, str(SOLUTIONS)], input=json.dumps(donnees), capture_output=True,
                           text=True, encoding="utf-8", timeout=600)
    except subprocess.TimeoutExpired:
        err("--executer : l'exécution des solutions dépasse 10 minutes")
        return
    if r.returncode != 0:
        err("--executer : échec du script de vérification : " + r.stderr.strip()[-500:])
        return
    for x in json.loads(r.stdout or "[]"):
        m = f"{x['id']} : {x['message']}"
        if x["ok"] is False:
            err(m)
        elif x["ok"] is None:
            avert(m)
        else:
            print(f"  ✓ {m}")


def verifier_page(chemin, classes_charte, matieres, executer=False):
    erreurs, avertis = [], []
    resultat = charte.verifier(chemin, classes_charte, matieres, True)
    if resultat:
        erreurs += [f"l.{l} {m}" for l, m in resultat[0]]
        avertis += [f"l.{l} {m}" for l, m in resultat[1]]
    source = chemin.read_text(encoding="utf-8")
    if not re.search(r'<link[^>]+href="[^"]*_outils/quiz/assets/quiz\.css"|<link[^>]+href="assets/quiz\.css"', source):
        erreurs.append("quiz.css n'est pas chargé")
    if not re.search(r'<script[^>]+defer[^>]+src="[^"]*quiz\.js"|<script[^>]+src="[^"]*quiz\.js"[^>]*defer', source):
        erreurs.append("quiz.js doit être chargé avec defer")
    m = re.search(r'<script[^>]*id="quiz-donnees"[^>]*>(.*?)</script>', source, re.S)
    if not m:
        erreurs.append("bloc <script type=\"application/json\" id=\"quiz-donnees\"> introuvable")
        return erreurs, avertis
    try:
        donnees = json.loads(m.group(1))
    except json.JSONDecodeError as e:
        ligne = source[:m.start(1)].count("\n") + e.lineno
        erreurs.append(f"JSON invalide ligne {ligne}, colonne {e.colno} : {e.msg}")
        return erreurs, avertis
    connues = set(charte.CLASSES_SEMANTIQUES)
    for f in FEUILLES:
        connues |= charte.classes_css(f)
    verifier_donnees(donnees, chemin, connues, erreurs.append, avertis.append)
    if isinstance(donnees, dict) and isinstance(donnees.get("questions"), list):
        types = {q.get("type") for q in donnees["questions"] if isinstance(q, dict)}
        themes = {q.get("theme") for q in donnees["questions"] if isinstance(q, dict)}
        print(f"  {len(donnees['questions'])} questions · {len(types)} type(s) · "
              f"{len([t for t in themes if t])} thème(s)")
        if "atelier" in types:
            if not re.search(r'<link[^>]+href="[^"]*_outils/atelier/assets/atelier\.css"', source):
                erreurs.append("questions « atelier » : atelier.css n'est pas chargé")
            if not re.search(r'<script[^>]+src="[^"]*_outils/atelier/assets/atelier\.js"[^>]*defer|<script[^>]+defer[^>]+src="[^"]*_outils/atelier/assets/atelier\.js"', source):
                erreurs.append("questions « atelier » : atelier.js doit être chargé avec defer")
            verifier_ateliers(donnees, executer, erreurs.append, avertis.append)
        if executer:
            executer_solutions(donnees, erreurs.append, avertis.append)
    return erreurs, avertis


def pages(chemins):
    for brut in chemins:
        p = Path(brut)
        if p.is_dir():
            for f in sorted(p.rglob("*.html")):
                texte = f.read_text(encoding="utf-8", errors="ignore")
                if "quiz-donnees" in texte and "MODÈLE —" not in texte:   # le modèle est ignoré
                    yield f
        elif p.suffix.lower() == ".html" and p.exists():
            yield p
        else:
            print(f"introuvable ou pas un .html : {brut}")


def main(argv):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    executer = "--executer" in argv
    argv = [a for a in argv if a != "--executer"]
    if not argv:
        print(__doc__.strip())
        return 2
    classes_charte, matieres = charte.lire_charte()
    total_e = total_a = nb = 0
    for chemin in pages(argv):
        nb += 1
        print(f"{chemin}")
        erreurs, avertis = verifier_page(chemin, classes_charte, matieres, executer)
        total_e += len(erreurs)
        total_a += len(avertis)
        for m in erreurs:
            print(f"  ✗ {m}")
        for m in avertis:
            print(f"  ! {m}")
        if not erreurs and not avertis:
            print("  OK")
    print(f"\n{nb} quiz vérifié(s) : {total_e} erreur(s), {total_a} avertissement(s).")
    return 1 if total_e else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
