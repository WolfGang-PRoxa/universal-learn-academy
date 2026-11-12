/* ==========================================================================
   Atelier · éditeur « classes » : diagramme de classes UML (logique)
   --------------------------------------------------------------------------
   Syntaxe :
     classe Vendeur
       id : int {PK}
       nom : varchar [1]
     classe abstraite Personne          (aussi : interface, enumeration)
       + age() : int                    (méthode : des parenthèses)
     Vendeur "1" -- "*" Article : vend >
     Vendeur "0..1 parrain" -- "* filleul" Vendeur : parraine
     Acteur "2..*" -- "*" Film : joue [Distribution]   (classe d'association)
     Voiture "1" *-- "4" Roue           composition (losange côté Voiture)
     Equipe o-- Joueur                  agrégation
     Etudiant --|> Personne             héritage (Etudiant hérite de Personne)
     Compte ..|> Comparable             réalisation d'une interface
     Client ..> Banque                  dépendance
     A --> B                            association navigable vers B
     objet c1 : Carre                   objet : ses valeurs en retrait (pleine = true)
     c1 o-- r1                          lien entre objets, sans multiplicités
   Les membres d'une classe sont indentés sous son en-tête. Une extrémité
   d'association s'écrit entre guillemets : multiplicité, puis rôle.
   Options : bdd (contrôles propres au passage au relationnel), methodes
   (le formulaire d'une classe propose aussi ses méthodes), objets (diagramme
   d'objets : le dessin crée des objets).
   ========================================================================== */
(function (A) {
  "use strict";

  var N = A.noyau, S = A.syntaxe, msg = N.message, ecart = N.ecart;
  var NOM = "[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_·']*";
  var OPS = ["<|--", "--|>", "<|..", "..|>", "*--", "--*", "o--", "--o", "<--", "-->", "<..", "..>", "--"];
  var RE_OP = OPS.map(function (o) { return o.replace(/[|*.]/g, "\\$&"); }).join("|");
  var RE_LIEN = new RegExp("^(" + NOM + ")\\s*(?:\"([^\"]*)\")?\\s*(" + RE_OP + ")\\s*(?:\"([^\"]*)\")?\\s*(" + NOM + ")\\s*(.*)$");
  var RE_ENTETE = new RegExp("^(classe\\s+abstraite|abstraite|classe|interface|enumeration|énumération|enum)\\s+(" + NOM +
    ")\\s*(\\{abstraite\\})?\\s*(?:<<\\s*([^>]+?)\\s*>>|«\\s*([^»]+?)\\s*»)?\\s*$", "i");
  var RE_OBJET = new RegExp("^objet\\s+(" + NOM + ")\\s*:\\s*(" + NOM + ")\\s*$", "i");
  var OPERATEUR_RUBY = /^(<=>|===?|=~|!=|\[\]=?|\*\*|<<|>>|[+\-*\/%<>]=?|[+\-]@|!|~)$/;
  var PRIMITIFS = /^(varchar\d*|char|character|text|string|int|integer|smallint|bigint|serial|bigserial|numeric|decimal|number|float|real|double|double precision|money|bool|boolean|date|time|timestamp|datetime|interval|blob|bytea|uuid|json|entier|réel|reel|chaîne|chaine|texte|booléen|booleen|caractère|caractere|void)(\s*\(.*\))?$/i;

  var GENRES_SYMETRIQUES = { association: true };
  var LIBELLES = {
    association: "association", composition: "composition", agregation: "agrégation",
    heritage: "héritage", realisation: "réalisation", dependance: "dépendance"
  };

  /* Lecture ------------------------------------------------------------------ */

  function estMultiplicite(t) { return /^(\d+|\*|n|N)(\.\.(\d+|\*|n|N))?$/.test(t); }

  // « 0..1 parrain » -> { mult: "0..1", role: "parrain" } ; « parrain » -> { role: "parrain" }
  function lireExtremite(t) {
    if (t == null) return { mult: "", role: "" };
    var mots = t.trim().split(/\s+/).filter(Boolean);
    if (!mots.length) return { mult: "", role: "" };
    if (estMultiplicite(mots[0])) return { mult: mots[0], role: mots.slice(1).join(" ") };
    if (estMultiplicite(mots[mots.length - 1])) return { mult: mots[mots.length - 1], role: mots.slice(0, -1).join(" ") };
    return { mult: "", role: mots.join(" ") };
  }

  function lireMembre(texte, num, erreurs, classe) {
    var t = texte, contraintes = [];
    t = t.replace(/\{([^}]*)\}/g, function (_, c) {
      c.split(",").forEach(function (x) { if (x.trim()) contraintes.push(x.trim()); });
      return " ";
    }).trim();
    var vis = "";
    var mv = t.match(/^([+\-#~])\s*/);
    if (mv) { vis = mv[1]; t = t.slice(mv[0].length); }
    if (t.indexOf("(") >= 0) {
      var mm = t.match(/^(\S+?)\s*\((.*)\)\s*(?::\s*(.+))?$/);
      // Un nom de méthode Ruby peut finir par ? (prédicat), ! (modifie le receveur) ou = (écriture)
      // … ou être un opérateur redéfini (<=>, ==, +, [], <<…)
      if (!mm || !(S.nomValide(mm[1].replace(/[?!=]$/, "")) || OPERATEUR_RUBY.test(mm[1]))) { erreurs.push(S.erreur(num, "Méthode illisible dans « " + classe.nom + " » : « " + texte + " »."));
        return; }
      classe.methodes.push({ vis: vis, nom: mm[1], params: mm[2].trim(), type: (mm[3] || "").trim(), contraintes: contraintes });
      return;
    }
    var mult = "";
    t = t.replace(/\[([^\]]*)\]/, function (_, x) { mult = x.trim(); return " "; }).trim();
    var defaut = "";
    var ie = S.indexHors(t, "=");
    if (ie >= 0) { defaut = t.slice(ie + 1).trim(); t = t.slice(0, ie).trim(); }
    var type = "";
    var id = S.indexHors(t, ":");
    if (id >= 0) { type = t.slice(id + 1).trim(); t = t.slice(0, id).trim(); }
    if (t.length > 2 && t[0] === "_" && t[t.length - 1] === "_") {
      t = t.slice(1, -1);
      if (!contraintes.some(estContrainteCle)) contraintes.unshift("PK");
    }
    if (!S.nomValide(t)) { erreurs.push(S.erreur(num, "Attribut illisible dans « " + classe.nom + " » : « " + texte + " »."));
      return; }
    if (mult && !N.multiplicite(mult)) erreurs.push(S.erreur(num, "Multiplicité invalide « [" + mult + "] » pour « " + t + " ». Exemples : [1], [0..1], [1..*], [*]."));
    classe.attributs.push({ vis: vis, nom: t, type: type, mult: mult, defaut: defaut, contraintes: contraintes });
  }

  function estContrainteCle(c) { return /^(pk|id|identifiant|cle|clé)$/i.test(String(c).trim()); }
  function estCle(a) { return (a.contraintes || []).some(estContrainteCle); }

  function lire(texte) {
    var erreurs = [], classes = [], liens = [], courante = null, indentEntete = 0;
    S.lignes(texte).forEach(function (l) {
      var t = l.texte, m;
      if ((m = t.match(RE_ENTETE))) {
        var mot = m[1].toLowerCase().replace(/\s+/g, " ");
        var genre = mot.indexOf("abstraite") >= 0 || m[3] ? "abstraite"
          : mot === "interface" ? "interface" : /num/.test(mot) ? "enumeration" : "classe";
        courante = { nom: m[2], genre: genre, stereotype: m[4] || m[5] || "", attributs: [], methodes: [], ligne: l.num };
        indentEntete = l.indent;
        classes.push(courante);
        return;
      }
      if ((m = t.match(RE_OBJET))) {
        courante = { nom: m[1], genre: "objet", type: m[2], stereotype: "", attributs: [], methodes: [], ligne: l.num };
        indentEntete = l.indent;
        classes.push(courante);
        return;
      }
      if ((m = t.match(RE_LIEN)) && !(courante && l.indent > indentEntete && !/--|\.\./.test(t))) {
        courante = null;
        var lien = lireLien(m, l.num, erreurs);
        if (lien) liens.push(lien);
        return;
      }
      if (courante && l.indent > indentEntete) { lireMembre(t, l.num, erreurs, courante); return; }
      if (/^objet\b/i.test(t)) erreurs.push(S.erreur(l.num, "Objet illisible : « " + t + " ». Exemple : objet c1 : Carre"));
      else if (/^(classe|interface|abstraite|enum)/i.test(t)) erreurs.push(S.erreur(l.num, "En-tête de classe illisible : « " + t + " ». Exemple : classe Film"));
      else if (/--|\.\./.test(t)) erreurs.push(S.erreur(l.num, "Lien illisible : « " + t + " ». Exemple : Vendeur \"1\" -- \"*\" Article : vend"));
      else erreurs.push(S.erreur(l.num, "Ligne illisible : « " + t + " ». Les attributs s'écrivent en retrait sous « classe Nom »."));
    });
    return { modele: { classes: classes, liens: liens }, erreurs: erreurs };
  }

  function lireLien(m, num, erreurs) {
    var gauche = m[1], op = m[3], droite = m[5], reste = m[6].trim();
    var eg = lireExtremite(m[2]), ed = lireExtremite(m[4]);
    var nom = "", sens = "", asso = "";
    var ma = reste.match(/^(?::\s*(.*?))?\s*(?:\[\s*([^\]]+?)\s*\])?\s*$/);
    if (!ma) { erreurs.push(S.erreur(num, "Fin de lien illisible : « " + reste + " ». Attendu : « : nom » puis, pour une classe d'association, « [Classe] »."));
      return null; }
    if (ma[1]) {
      nom = ma[1].trim();
      var s = nom.match(/^(?:([<◂◀])\s*)?(.*?)\s*([>▸▶])?$/);
      if (s) { nom = s[2].trim(); sens = s[3] ? ">" : s[1] ? "<" : ""; }
    }
    if (ma[2]) asso = ma[2].trim();
    [eg, ed].forEach(function (e) {
      if (e.mult && !N.multiplicite(e.mult)) erreurs.push(S.erreur(num, "Multiplicité invalide « " + e.mult + " ». Exemples : 1, 0..1, *, 1..*, 2..5."));
    });
    var l = { a: gauche, b: droite, genre: "association", ma: eg.mult, ra: eg.role, mb: ed.mult, rb: ed.role, nom: nom, sens: sens, navigable: "", classeAsso: asso, ligne: num };
    function inverser() {
      var x = l.a; l.a = l.b; l.b = x;
      x = l.ma; l.ma = l.mb; l.mb = x;
      x = l.ra; l.ra = l.rb; l.rb = x;
      if (l.sens) l.sens = l.sens === ">" ? "<" : ">";
    }
    switch (op) {
      case "--": break;
      case "-->": l.navigable = "b"; break;
      case "<--": l.navigable = "a"; break;
      case "*--": l.genre = "composition"; break;
      case "--*": l.genre = "composition"; inverser(); break;
      case "o--": l.genre = "agregation"; break;
      case "--o": l.genre = "agregation"; inverser(); break;
      case "--|>": l.genre = "heritage"; break;
      case "<|--": l.genre = "heritage"; inverser(); break;
      case "..|>": l.genre = "realisation"; break;
      case "<|..": l.genre = "realisation"; inverser(); break;
      case "..>": l.genre = "dependance"; break;
      case "<..": l.genre = "dependance"; inverser(); break;
    }
    return l;
  }

  /* Écriture ------------------------------------------------------------------ */

  function ecrireMembre(a) {
    var t = (a.vis || "") + (a.vis ? " " : "") + a.nom;
    if (a.type) t += " : " + a.type;
    if (a.mult) t += " [" + a.mult + "]";
    if (a.defaut) t += " = " + a.defaut;
    if (a.contraintes && a.contraintes.length) t += " {" + a.contraintes.join(", ") + "}";
    return t;
  }
  function ecrireMethode(m) {
    var t = (m.vis || "") + (m.vis ? " " : "") + m.nom + "(" + (m.params || "") + ")";
    if (m.type) t += " : " + m.type;
    if (m.contraintes && m.contraintes.length) t += " {" + m.contraintes.join(", ") + "}";
    return t;
  }
  function extremite(mult, role) {
    var t = [mult, role].filter(Boolean).join(" ");
    return t ? ' "' + t + '"' : "";
  }
  function operateur(l) {
    switch (l.genre) {
      case "composition": return "*--";
      case "agregation": return "o--";
      case "heritage": return "--|>";
      case "realisation": return "..|>";
      case "dependance": return "..>";
      default: return l.navigable === "b" ? "-->" : l.navigable === "a" ? "<--" : "--";
    }
  }
  function ecrireLien(l) {
    var t = l.a + extremite(l.ma, l.ra) + " " + operateur(l) + extremite(l.mb, l.rb) + " " + l.b;
    if (l.nom) t += " : " + (l.sens === "<" ? "< " : "") + l.nom + (l.sens === ">" ? " >" : "");
    if (l.classeAsso) t += " [" + l.classeAsso + "]";
    return t;
  }
  function ecrire(m) {
    if (!m) return "";
    var blocs = m.classes.map(function (c) {
      var entete = c.genre === "abstraite" ? "classe abstraite " : c.genre === "interface" ? "interface " : c.genre === "enumeration" ? "enumeration " : c.genre === "objet" ? "objet " : "classe ";
      var t = c.genre === "objet" ? entete + c.nom + " : " + c.type : entete + c.nom + (c.stereotype ? " <<" + c.stereotype + ">>" : "");
      c.attributs.forEach(function (a) { t += "\n  " + ecrireMembre(a); });
      (c.methodes || []).forEach(function (x) { t += "\n  " + ecrireMethode(x); });
      return t;
    });
    if (m.liens.length) blocs.push(m.liens.map(ecrireLien).join("\n"));
    return blocs.join("\n\n");
  }

  // Garde les positions des classes existantes (par nom, puis une classe renommée seule)
  function fusionner(nouveau, ancien) {
    if (!ancien) return nouveau;
    var restants = ancien.classes.slice();
    var sansPlace = [];
    nouveau.classes.forEach(function (c) {
      var i = restants.findIndex(function (x) { return x.nom.toLowerCase() === c.nom.toLowerCase(); });
      if (i >= 0) { c.x = restants[i].x; c.y = restants[i].y; restants.splice(i, 1); }
      else sansPlace.push(c);
    });
    if (sansPlace.length === 1 && restants.length === 1) { sansPlace[0].x = restants[0].x; sansPlace[0].y = restants[0].y; }
    return nouveau;
  }

  /* Contrôles ----------------------------------------------------------------- */

  function trouverClasse(m, nom) {
    return m.classes.find(function (c) { return c.nom.toLowerCase() === String(nom).toLowerCase(); }) || null;
  }
  function cibleLien(l) { return l.a + "--" + l.b; }

  function controler(m, options) {
    options = options || {};
    var res = [];
    if (!m || (!m.classes.length && !m.liens.length)) return [msg("info", "Le diagramme est vide pour l'instant.")];
    var vus = {};
    m.classes.forEach(function (c) {
      var k = c.nom.toLowerCase();
      if (vus[k]) res.push(msg("erreur", "La classe « " + c.nom + " » est définie deux fois.", c.nom));
      vus[k] = true;
      var noms = {};
      c.attributs.forEach(function (a) {
        var ka = a.nom.toLowerCase();
        if (noms[ka]) res.push(msg("erreur", "L'attribut « " + a.nom + " » apparaît deux fois dans « " + c.nom + " ».", c.nom + "." + a.nom));
        noms[ka] = true;
      });
    });
    var parents = {};
    m.liens.forEach(function (l) {
      var c = cibleLien(l);
      [l.a, l.b].forEach(function (n) {
        if (!trouverClasse(m, n)) res.push(msg("erreur", "Le lien « " + l.a + " – " + l.b + " » utilise la classe « " + n + " », qui n'est pas définie.", c));
      });
      var structurel = l.genre === "association" || l.genre === "composition" || l.genre === "agregation";
      var ca = trouverClasse(m, l.a), cb = trouverClasse(m, l.b);
      if (ca && cb && ca.genre === "objet" && cb.genre === "objet") {
        if (l.ma || l.mb) res.push(msg("attention", "Pas de multiplicités sur un lien entre objets (" + l.a + " – " + l.b + ") : il relie deux instances.", c));
        if (ca === cb) res.push(msg("attention", "« " + l.a + " » est relié à lui-même.", c));
        return;
      }
      if (structurel && (!l.ma || !l.mb)) {
        res.push(msg("attention", "Multiplicité manquante sur l'association « " + (l.nom || l.a + " – " + l.b) + " » : les indiquer aux deux extrémités.", c));
      }
      if (!structurel && (l.ma || l.mb)) {
        res.push(msg("attention", "Pas de multiplicités sur " + (l.genre === "heritage" ? "un héritage" : "une " + LIBELLES[l.genre]) + " (" + l.a + " – " + l.b + ").", c));
      }
      if (l.genre === "composition" && l.ma) {
        var mc = N.multiplicite(l.ma);
        if (mc && mc.max > 1) res.push(msg("attention", "Composition « " + l.a + " – " + l.b + " » : une partie appartient à un seul composite, la multiplicité côté « " + l.a + " » est 1 ou 0..1.", c));
      }
      if (l.a.toLowerCase() === l.b.toLowerCase() && structurel && !l.ra && !l.rb) {
        res.push(msg("info", "Association réflexive sur « " + l.a + " » : préciser les rôles aux deux extrémités facilite la lecture.", c));
      }
      if (l.genre === "heritage" || l.genre === "realisation") {
        if (l.a.toLowerCase() === l.b.toLowerCase()) res.push(msg("erreur", "« " + l.a + " » ne peut pas hériter d'elle-même.", c));
        (parents[l.a.toLowerCase()] = parents[l.a.toLowerCase()] || []).push(l.b.toLowerCase());
      }
      if (l.genre === "realisation") {
        var cible = trouverClasse(m, l.b);
        if (cible && cible.genre !== "interface") res.push(msg("info", "« " + l.a + " ..|> " + l.b + " » est une réalisation : « " + l.b + " » devrait être une interface.", c));
      }
      if (l.classeAsso) {
        if (!trouverClasse(m, l.classeAsso)) res.push(msg("erreur", "La classe d'association « " + l.classeAsso + " » n'est pas définie.", c));
        if (!structurel) res.push(msg("erreur", "Une classe d'association se rattache à une association, pas à " + (l.genre === "heritage" ? "un héritage" : "une " + LIBELLES[l.genre]) + ".", c));
      }
    });
    // Cycle d'héritage
    Object.keys(parents).forEach(function (depart) {
      var vus2 = {}, pile = [depart];
      while (pile.length) {
        var x = pile.pop();
        (parents[x] || []).forEach(function (p) {
          if (p === depart) { vus2.cycle = true; return; }
          if (!vus2[p]) { vus2[p] = true; pile.push(p); }
        });
      }
      if (vus2.cycle) res.push(msg("erreur", "Cycle d'héritage à partir de « " + depart + " ».", (trouverClasse(m, depart) || {}).nom || depart));
    });

    var assoClasses = new Set(m.liens.filter(function (l) { return l.classeAsso; }).map(function (l) { return l.classeAsso.toLowerCase(); }));
    var enfants = new Set(m.liens.filter(function (l) { return l.genre === "heritage"; }).map(function (l) { return l.a.toLowerCase(); }));
    m.classes.forEach(function (c) {
      if (!c.attributs.length && !(c.methodes || []).length && c.genre !== "interface" && c.genre !== "objet") {
        res.push(msg("info", "« " + c.nom + " » n'a aucun attribut.", c.nom));
      }
      if (!options.bdd) return;
      var k = c.nom.toLowerCase();
      if (c.genre !== "interface" && c.genre !== "enumeration" && !c.attributs.some(estCle) && !assoClasses.has(k) && !enfants.has(k)) {
        res.push(msg("attention", "« " + c.nom + " » n'a pas d'identifiant {PK} : il faudra en choisir un avant la traduction en relationnel.", c.nom));
      }
      c.attributs.forEach(function (a) {
        var mu = N.multiplicite(a.mult);
        if (mu && mu.max > 1) {
          res.push(msg("attention", "« " + c.nom + "." + a.nom + " [" + a.mult + "] » est multivalué : un attribut doit être atomique (première forme normale). En faire une classe liée.", c.nom + "." + a.nom));
        }
        if (a.type && !PRIMITIFS.test(a.type.trim())) {
          res.push(msg("info", "« " + c.nom + "." + a.nom + " » a le type composé « " + a.type + " » : le décomposer en attributs simples, ou en faire une classe.", c.nom + "." + a.nom));
        }
      });
      if ((c.methodes || []).length) res.push(msg("info", "« " + c.nom + " » a des méthodes : elles ne sont pas traduites dans le modèle relationnel.", c.nom));
    });
    return res;
  }

  /* Comparaison ---------------------------------------------------------------- */

  function similarite(a, b) {
    if ((a.genre === "objet" || b.genre === "objet") && N.cle(a.type) !== N.cle(b.type)) return 0;
    var x = new Set(a.attributs.map(function (t) { return N.cle(t.nom); }));
    var y = new Set(b.attributs.map(function (t) { return N.cle(t.nom); }));
    var inter = 0;
    x.forEach(function (k) { if (y.has(k)) inter++; });
    return x.size + y.size ? inter / (x.size + y.size - inter) : 0;
  }

  // Faits d'un diagramme ; nomDe(nom de classe) donne le nom commun
  function faits(m, nomDe, avecMethodes) {
    var f = [], vuPaire = {};
    m.classes.forEach(function (c) {
      var cn = nomDe(c.nom);
      f.push("C|" + cn);
      if (c.genre === "abstraite" || c.genre === "interface") f.push("G|" + cn + "|" + c.genre);
      if (c.genre === "objet") f.push("T|" + cn + "|" + N.cle(c.type));
      c.attributs.forEach(function (a) {
        f.push("A|" + cn + "|" + N.cle(a.nom));
        if (c.genre === "objet") f.push("V|" + cn + "|" + N.cle(a.nom) + "|" + N.cle(a.defaut));
        if (estCle(a)) f.push("K|" + cn + "|" + N.cle(a.nom));
      });
      if (avecMethodes) (c.methodes || []).forEach(function (x) { f.push("M|" + cn + "|" + N.cle(x.nom)); });
    });
    m.liens.forEach(function (l) {
      var a = nomDe(l.a), b = nomDe(l.b), cle;
      if (GENRES_SYMETRIQUES[l.genre]) {
        var paire = [a, b].sort();
        cle = paire.join("~");
        var n = vuPaire[cle] = (vuPaire[cle] || 0) + 1;
        if (n > 1) cle += "#" + n;
        f.push("L|association|" + cle);
        if (a === b) f.push("X|" + cle + "|" + [N.multNormale(l.ma), N.multNormale(l.mb)].sort().join(","));
        else {
          f.push("X|" + cle + "|" + a + "=" + N.multNormale(l.ma));
          f.push("X|" + cle + "|" + b + "=" + N.multNormale(l.mb));
        }
        if (l.classeAsso) f.push("AC|" + cle + "|" + nomDe(l.classeAsso));
      } else {
        cle = a + ">" + b;
        f.push("L|" + l.genre + "|" + cle);
        if (l.genre === "composition" || l.genre === "agregation") {
          f.push("X|" + l.genre + "|" + cle + "|" + a + "=" + N.multNormale(l.ma));
          f.push("X|" + l.genre + "|" + cle + "|" + b + "=" + N.multNormale(l.mb));
        }
      }
    });
    return f;
  }

  // Poids des faits dans le score : un lien (et sa classe d'association) compte plus qu'un attribut
  var POIDS = { C: 1, G: 1, T: 1, A: 1, V: 1, K: 1, M: 1, L: 2, X: 1, AC: 2 };

  function comparer(m, sol, options) {
    if (!sol) return null;
    options = options || {};
    var ap = N.apparier(m.classes, sol.classes, function (c) { return c.nom; }, similarite);
    var versSol = {}, ecarts = [];
    ap.paires.forEach(function (p) {
      versSol[p[0].nom.toLowerCase()] = N.cle(p[1].nom);
      if (N.cle(p[0].nom) !== N.cle(p[1].nom)) ecarts.push(ecart("different", "« " + p[0].nom + " » correspond à « " + p[1].nom + " » dans la solution (nom différent).", p[0].nom));
    });
    // Classe déclarée sans correspondante : nom marqué « ! » ; nom seulement cité par un lien : comparé tel quel
    var declarees = new Set(m.classes.map(function (c) { return c.nom.toLowerCase(); }));
    function nomEtu(n) { var k = versSol[String(n).toLowerCase()]; return k || (declarees.has(String(n).toLowerCase()) ? "!" : "") + N.cle(n); }
    function nomSol(n) { return N.cle(n); }
    var avecMethodes = sol.classes.some(function (c) { return (c.methodes || []).length; });
    var res = N.f1(faits(m, nomEtu, avecMethodes), faits(sol, nomSol, avecMethodes), POIDS);

    // Noms lisibles
    var solParCle = {}, etuParCle = {};
    sol.classes.forEach(function (c) { solParCle[N.cle(c.nom)] = c; });
    m.classes.forEach(function (c) { etuParCle[nomEtu(c.nom)] = c; });
    function lisible(k) { return etuParCle[k] ? etuParCle[k].nom : solParCle[k] ? solParCle[k].nom : k.replace(/^!/, ""); }
    function attr(c, k, liste) { var a = c && (c[liste || "attributs"] || []).find(function (x) { return N.cle(x.nom) === k; }); return a ? a.nom : k; }
    function paireLisible(cle) { return cle.replace(/#\d+$/, "").split(/[~>]/).map(lisible).join(" – "); }
    function cibleDe(cle) { var p = cle.replace(/#\d+$/, "").split(/[~>]/).map(lisible); return p[0] + "--" + p[1]; }
    var manque = new Set(res.manquants), trop = new Set(res.exces);

    // Liens de même paire mais de genre différent
    var liensManquants = res.manquants.filter(function (f) { return f.indexOf("L|") === 0; });
    var liensEnTrop = res.exces.filter(function (f) { return f.indexOf("L|") === 0; });
    function paireDe(f) { var p = f.split("|"); return p[2].replace(/#\d+$/, "").split(/[~>]/).sort().join("~"); }
    var traites = new Set();
    liensManquants.forEach(function (f) {
      var autre = liensEnTrop.find(function (g) { return !traites.has(g) && paireDe(g) === paireDe(f); });
      if (autre) {
        traites.add(f); traites.add(autre);
        var gs = f.split("|")[1], ge = autre.split("|")[1];
        ecarts.push(ecart("different", "Entre « " + paireLisible(f.split("|")[2]) + " », la solution utilise " + article(gs) + (gs === ge ? " dans l'autre sens" : "") + ", pas " + article(ge) + ".", cibleDe(autre.split("|")[2])));
      }
    });

    res.manquants.forEach(function (f) {
      if (traites.has(f)) return;
      var p = f.split("|");
      switch (p[0]) {
        case "C": ecarts.push(ecart("manque", "Il manque une classe : « " + lisible(p[1]) + " ».")); break;
        case "A": if (!manque.has("C|" + p[1])) ecarts.push(ecart("manque", "Il manque l'attribut « " + attr(solParCle[p[1]], p[2]) + " » dans « " + lisible(p[1]) + " ».", lisible(p[1]))); break;
        case "K": if (!manque.has("A|" + p[1] + "|" + p[2])) ecarts.push(ecart("different", "« " + attr(etuParCle[p[1]], p[2]) + " » devrait être l'identifiant {PK} de « " + lisible(p[1]) + " ».", lisible(p[1]) + "." + attr(etuParCle[p[1]], p[2]))); break;
        case "M": if (!manque.has("C|" + p[1])) ecarts.push(ecart("manque", "Il manque la méthode « " + attr(solParCle[p[1]], p[2], "methodes") + "() » dans « " + lisible(p[1]) + " ».", lisible(p[1]))); break;
        case "G": ecarts.push(ecart("different", "« " + lisible(p[1]) + " » devrait être " + (p[2] === "interface" ? "une interface" : "abstraite") + ".", lisible(p[1]))); break;
        case "T": if (!manque.has("C|" + p[1])) ecarts.push(ecart("different", "« " + lisible(p[1]) + " » devrait être un objet de la classe « " + solParCle[p[1]].type + " ».", lisible(p[1]))); break;
        case "V": if (!manque.has("C|" + p[1]) && !manque.has("A|" + p[1] + "|" + p[2])) ecarts.push(ecart("different", "« " + lisible(p[1]) + "." + attr(solParCle[p[1]], p[2]) + " » a une autre valeur dans la solution.", lisible(p[1]) + "." + attr(etuParCle[p[1]], p[2]))); break;
        case "L": ecarts.push(ecart("manque", "Il manque " + article(p[1]) + " entre « " + paireLisible(p[2]) + " ».", cibleDe(p[2]))); break;
        case "X": {
          var lien = p.length === 4 ? p[1] + "|" + p[2] : p[1];
          var liee = p.length === 4 ? "L|" + p[1] + "|" + p[2] : "L|association|" + p[1];
          if (manque.has(liee) || traites.has(liee)) break;
          var ext = p[p.length - 1];
          var q = ext.split("=");
          ecarts.push(ecart("different", q.length === 2
            ? "Entre « " + paireLisible(lien.split("|").pop()) + " » : multiplicité attendue côté « " + lisible(q[0]) + " » : " + (q[1] || "(aucune)") + "."
            : "Multiplicités attendues sur l'association réflexive « " + paireLisible(lien) + " » : " + ext + ".", cibleDe(lien.split("|").pop())));
          break;
        }
        case "AC": if (!manque.has("L|association|" + p[1])) ecarts.push(ecart("manque", "L'association « " + paireLisible(p[1]) + " » devrait porter la classe d'association « " + lisible(p[2]) + " ».", cibleDe(p[1]))); break;
      }
    });
    res.exces.forEach(function (f) {
      if (traites.has(f)) return;
      var p = f.split("|");
      switch (p[0]) {
        case "C": ecarts.push(ecart("exces", "La classe « " + lisible(p[1]) + " » n'apparaît pas dans la solution.", lisible(p[1]))); break;
        case "A": if (!trop.has("C|" + p[1])) ecarts.push(ecart("exces", "L'attribut « " + attr(etuParCle[p[1]], p[2]) + " » de « " + lisible(p[1]) + " » n'apparaît pas dans la solution.", lisible(p[1]) + "." + attr(etuParCle[p[1]], p[2]))); break;
        case "K": if (!trop.has("A|" + p[1] + "|" + p[2])) ecarts.push(ecart("different", "« " + attr(etuParCle[p[1]], p[2]) + " » n'est pas l'identifiant de « " + lisible(p[1]) + " » dans la solution.", lisible(p[1]) + "." + attr(etuParCle[p[1]], p[2]))); break;
        case "L": ecarts.push(ecart("exces", article(p[1], true) + " entre « " + paireLisible(p[2]) + " » n'apparaît pas dans la solution.", cibleDe(p[2]))); break;
      }
    });
    return { score: res.score, ecarts: ecarts, resume: resumeScore(res.score, ecarts.length) };
  }

  function article(genre, majuscule) {
    var t = { association: "une association", composition: "une composition", agregation: "une agrégation", heritage: "un héritage", realisation: "une réalisation", dependance: "une dépendance" }[genre] || genre;
    return majuscule ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  }

  function resumeScore(score, n) {
    if (score === 1 && !n) return "Identique à la solution proposée.";
    return Math.round(score * 100) + " % de concordance avec la solution · " + N.pluriel(n, "écart");
  }

  function cibles(m) {
    var t = [];
    (m && m.classes || []).forEach(function (c) {
      t.push(c.nom);
      c.attributs.forEach(function (a) { t.push(c.nom + "." + a.nom); });
      (c.methodes || []).forEach(function (x) { t.push(c.nom + "." + x.nom + "()"); });
    });
    (m && m.liens || []).forEach(function (l) { t.push(cibleLien(l)); });
    return t;
  }

  A.editeurs.classes = {
    nom: "classes",
    // Options reconnues (champ « options » d'un atelier), vérifiées par outils/verifier.js
    options: {
      bdd: "true : contrôles de conception de base de données ({PK}, attributs atomiques et monovalués, pas de méthodes)",
      methodes: "true : le formulaire d'une classe propose aussi ses méthodes (POO)",
      objets: "true : diagramme d'objets ; le dessin crée des objets plutôt que des classes"
    },
    libelle: "Diagramme de classes",
    description: "Diagramme de classes UML : classes et attributs indentés, associations avec multiplicités et rôles entre guillemets, compositions, agrégations, héritages, classes d'association entre crochets. Diagramme d'objets : objet c1 : Carre, valeurs en retrait, liens sans multiplicités.",
    aide: "<p>Une classe, puis ses membres en retrait :</p>" +
      "<pre><code class='language-plaintext'>classe Vendeur\n  id : int {PK}\n  nom : varchar [1]</code></pre>" +
      "<ul><li>Aussi : <code>classe abstraite Personne</code>, <code>interface Comparable</code>, <code>enumeration Couleur</code>. Méthode : <code>+ age() : int</code>.</li>" +
      "<li>Association : <code>Vendeur \"1\" -- \"*\" Article : vend &gt;</code> ; rôles après la multiplicité : <code>\"0..1 parrain\"</code>.</li>" +
      "<li>Classe d'association : <code>Acteur \"*\" -- \"*\" Film : joue [Distribution]</code>.</li>" +
      "<li>Composition <code>A \"1\" *-- \"*\" B</code> (losange côté A), agrégation <code>o--</code>, héritage <code>Etudiant --|&gt; Personne</code>, réalisation <code>..|&gt;</code>, dépendance <code>..&gt;</code>, navigabilité <code>--&gt;</code>.</li>" +
      "<li>Objet : <code>objet c1 : Carre</code>, ses valeurs en retrait (<code>pleine = true</code>) ; lien sans multiplicités : <code>c1 o-- r1</code>.</li></ul>",
    vide: function () { return { classes: [], liens: [] }; },
    lire: lire,
    ecrire: ecrire,
    fusionner: fusionner,
    controler: controler,
    comparer: comparer,
    cibles: cibles,
    estCle: estCle,
    ecrireMembre: ecrireMembre,
    ecrireMethode: ecrireMethode,
    lireMembres: function (texte, classe) {
      var erreurs = [], c = { nom: classe || "?", attributs: [], methodes: [] };
      S.lignes(texte).forEach(function (l) { lireMembre(l.texte, l.num, erreurs, c); });
      return { attributs: c.attributs, methodes: c.methodes, erreurs: erreurs };
    },
    estMultiplicite: estMultiplicite,
    LIBELLES: LIBELLES,
    estVide: function (m) { return !m || (!m.classes.length && !m.liens.length); }
  };
})(window.Atelier);
