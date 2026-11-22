/* ==========================================================================
   Atelier · éditeur « relationnel » : modèle relationnel (logique)
   --------------------------------------------------------------------------
   Syntaxe, celle du cours :
     Vendeurs(_id_, nom, #id_parrain(Vendeurs.id))
     Articles(_id_, nom, categorie, prix, date_vente, #id_vendeur(Vendeurs))
     Activite(_#id_mus_, _#id_orch_, date_debut)
   - une relation par ligne (elle peut continuer sur les lignes suivantes
     tant que la parenthèse n'est pas fermée) ;
   - clé primaire soulignée : _attribut_ ; clé étrangère : #attribut ;
   - référence entre parenthèses quand le nom ne suffit pas : (Table),
     (Table.colonne), ou (colonne) pour une colonne de la même relation ;
   - type facultatif : prix : numeric(6,2) ;
   - commentaires : « -- » en début de ligne, « // » ailleurs.
   L'ordre des relations compte : c'est celui de l'implémentation.
   ========================================================================== */
(function (A) {
  'use strict';

  var N = A.noyau,
    S = A.syntaxe,
    msg = N.message,
    ecart = N.ecart,
    tr = A.tr;

  /* Lecture -------------------------------------------------------------------- */

  function lireAttribut(brut, num, erreurs, nomRel) {
    var t = brut.trim(),
      type = null,
      ref = null;
    if (!t) {
      erreurs.push(
        S.erreur(
          num,
          tr(
            'Attribut vide dans « ' + nomRel + ' » : deux virgules de suite ?',
            'Empty attribute in “' + nomRel + '”: two commas in a row?',
          ),
        ),
      );
      return null;
    }
    var deux = S.indexHors(t, ':');
    if (deux >= 0) {
      type = t.slice(deux + 1).trim() || null;
      t = t.slice(0, deux).trim();
    }
    var m = t.match(/^([^()]*?)\s*\(([^()]*)\)$/);
    if (m) {
      t = m[1].trim();
      ref = m[2].trim();
    } else if (/[()]/.test(t)) {
      erreurs.push(
        S.erreur(
          num,
          tr(
            'Parenthèses mal placées dans « ' + brut.trim() + ' ».',
            'Misplaced parentheses in “' + brut.trim() + '”.',
          ),
        ),
      );
      return null;
    }
    var cle = false,
      etrangere = false;
    function souligne() {
      if (t.length > 2 && t[0] === '_' && t[t.length - 1] === '_') {
        cle = true;
        t = t.slice(1, -1);
      }
    }
    function diese() {
      if (t[0] === '#') {
        etrangere = true;
        t = t.slice(1).trim();
      }
    }
    souligne();
    diese();
    souligne();
    diese();
    if (!S.nomValide(t)) {
      erreurs.push(
        S.erreur(
          num,
          tr("Nom d'attribut invalide : « " + brut.trim() + ' ».', 'Invalid attribute name: “' + brut.trim() + '”.'),
        ),
      );
      return null;
    }
    var r = null;
    if (ref != null) {
      var p = ref.split('.').map(function (x) {
        return x.trim();
      });
      if (!ref || p.length > 2 || !p.every(S.nomValide)) {
        erreurs.push(
          S.erreur(
            num,
            tr(
              'Référence illisible : « (' + ref + ') ». Écrire (Table), (Table.colonne) ou (colonne).',
              'Unreadable reference: “(' + ref + ')”. Write (Table), (Table.column) or (column).',
            ),
          ),
        );
        return null;
      }
      r = p.length === 2 ? { table: p[0], colonne: p[1] } : { table: p[0], colonne: null };
    }
    return { nom: t, cle: cle, etrangere: etrangere, ref: r, type: type };
  }

  function lire(texte) {
    var erreurs = [],
      relations = [];
    var ls = S.lignes(texte),
      i = 0;
    while (i < ls.length) {
      var num = ls[i].num,
        t = ls[i].texte.replace(/^[-*•¡]\s+/, '');
      // Une relation peut continuer sur plusieurs lignes, jusqu'à la parenthèse fermante
      while (t.indexOf('(') >= 0 && !S.equilibre(t) && i + 1 < ls.length) {
        i++;
        t += ' ' + ls[i].texte;
      }
      i++;
      t = t.replace(/[;.,]\s*$/, '');
      var m = t.match(/^([^\s(]+)\s*\((.*)\)$/);
      if (!m) {
        erreurs.push(
          S.erreur(
            num,
            t.indexOf('(') < 0
              ? tr(
                  'Ligne illisible : « ' + t + ' ». Attendu : Nom(attribut, attribut, …).',
                  'Unreadable line: “' + t + '”. Expected: Name(attribute, attribute, …).',
                )
              : tr('Parenthèse fermante manquante dans « ' + t + ' ».', 'Missing closing parenthesis in “' + t + '”.'),
          ),
        );
        continue;
      }
      var nom = m[1];
      if (!S.nomValide(nom)) {
        erreurs.push(
          S.erreur(num, tr('Nom de relation invalide : « ' + nom + ' ».', 'Invalid relation name: “' + nom + '”.')),
        );
        continue;
      }
      var rel = { nom: nom, attributs: [], ligne: num };
      if (!m[2].trim())
        erreurs.push(
          S.erreur(
            num,
            tr('La relation « ' + nom + " » n'a aucun attribut.", 'The relation “' + nom + '” has no attribute.'),
          ),
        );
      else
        S.decouper(m[2], ',').forEach(function (brut) {
          var a = lireAttribut(brut, num, erreurs, nom);
          if (a) rel.attributs.push(a);
        });
      relations.push(rel);
    }
    return { modele: { relations: relations }, erreurs: erreurs };
  }

  /* Écriture --------------------------------------------------------------------- */

  function ecrireAttribut(a) {
    var t = (a.etrangere ? '#' : '') + a.nom;
    if (a.cle) t = '_' + t + '_';
    if (a.ref) t += '(' + a.ref.table + (a.ref.colonne ? '.' + a.ref.colonne : '') + ')';
    if (a.type) t += ' : ' + a.type;
    return t;
  }
  function ecrire(m) {
    return ((m && m.relations) || [])
      .map(function (r) {
        return r.nom + '(' + r.attributs.map(ecrireAttribut).join(', ') + ')';
      })
      .join('\n');
  }

  /* Résolution des clés étrangères ------------------------------------------------- */

  function egal(a, b) {
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
  function trouverRelation(m, nom) {
    return (
      m.relations.find(function (r) {
        return egal(r.nom, nom);
      }) ||
      m.relations.find(function (r) {
        return N.cle(r.nom) === N.cle(nom);
      }) ||
      null
    );
  }
  function clesPrimaires(r) {
    return r.attributs.filter(function (a) {
      return a.cle;
    });
  }

  // Relation et colonne visées par une clé étrangère :
  // { cible, colonne, statut: ok | table-inconnue | colonne-inconnue | colonne-ambigue | introuvable | ambigue | pas-cle }
  function resoudre(m, rel, att) {
    if (!att.etrangere && !att.ref) return null;
    var res = { cible: null, colonne: null, statut: 'ok' };
    if (att.ref) {
      var t = trouverRelation(m, att.ref.table);
      if (!t && !att.ref.colonne) {
        // (colonne) : colonne de la même relation, notation du cours « #id_parrain(id) »
        var col = rel.attributs.find(function (a) {
          return a !== att && egal(a.nom, att.ref.table);
        });
        if (!col) {
          res.statut = 'table-inconnue';
          return res;
        }
        res.cible = rel;
        res.colonne = col;
      } else if (!t) {
        res.statut = 'table-inconnue';
        return res;
      } else {
        res.cible = t;
        if (att.ref.colonne) {
          res.colonne =
            t.attributs.find(function (a) {
              return egal(a.nom, att.ref.colonne);
            }) || null;
          if (!res.colonne) {
            res.statut = 'colonne-inconnue';
            return res;
          }
        } else {
          var pk = clesPrimaires(t);
          res.colonne =
            pk.length === 1
              ? pk[0]
              : pk.find(function (a) {
                  return egal(a.nom, att.nom);
                }) || null;
          if (!res.colonne) {
            res.statut = 'colonne-ambigue';
            return res;
          }
        }
      }
    } else {
      // Par le nom : une clé étrangère vise une clé primaire entière, donc d'abord les relations dont la
      // clé est ce seul attribut (les tables d'association, dont la clé le contient, ne comptent pas) ;
      // à défaut, une clé composée qui contient l'attribut sans qu'il y soit lui-même une clé étrangère
      var candidats = m.relations.filter(function (r) {
        var pk = clesPrimaires(r);
        return pk.length === 1 && pk[0] !== att && egal(pk[0].nom, att.nom) && !(r === rel && pk[0].etrangere);
      });
      if (!candidats.length)
        candidats = m.relations.filter(function (r) {
          return (
            r !== rel &&
            r.attributs.some(function (a) {
              return a.cle && !a.etrangere && egal(a.nom, att.nom);
            })
          );
        });
      if (candidats.length !== 1) {
        res.statut = candidats.length ? 'ambigue' : 'introuvable';
        res.candidats = candidats;
        return res;
      }
      res.cible = candidats[0];
      res.colonne = candidats[0].attributs.find(function (a) {
        return a.cle && egal(a.nom, att.nom);
      });
    }
    if (res.colonne && !res.colonne.cle) res.statut = 'pas-cle';
    return res;
  }

  /* Contrôles ---------------------------------------------------------------------- */

  function controler(m, options) {
    options = options || {};
    var res = [];
    if (!m || !m.relations.length) return [msg('info', tr("Aucune relation pour l'instant.", 'No relation yet.'))];
    var vus = {};
    m.relations.forEach(function (r, ir) {
      var k = r.nom.toLowerCase();
      if (vus[k])
        res.push(
          msg(
            'erreur',
            tr(
              'La relation « ' + r.nom + ' » est définie deux fois.',
              'The relation “' + r.nom + '” is defined twice.',
            ),
            r.nom,
          ),
        );
      vus[k] = true;
      var noms = {};
      r.attributs.forEach(function (a) {
        var ka = a.nom.toLowerCase();
        if (noms[ka])
          res.push(
            msg(
              'erreur',
              tr(
                "L'attribut « " + a.nom + ' » apparaît deux fois dans « ' + r.nom + ' ».',
                'The attribute “' + a.nom + '” appears twice in “' + r.nom + '”.',
              ),
              r.nom + '.' + a.nom,
            ),
          );
        noms[ka] = true;
      });
      if (!clesPrimaires(r).length) {
        res.push(
          msg(
            'erreur',
            tr(
              '« ' + r.nom + " » n'a pas de clé primaire : souligner au moins un attribut (_attribut_).",
              '“' + r.nom + '” has no primary key: underline at least one attribute (_attribute_).',
            ),
            r.nom,
          ),
        );
      }
      r.attributs.forEach(function (a) {
        var x = resoudre(m, r, a);
        if (!x) return;
        var c = r.nom + '.' + a.nom,
          nomA = tr('« ' + a.nom + ' » (' + r.nom + ')', '“' + a.nom + '” (' + r.nom + ')');
        if (a.ref && !a.etrangere)
          res.push(
            msg(
              'attention',
              tr(
                nomA + " a une référence mais pas de # : si c'est une clé étrangère, écrire #" + a.nom + '.',
                nomA + ' has a reference but no #: if it is a foreign key, write #' + a.nom + '.',
              ),
              c,
            ),
          );
        switch (x.statut) {
          case 'table-inconnue':
            res.push(
              msg(
                'erreur',
                tr(
                  nomA + ' fait référence à « ' + a.ref.table + " », qui n'est pas une relation du modèle.",
                  nomA + ' refers to “' + a.ref.table + '”, which is not a relation of the model.',
                ),
                c,
              ),
            );
            break;
          case 'colonne-inconnue':
            res.push(
              msg(
                'erreur',
                tr(
                  nomA + ' fait référence à « ' + a.ref.table + '.' + a.ref.colonne + " », qui n'existe pas.",
                  nomA + ' refers to “' + a.ref.table + '.' + a.ref.colonne + '”, which does not exist.',
                ),
                c,
              ),
            );
            break;
          case 'colonne-ambigue':
            res.push(
              msg(
                'erreur',
                tr(
                  nomA +
                    ' : la clé primaire de « ' +
                    x.cible.nom +
                    ' » est composée ; préciser la colonne visée, (' +
                    x.cible.nom +
                    '.colonne).',
                  nomA +
                    ': the primary key of “' +
                    x.cible.nom +
                    '” is composite; specify the target column, (' +
                    x.cible.nom +
                    '.column).',
                ),
                c,
              ),
            );
            break;
          case 'introuvable':
            res.push(
              msg(
                'erreur',
                tr(
                  nomA +
                    " : aucune relation n'a de clé primaire nommée « " +
                    a.nom +
                    ' ». Quand le nom diffère, préciser la table entre parenthèses : #' +
                    a.nom +
                    '(Table).',
                  nomA +
                    ': no relation has a primary key named “' +
                    a.nom +
                    '”. When the name differs, give the table in parentheses: #' +
                    a.nom +
                    '(Table).',
                ),
                c,
              ),
            );
            break;
          case 'ambigue':
            res.push(
              msg(
                'attention',
                tr(
                  nomA +
                    ' peut viser plusieurs relations (' +
                    x.candidats
                      .map(function (t) {
                        return t.nom;
                      })
                      .join(', ') +
                    ') : préciser la table entre parenthèses.',
                  nomA +
                    ' may target several relations (' +
                    x.candidats
                      .map(function (t) {
                        return t.nom;
                      })
                      .join(', ') +
                    '): give the table in parentheses.',
                ),
                c,
              ),
            );
            break;
          case 'pas-cle':
            res.push(
              msg(
                'attention',
                tr(
                  nomA +
                    ' fait référence à « ' +
                    x.cible.nom +
                    '.' +
                    x.colonne.nom +
                    " », qui n'est pas la clé primaire de « " +
                    x.cible.nom +
                    ' ».',
                  nomA +
                    ' refers to “' +
                    x.cible.nom +
                    '.' +
                    x.colonne.nom +
                    '”, which is not the primary key of “' +
                    x.cible.nom +
                    '”.',
                ),
                c,
              ),
            );
            break;
        }
        if (x.cible && x.cible !== r && options.ordre !== false && m.relations.indexOf(x.cible) > ir) {
          res.push(
            msg(
              'attention',
              tr(
                '« ' +
                  r.nom +
                  ' » fait référence à « ' +
                  x.cible.nom +
                  " », déclarée plus bas : l'ordre des relations doit suivre celui de l'implémentation (une table référencée est créée avant).",
                '“' +
                  r.nom +
                  '” refers to “' +
                  x.cible.nom +
                  '”, declared further down: relations must follow the implementation order (a referenced table is created first).',
              ),
              c,
            ),
          );
        }
      });
    });
    return res;
  }

  /* Comparaison avec la solution ----------------------------------------------------- */

  function similarite(a, b) {
    var x = new Set(
      a.attributs.map(function (t) {
        return N.cle(t.nom);
      }),
    );
    var y = new Set(
      b.attributs.map(function (t) {
        return N.cle(t.nom);
      }),
    );
    var inter = 0;
    x.forEach(function (k) {
      if (y.has(k)) inter++;
    });
    return x.size + y.size ? inter / (x.size + y.size - inter) : 0;
  }

  // Poids des faits dans le score : les clés, et surtout les clés étrangères, sont l'essentiel d'une traduction
  var POIDS = { R: 1, A: 1, K: 2, F: 4 };

  // Faits d'un modèle ; nomDe(relation) donne le nom commun (celui de la solution quand il y a appariement),
  // alias (facultatif) le nom commun d'un attribut (clé étrangère nommée autrement que dans la solution)
  function faits(m, nomDe, alias) {
    var f = [];
    m.relations.forEach(function (r) {
      var rn = nomDe(r);
      f.push('R|' + rn);
      r.attributs.forEach(function (a) {
        var an = alias && alias.has(a) ? alias.get(a) : N.cle(a.nom);
        f.push('A|' + rn + '|' + an);
        if (a.cle) f.push('K|' + rn + '|' + an);
        var x = resoudre(m, r, a);
        if (x) f.push('F|' + rn + '|' + an + '|' + (x.cible ? nomDe(x.cible) : '?'));
      });
    });
    return f;
  }

  function comparer(m, sol) {
    if (!sol) return null;
    var ap = N.apparier(
      m.relations,
      sol.relations,
      function (r) {
        return r.nom;
      },
      similarite,
    );
    var nomEtudiant = new Map(),
      nomSolution = new Map(),
      ecarts = [];
    ap.paires.forEach(function (p) {
      nomEtudiant.set(p[0], N.cle(p[1].nom));
      if (N.cle(p[0].nom) !== N.cle(p[1].nom)) {
        ecarts.push(
          ecart(
            'different',
            tr(
              '« ' + p[0].nom + ' » correspond à « ' + p[1].nom + ' » dans la solution (nom différent).',
              '“' + p[0].nom + '” matches “' + p[1].nom + '” in the solution (different name).',
            ),
            p[0].nom,
          ),
        );
      }
    });
    ap.seulsA.forEach(function (r) {
      nomEtudiant.set(r, '!' + N.cle(r.nom));
    });
    sol.relations.forEach(function (r) {
      nomSolution.set(r, N.cle(r.nom));
    });

    // Le nom d'une clé étrangère est libre : dans deux relations appariées, une clé étrangère de
    // l'étudiant qui vise la même relation qu'une clé étrangère de la solution de nom différent prend ce nom
    var alias = new Map();
    ap.paires.forEach(function (p) {
      var re = p[0],
        rs = p[1];
      var nomsS = new Set(
        rs.attributs.map(function (a) {
          return N.cle(a.nom);
        }),
      );
      var nomsE = new Set(
        re.attributs.map(function (a) {
          return N.cle(a.nom);
        }),
      );
      var libresS = rs.attributs.filter(function (a) {
        var x = resoudre(sol, rs, a);
        return x && x.cible && !nomsE.has(N.cle(a.nom));
      });
      re.attributs.forEach(function (a) {
        if (nomsS.has(N.cle(a.nom))) return;
        var x = resoudre(m, re, a);
        if (!x || !x.cible) return;
        var cible = nomEtudiant.get(x.cible);
        var i = libresS.findIndex(function (b) {
          return nomSolution.get(resoudre(sol, rs, b).cible) === cible;
        });
        if (i < 0) return;
        alias.set(a, N.cle(libresS[i].nom));
        libresS.splice(i, 1);
      });
    });

    var fe = faits(
      m,
      function (r) {
        return nomEtudiant.get(r);
      },
      alias,
    );
    var fs = faits(sol, function (r) {
      return nomSolution.get(r);
    });
    var res = N.f1(fe, fs, POIDS);

    // Libellés lisibles
    var parCle = {};
    sol.relations.forEach(function (r) {
      parCle[N.cle(r.nom)] = r;
    });
    var etuParCle = {};
    m.relations.forEach(function (r) {
      etuParCle[nomEtudiant.get(r)] = r;
    });
    function nomSol(k) {
      return parCle[k] ? parCle[k].nom : k;
    }
    function nomEtu(k) {
      return etuParCle[k] ? etuParCle[k].nom : k.replace(/^!/, '');
    }
    function attr(r, k) {
      var a =
        r &&
        r.attributs.find(function (x) {
          return (alias.has(x) ? alias.get(x) : N.cle(x.nom)) === k;
        });
      return a ? a.nom : k;
    }
    var aManquer = new Set(res.manquants),
      enTrop = new Set(res.exces);

    res.manquants.forEach(function (f) {
      var p = f.split('|'),
        rs = parCle[p[1]],
        re = etuParCle[p[1]];
      if (p[0] === 'R')
        ecarts.push(
          ecart(
            'manque',
            tr('Il manque une relation : « ' + nomSol(p[1]) + ' ».', 'A relation is missing: “' + nomSol(p[1]) + '”.'),
            null,
          ),
        );
      else if (p[0] === 'A' && !aManquer.has('R|' + p[1]))
        ecarts.push(
          ecart(
            'manque',
            tr(
              "Il manque l'attribut « " + attr(rs, p[2]) + ' » dans « ' + nomEtu(p[1]) + ' ».',
              'The attribute “' + attr(rs, p[2]) + '” is missing in “' + nomEtu(p[1]) + '”.',
            ),
            nomEtu(p[1]),
          ),
        );
      else if (p[0] === 'K' && !aManquer.has('A|' + p[1] + '|' + p[2]))
        ecarts.push(
          ecart(
            'different',
            tr(
              '« ' + attr(re, p[2]) + ' » devrait faire partie de la clé primaire de « ' + nomEtu(p[1]) + ' ».',
              '“' + attr(re, p[2]) + '” should be part of the primary key of “' + nomEtu(p[1]) + '”.',
            ),
            nomEtu(p[1]) + '.' + attr(re, p[2]),
          ),
        );
      else if (p[0] === 'F' && !aManquer.has('A|' + p[1] + '|' + p[2])) {
        var autre = res.exces.find(function (x) {
          return x.indexOf('F|' + p[1] + '|' + p[2] + '|') === 0;
        });
        ecarts.push(
          ecart(
            autre ? 'different' : 'manque',
            tr(
              '« ' +
                attr(re, p[2]) +
                ' » (' +
                nomEtu(p[1]) +
                ') devrait être une clé étrangère vers « ' +
                nomSol(p[3]) +
                ' »' +
                (autre ? ', et non vers « ' + nomEtu(autre.split('|')[3]) + ' ».' : '.'),
              '“' +
                attr(re, p[2]) +
                '” (' +
                nomEtu(p[1]) +
                ') should be a foreign key to “' +
                nomSol(p[3]) +
                '”' +
                (autre ? ', not to “' + nomEtu(autre.split('|')[3]) + '”.' : '.'),
            ),
            nomEtu(p[1]) + '.' + attr(re, p[2]),
          ),
        );
      }
    });
    res.exces.forEach(function (f) {
      var p = f.split('|'),
        re = etuParCle[p[1]];
      if (p[0] === 'R')
        ecarts.push(
          ecart(
            'exces',
            tr(
              'La relation « ' + nomEtu(p[1]) + " » n'apparaît pas dans la solution.",
              'The relation “' + nomEtu(p[1]) + '” does not appear in the solution.',
            ),
            nomEtu(p[1]),
          ),
        );
      else if (p[0] === 'A' && !enTrop.has('R|' + p[1]))
        ecarts.push(
          ecart(
            'exces',
            tr(
              "L'attribut « " + attr(re, p[2]) + ' » de « ' + nomEtu(p[1]) + " » n'apparaît pas dans la solution.",
              'The attribute “' + attr(re, p[2]) + '” of “' + nomEtu(p[1]) + '” does not appear in the solution.',
            ),
            nomEtu(p[1]) + '.' + attr(re, p[2]),
          ),
        );
      else if (p[0] === 'K' && !enTrop.has('A|' + p[1] + '|' + p[2]))
        ecarts.push(
          ecart(
            'different',
            tr(
              '« ' +
                attr(re, p[2]) +
                ' » ne fait pas partie de la clé primaire de « ' +
                nomEtu(p[1]) +
                ' » dans la solution.',
              '“' + attr(re, p[2]) + '” is not part of the primary key of “' + nomEtu(p[1]) + '” in the solution.',
            ),
            nomEtu(p[1]) + '.' + attr(re, p[2]),
          ),
        );
      else if (
        p[0] === 'F' &&
        !enTrop.has('A|' + p[1] + '|' + p[2]) &&
        !aManquer.has('A|' + p[1] + '|' + p[2]) &&
        !res.manquants.some(function (x) {
          return x.indexOf('F|' + p[1] + '|' + p[2] + '|') === 0;
        })
      ) {
        ecarts.push(
          ecart(
            'exces',
            tr(
              '« ' + attr(re, p[2]) + ' » (' + nomEtu(p[1]) + ") n'est pas une clé étrangère dans la solution.",
              '“' + attr(re, p[2]) + '” (' + nomEtu(p[1]) + ') is not a foreign key in the solution.',
            ),
            nomEtu(p[1]) + '.' + attr(re, p[2]),
          ),
        );
      }
    });
    return { score: res.score, ecarts: ecarts, resume: resumeScore(res.score, ecarts.length) };
  }

  function resumeScore(score, n) {
    if (score === 1 && !n) return tr('Identique à la solution proposée.', 'Identical to the proposed solution.');
    return tr(
      Math.round(score * 100) + ' % de concordance avec la solution · ' + N.pluriel(n, 'écart'),
      Math.round(score * 100) + '% match with the solution · ' + N.pluriel(n, 'difference'),
    );
  }

  function cibles(m) {
    var t = [];
    ((m && m.relations) || []).forEach(function (r) {
      t.push(r.nom);
      r.attributs.forEach(function (a) {
        t.push(r.nom + '.' + a.nom);
      });
    });
    return t;
  }

  A.editeurs.relationnel = {
    nom: 'relationnel',
    // Options reconnues (champ « options » d'un atelier), vérifiées par outils/verifier.js
    options: {
      ordre: 'false : ne pas signaler une clé étrangère vers une relation définie plus bas',
    },
    get libelle() {
      return tr('Modèle relationnel', 'Relational model');
    },
    description:
      'Modèle relationnel, une relation par ligne : clé primaire soulignée (_attribut_), clé étrangère préfixée par # avec la table visée entre parenthèses si besoin.',
    get aide() {
      return tr(
        '<p>Une relation par ligne : <code>Nom(attribut, attribut, …)</code>.</p>' +
          '<ul><li>Clé primaire soulignée : <code>_id_</code> ; clé primaire composée : <code>_#id_mus_, _#id_orch_</code>.</li>' +
          '<li>Clé étrangère : <code>#id_race</code>. Si son nom diffère de la clé visée, préciser la table : <code>#id_parrain(Vendeurs)</code> ou <code>#id_parrain(Vendeurs.id)</code>.</li>' +
          '<li>Type facultatif : <code>prix : numeric(6,2)</code>. Commentaire : <code>-- …</code> en début de ligne.</li>' +
          "<li>L'ordre des lignes est celui de l'implémentation : une relation référencée vient avant.</li></ul>",
        '<p>One relation per line: <code>Name(attribute, attribute, …)</code>.</p>' +
          '<ul><li>Underlined primary key: <code>_id_</code>; composite primary key: <code>_#id_mus_, _#id_orch_</code>.</li>' +
          '<li>Foreign key: <code>#id_race</code>. If its name differs from the target key, give the table: <code>#id_parrain(Vendeurs)</code> or <code>#id_parrain(Vendeurs.id)</code>.</li>' +
          '<li>Optional type: <code>prix : numeric(6,2)</code>. Comment: <code>-- …</code> at the start of a line.</li>' +
          '<li>Lines follow the implementation order: a referenced relation comes first.</li></ul>',
      );
    },
    vide: function () {
      return { relations: [] };
    },
    lire: lire,
    ecrire: ecrire,
    controler: controler,
    comparer: comparer,
    resoudre: resoudre,
    cibles: cibles,
    estVide: function (m) {
      return !m || !m.relations.length;
    },
  };
})(window.Atelier);
