/* ==========================================================================
   Atelier · vue « cas » : diagramme de cas d'utilisation UML (interface)
   --------------------------------------------------------------------------
   Acteurs en bonhomme (rectangle « actor » s'ils ne sont pas humains), cas en
   ellipses, frontière du système autour des cas. Premier placement en
   colonnes : acteurs principaux à gauche, cas au centre, acteurs secondaires
   à droite. Édition : double-clic sur le fond (nouveau cas) ou sur un
   élément, « + Acteur », « + Cas », mode « Relier ». Le lien entre deux cas
   demande sa nature : include, extend ou généralisation.
   ========================================================================== */
(function (A) {
  "use strict";

  var N = A.noyau, G = A.geometrie;
  var LARGEUR_LIGNE = 22, H_LIGNE = 16, H_BONHOMME = 42;

  // Coupe un nom sur des espaces, en lignes d'environ LARGEUR_LIGNE caractères
  function lignesNom(nom) {
    var lignes = [], cour = "";
    String(nom).split(/\s+/).forEach(function (mot) {
      if (cour && (cour + " " + mot).length > LARGEUR_LIGNE) { lignes.push(cour); cour = mot; }
      else cour = cour ? cour + " " + mot : mot;
    });
    if (cour) lignes.push(cour);
    return lignes;
  }
  function largeurLignes(lignes, graisse) {
    return Math.max.apply(null, lignes.map(function (l) { return N.largeurTexte(l, N.police("--police-texte", 13, graisse)); }));
  }

  // Taille de la boîte d'un élément ; x et y sont son coin supérieur gauche
  function tailleCas(c) {
    var lignes = lignesNom(c.nom);
    return { l: Math.max(120, Math.ceil(largeurLignes(lignes, 600) * 1.3) + 28), h: Math.max(52, lignes.length * H_LIGNE + 30), lignes: lignes };
  }
  function tailleActeur(a) {
    var lignes = lignesNom(a.nom);
    var l = Math.max(a.genre === "systeme" ? 100 : 70, Math.ceil(largeurLignes(lignes, 600)) + 16);
    return { l: l, h: a.genre === "systeme" ? 26 + lignes.length * H_LIGNE + 12 : H_BONHOMME + lignes.length * H_LIGNE + 6, lignes: lignes };
  }
  function boite(m, nom) {
    var c = m.cas.find(function (x) { return x.nom === nom; });
    if (c) { var t = tailleCas(c); return { x: c.x || 0, y: c.y || 0, l: t.l, h: t.h, ellipse: true }; }
    var a = m.acteurs.find(function (x) { return x.nom === nom; });
    if (!a) return null;
    var u = tailleActeur(a), r = { x: a.x || 0, y: a.y || 0, l: u.l, h: u.h, ellipse: false };
    // Les traits visent le bonhomme, pas la boîte qui englobe aussi son nom
    if (a.genre !== "systeme") r.corps = { x: r.x + r.l / 2 - 13, y: r.y, l: 26, h: H_BONHOMME };
    return r;
  }
  function centre(b) { var r = b.corps || b; return { x: r.x + r.l / 2, y: r.y + r.h / 2 }; }
  // Point du bord d'une boîte (ellipse ou rectangle) sur la droite qui va vers (px, py)
  function bord(b, px, py) {
    var c = centre(b);
    if (!b.ellipse) return G.bordRect(b.corps || b, px, py);
    var dx = px - c.x, dy = py - c.y, k = Math.sqrt(dx * dx / (b.l * b.l / 4) + dy * dy / (b.h * b.h / 4)) || 1;
    return { x: c.x + dx / k, y: c.y + dy / k };
  }

  /* Placement ------------------------------------------------------------------- */

  function secondaire(m, a) {
    var liens = m.liens.filter(function (l) { return l.type === "association" && l.a === a.nom; });
    return liens.length > 0 && liens.every(function (l) { return N.cle(l.etiquette) === "secondaire"; });
  }
  function empiler(elements, taille, x, largeur, ecart, y0) {
    var y = y0;
    elements.forEach(function (e) {
      var t = taille(e);
      e.x = x + (largeur - t.l) / 2; e.y = y;
      y += t.h + ecart;
    });
    return y - ecart;
  }
  function milieu(elements, taille) {
    if (!elements.length) return 0;
    var d = elements[elements.length - 1];
    return (elements[0].y + d.y + taille(d).h) / 2;
  }

  // Colonnes : acteurs principaux, cas de premier rang, cas inclus ou étendus, acteurs secondaires
  function colonnes(m) {
    var ordreCas = {};
    m.liens.forEach(function (l, i) {
      if (l.type === "association" && ordreCas[l.b] == null) ordreCas[l.b] = i;
    });
    var seconds = new Set();
    m.liens.forEach(function (l) {
      if (l.type === "include") seconds.add(l.b);
      if (l.type === "extend" || l.type === "generalisation") seconds.add(l.a);
    });
    var rang = function (c) { return ordreCas[c.nom] == null ? 1e6 : ordreCas[c.nom]; };
    var cas = m.cas.slice().sort(function (x, y) { return rang(x) - rang(y); });
    var col1 = cas.filter(function (c) { return !seconds.has(c.nom); }), col2 = cas.filter(function (c) { return seconds.has(c.nom); });
    if (!col1.length) { col1 = col2; col2 = []; }
    var gauche = m.acteurs.filter(function (a) { return !secondaire(m, a); }), droite = m.acteurs.filter(function (a) { return secondaire(m, a); });
    var lGauche = gauche.length ? Math.max.apply(null, gauche.map(function (a) { return tailleActeur(a).l; })) : 0;
    var l1 = col1.length ? Math.max.apply(null, col1.map(function (c) { return tailleCas(c).l; })) : 0;
    var l2 = col2.length ? Math.max.apply(null, col2.map(function (c) { return tailleCas(c).l; })) : 0;
    var x1 = 20 + lGauche + (gauche.length ? 90 : 0);
    var x2 = x1 + l1 + (col2.length ? 110 : 0);
    var x3 = x2 + l2 + 90;
    var bas1 = empiler(col1, tailleCas, x1, l1, 22, 60);
    var h2 = col2.reduce(function (s, c) { return s + tailleCas(c).h + 22; }, -22);
    empiler(col2, tailleCas, x2, l2, 22, 60 + Math.max(0, (bas1 - 60 - h2) / 2));
    [[gauche, 20], [droite, x3]].forEach(function (c) {
      var h = c[0].reduce(function (s, a) { return s + tailleActeur(a).h + 50; }, -50);
      var lc = c[0].length ? Math.max.apply(null, c[0].map(function (a) { return tailleActeur(a).l; })) : 0;
      empiler(c[0], tailleActeur, c[1], lc, 50, Math.max(40, 60 + (bas1 - 60 - h) / 2));
    });
    m.acteurs.concat(m.cas).forEach(function (e) { e.x = A.disposition.aligner(e.x); e.y = A.disposition.aligner(e.y); });
  }

  function placer(m, tout) {
    var elements = m.acteurs.concat(m.cas);
    var manquants = elements.filter(function (e) { return e.x == null || e.y == null; });
    if (!tout && !manquants.length) return false;
    if (tout || manquants.length === elements.length) { colonnes(m); return true; }
    var noeuds = elements.map(function (e) {
      var b = boite(m, e.nom);
      return { id: e.nom, l: b.l, h: b.h, x: e.x, y: e.y, e: e };
    });
    A.disposition.placer(noeuds, m.liens.map(function (l) { return { a: l.a, b: l.b }; }), { ecart: 60 });
    noeuds.forEach(function (n) { n.e.x = n.x; n.e.y = n.y; });
    return true;
  }

  /* Dessin ----------------------------------------------------------------------- */

  function cadreSysteme(m) {
    if (!m.systeme || !m.cas.length) return null;
    var bs = m.cas.map(function (c) { return boite(m, c.nom); });
    var x0 = Math.min.apply(null, bs.map(function (b) { return b.x; })) - 26, y0 = Math.min.apply(null, bs.map(function (b) { return b.y; })) - 44;
    var x1 = Math.max.apply(null, bs.map(function (b) { return b.x + b.l; })) + 26, y1 = Math.max.apply(null, bs.map(function (b) { return b.y + b.h; })) + 22;
    return { x: x0, y: y0, l: x1 - x0, h: y1 - y0 };
  }

  function dessiner(g, m, avecId) {
    var cadre = cadreSysteme(m);
    if (cadre) {
      N.svg("rect", { x: cadre.x, y: cadre.y, width: cadre.l, height: cadre.h, rx: 3, "class": "cv-systeme" }, g);
      N.texteSvg(g, cadre.x + 12, cadre.y + 22, m.systeme, "cv-nom-systeme");
    }
    var gLiens = N.svg("g", { "class": "cv-liens" }, g);
    m.liens.forEach(function (l, i) {
      var ba = boite(m, l.a), bb = boite(m, l.b);
      if (!ba || !bb) return;
      var ca = centre(ba), cb = centre(bb), debut = bord(ba, cb.x, cb.y), fin = bord(bb, ca.x, ca.y);
      if (l.a === l.b) return;
      var grp = N.svg("g", { "class": "cv-lien-cas", "data-lien": avecId ? String(i) : null, "data-arc": l.a + "--" + l.b }, gLiens);
      var d = "M" + debut.x.toFixed(1) + " " + debut.y.toFixed(1) + " L" + fin.x.toFixed(1) + " " + fin.y.toFixed(1);
      var finTrait = fin, p = null;
      if (l.type === "generalisation") {
        p = G.pointe(debut.x, debut.y, fin.x, fin.y, "triangle", 13);
        finTrait = G.pointSur(fin.x, fin.y, debut.x, debut.y, p.recul, 0);
      } else if (l.type !== "association") p = G.pointe(debut.x, debut.y, fin.x, fin.y, "ouverte", 11);
      var dTrait = "M" + debut.x.toFixed(1) + " " + debut.y.toFixed(1) + " L" + finTrait.x.toFixed(1) + " " + finTrait.y.toFixed(1);
      N.svg("path", { d: d, "class": "cv-zone-clic" }, grp);
      N.svg("path", { d: dTrait, "class": "cv-trait" + (l.type === "include" || l.type === "extend" ? " cv-pointille" : "") }, grp);
      if (p) N.svg("path", { d: p.d, "class": "cv-pointe" + (p.ouverte ? " ouverte" : "") }, grp);
      var texte = l.type === "include" || l.type === "extend" ? "« " + l.type + " »" : l.etiquette;
      if (texte) N.texteSvg(grp, (debut.x + fin.x) / 2, (debut.y + fin.y) / 2 - 5, texte, "cv-nom-lien", "middle");
    });
    var gNoeuds = N.svg("g", { "class": "cv-noeuds" }, g);
    m.cas.forEach(function (c) {
      var t = tailleCas(c), x = (c.x || 0) + t.l / 2, y = (c.y || 0) + t.h / 2;
      var grp = N.svg("g", { "class": "cv-cas", "data-noeud": avecId ? c.nom : null, "data-mobile": avecId ? "" : null, "data-nom": c.nom }, gNoeuds);
      N.svg("ellipse", { cx: x, cy: y, rx: t.l / 2, ry: t.h / 2, "class": "cv-boite cv-ellipse" }, grp);
      t.lignes.forEach(function (l, i) { N.texteSvg(grp, x, y + 4.5 + (i - (t.lignes.length - 1) / 2) * H_LIGNE, l, "cv-nom-cas", "middle"); });
    });
    m.acteurs.forEach(function (a) {
      var t = tailleActeur(a), x0 = a.x || 0, y0 = a.y || 0, cx = x0 + t.l / 2;
      var grp = N.svg("g", { "class": "cv-acteur " + a.genre, "data-noeud": avecId ? a.nom : null, "data-mobile": avecId ? "" : null, "data-nom": a.nom }, gNoeuds);
      N.svg("rect", { x: x0, y: y0, width: t.l, height: t.h, "class": "cv-zone-clic-rect" }, grp);
      if (a.genre === "systeme") {
        N.svg("rect", { x: x0, y: y0, width: t.l, height: t.h, rx: 2, "class": "cv-boite" }, grp);
        N.texteSvg(grp, cx, y0 + 16, "« actor »", "cv-stereo", "middle");
        t.lignes.forEach(function (l, i) { N.texteSvg(grp, cx, y0 + 34 + i * H_LIGNE, l, "cv-nom-cas", "middle"); });
      } else {
        N.svg("circle", { cx: cx, cy: y0 + 7, r: 6.5, "class": "cv-boite" }, grp);
        N.svg("path", { d: "M" + cx + " " + (y0 + 14) + " v14 M" + (cx - 11) + " " + (y0 + 19) + " h22 M" + cx + " " + (y0 + 28) + " l-9 12 M" + cx + " " + (y0 + 28) + " l9 12", "class": "cv-trait" }, grp);
        t.lignes.forEach(function (l, i) { N.texteSvg(grp, cx, y0 + H_BONHOMME + 13 + i * H_LIGNE, l, "cv-nom-cas", "middle"); });
      }
    });
  }

  function cadre(m) {
    var bs = m.acteurs.concat(m.cas).map(function (e) { return boite(m, e.nom); }), s = cadreSysteme(m);
    if (s) bs.push(s);
    if (!bs.length) return { x: 0, y: 0, l: 200, h: 80 };
    var x0 = Math.min.apply(null, bs.map(function (b) { return b.x; })) - 16, y0 = Math.min.apply(null, bs.map(function (b) { return b.y; })) - 16;
    return { x: x0, y: y0, l: Math.max.apply(null, bs.map(function (b) { return b.x + b.l; })) - x0 + 16, h: Math.max.apply(null, bs.map(function (b) { return b.y + b.h; })) - y0 + 16 };
  }

  /* Édition ---------------------------------------------------------------------- */

  function creer(conteneur, ctx) {
    var m = null, ro = ctx.lectureSeule, peinture = null, derniers = null;
    var cv = new A.Canevas(conteneur, {
      hauteur: ctx.hauteur, lectureSeule: ro, libelle: "Diagramme de cas d'utilisation",
      position: function (id) { var e = trouver(id); return { x: e.x, y: e.y }; },
      centre: function (id) { return centre(boite(m, id)); },
      surDeplacer: function (id, x, y) { var e = trouver(id); e.x = x; e.y = y; redessiner(); ctx.modifie(m, false); },
      surFinGeste: function () { ctx.modifie(m, true); },
      surLier: function (a, b) {
        cv.definirMode("normal"); majOutils();
        if (a === b) return;
        var acteurA = estActeur(a), acteurB = estActeur(b);
        var l = { type: acteurA && acteurB ? "generalisation" : acteurA || acteurB ? "association" : "include", a: acteurB && !acteurA ? b : a, b: acteurB && !acteurA ? a : b, etiquette: "" };
        m.liens.push(l);
        dessinerTout(); ctx.modifie(m, true);
        if (!acteurA && !acteurB) editerLien(m.liens.length - 1);
      },
      surDoubleClic: function (c, p, e) {
        if (ro) return;
        if (!c) { if (p) nouveauCas(p.x, p.y); return; }
        if (c.type === "noeud") editerElement(c.id, e); else editerLien(Number(c.id), e);
      },
      surSupprimer: function (sel) {
        if (sel.type === "noeud") {
          m.acteurs = m.acteurs.filter(function (a) { return a.nom !== sel.id; });
          m.cas = m.cas.filter(function (c) { return c.nom !== sel.id; });
          m.liens = m.liens.filter(function (l) { return l.a !== sel.id && l.b !== sel.id; });
        } else m.liens.splice(Number(sel.id), 1);
        cv.selectionner(null, true);
        dessinerTout(); ctx.modifie(m, true);
      },
      surClic: function (c) {
        if (!ctx.surClicElement) return;
        if (c.type === "noeud") ctx.surClicElement(c.id);
        else { var l = m.liens[Number(c.id)]; if (l) ctx.surClicElement(l.a + "--" + l.b); }
      },
      surEchap: majOutils
    });
    function trouver(id) { return m.acteurs.find(function (a) { return a.nom === id; }) || m.cas.find(function (c) { return c.nom === id; }); }
    function estActeur(id) { return m.acteurs.some(function (a) { return a.nom === id; }); }
    function redessiner() { if (!peinture) peinture = requestAnimationFrame(function () { peinture = null; dessinerTout(); }); }
    function dessinerTout() {
      cv.vider();
      if (!m) return;
      dessiner(cv.monde, m, true);
      cv.marquerSelection();
      if (derniers) appliquer(derniers);
    }
    function nomLibre(base) {
      if (!trouver(base)) return base;
      var i = 2;
      while (trouver(base + " " + i)) i++;
      return base + " " + i;
    }
    function nouveauCas(x, y) {
      var c = { nom: nomLibre("Nouveau cas"), x: A.disposition.aligner(x - 60), y: A.disposition.aligner(y - 26) };
      m.cas.push(c);
      dessinerTout(); ctx.modifie(m, false);   // entre dans l'historique à la validation du formulaire
      cv.selectionner({ type: "noeud", id: c.nom });
      editerElement(c.nom);
    }
    function nouvelActeur(x, y) {
      var a = { nom: nomLibre("Acteur"), genre: "humain", x: A.disposition.aligner(x - 35), y: A.disposition.aligner(y - 30) };
      m.acteurs.push(a);
      dessinerTout(); ctx.modifie(m, false);
      cv.selectionner({ type: "noeud", id: a.nom });
      editerElement(a.nom);
    }
    function position(e, type, id) {
      if (e && e.clientX != null) return { x: e.clientX + 10, y: e.clientY + 10 };
      var el = cv.monde.querySelector("[" + (type === "lien" ? "data-lien" : "data-noeud") + '="' + CSS.escape(String(id)) + '"]');
      if (!el) return {};
      var r = el.getBoundingClientRect();
      return { x: r.right + 8, y: r.top };
    }
    function editerElement(id, ev) {
      var e = trouver(id), acteur = estActeur(id), p = position(ev, "noeud", id);
      var champs = [{ nom: "nom", libelle: "Nom", valeur: e.nom }];
      if (acteur) champs.push({ nom: "systeme", libelle: "Acteur non humain (« actor »)", type: "case", valeur: e.genre === "systeme" });
      A.formulaire.ouvrir(cv.racine, {
        x: p.x, y: p.y, titre: acteur ? "Acteur" : "Cas d'utilisation", champs: champs,
        surValider: function (v) {
          var nom = v.nom.trim().replace(/\s+/g, " ");
          if (!nom) return "Le nom est vide.";
          if (/\s(--|\.\.>)\s|:/.test(nom)) return "Pas de « : », de « -- » ni de « ..> » dans un nom.";
          if (nom !== e.nom && trouver(nom)) return "Ce nom est déjà pris.";
          m.liens.forEach(function (l) { if (l.a === e.nom) l.a = nom; if (l.b === e.nom) l.b = nom; });
          e.nom = nom;
          if (acteur) e.genre = v.systeme ? "systeme" : "humain";
          dessinerTout(); ctx.modifie(m, true);
        },
        surSupprimer: function () { cv.options.surSupprimer({ type: "noeud", id: e.nom }); },
        surFermer: function () { cv.racine.focus({ preventScroll: true }); }
      });
    }
    function editerLien(i, ev) {
      var l = m.liens[i], p = position(ev, "lien", i), champs = [];
      var acteurs = estActeur(l.a) && estActeur(l.b), mixte = estActeur(l.a) !== estActeur(l.b);
      if (mixte) champs.push({ nom: "etiquette", libelle: "Étiquette (par exemple : secondaire)", valeur: l.etiquette });
      else if (acteurs) champs.push({ nom: "type", libelle: "Nature", type: "choix", valeur: "generalisation", options: [["generalisation", "Généralisation"]] });
      else champs.push({ nom: "type", libelle: "Nature", type: "choix", valeur: l.type, options: [["include", "« include »"], ["extend", "« extend »"], ["generalisation", "Généralisation"]] });
      var fleche = mixte ? " – " : " → ";
      A.formulaire.ouvrir(cv.racine, {
        x: p.x, y: p.y, titre: l.a + fleche + l.b, champs: champs,
        actions: mixte ? [] : [{ libelle: "Inverser", action: function () { A.formulaire.fermer(false); var x = l.a; l.a = l.b; l.b = x; dessinerTout(); ctx.modifie(m, true); } }],
        surValider: function (v) {
          if (mixte) l.etiquette = v.etiquette.trim(); else l.type = v.type;
          dessinerTout(); ctx.modifie(m, true);
        },
        surSupprimer: function () { cv.options.surSupprimer({ type: "lien", id: String(i) }); },
        surFermer: function () { cv.racine.focus({ preventScroll: true }); }
      });
    }
    var boutonLier = null;
    function majOutils() { if (boutonLier) boutonLier.classList.toggle("actif", cv.mode === "lier"); }
    function appliquer(liste) {
      function norme(t) { return N.sansAccents(String(t == null ? "" : t)).toLowerCase().replace(/\s+/g, ""); }
      cv.surligner(liste.map(function (s) {
        var t = norme(s.cible), els = [];
        Array.prototype.forEach.call(cv.monde.querySelectorAll("[data-nom], [data-arc]"), function (e) {
          if (norme(e.getAttribute("data-nom") || e.getAttribute("data-arc")) === t) els.push(e);
        });
        return { classe: s.classe, elements: els };
      }));
    }
    // Près du centre de la vue, à la première place libre
    function auCentre(f) {
      var r = cv.svg.getBoundingClientRect(), p = cv.point({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
      var q = A.disposition.placeLibre(p, m.acteurs.concat(m.cas).map(function (e) { return boite(m, e.nom); }), 110, 60, 170, 90);
      f(q.x, q.y);
    }
    var premier = true;
    return {
      canevas: cv,
      afficher: function (modele) {
        m = modele;
        var place = placer(m, false);
        dessinerTout();
        if (premier || place) { premier = false; requestAnimationFrame(function () { cv.ajuster(1.2); }); }
        if (place) ctx.modifie(m, false);
      },
      outils: function () {
        if (ro) return [];
        var acteur = N.bouton("+ Acteur", "petit", function () { auCentre(nouvelActeur); }, "Ajouter un acteur");
        var cas = N.bouton("+ Cas", "petit", function () { auCentre(nouveauCas); }, "Ajouter un cas d'utilisation (ou double-clic sur le fond)");
        boutonLier = N.bouton("Relier", "petit", function () { cv.definirMode(cv.mode === "lier" ? "normal" : "lier"); majOutils(); }, "Relier deux éléments : glisser du premier au second");
        return [acteur, cas, boutonLier];
      },
      surligner: function (liste) { derniers = liste; appliquer(liste); },
      effacerSurlignage: function () { derniers = null; cv.effacerSurlignage(); },
      reorganiser: function () { if (!m) return; placer(m, true); dessinerTout(); ctx.modifie(m, true); requestAnimationFrame(function () { cv.ajuster(1.2); }); },
      ajuster: function () { cv.ajuster(1.2); },
      focus: function () { cv.racine.focus(); }
    };
  }

  function statique(modele) {
    var m = N.copie(modele);
    placer(m, false);
    var svg = N.svg("svg", { "class": "atelier-svg statique", role: "img" });
    dessiner(N.svg("g", null, svg), m, false);
    var b = cadre(m);
    svg.setAttribute("viewBox", b.x + " " + b.y + " " + b.l + " " + b.h);
    svg.setAttribute("width", Math.round(b.l));
    return svg;
  }

  A.vues.cas = { creer: creer, statique: statique, reorganisable: true, aideVide: "« + Acteur » et « + Cas », ou double-cliquer sur le fond, puis « Relier » ; ou écrire dans la vue texte." };
})(window.Atelier);
