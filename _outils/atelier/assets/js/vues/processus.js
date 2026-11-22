/* ==========================================================================
   Atelier · vue « processus » : arbre de processus (interface)
   --------------------------------------------------------------------------
   Arbre dessiné de haut en bas, placé automatiquement. Édition : choisir un
   processus puis « + Fils », « + Frère », « ← », « → » (ordre des fils) ;
   double-clic pour renommer ou étiqueter ; Suppr retire le processus et sa
   descendance. Sans processus, « + Fils » crée la racine. Organigramme : la
   racine en haut, une colonne par fils, leurs descendants en liste dessous.
   ========================================================================== */
(function (A) {
  'use strict';

  var N = A.noyau,
    tr = A.tr;
  var H = 34;

  function taille(n) {
    var l = Math.max(
      N.largeurTexte(n.nom, N.police('--police-texte', 14, 650)),
      n.etiquette ? N.largeurTexte(n.etiquette, N.police('--police-code', 11.5, 400)) : 0,
    );
    return { l: Math.max(56, Math.ceil(l) + 22), h: H };
  }
  function E() {
    return A.editeurs.processus;
  }

  // Un organigramme est large et ses noms sont longs : en colonnes, il reste lisible
  function colonnes(m) {
    var pos = new Map(),
      x = 0;
    E()
      .racines(m)
      .forEach(function (r) {
        var depart = x,
          t = taille(r);
        E()
          .enfants(m, r.id)
          .forEach(function (c) {
            var y = H + 44,
              large = 0;
            (function poser(n, d) {
              var tn = taille(n);
              pos.set(n, { x: x + d * 20, y: y });
              large = Math.max(large, d * 20 + tn.l);
              y += tn.h + (n.etiquette ? 16 : 0) + 10;
              E()
                .enfants(m, n.id)
                .forEach(function (f) {
                  poser(f, d + 1);
                });
            })(c, 0);
            x += large + 24;
          });
        pos.set(r, { x: x > depart ? Math.max(depart, (depart + x - 24 - t.l) / 2) : depart, y: 0 });
        if (x === depart) x += t.l + 24;
      });
    return pos;
  }

  function dessiner(g, m, avecId) {
    var pos = m.organigramme
      ? colonnes(m)
      : A.disposition.arbre(
          E().racines(m),
          function (n) {
            return E().enfants(m, n.id);
          },
          taille,
          { ecartX: 26, ecartY: 44 },
        );
    var gTraits = N.svg('g', { class: 'cv-liens' }, g),
      gNoeuds = N.svg('g', { class: 'cv-noeuds' }, g);
    var boites = [];
    m.noeuds.forEach(function (n) {
      var p = pos.get(n),
        t = taille(n);
      if (!p) return;
      boites.push({ x: p.x, y: p.y, l: t.l, h: t.h + (n.etiquette ? 16 : 0) });
      if (n.parent) {
        var par = m.noeuds.find(function (x) {
            return x.id === n.parent;
          }),
          pp = pos.get(par),
          tp = taille(par);
        var x1 = pp.x + tp.l / 2,
          y1 = pp.y + tp.h,
          x2 = p.x + t.l / 2,
          y2 = p.y,
          ym = (y1 + y2) / 2;
        // Dans une colonne, le fils se rattache sur le côté, sous son père
        N.svg(
          'path',
          {
            d:
              m.organigramme && par.parent
                ? 'M' + (pp.x + 8) + ' ' + y1 + ' V' + (p.y + t.h / 2) + ' H' + p.x
                : 'M' + x1 + ' ' + y1 + ' V' + ym + ' H' + x2 + ' V' + y2,
            class: 'cv-trait',
          },
          gTraits,
        );
      }
      var grp = N.svg('g', { class: 'cv-processus', 'data-noeud': avecId ? n.id : null, 'data-nom': n.nom }, gNoeuds);
      N.svg('rect', { x: p.x, y: p.y, width: t.l, height: t.h, rx: 9, class: 'cv-boite' }, grp);
      N.texteSvg(grp, p.x + t.l / 2, p.y + 22, n.nom, 'cv-nom-noeud', 'middle');
      if (n.etiquette) N.texteSvg(grp, p.x + t.l / 2, p.y + t.h + 14, n.etiquette, 'cv-etiquette-processus', 'middle');
    });
    return boites;
  }

  function cadre(boites) {
    if (!boites.length) return { x: 0, y: 0, l: 200, h: 80 };
    var x0 =
      Math.min.apply(
        null,
        boites.map(function (b) {
          return b.x;
        }),
      ) - 16;
    var y0 =
      Math.min.apply(
        null,
        boites.map(function (b) {
          return b.y;
        }),
      ) - 16;
    var x1 =
      Math.max.apply(
        null,
        boites.map(function (b) {
          return b.x + b.l;
        }),
      ) + 16;
    var y1 =
      Math.max.apply(
        null,
        boites.map(function (b) {
          return b.y + b.h;
        }),
      ) + 16;
    return { x: x0, y: y0, l: x1 - x0, h: y1 - y0 };
  }

  function creer(conteneur, ctx) {
    var m = null,
      ro = ctx.lectureSeule,
      derniers = null,
      compteur = 0;
    var cv = new A.Canevas(conteneur, {
      hauteur: ctx.hauteur,
      lectureSeule: ro,
      libelle: tr('Arbre de processus', 'Process tree'),
      surDoubleClic: function (c, p, e) {
        if (!ro && c && c.type === 'noeud') editer(c.id, e);
        else if (!ro && !c && !m.noeuds.length) ajouter(null);
      },
      surSupprimer: function (sel) {
        var retirer = new Set([sel.id]),
          change = true;
        while (change) {
          change = false;
          m.noeuds.forEach(function (n) {
            if (n.parent && retirer.has(n.parent) && !retirer.has(n.id)) {
              retirer.add(n.id);
              change = true;
            }
          });
        }
        m.noeuds = m.noeuds.filter(function (n) {
          return !retirer.has(n.id);
        });
        cv.selectionner(null, true);
        dessinerTout();
        ctx.modifie(m, true);
      },
      surSelection: majOutils,
      surClic: function (c) {
        if (ctx.surClicElement && c.type === 'noeud') {
          var n = trouver(c.id);
          if (n) ctx.surClicElement(n.nom);
        }
      },
    });
    function trouver(id) {
      return m.noeuds.find(function (n) {
        return n.id === id;
      });
    }
    function dessinerTout() {
      cv.vider();
      if (!m) return;
      dessiner(cv.monde, m, true);
      cv.marquerSelection();
      if (derniers) appliquer(derniers);
    }
    function nomLibre() {
      var i = m.noeuds.length + 1,
        base = m.organigramme ? 'Lot ' : 'P';
      while (
        m.noeuds.some(function (n) {
          return n.nom === base + i;
        })
      )
        i++;
      return base + i;
    }
    function nouvelId() {
      compteur++;
      var id = 'n' + Date.now().toString(36) + compteur;
      return id;
    }
    function ajouter(parent, apres) {
      var n = { id: nouvelId(), nom: nomLibre(), etiquette: '', parent: parent };
      if (apres) m.noeuds.splice(m.noeuds.indexOf(apres) + 1, 0, n);
      else m.noeuds.push(n);
      dessinerTout();
      ctx.modifie(m, true);
      cv.selectionner({ type: 'noeud', id: n.id });
      requestAnimationFrame(function () {
        cv.ajuster(1.2);
      });
    }
    function deplacer(sens) {
      var sel = cv.selection && trouver(cv.selection.id);
      if (!sel) return;
      var freres = m.noeuds.filter(function (n) {
          return n.parent === sel.parent;
        }),
        i = freres.indexOf(sel),
        autre = freres[i + sens];
      if (!autre) return;
      var a = m.noeuds.indexOf(sel),
        b = m.noeuds.indexOf(autre);
      m.noeuds[a] = autre;
      m.noeuds[b] = sel;
      dessinerTout();
      ctx.modifie(m, true);
    }
    function editer(id, e) {
      var n = trouver(id),
        el = cv.monde.querySelector('[data-noeud="' + CSS.escape(id) + '"]'),
        r = el ? el.getBoundingClientRect() : null;
      A.formulaire.ouvrir(cv.racine, {
        x: e && e.clientX != null ? e.clientX + 10 : r && r.right + 8,
        y: e && e.clientY != null ? e.clientY + 10 : r && r.top,
        titre: tr(m.organigramme ? 'Élément' : 'Processus', m.organigramme ? 'Element' : 'Process'),
        champs: [
          { nom: 'nom', libelle: tr('Nom', 'Name'), valeur: n.nom },
          {
            nom: 'etiquette',
            libelle: tr(
              m.organigramme ? 'Ressources et durée' : 'Étiquette (affichage, valeur de fork…)',
              m.organigramme ? 'Resources and duration' : 'Label (output, fork value…)',
            ),
            valeur: n.etiquette,
          },
        ],
        surValider: function (v) {
          if (!v.nom.trim()) return tr('Le nom est obligatoire.', 'The name is required.');
          n.nom = v.nom.trim().replace(/:/g, '');
          n.etiquette = v.etiquette.trim();
          dessinerTout();
          ctx.modifie(m, true);
        },
        surSupprimer: function () {
          cv.options.surSupprimer({ type: 'noeud', id: n.id });
        },
        surFermer: function () {
          cv.racine.focus({ preventScroll: true });
        },
      });
    }
    var boutons = {};
    function majOutils() {
      var sel = cv.selection && m && trouver(cv.selection.id);
      if (boutons.fils) boutons.fils.disabled = Boolean(m && m.noeuds.length && !sel);
      ['frere', 'gauche', 'droite'].forEach(function (k) {
        if (boutons[k]) boutons[k].disabled = !sel || (k === 'frere' && !sel.parent);
      });
    }
    function appliquer(liste) {
      cv.surligner(
        liste.map(function (s) {
          return {
            classe: s.classe,
            elements: Array.prototype.filter.call(cv.monde.querySelectorAll('[data-nom]'), function (e) {
              return e.getAttribute('data-nom').toLowerCase() === String(s.cible || '').toLowerCase();
            }),
          };
        }),
      );
    }
    var premier = true;
    return {
      canevas: cv,
      afficher: function (modele) {
        m = modele;
        dessinerTout();
        // Un organigramme se place tout seul, et il s'élargit vite : il reste cadré quand il grandit
        if (premier || m.organigramme) {
          premier = false;
          requestAnimationFrame(function () {
            cv.ajuster(1.2);
          });
        }
        majOutils();
      },
      outils: function () {
        if (ro) return [];
        boutons.fils = N.bouton(
          tr('+ Fils', '+ Child'),
          'petit',
          function () {
            var sel = cv.selection && trouver(cv.selection.id);
            ajouter(sel ? sel.id : null);
          },
          tr(
            "Ajouter un fils au processus choisi (la racine si l'arbre est vide)",
            'Add a child to the selected process (the root if the tree is empty)',
          ),
        );
        boutons.frere = N.bouton(
          tr('+ Frère', '+ Sibling'),
          'petit',
          function () {
            var sel = trouver(cv.selection.id);
            if (sel) ajouter(sel.parent, sel);
          },
          tr('Ajouter un frère après le processus choisi', 'Add a sibling after the selected process'),
        );
        boutons.gauche = N.bouton(
          '←',
          'petit',
          function () {
            deplacer(-1);
          },
          tr('Placer avant son frère précédent', 'Move before its previous sibling'),
        );
        boutons.droite = N.bouton(
          '→',
          'petit',
          function () {
            deplacer(1);
          },
          tr('Placer après son frère suivant', 'Move after its next sibling'),
        );
        majOutils();
        return [boutons.fils, boutons.frere, boutons.gauche, boutons.droite];
      },
      surligner: function (liste) {
        derniers = liste;
        appliquer(liste);
      },
      effacerSurlignage: function () {
        derniers = null;
        cv.effacerSurlignage();
      },
      ajuster: function () {
        cv.ajuster(1.2);
      },
      focus: function () {
        cv.racine.focus();
      },
    };
  }

  function statique(modele) {
    var svg = N.svg('svg', { class: 'atelier-svg statique', role: 'img' });
    var b = cadre(dessiner(N.svg('g', null, svg), modele, false));
    svg.setAttribute('viewBox', b.x + ' ' + b.y + ' ' + b.l + ' ' + b.h);
    svg.setAttribute('width', Math.round(b.l));
    return svg;
  }

  A.vues.processus = {
    creer: creer,
    statique: statique,
    get aideVide() {
      return A.tr(
        '« + Fils » crée le processus initial ; ou écrire l’arbre dans la vue texte.',
        '“+ Child” creates the initial process; or write the tree in the text view.',
      );
    },
  };
})(window.Atelier);
