/* ==========================================================================
   Atelier · placement automatique (Atelier.disposition)
   --------------------------------------------------------------------------
   - placer(noeuds, liens, options) : donne une position aux nœuds qui n'en
     ont pas (ceux décrits dans la vue texte, par exemple), sans bouger les
     autres, puis sépare les boîtes qui se chevauchent. Placement par forces :
     les nœuds liés s'attirent, tous se repoussent.
   - arbre(racines, enfants, taille) : disposition d'un arbre de haut en bas.
   Les positions sont celles du coin supérieur gauche, alignées sur une
   grille de 10 px. Tout est déterministe : même entrée, même dessin.
   ========================================================================== */
(function (A) {
  'use strict';

  var GRILLE = 10;
  function aligner(v) {
    return Math.round(v / GRILLE) * GRILLE;
  }

  // noeuds : [{ id, l, h, x?, y? }] (modifiés sur place) ; liens : [{ a, b }] (ids)
  function placer(noeuds, liens, options) {
    options = options || {};
    var ecart = options.ecart || 70;
    var parId = {};
    noeuds.forEach(function (n) {
      parId[n.id] = n;
    });
    var libres = noeuds.filter(function (n) {
      return options.tout || n.x == null || n.y == null;
    });
    if (!libres.length) return noeuds;
    var fixes = noeuds.filter(function (n) {
      return libres.indexOf(n) < 0;
    });
    var voisins = {};
    liens.forEach(function (l) {
      if (!parId[l.a] || !parId[l.b] || l.a === l.b) return;
      (voisins[l.a] = voisins[l.a] || []).push(l.b);
      (voisins[l.b] = voisins[l.b] || []).push(l.a);
    });

    // Position de départ : près des voisins déjà placés, sinon en grille à côté du dessin existant
    var droite = fixes.reduce(function (m, n) {
      return Math.max(m, n.x + n.l);
    }, 0);
    var col = 0,
      rang = 0,
      parLigne = Math.max(2, Math.ceil(Math.sqrt(libres.length)));
    libres.forEach(function (n, i) {
      var places = (voisins[n.id] || [])
        .map(function (v) {
          return parId[v];
        })
        .filter(function (v) {
          return v.x != null && libres.indexOf(v) < i;
        });
      places = places.concat(
        (voisins[n.id] || [])
          .map(function (v) {
            return parId[v];
          })
          .filter(function (v) {
            return fixes.indexOf(v) >= 0;
          }),
      );
      if (places.length && !options.tout) {
        var cx =
          places.reduce(function (s, v) {
            return s + v.x + v.l / 2;
          }, 0) / places.length;
        var cy =
          places.reduce(function (s, v) {
            return s + v.y + v.h / 2;
          }, 0) / places.length;
        var angle = (i * 2.399963) % (2 * Math.PI); // angle d'or : répartit les nouveaux nœuds
        n.x = cx + Math.cos(angle) * (n.l + ecart * 2) - n.l / 2;
        n.y = cy + Math.sin(angle) * (n.h + ecart) - n.h / 2;
      } else {
        n.x = (fixes.length ? droite + ecart : 0) + col * (190 + ecart);
        n.y = rang * (140 + ecart);
        if (++col >= parLigne) {
          col = 0;
          rang++;
        }
      }
    });

    // Forces : répulsion entre boîtes, attraction le long des liens (seuls les nœuds libres bougent)
    var iterations = options.iterations || 220;
    for (var it = 0; it < iterations; it++) {
      var temp = 30 * (1 - it / iterations) + 1;
      var depl = {};
      libres.forEach(function (n) {
        depl[n.id] = { x: 0, y: 0 };
      });
      for (var i = 0; i < noeuds.length; i++) {
        for (var j = i + 1; j < noeuds.length; j++) {
          var a = noeuds[i],
            b = noeuds[j];
          if (!depl[a.id] && !depl[b.id]) continue;
          var dx = b.x + b.l / 2 - (a.x + a.l / 2),
            dy = b.y + b.h / 2 - (a.y + a.h / 2);
          var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          var voulu = (a.l + b.l) / 2 + ecart;
          var f = Math.min((voulu * voulu) / d, 400) * 0.06;
          if (d > voulu * 2.2) f *= 0.2;
          var fx = (dx / d) * f,
            fy = (dy / d) * f;
          if (depl[a.id]) {
            depl[a.id].x -= fx;
            depl[a.id].y -= fy * 0.75;
          }
          if (depl[b.id]) {
            depl[b.id].x += fx;
            depl[b.id].y += fy * 0.75;
          }
        }
      }
      liens.forEach(function (l) {
        var a = parId[l.a],
          b = parId[l.b];
        if (!a || !b || a === b) return;
        var dx = b.x + b.l / 2 - (a.x + a.l / 2),
          dy = b.y + b.h / 2 - (a.y + a.h / 2);
        var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        var voulu = (a.l + b.l) / 2 + ecart * 1.6;
        var f = (d - voulu) * 0.04;
        if (depl[a.id]) {
          depl[a.id].x += (dx / d) * f;
          depl[a.id].y += (dy / d) * f;
        }
        if (depl[b.id]) {
          depl[b.id].x -= (dx / d) * f;
          depl[b.id].y -= (dy / d) * f;
        }
      });
      // Dernière phase : une boîte traversée par un trait qui ne la concerne pas s'en écarte
      if (it > iterations * 0.6)
        liens.forEach(function (l) {
          var a = parId[l.a],
            b = parId[l.b];
          if (!a || !b || a === b) return;
          var ax = a.x + a.l / 2,
            ay = a.y + a.h / 2,
            dx = b.x + b.l / 2 - ax,
            dy = b.y + b.h / 2 - ay,
            L = Math.sqrt(dx * dx + dy * dy) || 1;
          var nx = -dy / L,
            ny = dx / L;
          libres.forEach(function (n) {
            if (n === a || n === b) return;
            var cx = n.x + n.l / 2,
              cy = n.y + n.h / 2,
              t = ((cx - ax) * dx + (cy - ay) * dy) / (L * L);
            if (t <= 0 || t >= 1) return;
            var dist = (cx - ax) * nx + (cy - ay) * ny; // distance signée au trait
            var demi = (Math.abs(nx) * n.l) / 2 + (Math.abs(ny) * n.h) / 2 + 28; // demi-épaisseur de la boîte selon la normale
            if (Math.abs(dist) >= demi) return;
            var sens = dist >= 0 ? 1 : -1,
              f = (demi - Math.abs(dist)) * 0.5;
            depl[n.id].x += nx * sens * f;
            depl[n.id].y += ny * sens * f;
          });
        });
      libres.forEach(function (n) {
        var v = depl[n.id],
          lg = Math.sqrt(v.x * v.x + v.y * v.y);
        if (lg > temp) {
          v.x = (v.x / lg) * temp;
          v.y = (v.y / lg) * temp;
        }
        n.x += v.x;
        n.y += v.y;
      });
    }
    separer(noeuds, libres, 24);
    // Recaler le dessin en haut à gauche si tout a été placé automatiquement
    if (!fixes.length) {
      var mx = Math.min.apply(
        null,
        noeuds.map(function (n) {
          return n.x;
        }),
      );
      var my = Math.min.apply(
        null,
        noeuds.map(function (n) {
          return n.y;
        }),
      );
      noeuds.forEach(function (n) {
        n.x -= mx - 20;
        n.y -= my - 20;
      });
    }
    noeuds.forEach(function (n) {
      if (libres.indexOf(n) >= 0) {
        n.x = aligner(n.x);
        n.y = aligner(n.y);
      }
    });
    return noeuds;
  }

  // Écarte les boîtes qui se chevauchent (marge comprise) ; seuls les nœuds « mobiles » bougent
  function separer(noeuds, mobiles, marge) {
    var bouge = new Set(mobiles);
    for (var passe = 0; passe < 60; passe++) {
      var change = false;
      for (var i = 0; i < noeuds.length; i++) {
        for (var j = i + 1; j < noeuds.length; j++) {
          var a = noeuds[i],
            b = noeuds[j];
          if (!bouge.has(a) && !bouge.has(b)) continue;
          var ox = Math.min(a.x + a.l + marge, b.x + b.l + marge) - Math.max(a.x, b.x);
          var oy = Math.min(a.y + a.h + marge, b.y + b.h + marge) - Math.max(a.y, b.y);
          if (ox <= 0 || oy <= 0) continue;
          change = true;
          var parX = ox < oy,
            sens = parX ? (a.x + a.l / 2 <= b.x + b.l / 2 ? 1 : -1) : a.y + a.h / 2 <= b.y + b.h / 2 ? 1 : -1;
          var d = (parX ? ox : oy) + 1,
            partA = bouge.has(a) ? (bouge.has(b) ? 0.5 : 1) : 0,
            partB = 1 - partA;
          if (parX) {
            a.x -= sens * d * partA;
            b.x += sens * d * partB;
          } else {
            a.y -= sens * d * partA;
            b.y += sens * d * partB;
          }
        }
      }
      if (!change) break;
    }
  }

  // Arbre de haut en bas : racines [noeud], enfants(noeud) -> [noeud], taille(noeud) -> { l, h }.
  // Renvoie une Map noeud -> { x, y } (coin supérieur gauche).
  function arbre(racines, enfants, taille, options) {
    options = options || {};
    var ecartX = options.ecartX || 30,
      ecartY = options.ecartY || 60;
    var pos = new Map(),
      largeurs = new Map();
    function largeur(n) {
      var f = enfants(n),
        t = taille(n);
      var l = f.length
        ? Math.max(
            t.l,
            f.reduce(function (s, x) {
              return s + largeur(x);
            }, 0) +
              ecartX * (f.length - 1),
          )
        : t.l;
      largeurs.set(n, l);
      return l;
    }
    function poser(n, gauche, y) {
      var t = taille(n),
        l = largeurs.get(n),
        f = enfants(n);
      pos.set(n, { x: aligner(gauche + (l - t.l) / 2), y: y });
      var total =
        f.reduce(function (s, x) {
          return s + largeurs.get(x);
        }, 0) +
        ecartX * Math.max(0, f.length - 1);
      var x = gauche + (l - total) / 2;
      f.forEach(function (e) {
        poser(e, x, y + t.h + ecartY);
        x += largeurs.get(e) + ecartX;
      });
    }
    var x = 20;
    racines.forEach(function (r) {
      largeur(r);
      poser(r, x, 20);
      x += largeurs.get(r) + ecartX * 2;
    });
    return pos;
  }

  // Première place libre autour de p, pour un élément de demi-taille (dl, dh), sur une grille de pas (px, py).
  // Un nouvel élément posé sur un autre ne pourrait pas être relié sans déplacer d'abord le premier
  function placeLibre(p, boites, dl, dh, px, py) {
    function libre(x, y) {
      return boites.every(function (b) {
        return x + dl < b.x || x - dl > b.x + b.l || y + dh < b.y || y - dh > b.y + b.h;
      });
    }
    for (var rang = 0; rang < 12; rang++) {
      for (var i = -rang; i <= rang; i++) {
        for (var j = -rang; j <= rang; j++) {
          if (Math.max(Math.abs(i), Math.abs(j)) !== rang) continue;
          if (libre(p.x + i * px, p.y + j * py)) return { x: p.x + i * px, y: p.y + j * py };
        }
      }
    }
    return p;
  }

  A.disposition = {
    placer: placer,
    separer: separer,
    arbre: arbre,
    aligner: aligner,
    placeLibre: placeLibre,
    GRILLE: GRILLE,
  };
})(window.Atelier);
