/* ==========================================================================
   Atelier · noyau (Atelier.noyau)
   --------------------------------------------------------------------------
   Outils communs à tous les éditeurs : noms comparables, multiplicités,
   messages de contrôle, copies, distance d'édition, score F1. Les fonctions
   de construction du DOM (el, svg) ne touchent au document qu'à l'appel :
   ce module se charge aussi dans Node (vérificateur, tests).
   ========================================================================== */
(function (A) {
  'use strict';

  /* Langue de l'interface -------------------------------------------------- */

  // Celle de l'application installée (cours.js : window.ulaLangueCourante), sinon le
  // français (navigateur seul, lancer.bat, Node). Les messages de l'atelier sont écrits
  // en paire : tr("texte français", "English text"). Le contenu des TD (consignes,
  // solutions, syntaxe des éditeurs) reste dans sa langue.
  function langue() {
    var w = typeof window !== 'undefined' ? window : {};
    return typeof w.ulaLangueCourante === 'function' && w.ulaLangueCourante() === 'en' ? 'en' : 'fr';
  }
  function tr(fr, en) {
    return langue() === 'en' ? en : fr;
  }
  A.langue = langue;
  A.tr = tr;

  // Nom de l'assistant IA choisi dans les réglages du serveur local (outil de quiz :
  // Claude, ChatGPT ou Gemini) ; Claude sans serveur
  A.nomIa = function () {
    var q = typeof window !== 'undefined' ? window.QuizApp : null;
    return q && q.connexion && q.connexion.assistant ? q.connexion.assistant().nom : 'Claude';
  };

  /* Textes ------------------------------------------------------------------ */

  // Retire les accents : on filtre les signes diacritiques après décomposition
  function sansAccents(t) {
    return String(t)
      .normalize('NFD')
      .split('')
      .filter(function (c) {
        var k = c.charCodeAt(0);
        return k < 0x300 || k > 0x36f;
      })
      .join('');
  }

  // Nom comparable : casse, accents, séparateurs et pluriel simple ignorés
  // (« Vendeur·ses », « vendeurs », « Vendeur » donnent tous « vendeur »)
  function cle(nom) {
    var t = sansAccents(String(nom == null ? '' : nom))
      .toLowerCase()
      .replace(/[·•.]\s*(se|ses|e|es|s)\b/g, '')
      .replace(/[^a-z0-9]+/g, '');
    if (t.length > 3 && /[sx]$/.test(t) && !/(ss|us|is)$/.test(t)) t = t.slice(0, -1);
    return t;
  }

  // Texte d'un champ JSON : une chaîne, ou une liste de lignes
  function lignesDe(v) {
    if (v == null) return '';
    return Array.isArray(v) ? v.join('\n') : String(v);
  }

  function copie(o) {
    return o == null ? o : JSON.parse(JSON.stringify(o));
  }

  function echapper(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Distance d'édition (Levenshtein), pour repérer une faute de frappe dans un nom
  function distance(a, b) {
    a = String(a);
    b = String(b);
    if (a === b) return 0;
    var prec = [],
      cour,
      i,
      j;
    for (j = 0; j <= b.length; j++) prec[j] = j;
    for (i = 1; i <= a.length; i++) {
      cour = [i];
      for (j = 1; j <= b.length; j++) {
        cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prec = cour;
    }
    return prec[b.length];
  }

  // Deux noms sont-ils « presque » identiques (faute de frappe, pluriel) ?
  function voisins(a, b) {
    var x = cle(a),
      y = cle(b);
    if (!x || !y) return false;
    if (x === y) return true;
    return Math.max(x.length, y.length) >= 5 && distance(x, y) <= 1;
  }

  /* Multiplicités UML ------------------------------------------------------------ */

  // « 1 », « 0..1 », « * », « 1..* », « 2..5 », « n » (= *) -> { min, max } (max Infinity) ou null
  function multiplicite(texte) {
    if (texte == null) return null;
    var t = String(texte).trim().replace(/\s+/g, '').replace(/…/g, '..');
    if (!t) return null;
    var inf = function (x) {
      return x === '*' || x === 'n' || x === 'N';
    };
    var m = t.match(/^(\d+|\*|n|N)$/);
    if (m) return inf(m[1]) ? { min: 0, max: Infinity } : { min: Number(m[1]), max: Number(m[1]) };
    m = t.match(/^(\d+)\.\.(\d+|\*|n|N)$/);
    if (!m) return null;
    var min = Number(m[1]),
      max = inf(m[2]) ? Infinity : Number(m[2]);
    if (max < min || max === 0) return null;
    return { min: min, max: max };
  }

  // Forme canonique d'une multiplicité valide : « * », « 1 », « 0..1 », « 1..* »…
  function multNormale(texte) {
    var m = multiplicite(texte);
    if (!m) return texte == null ? '' : String(texte).trim();
    if (m.min === 0 && m.max === Infinity) return '*';
    if (m.min === m.max) return String(m.min);
    return m.min + '..' + (m.max === Infinity ? '*' : m.max);
  }

  /* Messages de contrôle et écarts ---------------------------------------------- */

  // niveau : "erreur" | "attention" | "info" ; cible : chaîne qui désigne un élément
  function message(niveau, texte, cible) {
    var m = { niveau: niveau, message: texte };
    if (cible) m.cible = cible;
    return m;
  }
  // nature : "manque" (dans la solution, pas chez l'étudiant), "exces", "different"
  function ecart(nature, texte, cible) {
    var e = { nature: nature, message: texte };
    if (cible) e.cible = cible;
    return e;
  }

  // Score F1 entre deux ensembles de faits (chaînes) : { score, communs, manquants, exces }
  // Une remarque posée sur la cible a vise-t-elle l'élément attendu x ? Même élément (sans casse ni
  // accents), même lien dans un sens ou dans l'autre (« A--B », « B--A »), ou remarque posée sur la
  // classe d'un attribut attendu (« Film » pour « Film.Genre »). Une cible attendue vide est toujours trouvée.
  function memeCible(a, x) {
    function norme(t) {
      return sansAccents(String(t == null ? '' : t))
        .toLowerCase()
        .replace(/\s+/g, '');
    }
    a = norme(a);
    x = norme(x);
    if (!x || a === x) return true;
    var la = a.split('--'),
      lx = x.split('--');
    if (la.length === 2 && lx.length === 2) return la[0] === lx[1] && la[1] === lx[0];
    return lx.length === 1 && x.indexOf('.') > 0 && a === x.split('.')[0];
  }

  // poids (facultatif) : { préfixe: poids } ; le préfixe d'un fait est ce qui précède le premier « | »
  function f1(faitsEtudiant, faitsSolution, poids) {
    var a = new Set(faitsEtudiant),
      b = new Set(faitsSolution);
    var communs = [],
      manquants = [],
      exces = [];
    b.forEach(function (f) {
      (a.has(f) ? communs : manquants).push(f);
    });
    a.forEach(function (f) {
      if (!b.has(f)) exces.push(f);
    });
    if (!b.size && !a.size) return { score: 1, communs: communs, manquants: manquants, exces: exces };
    function somme(ens) {
      var s = 0;
      ens.forEach(function (f) {
        var w = poids && poids[f.split('|')[0]];
        s += w == null ? 1 : w;
      });
      return s;
    }
    var c = somme(communs),
      sa = somme(a),
      sb = somme(b);
    var p = sa ? c / sa : 0,
      r = sb ? c / sb : 0;
    return { score: p + r ? (2 * p * r) / (p + r) : 0, communs: communs, manquants: manquants, exces: exces };
  }

  // Associe les éléments de deux listes par leur nom (clé exacte, puis nom voisin).
  // Renvoie { paires: [[a, b]], seulsA: [a], seulsB: [b] } ; nom(x) donne le nom.
  function apparier(listeA, listeB, nom, similarite) {
    var restantsB = listeB.slice(),
      paires = [],
      seulsA = [];
    listeA.forEach(function (a) {
      var i = restantsB.findIndex(function (b) {
        return cle(nom(b)) === cle(nom(a));
      });
      if (i >= 0) {
        paires.push([a, restantsB[i]]);
        restantsB.splice(i, 1);
      } else seulsA.push(a);
    });
    // Seconde passe : nom voisin, puis similarité de contenu fournie par l'éditeur
    seulsA = seulsA.filter(function (a) {
      var i = restantsB.findIndex(function (b) {
        return voisins(nom(a), nom(b));
      });
      if (i < 0 && similarite) {
        var meilleur = -1,
          score = 0.5;
        restantsB.forEach(function (b, k) {
          var s = similarite(a, b);
          if (s > score) {
            score = s;
            meilleur = k;
          }
        });
        i = meilleur;
      }
      if (i >= 0) {
        paires.push([a, restantsB[i]]);
        restantsB.splice(i, 1);
        return false;
      }
      return true;
    });
    return { paires: paires, seulsA: seulsA, seulsB: restantsB };
  }

  /* Travail fait sur papier ------------------------------------------------------- */

  // Champ « papier » d'un atelier : la réponse écrite sur papier, dans la syntaxe texte de l'éditeur
  // (texte ou tableau de lignes), ou { texte, source, date, note }. Renvoie l'état enregistrable de ce
  // travail (celui d'un fichier td_results/), les erreurs de syntaxe et la note sur la copie.
  function travailPapier(ed, papier, options) {
    var p = papier && typeof papier === 'object' && !Array.isArray(papier) ? papier : { texte: papier };
    var texte = lignesDe(p.texte);
    var r = ed.lire(texte, options || {});
    var ecrit = ed.ecrire(r.modele, options || {});
    var date = p.date ? new Date(p.date) : null;
    return {
      etat: {
        editeur: ed.nom,
        modele: r.modele,
        texte: texte !== ecrit ? texte : null,
        resume: ed.estVide(r.modele) ? 'vide' : 'commencé',
        maj: date && !isNaN(date) ? date.toISOString() : '',
        papier: { source: p.source || '', date: p.date || '' },
      },
      erreurs: r.erreurs,
      note: p.note || '',
    };
  }

  function pluriel(n, mot, motPluriel) {
    if (langue() === 'en') {
      if (n === 1) return n + ' ' + mot;
      return (
        n +
        ' ' +
        (motPluriel ||
          (/(s|x|z|ch|sh)$/.test(mot) ? mot + 'es' : /[^aeiou]y$/.test(mot) ? mot.slice(0, -1) + 'ies' : mot + 's'))
      );
    }
    if (n <= 1) return n + ' ' + mot;
    return n + ' ' + (motPluriel || (/[sxz]$/.test(mot) ? mot : /(au|eu)$/.test(mot) ? mot + 'x' : mot + 's'));
  }

  /* DOM (navigateur seulement) --------------------------------------------------- */

  var NS_SVG = 'http://www.w3.org/2000/svg';

  function el(balise, classe, texte) {
    var e = document.createElement(balise);
    if (classe) e.className = classe;
    if (texte != null) e.textContent = texte;
    return e;
  }
  function svg(balise, attributs, parent) {
    var e = document.createElementNS(NS_SVG, balise);
    if (attributs)
      Object.keys(attributs).forEach(function (k) {
        if (attributs[k] != null) e.setAttribute(k, attributs[k]);
      });
    if (parent) parent.appendChild(e);
    return e;
  }
  function texteSvg(parent, x, y, contenu, classe, ancre) {
    var t = svg('text', { x: x, y: y, class: classe || null, 'text-anchor': ancre || null }, parent);
    t.textContent = contenu;
    return t;
  }
  function bouton(texte, classe, action, titre) {
    var b = el('button', 'bouton' + (classe ? ' ' + classe : ''), texte);
    b.type = 'button';
    if (titre) {
      b.title = titre;
      b.setAttribute('aria-label', titre);
    }
    if (action) b.addEventListener('click', action);
    return b;
  }

  // Largeur d'un texte, mesurée avec la police réelle de la page (canvas hors écran)
  var mesureur = null;
  // Rendu statique dans un cadre défilant : le SVG rétrécit avec la page, mais pas sous 65 % de
  // sa taille naturelle (au-delà, le texte devient illisible et le cadre défile)
  function cadreLisible(rendu, classe) {
    var d = el('div', 'atelier-rendu' + (classe ? ' ' + classe : ''));
    var w = rendu.getAttribute && Number(rendu.getAttribute('width'));
    if (w && rendu.tagName.toLowerCase() === 'svg') rendu.style.minWidth = Math.round(w * 0.65) + 'px';
    d.appendChild(rendu);
    return d;
  }

  function largeurTexte(texte, police) {
    if (typeof document === 'undefined') return String(texte).length * 7.5;
    if (!mesureur) mesureur = document.createElement('canvas').getContext('2d');
    mesureur.font = police;
    return mesureur.measureText(String(texte)).width;
  }
  function police(variable, taille, graisse) {
    var f = 'system-ui, sans-serif';
    if (typeof document !== 'undefined') {
      var v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
      if (v) f = v;
    }
    return (graisse || 400) + ' ' + taille + 'px ' + f;
  }

  // Petit émetteur d'événements
  function emetteur(objet) {
    var auditeurs = {};
    objet.sur = function (nom, f) {
      (auditeurs[nom] = auditeurs[nom] || []).push(f);
      return objet;
    };
    objet.emettre = function (nom, donnees) {
      (auditeurs[nom] || []).forEach(function (f) {
        try {
          f(donnees);
        } catch (e) {
          console.error('[atelier]', e);
        }
      });
    };
    return objet;
  }

  A.noyau = {
    sansAccents: sansAccents,
    cle: cle,
    memeCible: memeCible,
    lignesDe: lignesDe,
    copie: copie,
    echapper: echapper,
    distance: distance,
    voisins: voisins,
    multiplicite: multiplicite,
    multNormale: multNormale,
    message: message,
    ecart: ecart,
    f1: f1,
    apparier: apparier,
    pluriel: pluriel,
    travailPapier: travailPapier,
    el: el,
    svg: svg,
    texteSvg: texteSvg,
    bouton: bouton,
    cadreLisible: cadreLisible,
    largeurTexte: largeurTexte,
    police: police,
    emetteur: emetteur,
  };
})(window.Atelier);
