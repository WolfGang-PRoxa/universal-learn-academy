/* ==========================================================================
   Atelier · vue « relationnel » : modèle relationnel (interface)
   --------------------------------------------------------------------------
   Une ligne par relation, dans la notation du cours : nom, puis attributs
   en pastilles (clé primaire soulignée, clé étrangère préfixée par # avec
   la relation visée). Cliquer une pastille ou un nom ouvre son formulaire ;
   « + » ajoute un attribut ; ↑ ↓ changent l'ordre des relations (celui de
   l'implémentation). Survoler une clé étrangère éclaire la relation visée.
   ========================================================================== */
(function (A) {
  'use strict';

  var N = A.noyau,
    el = N.el,
    tr = A.tr;
  function E() {
    return A.editeurs.relationnel;
  }

  function creer(conteneur, ctx) {
    var m = null,
      ro = ctx.lectureSeule,
      derniers = null;
    var racine = el('div', 'atelier-relationnel' + (ro ? ' lecture' : ''));
    var liste = el('div', 'rel-liste');
    racine.appendChild(liste);
    conteneur.appendChild(racine);

    function modifie() {
      dessiner();
      ctx.modifie(m, true);
    }

    function dessiner() {
      liste.innerHTML = '';
      if (!m) return;
      if (!m.relations.length)
        liste.appendChild(
          el(
            'p',
            'rel-vide',
            tr(
              ro ? 'Aucune relation.' : 'Aucune relation : « + Relation » pour commencer, ou écrire dans la vue texte.',
              ro ? 'No relation.' : 'No relation: “+ Relation” to start, or write in the text view.',
            ),
          ),
        );
      m.relations.forEach(function (r, ir) {
        var ligne = el('div', 'rel-relation');
        ligne.setAttribute('data-relation', r.nom);
        if (!ro) {
          var ordre = el('span', 'rel-ordre');
          var haut = N.bouton(
            '↑',
            'atelier-mini',
            function () {
              deplacer(ir, -1);
            },
            tr('Monter « ' + r.nom + ' »', 'Move “' + r.nom + '” up'),
          );
          var bas = N.bouton(
            '↓',
            'atelier-mini',
            function () {
              deplacer(ir, 1);
            },
            tr('Descendre « ' + r.nom + ' »', 'Move “' + r.nom + '” down'),
          );
          haut.disabled = ir === 0;
          bas.disabled = ir === m.relations.length - 1;
          ordre.appendChild(haut);
          ordre.appendChild(bas);
          ligne.appendChild(ordre);
        }
        var nom = el(ro ? 'span' : 'button', 'rel-nom', r.nom);
        if (!ro) {
          nom.type = 'button';
          nom.title = tr('Renommer ou supprimer la relation', 'Rename or delete the relation');
          nom.addEventListener('click', function (e) {
            editerRelation(ir, e);
          });
        } else
          nom.addEventListener('click', function (e) {
            if (ctx.surClicElement) ctx.surClicElement(r.nom, e);
          });
        ligne.appendChild(nom);
        ligne.appendChild(el('span', 'rel-parenthese', '('));
        var attrs = el('span', 'rel-attributs');
        r.attributs.forEach(function (a, ia) {
          if (ia) attrs.appendChild(el('span', 'rel-virgule', ','));
          var p = el(ro ? 'span' : 'button', 'rel-attr' + (a.cle ? ' cle' : '') + (a.etrangere ? ' etrangere' : ''));
          if (!ro) p.type = 'button';
          p.setAttribute('data-cible', r.nom + '.' + a.nom);
          var texte = el('span', 'rel-attr-nom', (a.etrangere ? '#' : '') + a.nom);
          p.appendChild(texte);
          var x = E().resoudre(m, r, a);
          if (x) {
            var visee = x.cible
              ? x.cible.nom + (x.colonne && x.colonne.nom !== a.nom ? '.' + x.colonne.nom : '')
              : a.ref
                ? a.ref.table
                : '?';
            p.appendChild(el('span', 'rel-attr-ref' + (x.statut === 'ok' ? '' : ' douteuse'), '→ ' + visee));
            if (x.cible) {
              p.addEventListener('mouseenter', function () {
                eclairer(x.cible.nom, true);
              });
              p.addEventListener('mouseleave', function () {
                eclairer(x.cible.nom, false);
              });
            }
          }
          if (a.type) p.appendChild(el('span', 'rel-attr-type', a.type));
          p.title = tr(
            (a.cle ? 'Clé primaire. ' : '') +
              (a.etrangere ? 'Clé étrangère. ' : '') +
              (ro ? '' : 'Cliquer pour modifier.'),
            (a.cle ? 'Primary key. ' : '') + (a.etrangere ? 'Foreign key. ' : '') + (ro ? '' : 'Click to edit.'),
          );
          if (!ro)
            p.addEventListener('click', function (e) {
              editerAttribut(ir, ia, e);
            });
          else
            p.addEventListener('click', function (e) {
              if (ctx.surClicElement) ctx.surClicElement(r.nom + '.' + a.nom, e);
            });
          attrs.appendChild(p);
        });
        if (!ro) {
          var plus = N.bouton(
            '+',
            'rel-ajout',
            function (e) {
              ajouterAttribut(ir, e);
            },
            tr('Ajouter un attribut à « ' + r.nom + ' »', 'Add an attribute to “' + r.nom + '”'),
          );
          attrs.appendChild(plus);
        }
        ligne.appendChild(attrs);
        ligne.appendChild(el('span', 'rel-parenthese', ')'));
        liste.appendChild(ligne);
      });
      if (derniers) appliquer(derniers);
    }

    function eclairer(nom, oui) {
      liste.querySelectorAll('.rel-relation').forEach(function (l) {
        if (l.getAttribute('data-relation') === nom) l.classList.toggle('visee', oui);
      });
    }
    function deplacer(i, sens) {
      var j = i + sens;
      if (j < 0 || j >= m.relations.length) return;
      var t = m.relations[i];
      m.relations[i] = m.relations[j];
      m.relations[j] = t;
      modifie();
    }
    function nomLibre(base, existe) {
      var i = 1;
      while (existe(base + i)) i++;
      return base + i;
    }
    function ajouterRelation() {
      var nom = nomLibre('Relation', function (n) {
        return m.relations.some(function (r) {
          return r.nom === n;
        });
      });
      m.relations.push({ nom: nom, attributs: [{ nom: 'id', cle: true, etrangere: false, ref: null, type: null }] });
      modifie();
      editerRelation(m.relations.length - 1);
    }
    function ajouterAttribut(ir, e) {
      var r = m.relations[ir];
      var nom = nomLibre(tr('attribut', 'attribute'), function (n) {
        return r.attributs.some(function (a) {
          return a.nom === n;
        });
      });
      r.attributs.push({ nom: nom, cle: false, etrangere: false, ref: null, type: null });
      modifie();
      editerAttribut(ir, r.attributs.length - 1, e);
    }
    function position(e, selecteur) {
      if (e && e.clientX) return { x: e.clientX + 6, y: e.clientY + 12 };
      var cible = selecteur && liste.querySelector(selecteur);
      if (!cible) return {};
      var b = cible.getBoundingClientRect();
      return { x: b.left, y: b.bottom + 6 };
    }
    function editerRelation(ir, e) {
      var r = m.relations[ir],
        pos = position(e, '[data-relation="' + CSS.escape(r.nom) + '"] .rel-nom');
      A.formulaire.ouvrir(racine, {
        x: pos.x,
        y: pos.y,
        titre: 'Relation',
        champs: [{ nom: 'nom', libelle: tr('Nom', 'Name'), valeur: r.nom }],
        surValider: function (v) {
          var nom = v.nom.trim();
          if (!A.syntaxe.nomValide(nom))
            return tr('Nom invalide : lettres, chiffres et _ seulement.', 'Invalid name: letters, digits and _ only.');
          if (
            nom !== r.nom &&
            m.relations.some(function (x) {
              return x.nom === nom;
            })
          )
            return tr(
              "Une autre relation s'appelle déjà « " + nom + ' ».',
              'Another relation is already called “' + nom + '”.',
            );
          var ancien = r.nom;
          r.nom = nom;
          m.relations.forEach(function (x) {
            x.attributs.forEach(function (a) {
              if (a.ref && a.ref.table === ancien) a.ref.table = nom;
            });
          });
          modifie();
        },
        surSupprimer: function () {
          m.relations.splice(ir, 1);
          modifie();
        },
      });
    }
    function editerAttribut(ir, ia, e) {
      var r = m.relations[ir],
        a = r.attributs[ia];
      var pos = position(e, '[data-cible="' + CSS.escape(r.nom + '.' + a.nom) + '"]');
      var tables = [['', tr('(déduite du nom)', '(deduced from the name)')]].concat(
        m.relations.map(function (x) {
          return [x.nom, x.nom];
        }),
      );
      A.formulaire.ouvrir(racine, {
        x: pos.x,
        y: pos.y,
        titre: tr('Attribut de « ' + r.nom + ' »', 'Attribute of “' + r.nom + '”'),
        champs: [
          { nom: 'nom', libelle: tr('Nom', 'Name'), valeur: a.nom },
          {
            nom: 'cle',
            libelle: tr('Fait partie de la clé primaire (souligné)', 'Part of the primary key (underlined)'),
            type: 'case',
            valeur: a.cle,
          },
          { nom: 'etrangere', libelle: tr('Clé étrangère (#)', 'Foreign key (#)'), type: 'case', valeur: a.etrangere },
          {
            nom: 'table',
            libelle: tr('Relation visée', 'Target relation'),
            type: 'choix',
            valeur: a.ref ? a.ref.table : '',
            options: tables,
          },
          {
            nom: 'colonne',
            libelle: tr("Colonne visée (si ce n'est pas la clé)", 'Target column (if not the key)'),
            valeur: (a.ref && a.ref.colonne) || '',
          },
          {
            nom: 'type',
            libelle: tr('Type (facultatif)', 'Type (optional)'),
            valeur: a.type || '',
            placeholder: 'varchar(50)',
          },
        ],
        actions: [
          {
            libelle: tr('← Déplacer', '← Move'),
            action: function () {
              bouger(r, ia, -1);
            },
          },
          {
            libelle: tr('Déplacer →', 'Move →'),
            action: function () {
              bouger(r, ia, 1);
            },
          },
        ],
        surValider: function (v) {
          var nom = v.nom.trim();
          if (!A.syntaxe.nomValide(nom))
            return tr('Nom invalide : lettres, chiffres et _ seulement.', 'Invalid name: letters, digits and _ only.');
          if (
            nom !== a.nom &&
            r.attributs.some(function (x) {
              return x.nom === nom;
            })
          )
            return tr(
              '« ' + r.nom + ' » a déjà un attribut « ' + nom + ' ».',
              '“' + r.nom + '” already has an attribute “' + nom + '”.',
            );
          a.nom = nom;
          a.cle = v.cle;
          a.etrangere = v.etrangere || Boolean(v.table);
          a.ref = v.table ? { table: v.table, colonne: v.colonne.trim() || null } : null;
          a.type = v.type.trim() || null;
          modifie();
        },
        surSupprimer: function () {
          r.attributs.splice(ia, 1);
          modifie();
        },
      });
    }
    function bouger(r, ia, sens) {
      var j = ia + sens;
      if (j < 0 || j >= r.attributs.length) return;
      A.formulaire.fermer(false);
      var t = r.attributs[ia];
      r.attributs[ia] = r.attributs[j];
      r.attributs[j] = t;
      modifie();
    }
    function appliquer(lst) {
      liste.querySelectorAll('.surligne').forEach(function (e) {
        e.className = e.className.replace(/\s*surligne(-\S+)?/g, '');
      });
      lst.forEach(function (s) {
        var t = String(s.cible || '').toLowerCase(),
          els;
        if (t.indexOf('.') > 0)
          els = Array.prototype.filter.call(liste.querySelectorAll('[data-cible]'), function (e) {
            return e.getAttribute('data-cible').toLowerCase() === t;
          });
        else
          els = Array.prototype.filter.call(liste.querySelectorAll('[data-relation]'), function (e) {
            return e.getAttribute('data-relation').toLowerCase() === t;
          });
        els.forEach(function (e) {
          e.classList.add('surligne', 'surligne-' + (s.classe || 'info'));
        });
      });
    }

    return {
      afficher: function (modele) {
        m = modele;
        dessiner();
      },
      outils: function () {
        return ro
          ? []
          : [N.bouton('+ Relation', 'petit', ajouterRelation, tr('Ajouter une relation', 'Add a relation'))];
      },
      surligner: function (lst) {
        derniers = lst;
        appliquer(lst);
      },
      effacerSurlignage: function () {
        derniers = null;
        appliquer([]);
      },
      focus: function () {
        var b = racine.querySelector('button');
        if (b) b.focus();
      },
    };
  }

  // Rendu statique : le composant « relations » de la charte
  function statique(modele) {
    var d = el('div', 'relations');
    (modele.relations || []).forEach(function (r) {
      var p = el('p');
      p.appendChild(el('b', null, r.nom));
      p.appendChild(document.createTextNode('('));
      r.attributs.forEach(function (a, i) {
        if (i) p.appendChild(document.createTextNode(', '));
        var t =
          (a.etrangere ? '#' : '') +
          a.nom +
          (a.ref ? '(' + a.ref.table + (a.ref.colonne ? '.' + a.ref.colonne : '') + ')' : '');
        p.appendChild(a.cle ? el('u', null, t) : document.createTextNode(t));
      });
      p.appendChild(document.createTextNode(')'));
      d.appendChild(p);
    });
    return d;
  }

  A.vues.relationnel = {
    creer: creer,
    statique: statique,
    get libelleVue() {
      return A.tr('Liste', 'List');
    },
  };
})(window.Atelier);
