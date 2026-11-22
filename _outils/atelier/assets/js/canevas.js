/* ==========================================================================
   Atelier · canevas SVG (Atelier.Canevas) et géométrie (Atelier.geometrie)
   --------------------------------------------------------------------------
   Surface de dessin commune aux vues en diagramme (classes, graphes,
   arbres, séquences). La vue dessine dans canevas.monde des éléments
   marqués data-noeud="id" ou data-lien="id" ; le canevas gère :
     - déplacement de la vue (glisser le fond) et zoom (Ctrl + molette,
       boutons +, −, ajuster) ;
     - sélection (clic), déplacement d'un nœud (glisser, aligné sur la
       grille ; flèches du clavier), suppression (Suppr) ;
     - mode « lier » : glisser d'un nœud vers un autre crée un lien ;
     - double-clic sur un élément ou sur le fond.
   Les rappels (options) préviennent la vue : surSelection, surDeplacer,
   surFinGeste, surDoubleClic, surLier, surSupprimer, surClic.
   ========================================================================== */
(function (A) {
  'use strict';

  var N = A.noyau,
    tr = A.tr,
    GRILLE = 10;

  /* Géométrie ------------------------------------------------------------------ */

  // Point du bord d'un rectangle { x, y, l, h } sur la droite qui va du centre vers (px, py)
  function bordRect(r, px, py) {
    var cx = r.x + r.l / 2,
      cy = r.y + r.h / 2,
      dx = px - cx,
      dy = py - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    var sx = dx ? r.l / 2 / Math.abs(dx) : Infinity,
      sy = dy ? r.h / 2 / Math.abs(dy) : Infinity;
    var s = Math.min(sx, sy);
    return { x: cx + dx * s, y: cy + dy * s };
  }
  function dedans(r, x, y) {
    return x > r.x && x < r.x + r.l && y > r.y && y < r.y + r.h;
  }
  // Point où le segment (x0, y0) -> (x1, y1), parti de l'intérieur du rectangle, en sort
  function sortieRect(r, x0, y0, x1, y1) {
    var dx = x1 - x0,
      dy = y1 - y0,
      t = Infinity;
    if (dx > 0) t = Math.min(t, (r.x + r.l - x0) / dx);
    if (dx < 0) t = Math.min(t, (r.x - x0) / dx);
    if (dy > 0) t = Math.min(t, (r.y + r.h - y0) / dy);
    if (dy < 0) t = Math.min(t, (r.y - y0) / dy);
    if (!isFinite(t)) return { x: x0, y: y0 };
    t = Math.min(1, Math.max(0, t));
    return { x: x0 + dx * t, y: y0 + dy * t };
  }
  function bordCercle(cx, cy, rayon, px, py) {
    var dx = px - cx,
      dy = py - cy,
      d = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: cx + (dx / d) * rayon, y: cy + (dy / d) * rayon };
  }
  function longueur(x1, y1, x2, y2) {
    var dx = x2 - x1,
      dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }
  // Point à la distance d de (x1, y1) vers (x2, y2), décalé de p perpendiculairement
  function pointSur(x1, y1, x2, y2, d, p) {
    var L = longueur(x1, y1, x2, y2) || 1,
      ux = (x2 - x1) / L,
      uy = (y2 - y1) / L;
    return { x: x1 + ux * d - uy * (p || 0), y: y1 + uy * d + ux * (p || 0) };
  }
  // Tête de flèche au point (x2, y2), venant de (x1, y1).
  // forme : ouverte | triangle | pleine | losange | losange-plein ; renvoie { d, recul }
  function pointe(x1, y1, x2, y2, forme, taille) {
    taille = taille || 12;
    var L = longueur(x1, y1, x2, y2) || 1,
      ux = (x2 - x1) / L,
      uy = (y2 - y1) / L,
      px = -uy,
      py = ux;
    function pt(a, b) {
      return (x2 - ux * a + px * b).toFixed(1) + ' ' + (y2 - uy * a + py * b).toFixed(1);
    }
    var l = taille * 0.5;
    switch (forme) {
      case 'ouverte':
        return { d: 'M' + pt(taille, l) + ' L' + pt(0, 0) + ' L' + pt(taille, -l), recul: 0, ouverte: true };
      case 'triangle':
      case 'pleine':
        return { d: 'M' + pt(0, 0) + ' L' + pt(taille, l * 1.1) + ' L' + pt(taille, -l * 1.1) + ' Z', recul: taille };
      case 'losange':
      case 'losange-plein':
        return {
          d:
            'M' +
            pt(0, 0) +
            ' L' +
            pt(taille * 0.8, l) +
            ' L' +
            pt(taille * 1.6, 0) +
            ' L' +
            pt(taille * 0.8, -l) +
            ' Z',
          recul: taille * 1.6,
        };
    }
    return { d: '', recul: 0 };
  }
  function aligner(v) {
    return Math.round(v / GRILLE) * GRILLE;
  }

  A.geometrie = {
    bordRect: bordRect,
    dedans: dedans,
    sortieRect: sortieRect,
    bordCercle: bordCercle,
    longueur: longueur,
    pointSur: pointSur,
    pointe: pointe,
    aligner: aligner,
    GRILLE: GRILLE,
  };

  /* Canevas ---------------------------------------------------------------------- */

  var compteur = 0;

  function Canevas(conteneur, options) {
    var self = this;
    this.options = options = options || {};
    this.id = 'cv' + ++compteur;
    this.vue = { x: 0, y: 0, echelle: 1 };
    this.selection = null;
    this.mode = 'normal';
    this.racine = N.el('div', 'atelier-canevas' + (options.lectureSeule ? ' lecture' : ''));
    this.racine.tabIndex = 0;
    this.racine.setAttribute('role', 'application');
    this.racine.setAttribute('aria-label', tr(options.libelle || 'Dessin', options.libelle || 'Drawing'));
    // Hauteur donnée en pixels pour une page à 16 px ; en rem, elle suit l'échelle de la page
    if (options.hauteur) this.racine.style.setProperty('--hauteur', options.hauteur / 16 + 'rem');
    this.svg = N.svg('svg', { class: 'atelier-svg', width: '100%', height: '100%' }, this.racine);
    var defs = N.svg('defs', null, this.svg);
    var motif = N.svg(
      'pattern',
      { id: this.id + '-grille', width: GRILLE * 2, height: GRILLE * 2, patternUnits: 'userSpaceOnUse' },
      defs,
    );
    N.svg('circle', { cx: 1, cy: 1, r: 0.9, class: 'cv-point-grille' }, motif);
    this.fond = N.svg(
      'rect',
      { class: 'cv-fond', x: -5000, y: -5000, width: 10000, height: 10000, fill: 'url(#' + this.id + '-grille)' },
      this.svg,
    );
    this.groupe = N.svg('g', { class: 'cv-vue' }, this.svg);
    this.fondMonde = N.svg(
      'rect',
      { class: 'cv-fond-monde', x: -5000, y: -5000, width: 10000, height: 10000 },
      this.groupe,
    );
    this.monde = N.svg('g', { class: 'cv-monde' }, this.groupe);
    this.dessus = N.svg('g', { class: 'cv-dessus' }, this.groupe);
    this.fond.setAttribute('transform', '');

    // Boutons de zoom
    var zoom = N.el('div', 'atelier-zoom');
    zoom.appendChild(
      N.bouton(
        '+',
        'atelier-mini',
        function () {
          self.zoomer(1.2);
        },
        tr('Agrandir', 'Zoom in'),
      ),
    );
    zoom.appendChild(
      N.bouton(
        '−',
        'atelier-mini',
        function () {
          self.zoomer(1 / 1.2);
        },
        tr('Réduire', 'Zoom out'),
      ),
    );
    zoom.appendChild(
      N.bouton(
        '⤢',
        'atelier-mini',
        function () {
          self.ajuster(self.maxEchelle, true);
        },
        tr('Tout voir', 'Fit all'),
      ),
    );
    this.racine.appendChild(zoom);
    conteneur.appendChild(this.racine);

    this.brancher();
    this.appliquerVue();
  }

  var P = Canevas.prototype;

  P.appliquerVue = function () {
    var v = this.vue;
    this.groupe.setAttribute(
      'transform',
      'translate(' + v.x.toFixed(1) + ' ' + v.y.toFixed(1) + ') scale(' + v.echelle.toFixed(3) + ')',
    );
    // La grille suit le déplacement (motif décalé), sans être mise à l'échelle au-delà du raisonnable
    var motif = this.svg.querySelector('pattern');
    var pas = GRILLE * 2 * v.echelle;
    motif.setAttribute('width', pas);
    motif.setAttribute('height', pas);
    motif.setAttribute('x', v.x % pas);
    motif.setAttribute('y', v.y % pas);
  };

  // Coordonnées du monde d'un événement
  P.point = function (e) {
    var r = this.svg.getBoundingClientRect(),
      v = this.vue;
    return { x: (e.clientX - r.left - v.x) / v.echelle, y: (e.clientY - r.top - v.y) / v.echelle };
  };
  P.versEcran = function (x, y) {
    var r = this.svg.getBoundingClientRect(),
      v = this.vue;
    return { x: r.left + v.x + x * v.echelle, y: r.top + v.y + y * v.echelle };
  };

  P.zoomer = function (facteur, centre) {
    var r = this.svg.getBoundingClientRect(),
      v = this.vue;
    var c = centre || { x: r.width / 2, y: r.height / 2 };
    var nouvelle = Math.max(0.25, Math.min(3, v.echelle * facteur));
    v.x = c.x - ((c.x - v.x) * nouvelle) / v.echelle;
    v.y = c.y - ((c.y - v.y) * nouvelle) / v.echelle;
    v.echelle = nouvelle;
    this.appliquerVue();
  };

  // Cadre le dessin. Sur un écran étroit, l'échelle ne descend pas sous 0,6 (texte lisible) :
  // le haut à gauche du dessin est montré, le reste s'atteint en glissant ; toutVoir lève ce plancher.
  // Ces bornes sont multipliées par l'échelle de la page (taille de base / 16 px) : le dessin, dont
  // les textes sont en pixels, grandit avec une page agrandie sur grand écran (quiz).
  P.ajuster = function (maxEchelle, toutVoir) {
    if (maxEchelle) this.maxEchelle = maxEchelle;
    var r = this.svg.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var page = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
    var b;
    try {
      b = this.monde.getBBox();
    } catch (e) {
      return;
    }
    if (!b.width && !b.height) {
      this.vue = { x: 20, y: 20, echelle: page };
      this.appliquerVue();
      return;
    }
    var marge = 24 * page;
    var e = Math.min((r.width - 2 * marge) / b.width, (r.height - 2 * marge) / b.height, (maxEchelle || 1) * page);
    if (!toutVoir && e < 0.6 * page) {
      e = 0.6 * page;
      this.vue = {
        echelle: e,
        x: Math.max(marge, (r.width - b.width * e) / 2) - b.x * e,
        y: Math.max(marge, (r.height - b.height * e) / 2) - b.y * e,
      };
    } else {
      e = Math.max(0.25, e);
      this.vue = { echelle: e, x: (r.width - b.width * e) / 2 - b.x * e, y: (r.height - b.height * e) / 2 - b.y * e };
    }
    this.appliquerVue();
  };

  P.vider = function () {
    while (this.monde.firstChild) this.monde.removeChild(this.monde.firstChild);
    while (this.dessus.firstChild) this.dessus.removeChild(this.dessus.firstChild);
  };

  P.selectionner = function (sel, silencieux) {
    this.selection = sel || null;
    this.marquerSelection();
    if (!silencieux && this.options.surSelection) this.options.surSelection(this.selection);
  };
  P.marquerSelection = function () {
    var sel = this.selection;
    this.monde.querySelectorAll('.selectionne').forEach(function (e) {
      e.classList.remove('selectionne');
    });
    if (!sel) return;
    var attr = sel.type === 'lien' ? 'data-lien' : 'data-noeud';
    this.monde.querySelectorAll('[' + attr + '="' + CSS.escape(sel.id) + '"]').forEach(function (e) {
      e.classList.add('selectionne');
    });
  };

  P.definirMode = function (mode) {
    this.mode = mode;
    this.racine.classList.toggle('mode-lier', mode === 'lier');
  };

  function cibleDe(e) {
    var n = e.target.closest && e.target.closest('[data-noeud]');
    if (n) return { type: 'noeud', id: n.getAttribute('data-noeud'), element: n };
    var l = e.target.closest && e.target.closest('[data-lien]');
    if (l) return { type: 'lien', id: l.getAttribute('data-lien'), element: l };
    return null;
  }

  P.brancher = function () {
    var self = this,
      o = this.options,
      geste = null,
      dernier = null;
    var svg = this.svg;

    svg.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      self.racine.focus({ preventScroll: true });
      var c = cibleDe(e),
        p = self.point(e);
      // Double-clic (ou double appui) détecté ici : la capture du pointeur empêche souvent l'événement dblclick
      var cle = c ? c.type + ':' + c.id : '',
        t = Date.now();
      if (
        dernier &&
        o.surDoubleClic &&
        self.mode !== 'lier' &&
        t - dernier.t < 450 &&
        dernier.cle === cle &&
        Math.abs(e.clientX - dernier.x) < 8 &&
        Math.abs(e.clientY - dernier.y) < 8
      ) {
        dernier = null;
        e.preventDefault();
        o.surDoubleClic(c, p, e);
        return;
      }
      dernier = { t: t, x: e.clientX, y: e.clientY, cle: cle };
      if (o.surClic && c) o.surClic(c, e);
      if (c && c.type === 'noeud' && self.mode === 'lier' && !o.lectureSeule) {
        geste = { type: 'lier', de: c.id, depart: o.centre ? o.centre(c.id) : p };
        svg.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }
      if (c) {
        self.selectionner({ type: c.type, id: c.id });
        if (c.type === 'noeud' && !o.lectureSeule && c.element.hasAttribute('data-mobile') && o.position) {
          var pos = o.position(c.id);
          geste = { type: 'deplacer', id: c.id, depart: p, x0: pos.x, y0: pos.y, bouge: false };
          svg.setPointerCapture(e.pointerId);
        }
        return;
      }
      self.selectionner(null);
      geste = { type: 'vue', ex: e.clientX, ey: e.clientY, vx: self.vue.x, vy: self.vue.y };
      svg.setPointerCapture(e.pointerId);
      self.racine.classList.add('glisse');
    });

    svg.addEventListener('pointermove', function (e) {
      if (!geste) return;
      if (geste.type === 'vue') {
        self.vue.x = geste.vx + e.clientX - geste.ex;
        self.vue.y = geste.vy + e.clientY - geste.ey;
        self.appliquerVue();
      } else if (geste.type === 'deplacer') {
        var p = self.point(e),
          dx = p.x - geste.depart.x,
          dy = p.y - geste.depart.y;
        if (!geste.bouge && Math.abs(dx) + Math.abs(dy) < 3) return;
        geste.bouge = true;
        o.surDeplacer(geste.id, aligner(geste.x0 + dx), aligner(geste.y0 + dy));
      } else if (geste.type === 'lier') {
        var q = self.point(e);
        while (self.dessus.firstChild) self.dessus.removeChild(self.dessus.firstChild);
        N.svg('line', { x1: geste.depart.x, y1: geste.depart.y, x2: q.x, y2: q.y, class: 'cv-elastique' }, self.dessus);
      }
    });

    function finir(e) {
      if (!geste) return;
      var g = geste;
      geste = null;
      if (dernier && (Math.abs(e.clientX - dernier.x) > 8 || Math.abs(e.clientY - dernier.y) > 8)) dernier = null; // un glisser n'est pas un clic
      self.racine.classList.remove('glisse');
      try {
        svg.releasePointerCapture(e.pointerId);
      } catch (x) {
        /* déjà relâché */
      }
      if (g.type === 'deplacer' && g.bouge && o.surFinGeste) o.surFinGeste();
      if (g.type === 'lier') {
        while (self.dessus.firstChild) self.dessus.removeChild(self.dessus.firstChild);
        var sous = document.elementFromPoint(e.clientX, e.clientY);
        var n = sous && sous.closest && sous.closest('[data-noeud]');
        if (n && self.racine.contains(n) && o.surLier) o.surLier(g.de, n.getAttribute('data-noeud'));
      }
    }
    svg.addEventListener('pointerup', finir);
    svg.addEventListener('pointercancel', finir);

    svg.addEventListener('dblclick', function (e) {
      e.preventDefault();
    });

    svg.addEventListener(
      'wheel',
      function (e) {
        if (!e.ctrlKey && !e.metaKey) return; // sans Ctrl, la molette fait défiler la page
        e.preventDefault();
        var r = svg.getBoundingClientRect();
        self.zoomer(e.deltaY < 0 ? 1.1 : 1 / 1.1, { x: e.clientX - r.left, y: e.clientY - r.top });
      },
      { passive: false },
    );

    this.racine.addEventListener('keydown', function (e) {
      if (e.target !== self.racine) return;
      var sel = self.selection;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !o.lectureSeule && o.surSupprimer) {
        e.preventDefault();
        o.surSupprimer(sel);
        return;
      }
      if (e.key === 'Escape') {
        self.definirMode('normal');
        self.selectionner(null);
        if (o.surEchap) o.surEchap();
        return;
      }
      if (e.key === 'Enter' && sel && o.surDoubleClic) {
        e.preventDefault();
        o.surDoubleClic(sel, null, e);
        return;
      }
      var fleches = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (fleches[e.key] && sel && sel.type === 'noeud' && !o.lectureSeule && o.position && o.surDeplacer) {
        var el = self.monde.querySelector('[data-noeud="' + CSS.escape(sel.id) + '"]');
        if (!el || !el.hasAttribute('data-mobile')) return;
        e.preventDefault();
        var pos = o.position(sel.id),
          pas = e.shiftKey ? GRILLE * 4 : GRILLE;
        o.surDeplacer(sel.id, pos.x + fleches[e.key][0] * pas, pos.y + fleches[e.key][1] * pas);
        if (o.surFinGeste) o.surFinGeste();
      }
    });
  };

  // Marque des éléments (surlignage des erreurs, des écarts, des remarques de Claude)
  P.surligner = function (liste) {
    var self = this;
    this.effacerSurlignage();
    (liste || []).forEach(function (s) {
      (s.elements || []).forEach(function (e) {
        e.classList.add('surligne', 'surligne-' + (s.classe || 'info'));
      });
    });
    self.marquerSelection();
  };
  P.effacerSurlignage = function () {
    this.monde.querySelectorAll('.surligne').forEach(function (e) {
      var aRetirer = Array.prototype.filter.call(e.classList, function (c) {
        return c.indexOf('surligne') === 0;
      });
      aRetirer.forEach(function (c) {
        e.classList.remove(c);
      });
    });
  };

  A.Canevas = Canevas;
})(window.Atelier);
