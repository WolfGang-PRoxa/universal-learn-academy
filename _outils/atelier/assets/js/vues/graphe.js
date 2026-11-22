/* ==========================================================================
   Atelier · vue « graphe » : graphes et automates (interface)
   --------------------------------------------------------------------------
   Nœuds en cercles déplaçables ; pour un automate, double cercle pour un
   état final et flèche entrante pour l'état initial. Arcs droits, courbés
   quand deux arcs relient la même paire, boucles au-dessus du nœud.
   PERT : étapes en cercles partagés (nom, date au plus tôt, date au plus
   tard), placées en colonnes, tâches fictives en pointillés.
   Édition : double-clic sur le fond (nouveau nœud) ou sur un élément,
   mode « Relier », Suppr.
   ========================================================================== */
(function (A) {
  'use strict';

  var N = A.noyau,
    G = A.geometrie,
    tr = A.tr;

  function rayon(n) {
    return Math.max(
      n.tot != null ? 33 : 20,
      Math.ceil(N.largeurTexte(n.nom, N.police('--police-texte', 14, 600)) / 2) + 9,
    );
  }
  function centre(n) {
    var r = rayon(n);
    return { x: (n.x || 0) + r, y: (n.y || 0) + r, r: r };
  }

  // PERT : les étapes en colonnes, de gauche à droite, selon leur rang dans le graphe
  function placerPert(m) {
    var rang = {},
      n = m.noeuds.length,
      colonnes = {};
    m.noeuds.forEach(function (x) {
      rang[x.nom] = 0;
    });
    for (var i = 0; i < n; i++)
      m.arcs.forEach(function (a) {
        if (rang[a.b] <= rang[a.a] && rang[a.a] < n) rang[a.b] = rang[a.a] + 1;
      });
    m.noeuds.forEach(function (x) {
      (colonnes[rang[x.nom]] = colonnes[rang[x.nom]] || []).push(x);
    });
    var haut = Math.max.apply(
      null,
      Object.keys(colonnes).map(function (k) {
        return colonnes[k].length;
      }),
    );
    Object.keys(colonnes).forEach(function (k) {
      colonnes[k].forEach(function (x, j) {
        x.x = 30 + Number(k) * 150;
        x.y = A.disposition.aligner(20 + ((haut - colonnes[k].length) / 2 + j) * 100);
      });
    });
  }

  function placer(m, tout) {
    if (
      m.pert &&
      (tout ||
        m.noeuds.every(function (n) {
          return n.x == null;
        }))
    ) {
      placerPert(m);
      return true;
    }
    var noeuds = m.noeuds.map(function (n) {
      var r = rayon(n);
      return { id: n.nom, l: 2 * r, h: 2 * r, x: tout ? null : n.x, y: tout ? null : n.y, n: n };
    });
    if (
      !tout &&
      noeuds.every(function (x) {
        return x.x != null && x.y != null;
      })
    )
      return false;
    A.disposition.placer(
      noeuds,
      m.arcs.map(function (a) {
        return { a: a.a, b: a.b };
      }),
      { ecart: 70, tout: tout },
    );
    noeuds.forEach(function (x) {
      x.n.x = x.x;
      x.n.y = x.y;
    });
    return true;
  }

  function dessiner(g, m, avecId) {
    var parNom = {};
    m.noeuds.forEach(function (n) {
      parNom[n.nom] = n;
    });
    var gArcs = N.svg('g', { class: 'cv-liens' }, g);
    var paires = {};
    m.arcs.forEach(function (a) {
      var k = [a.a, a.b].sort().join('~');
      (paires[k] = paires[k] || []).push(a);
    });
    m.arcs.forEach(function (a, i) {
      var na = parNom[a.a],
        nb = parNom[a.b];
      if (!na || !nb) return;
      var ca = centre(na),
        cb = centre(nb);
      var grp = N.svg(
        'g',
        { class: 'cv-arc', 'data-lien': avecId ? String(i) : null, 'data-arc': a.a + (m.oriente ? '->' : '--') + a.b },
        gArcs,
      );
      var d, fin, avantFin, etiquette;
      if (na === nb) {
        var memes = m.arcs.filter(function (x) {
            return x.a === a.a && x.b === a.a;
          }),
          k = memes.indexOf(a);
        var h = 42 + k * 16;
        var p1 = { x: ca.x - ca.r * 0.55, y: ca.y - ca.r * 0.83 },
          p2 = { x: ca.x + ca.r * 0.55, y: ca.y - ca.r * 0.83 };
        var c1 = { x: ca.x - ca.r - 4 - k * 6, y: ca.y - ca.r - h },
          c2 = { x: ca.x + ca.r + 4 + k * 6, y: ca.y - ca.r - h };
        d = 'M' + p1.x + ' ' + p1.y + ' C' + c1.x + ' ' + c1.y + ' ' + c2.x + ' ' + c2.y + ' ' + p2.x + ' ' + p2.y;
        fin = p2;
        avantFin = c2;
        etiquette = { x: ca.x, y: ca.y - ca.r - h * 0.75 - 4 };
      } else {
        var groupe = paires[[a.a, a.b].sort().join('~')],
          n = groupe.length,
          idx = groupe.indexOf(a);
        // Courbure : aucune pour un arc seul ; opposée pour les deux sens d'une paire
        var courbe = n === 1 ? 0 : (idx - (n - 1) / 2) * 34 * (a.a < a.b ? 1 : -1);
        var L = G.longueur(ca.x, ca.y, cb.x, cb.y) || 1,
          ux = (cb.x - ca.x) / L,
          uy = (cb.y - ca.y) / L;
        var ctrl = { x: (ca.x + cb.x) / 2 - uy * courbe, y: (ca.y + cb.y) / 2 + ux * courbe };
        var debut = G.bordCercle(ca.x, ca.y, ca.r, ctrl.x, ctrl.y);
        fin = G.bordCercle(cb.x, cb.y, cb.r + (m.oriente ? 0 : 0), ctrl.x, ctrl.y);
        d =
          'M' +
          debut.x.toFixed(1) +
          ' ' +
          debut.y.toFixed(1) +
          ' Q' +
          ctrl.x.toFixed(1) +
          ' ' +
          ctrl.y.toFixed(1) +
          ' ' +
          fin.x.toFixed(1) +
          ' ' +
          fin.y.toFixed(1);
        avantFin = ctrl;
        var mx = 0.25 * debut.x + 0.5 * ctrl.x + 0.25 * fin.x,
          my = 0.25 * debut.y + 0.5 * ctrl.y + 0.25 * fin.y;
        var dec = courbe === 0 ? 11 : courbe > 0 ? 11 : -11;
        etiquette = { x: mx - uy * dec, y: my + ux * dec + 4 };
      }
      var tache = m.pert ? A.editeurs.graphe.tachePert(a.etiquette) : null,
        fictive = tache && tache.fictive;
      N.svg('path', { d: d, class: 'cv-zone-clic' }, grp);
      N.svg('path', { d: d, class: fictive ? 'cv-trait cv-pointille' : 'cv-trait' }, grp);
      if (m.oriente) {
        var p = G.pointe(avantFin.x, avantFin.y, fin.x, fin.y, 'pleine', 11);
        N.svg('path', { d: p.d, class: 'cv-pointe pleine' }, grp);
      }
      if (a.etiquette && !fictive) {
        var t = N.texteSvg(grp, etiquette.x, etiquette.y, a.etiquette, 'cv-etiquette-arc', 'middle');
        t.setAttribute('paint-order', 'stroke');
      }
    });
    var gNoeuds = N.svg('g', { class: 'cv-noeuds' }, g);
    m.noeuds.forEach(function (n) {
      var c = centre(n);
      var grp = N.svg(
        'g',
        {
          class: 'cv-etat' + (n.final && m.automate ? ' final' : '') + (n.initial && m.automate ? ' initial' : ''),
          'data-noeud': avecId ? n.nom : null,
          'data-mobile': avecId ? '' : null,
          'data-nom': n.nom,
        },
        gNoeuds,
      );
      if (n.initial && m.automate) {
        N.svg('line', { x1: c.x - c.r - 30, y1: c.y, x2: c.x - c.r - 1, y2: c.y, class: 'cv-trait' }, grp);
        var p = G.pointe(c.x - c.r - 30, c.y, c.x - c.r, c.y, 'pleine', 10);
        N.svg('path', { d: p.d, class: 'cv-pointe pleine' }, grp);
      }
      N.svg('circle', { cx: c.x, cy: c.y, r: c.r, class: 'cv-boite cv-cercle' }, grp);
      if (n.final && m.automate) N.svg('circle', { cx: c.x, cy: c.y, r: c.r - 4.5, class: 'cv-cercle-interieur' }, grp);
      if (m.pert) {
        N.svg(
          'path',
          {
            d:
              'M' +
              (c.x - c.r) +
              ' ' +
              (c.y + 3) +
              ' H' +
              (c.x + c.r) +
              ' M' +
              c.x +
              ' ' +
              (c.y + 3) +
              ' V' +
              (c.y + c.r),
            class: 'cv-separateur',
          },
          grp,
        );
        N.texteSvg(grp, c.x, c.y - 7, n.nom, 'cv-nom-noeud', 'middle');
        N.texteSvg(grp, c.x - c.r * 0.45, c.y + 20, n.tot || '', 'cv-date-etape', 'middle');
        N.texteSvg(grp, c.x + c.r * 0.45, c.y + 20, n.tard || '', 'cv-date-etape', 'middle');
        return;
      }
      N.texteSvg(grp, c.x, c.y + 5, n.nom, 'cv-nom-noeud', 'middle');
    });
  }

  function cadre(m) {
    if (!m.noeuds.length) return { x: 0, y: 0, l: 200, h: 80 };
    var xs = [],
      ys = [];
    m.noeuds.forEach(function (n) {
      var c = centre(n);
      xs.push(c.x - c.r - (n.initial ? 40 : 10), c.x + c.r + 10);
      ys.push(c.y - c.r - 70, c.y + c.r + 20);
    });
    var x0 = Math.min.apply(null, xs) - 20,
      y0 = Math.min.apply(null, ys) - 10;
    return { x: x0, y: y0, l: Math.max.apply(null, xs) - x0 + 20, h: Math.max.apply(null, ys) - y0 + 10 };
  }

  function creer(conteneur, ctx) {
    var m = null,
      ro = ctx.lectureSeule,
      peinture = null,
      derniers = null;
    var cv = new A.Canevas(conteneur, {
      hauteur: ctx.hauteur,
      lectureSeule: ro,
      libelle: tr('Graphe', 'Graph'),
      position: function (id) {
        var n = trouver(id);
        return { x: n.x, y: n.y };
      },
      centre: function (id) {
        return centre(trouver(id));
      },
      surDeplacer: function (id, x, y) {
        var n = trouver(id);
        n.x = x;
        n.y = y;
        redessiner();
        ctx.modifie(m, false);
      },
      surFinGeste: function () {
        ctx.modifie(m, true);
      },
      surLier: function (a, b) {
        m.arcs.push({ a: a, b: b, etiquette: '' });
        dessinerTout();
        ctx.modifie(m, true);
        cv.definirMode('normal');
        majOutils();
        editerArc(m.arcs.length - 1);
      },
      surDoubleClic: function (c, p, e) {
        if (ro) return;
        if (!c) {
          if (p) nouveauNoeud(p.x, p.y);
          return;
        }
        if (c.type === 'noeud') editerNoeud(c.id, e);
        else editerArc(Number(c.id), e);
      },
      surSupprimer: function (sel) {
        if (sel.type === 'noeud') {
          m.noeuds = m.noeuds.filter(function (n) {
            return n.nom !== sel.id;
          });
          m.arcs = m.arcs.filter(function (a) {
            return a.a !== sel.id && a.b !== sel.id;
          });
        } else m.arcs.splice(Number(sel.id), 1);
        cv.selectionner(null, true);
        dessinerTout();
        ctx.modifie(m, true);
      },
      surClic: function (c) {
        if (!ctx.surClicElement) return;
        if (c.type === 'noeud') ctx.surClicElement(c.id);
        else {
          var a = m.arcs[Number(c.id)];
          if (a) ctx.surClicElement(a.a + (m.oriente ? '->' : '--') + a.b);
        }
      },
      surEchap: majOutils,
    });
    function trouver(id) {
      return m.noeuds.find(function (n) {
        return n.nom === id;
      });
    }
    function redessiner() {
      if (!peinture)
        peinture = requestAnimationFrame(function () {
          peinture = null;
          dessinerTout();
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
      var base = m.automate ? 'q' : m.pert ? 'E' : '',
        i = 0;
      if (!m.automate && !m.pert) {
        for (var k = 0; k < 26; k++) {
          var l = String.fromCharCode(65 + k);
          if (!trouver(l)) return l;
        }
        base = 'N';
      }
      while (trouver(base + i)) i++;
      return base + i;
    }
    function nouveauNoeud(x, y) {
      var n = {
        nom: nomLibre(),
        initial:
          m.automate &&
          !m.noeuds.some(function (x) {
            return x.initial;
          }),
        final: false,
        x: A.disposition.aligner(x - 22),
        y: A.disposition.aligner(y - 22),
      };
      if (m.pert) {
        n.tot = '';
        n.tard = '';
      }
      m.noeuds.push(n);
      dessinerTout();
      ctx.modifie(m, true);
      cv.selectionner({ type: 'noeud', id: n.nom });
    }
    function position(e, type, id) {
      if (e && e.clientX != null) return { x: e.clientX + 10, y: e.clientY + 10 };
      var el = cv.monde.querySelector(
        '[' + (type === 'lien' ? 'data-lien' : 'data-noeud') + '="' + CSS.escape(String(id)) + '"]',
      );
      if (!el) return {};
      var r = el.getBoundingClientRect();
      return { x: r.right + 8, y: r.top };
    }
    function editerNoeud(id, e) {
      var n = trouver(id),
        p = position(e, 'noeud', id);
      var champs = [{ nom: 'nom', libelle: tr('Nom', 'Name'), valeur: n.nom }];
      if (m.automate)
        champs.push(
          { nom: 'initial', libelle: tr('État initial', 'Initial state'), type: 'case', valeur: n.initial },
          { nom: 'final', libelle: tr('État final', 'Final state'), type: 'case', valeur: n.final },
        );
      if (m.pert)
        champs.push(
          { nom: 'tot', libelle: tr('Date au plus tôt', 'Earliest date'), valeur: n.tot },
          { nom: 'tard', libelle: tr('Date au plus tard', 'Latest date'), valeur: n.tard },
        );
      A.formulaire.ouvrir(cv.racine, {
        x: p.x,
        y: p.y,
        titre: tr(m.automate ? 'État' : m.pert ? 'Étape' : 'Nœud', m.automate ? 'State' : m.pert ? 'Stage' : 'Node'),
        champs: champs,
        surValider: function (v) {
          var nom = v.nom.trim();
          if (!/^[A-Za-zÀ-ÖØ-öø-ÿ0-9_'·{}]+$/.test(nom))
            return tr('Nom invalide : lettres, chiffres et _ seulement.', 'Invalid name: letters, digits and _ only.');
          if (nom !== n.nom && trouver(nom)) return tr('Ce nom est déjà pris.', 'This name is already taken.');
          m.arcs.forEach(function (a) {
            if (a.a === n.nom) a.a = nom;
            if (a.b === n.nom) a.b = nom;
          });
          n.nom = nom;
          if (m.automate) {
            n.initial = v.initial;
            n.final = v.final;
          }
          if (m.pert) {
            n.tot = v.tot.trim();
            n.tard = v.tard.trim();
          }
          dessinerTout();
          ctx.modifie(m, true);
        },
        surSupprimer: function () {
          cv.options.surSupprimer({ type: 'noeud', id: n.nom });
        },
        surFermer: function () {
          cv.racine.focus({ preventScroll: true });
        },
      });
    }
    function editerArc(i, e) {
      var a = m.arcs[i],
        p = position(e, 'lien', i);
      A.formulaire.ouvrir(cv.racine, {
        x: p.x,
        y: p.y,
        titre: tr(
          m.oriente ? 'Arc ' + a.a + ' → ' + a.b : 'Arête ' + a.a + ' – ' + a.b,
          m.oriente ? 'Arc ' + a.a + ' → ' + a.b : 'Edge ' + a.a + ' – ' + a.b,
        ),
        champs: [
          {
            nom: 'etiquette',
            libelle: tr(
              m.automate
                ? 'Symboles (séparés par des virgules, ε)'
                : m.pert
                  ? 'Tâche et durée (T5 3), ou fictive'
                  : 'Étiquette ou poids',
              m.automate
                ? 'Symbols (comma-separated, ε)'
                : m.pert
                  ? 'Task and duration (T5 3), or fictive'
                  : 'Label or weight',
            ),
            valeur: a.etiquette,
          },
        ],
        actions: m.oriente
          ? [
              {
                libelle: tr('Inverser', 'Reverse'),
                action: function () {
                  A.formulaire.fermer(false);
                  var x = a.a;
                  a.a = a.b;
                  a.b = x;
                  dessinerTout();
                  ctx.modifie(m, true);
                },
              },
            ]
          : [],
        surValider: function (v) {
          a.etiquette = v.etiquette.trim();
          dessinerTout();
          ctx.modifie(m, true);
        },
        surSupprimer: function () {
          cv.options.surSupprimer({ type: 'lien', id: String(i) });
        },
        surFermer: function () {
          cv.racine.focus({ preventScroll: true });
        },
      });
    }
    var boutonLier = null;
    function majOutils() {
      if (boutonLier) boutonLier.classList.toggle('actif', cv.mode === 'lier');
    }
    function appliquer(liste) {
      cv.surligner(
        liste.map(function (s) {
          var t = String(s.cible || ''),
            els;
          if (/->|--/.test(t))
            els = Array.prototype.filter.call(cv.monde.querySelectorAll('[data-arc]'), function (e) {
              return e.getAttribute('data-arc').toLowerCase() === t.toLowerCase().replace(/\s+/g, '');
            });
          else
            els = Array.prototype.filter.call(cv.monde.querySelectorAll('[data-nom]'), function (e) {
              return e.getAttribute('data-nom').toLowerCase() === t.toLowerCase();
            });
          return { classe: s.classe, elements: els };
        }),
      );
    }
    var premier = true;
    return {
      canevas: cv,
      afficher: function (modele) {
        m = modele;
        var place = placer(m, false);
        dessinerTout();
        if (premier || place) {
          premier = false;
          requestAnimationFrame(function () {
            cv.ajuster(1.2);
          });
        }
        if (place) ctx.modifie(m, false);
      },
      outils: function () {
        if (ro) return [];
        var ajout = N.bouton(
          tr(
            m && m.automate ? '+ État' : ctx.options.pert ? '+ Étape' : '+ Nœud',
            m && m.automate ? '+ State' : ctx.options.pert ? '+ Stage' : '+ Node',
          ),
          'petit',
          function () {
            var r = cv.svg.getBoundingClientRect(),
              p = cv.point({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
            var q = A.disposition.placeLibre(
              p,
              m.noeuds.map(function (n) {
                return { x: n.x, y: n.y, l: 44, h: 44 };
              }),
              40,
              40,
              90,
              70,
            );
            nouveauNoeud(q.x, q.y);
          },
          tr('Ajouter un nœud (ou double-clic sur le fond)', 'Add a node (or double-click the background)'),
        );
        boutonLier = N.bouton(
          tr('Relier', 'Link'),
          'petit',
          function () {
            cv.definirMode(cv.mode === 'lier' ? 'normal' : 'lier');
            majOutils();
          },
          tr('Relier deux nœuds : glisser du premier au second', 'Link two nodes: drag from the first to the second'),
        );
        return [ajout, boutonLier];
      },
      surligner: function (liste) {
        derniers = liste;
        appliquer(liste);
      },
      effacerSurlignage: function () {
        derniers = null;
        cv.effacerSurlignage();
      },
      reorganiser: function () {
        if (!m) return;
        placer(m, true);
        dessinerTout();
        ctx.modifie(m, true);
        requestAnimationFrame(function () {
          cv.ajuster(1.2);
        });
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
    var m = N.copie(modele);
    placer(m, false);
    var svg = N.svg('svg', { class: 'atelier-svg statique', role: 'img' });
    dessiner(N.svg('g', null, svg), m, false);
    var b = cadre(m);
    svg.setAttribute('viewBox', b.x + ' ' + b.y + ' ' + b.l + ' ' + b.h);
    svg.setAttribute('width', Math.round(b.l));
    return svg;
  }

  A.vues.graphe = {
    creer: creer,
    statique: statique,
    reorganisable: true,
    get aideVide() {
      return A.tr(
        'Double-cliquer sur le fond pour ajouter un nœud, puis « Relier » ; ou écrire dans la vue texte.',
        'Double-click the background to add a node, then “Link”; or write in the text view.',
      );
    },
  };
})(window.Atelier);
