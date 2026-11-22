/* ==========================================================================
   Atelier · éditeur « processus » : arbre de processus (logique)
   --------------------------------------------------------------------------
   Pour les exercices sur fork() : dessiner l'arbre des processus créés par
   un programme. Syntaxe : un processus par ligne, les fils en retrait sous
   leur père, étiquette facultative après « : » (ce que le processus
   affiche, la valeur renvoyée par fork…).
     P1 : main
       P2 : fork() = 0
         P4
       P3
   Options : etiquettes (true : les étiquettes comptent dans la comparaison),
   ordre (true : l'ordre des fils compte), organigramme (WBS, PBS : mêmes
   lignes, dessinées en colonnes, avec le vocabulaire d'un organigramme).
   ========================================================================== */
(function (A) {
  'use strict';

  var N = A.noyau,
    S = A.syntaxe,
    msg = N.message,
    ecart = N.ecart,
    tr = A.tr;

  function lire(texte, options) {
    var erreurs = [],
      noeuds = [],
      pile = [];
    S.lignes(texte).forEach(function (l) {
      var i = S.indexHors(l.texte, ':');
      var nom = (i >= 0 ? l.texte.slice(0, i) : l.texte).trim().replace(/^[-*•]\s*/, '');
      var etiquette = i >= 0 ? l.texte.slice(i + 1).trim() : '';
      if (!nom) {
        erreurs.push(S.erreur(l.num, 'Nom manquant.'));
        return;
      }
      while (pile.length && pile[pile.length - 1].indent >= l.indent) pile.pop();
      var parent = pile.length ? pile[pile.length - 1].noeud : null;
      var n = { id: 'p' + noeuds.length, nom: nom, etiquette: etiquette, parent: parent ? parent.id : null };
      noeuds.push(n);
      pile.push({ indent: l.indent, noeud: n });
    });
    return { modele: { noeuds: noeuds, organigramme: Boolean(options && options.organigramme) }, erreurs: erreurs };
  }

  function enfants(m, id) {
    return m.noeuds.filter(function (n) {
      return n.parent === id;
    });
  }
  function racines(m) {
    return enfants(m, null);
  }

  function ecrire(m) {
    if (!m) return '';
    var t = [];
    (function parcourir(liste, niveau) {
      liste.forEach(function (n) {
        t.push('  '.repeat(niveau) + n.nom + (n.etiquette ? ' : ' + n.etiquette : ''));
        parcourir(enfants(m, n.id), niveau + 1);
      });
    })(racines(m), 0);
    return t.join('\n');
  }

  function controler(m) {
    if (!m || !m.noeuds.length)
      return [msg('info', tr("L'arbre est vide pour l'instant.", 'The tree is empty for now.'))];
    var res = [],
      vus = {};
    m.noeuds.forEach(function (n) {
      var k = n.nom.toLowerCase();
      if (vus[k])
        res.push(
          msg(
            'attention',
            tr(
              m.organigramme
                ? "Deux éléments s'appellent « " + n.nom + ' » : les numéroter (1.1, 1.2…) évite les confusions.'
                : "Deux processus s'appellent « " + n.nom + ' » : les numéroter (P1, P2…) évite les confusions.',
              m.organigramme
                ? 'Two elements are called “' + n.nom + '”: numbering them (1.1, 1.2…) avoids confusion.'
                : 'Two processes are called “' + n.nom + '”: numbering them (P1, P2…) avoids confusion.',
            ),
            n.nom,
          ),
        );
      vus[k] = true;
    });
    if (racines(m).length > 1)
      res.push(
        msg(
          'info',
          tr(
            'Il y a ' +
              racines(m).length +
              ' racines : ' +
              (m.organigramme
                ? "un organigramme part d'un seul élément, le projet ou le produit."
                : "un arbre de processus part d'un seul processus initial."),
            'There are ' +
              racines(m).length +
              ' roots: ' +
              (m.organigramme
                ? 'a breakdown chart starts from a single element, the project or the product.'
                : 'a process tree starts from a single initial process.'),
          ),
        ),
      );
    return res;
  }

  // Forme canonique d'un sous-arbre (fils triés, sauf si l'ordre compte)
  function canonique(m, n, options) {
    var fils = enfants(m, n.id).map(function (f) {
      return canonique(m, f, options);
    });
    if (!options.ordre) fils.sort();
    return '(' + (options.etiquettes ? N.cle(n.etiquette) : '') + fils.join('') + ')';
  }

  function taille(m) {
    return m.noeuds.length;
  }
  function profondeur(m) {
    var p = 0;
    (function parcourir(liste, d) {
      liste.forEach(function (n) {
        p = Math.max(p, d);
        parcourir(enfants(m, n.id), d + 1);
      });
    })(racines(m), 1);
    return p;
  }

  // Nombre de nœuds appariés entre deux sous-arbres (appariement glouton des fils)
  function communs(m1, a, m2, b, options) {
    if (options.etiquettes && N.cle(a.etiquette) !== N.cle(b.etiquette)) return 0;
    var f1 = enfants(m1, a.id),
      f2 = enfants(m2, b.id).slice(),
      total = 1;
    if (options.ordre) {
      for (var i = 0; i < Math.min(f1.length, f2.length); i++) total += communs(m1, f1[i], m2, f2[i], options);
      return total;
    }
    f1.forEach(function (x) {
      var meilleur = -1,
        score = 0;
      f2.forEach(function (y, k) {
        var s = communs(m1, x, m2, y, options);
        if (s > score) {
          score = s;
          meilleur = k;
        }
      });
      if (meilleur >= 0) {
        total += score;
        f2.splice(meilleur, 1);
      }
    });
    return total;
  }

  function comparer(m, sol, options) {
    if (!sol) return null;
    options = options || {};
    var re = racines(m),
      rs = racines(sol),
      ecarts = [];
    function compte(n) {
      return sol.organigramme
        ? N.pluriel(n, tr('élément', 'element'))
        : N.pluriel(n, tr('processus', 'process'), tr('processus', 'processes'));
    }
    if (!re.length)
      return {
        score: 0,
        ecarts: [ecart('manque', tr("L'arbre est vide.", 'The tree is empty.'))],
        resume: tr('Arbre vide.', 'Empty tree.'),
      };
    var cm = re
      .map(function (n) {
        return canonique(m, n, options);
      })
      .sort()
      .join('');
    var cs = rs
      .map(function (n) {
        return canonique(sol, n, options);
      })
      .sort()
      .join('');
    if (cm === cs)
      return {
        score: 1,
        ecarts: [],
        resume: tr(
          'Même arbre que la solution (' + compte(taille(sol)) + ').',
          'Same tree as the solution (' + compte(taille(sol)) + ').',
        ),
      };
    var nc = communs(m, re[0], sol, rs[0] || re[0], options);
    var score = (2 * nc) / (taille(m) + taille(sol));
    if (taille(m) !== taille(sol))
      ecarts.push(
        ecart(
          taille(m) < taille(sol) ? 'manque' : 'exces',
          tr(
            'La solution compte ' + compte(taille(sol)) + ", l'arbre dessiné " + taille(m) + '.',
            'The solution has ' + compte(taille(sol)) + ', the drawn tree ' + taille(m) + '.',
          ),
        ),
      );
    if (profondeur(m) !== profondeur(sol))
      ecarts.push(
        ecart(
          'different',
          tr(
            'La solution a ' +
              N.pluriel(profondeur(sol), 'niveau') +
              " de profondeur, l'arbre dessiné " +
              profondeur(m) +
              '.',
            'The solution is ' + N.pluriel(profondeur(sol), 'level') + ' deep, the drawn tree ' + profondeur(m) + '.',
          ),
        ),
      );
    var fs = enfants(sol, (rs[0] || {}).id).length,
      fe = enfants(m, re[0].id).length;
    if (fs !== fe)
      ecarts.push(
        ecart(
          'different',
          tr(
            (sol.organigramme ? 'La racine a ' : 'Le processus initial a ') +
              N.pluriel(fs, 'fils', 'fils') +
              ' dans la solution, ' +
              fe +
              " dans l'arbre dessiné.",
            (sol.organigramme ? 'The root has ' : 'The initial process has ') +
              N.pluriel(fs, 'child', 'children') +
              ' in the solution, ' +
              fe +
              ' in the drawn tree.',
          ),
          re[0].nom,
        ),
      );
    if (!ecarts.length)
      ecarts.push(
        ecart(
          'different',
          tr(
            "Même nombre d'éléments, mais pas la même forme d'arbre" +
              (options.etiquettes ? ' ou pas les mêmes étiquettes' : '') +
              '.',
            'Same number of elements, but not the same tree shape' +
              (options.etiquettes ? ' or not the same labels' : '') +
              '.',
          ),
        ),
      );
    return {
      score: Math.min(score, 0.95),
      ecarts: ecarts,
      resume: tr(
        Math.round(score * 100) + ' % de concordance avec la solution',
        Math.round(score * 100) + '% match with the solution',
      ),
    };
  }

  A.editeurs.processus = {
    nom: 'processus',
    // Options reconnues (champ « options » d'un atelier), vérifiées par outils/verifier.js
    options: {
      etiquettes: 'true : les étiquettes comptent dans la comparaison',
      ordre: "true : l'ordre des fils compte",
      organigramme: 'true : organigramme (WBS, PBS), dessiné en colonnes',
    },
    get libelle() {
      return tr('Arbre de processus', 'Process tree');
    },
    description:
      'Arbre de processus : un processus par ligne, les fils en retrait sous leur père, étiquette après « : ».',
    get aide() {
      return (
        tr(
          '<p>Un processus par ligne, ses fils en retrait (deux espaces) ; étiquette facultative après <code>:</code> :</p>',
          '<p>One process per line, its children indented (two spaces); optional label after <code>:</code>:</p>',
        ) + "<pre><code class='language-plaintext'>P1 : main\n  P2 : fork() = 0\n    P4\n  P3</code></pre>"
      );
    },
    vide: function (options) {
      return { noeuds: [], organigramme: Boolean(options && options.organigramme) };
    },
    lire: lire,
    ecrire: ecrire,
    controler: controler,
    comparer: comparer,
    enfants: enfants,
    racines: racines,
    cibles: function (m) {
      return ((m && m.noeuds) || []).map(function (n) {
        return n.nom;
      });
    },
    estVide: function (m) {
      return !m || !m.noeuds.length;
    },
  };
})(window.Atelier);
