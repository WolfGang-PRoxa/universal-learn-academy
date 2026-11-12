/* ==========================================================================
   Atelier · vue « classes » : diagramme de classes UML (interface)
   --------------------------------------------------------------------------
   Dessin sur le canevas : classes déplaçables, associations avec
   multiplicités, rôles et nom, compositions, agrégations, héritages,
   réalisations, dépendances, classes d'association en pointillés, objets.
   Édition : « + Classe », double-clic sur le fond (nouvelle classe) ou sur
   un élément (formulaire), mode « Relier » (glisser d'une classe à une
   autre), Suppr. Les membres d'une classe s'éditent dans la syntaxe texte.
   ========================================================================== */
(function (A) {
  "use strict";

  var N = A.noyau, G = A.geometrie, E = function () { return A.editeurs.classes; };
  var H_LIGNE = 18, H_ENTETE = 28, MARGE = 8, L_MIN = 120;

  /* Mesures et géométrie ------------------------------------------------------- */

  function titreClasse(c) { return c.genre === "objet" ? c.nom + " : " + c.type : c.nom; }
  function libelleMembre(a) { return E().ecrireMembre(a).replace(/\s*\{(PK|pk|id)\}/, ""); }

  function tailleClasse(c) {
    var pNom = N.police("--police-texte", 14, 650), pMembre = N.police("--police-code", 12.5, 400), pSt = N.police("--police-texte", 11.5, 400);
    var st = etiquetteStereo(c);
    var larg = N.largeurTexte(titreClasse(c), pNom);
    if (st) larg = Math.max(larg, N.largeurTexte(st, pSt));
    c.attributs.forEach(function (a) { larg = Math.max(larg, N.largeurTexte(libelleMembre(a), pMembre) + (E().estCle(a) ? 0 : 0)); });
    (c.methodes || []).forEach(function (m) { larg = Math.max(larg, N.largeurTexte(E().ecrireMethode(m), pMembre)); });
    var hEntete = H_ENTETE + (st ? 14 : 0);
    var nA = Math.max(1, c.attributs.length), nM = (c.methodes || []).length;
    return {
      l: Math.max(L_MIN, Math.ceil(larg + 2 * MARGE + 4)),
      h: hEntete + nA * H_LIGNE + MARGE + (nM ? nM * H_LIGNE + MARGE : 0),
      hEntete: hEntete
    };
  }
  function etiquetteStereo(c) {
    if (c.genre === "interface") return "«interface»";
    if (c.genre === "enumeration") return "«énumération»";
    return c.stereotype ? "«" + c.stereotype + "»" : "";
  }

  function rectangles(m) {
    var r = {};
    m.classes.forEach(function (c) {
      var t = tailleClasse(c);
      r[c.nom.toLowerCase()] = { x: c.x || 0, y: c.y || 0, l: t.l, h: t.h, hEntete: t.hEntete, classe: c };
    });
    return r;
  }

  // Donne une place aux classes qui n'en ont pas. Les classes ordinaires sont placées par forces ;
  // une classe d'association à placer se met ensuite
  // au milieu de son association, du côté le moins encombré (convention UML)
  function placer(m, tout) {
    var noeuds = m.classes.map(function (c) { var t = tailleClasse(c); return { id: c.nom.toLowerCase(), l: t.l, h: t.h, x: tout ? null : c.x, y: tout ? null : c.y, c: c }; });
    if (!tout && noeuds.every(function (n) { return n.x != null && n.y != null; })) return false;
    var parId = {}, assoc = {};
    noeuds.forEach(function (n) { parId[n.id] = n; });
    m.liens.forEach(function (l) { if (l.classeAsso && parId[l.classeAsso.toLowerCase()]) assoc[l.classeAsso.toLowerCase()] = l; });
    var aPoser = noeuds.filter(function (n) { return assoc[n.id] && n.x == null; });
    var principaux = noeuds.filter(function (n) { return aPoser.indexOf(n) < 0; });
    var liens = m.liens.map(function (l) { return { a: l.a.toLowerCase(), b: l.b.toLowerCase() }; });
    A.disposition.placer(principaux, liens, { ecart: 60, tout: tout });
    aPoser.forEach(function (n) {
      var l = assoc[n.id], a = parId[l.a.toLowerCase()], b = parId[l.b.toLowerCase()];
      if (!a || !b || a.x == null || b.x == null) { n.x = 0; n.y = 0; return; }
      if (a === b) { n.x = A.disposition.aligner(a.x + a.l + 90); n.y = A.disposition.aligner(a.y - 20); return; }
      var ax = a.x + a.l / 2, ay = a.y + a.h / 2, bx = b.x + b.l / 2, by = b.y + b.h / 2;
      var mx = (ax + bx) / 2, my = (ay + by) / 2, dx = bx - ax, dy = by - ay, d = Math.sqrt(dx * dx + dy * dy) || 1;
      var px = -dy / d, py = dx / d, recul = 40 + Math.abs(px) * n.l / 2 + Math.abs(py) * n.h / 2;
      var poses = noeuds.filter(function (x) { return x !== n && x.x != null; });
      function genant(cx, cy) {
        var r = { x: cx - n.l / 2 - 12, y: cy - n.h / 2 - 12, l: n.l + 24, h: n.h + 24 };
        return poses.filter(function (x) { return x.x < r.x + r.l && x.x + x.l > r.x && x.y < r.y + r.h && x.y + x.h > r.y; }).length;
      }
      var c1 = { x: mx + px * recul, y: my + py * recul }, c2 = { x: mx - px * recul, y: my - py * recul };
      var c = genant(c2.x, c2.y) < genant(c1.x, c1.y) ? c2 : c1;
      n.x = A.disposition.aligner(c.x - n.l / 2); n.y = A.disposition.aligner(c.y - n.h / 2);
    });
    if (aPoser.length) A.disposition.separer(noeuds, aPoser, 20);
    if (tout || !noeuds.some(function (n) { return n.c.x != null; })) {
      var mx0 = Math.min.apply(null, noeuds.map(function (n) { return n.x; })), my0 = Math.min.apply(null, noeuds.map(function (n) { return n.y; }));
      noeuds.forEach(function (n) { n.x = A.disposition.aligner(n.x - mx0 + 20); n.y = A.disposition.aligner(n.y - my0 + 20); });
    }
    noeuds.forEach(function (n) { n.c.x = n.x; n.c.y = n.y; });
    return true;
  }

  /* Dessin ----------------------------------------------------------------------- */

  function dessinerClasse(g, c, r, avecId) {
    var grp = N.svg("g", { "class": "cv-classe" + (c.genre === "abstraite" ? " abstraite" : c.genre === "objet" ? " objet" : ""), "data-noeud": avecId ? c.nom : null, "data-mobile": avecId ? "" : null }, g);
    N.svg("rect", { x: r.x, y: r.y, width: r.l, height: r.h, rx: 3, "class": "cv-boite" }, grp);
    N.svg("rect", { x: r.x + 0.75, y: r.y + 0.75, width: r.l - 1.5, height: r.hEntete - 0.75, rx: 2.5, "class": "cv-entete" }, grp);
    var st = etiquetteStereo(c), y = r.y + 19;
    if (st) { N.texteSvg(grp, r.x + r.l / 2, r.y + 15, st, "cv-stereo", "middle"); y += 13; }
    N.texteSvg(grp, r.x + r.l / 2, y, titreClasse(c), "cv-nom", "middle");
    N.svg("line", { x1: r.x, y1: r.y + r.hEntete, x2: r.x + r.l, y2: r.y + r.hEntete, "class": "cv-separateur" }, grp);
    var ya = r.y + r.hEntete + MARGE / 2 + 13;
    c.attributs.forEach(function (a) {
      var t = N.texteSvg(grp, r.x + MARGE, ya, libelleMembre(a), "cv-membre" + (E().estCle(a) ? " cv-cle" : ""));
      t.setAttribute("data-cible", c.nom + "." + a.nom);
      ya += H_LIGNE;
    });
    if (!c.attributs.length) ya += H_LIGNE;
    if ((c.methodes || []).length) {
      var ys = ya - 13 + MARGE / 2;
      N.svg("line", { x1: r.x, y1: ys, x2: r.x + r.l, y2: ys, "class": "cv-separateur" }, grp);
      ya = ys + MARGE / 2 + 13;
      c.methodes.forEach(function (m) {
        var t = N.texteSvg(grp, r.x + MARGE, ya, E().ecrireMethode(m), "cv-membre");
        t.setAttribute("data-cible", c.nom + "." + m.nom + "()");
        ya += H_LIGNE;
      });
    }
    return grp;
  }

  function cleLien(l) { return [l.a.toLowerCase(), l.b.toLowerCase()].sort().join("~"); }

  function dessinerLien(g, l, i, rects, decalage, avecId) {
    var ra = rects[l.a.toLowerCase()], rb = rects[l.b.toLowerCase()];
    if (!ra || !rb) return null;
    var grp = N.svg("g", { "class": "cv-lien cv-" + l.genre, "data-lien": avecId ? String(i) : null, "data-paire": cleLien(l) }, g);
    var pointille = l.genre === "realisation" || l.genre === "dependance";
    var d, a, b, milieu;
    if (ra === rb) {
      // Boucle réflexive, sur un coin supérieur, à tour de rôle à droite et à gauche
      var s = decalage % 2 ? -1 : 1, k = Math.floor(decalage / 2) * 16;
      var x0 = s > 0 ? ra.x + ra.l : ra.x, y0 = ra.y + Math.min(ra.h * 0.35, 40) + k, x1 = x0 - s * (ra.l * 0.3 + k), y1 = ra.y;
      var ext = 34 + k;
      d = "M" + x0 + " " + y0 + " H" + (x0 + s * ext) + " V" + (y1 - ext) + " H" + x1 + " V" + y1;
      a = { x: x0, y: y0, vx: x0 + s * 20, vy: y0 };
      b = { x: x1, y: y1, vx: x1, vy: y1 - 20 };
      milieu = { x: x0 + s * (ext + 6), y: (y0 + y1 - ext) / 2, ancre: s > 0 ? "start" : "end" };
    } else {
      var ca = { x: ra.x + ra.l / 2, y: ra.y + ra.h / 2 }, cb = { x: rb.x + rb.l / 2, y: rb.y + rb.h / 2 };
      // Associations parallèles : le segment entre les centres est décalé perpendiculairement
      var L = G.longueur(ca.x, ca.y, cb.x, cb.y) || 1, px = -(cb.y - ca.y) / L * decalage, py = (cb.x - ca.x) / L * decalage;
      var ca2 = { x: ca.x + px, y: ca.y + py }, cb2 = { x: cb.x + px, y: cb.y + py };
      var pa = G.dedans(ra, ca2.x, ca2.y) ? G.sortieRect(ra, ca2.x, ca2.y, cb2.x, cb2.y) : G.bordRect(ra, cb.x, cb.y);
      var pb = G.dedans(rb, cb2.x, cb2.y) ? G.sortieRect(rb, cb2.x, cb2.y, ca2.x, ca2.y) : G.bordRect(rb, ca.x, ca.y);
      a = { x: pa.x, y: pa.y, vx: pb.x, vy: pb.y };
      b = { x: pb.x, y: pb.y, vx: pa.x, vy: pa.y };
      d = "M" + a.x.toFixed(1) + " " + a.y.toFixed(1) + " L" + b.x.toFixed(1) + " " + b.y.toFixed(1);
      milieu = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
    // Têtes et raccourcissement du trait
    var teteA = null, teteB = null;
    if (l.genre === "composition") teteA = "losange-plein";
    else if (l.genre === "agregation") teteA = "losange";
    else if (l.genre === "heritage" || l.genre === "realisation") teteB = "triangle";
    else if (l.genre === "dependance") teteB = "ouverte";
    else if (l.navigable === "b") teteB = "ouverte";
    else if (l.navigable === "a") teteA = "ouverte";
    N.svg("path", { d: d, "class": "cv-zone-clic" }, grp);
    N.svg("path", { d: d, "class": pointille ? "cv-trait cv-pointille" : "cv-trait" }, grp);
    [[teteA, a], [teteB, b]].forEach(function (x) {
      if (!x[0]) return;
      var p = G.pointe(x[1].vx, x[1].vy, x[1].x, x[1].y, x[0], x[0].indexOf("losange") === 0 ? 11 : 13);
      N.svg("path", { d: p.d, "class": "cv-pointe" + (x[0] === "losange-plein" ? " pleine" : "") + (p.ouverte ? " ouverte" : "") }, grp);
    });
    // Multiplicités (côté extérieur) et rôles (côté intérieur) près de chaque extrémité
    var cote = ra === rb && decalage % 2 ? -1 : 1;   // boucle de gauche : le rôle reste à l'intérieur de la boucle
    function etiquettes(ext, mult, role, signe) {
      var recul = ext === a && (teteA || "").indexOf("losange") === 0 ? 24 : ext === b && teteB === "triangle" ? 20 : 12;
      if (mult) {
        var pm = G.pointSur(ext.x, ext.y, ext.vx, ext.vy, recul + 8, 11 * signe);
        N.texteSvg(grp, pm.x, pm.y + 4, mult, "cv-mult", "middle");
      }
      if (role) {
        // Sur une boucle, le rôle du haut part du trait ; ailleurs, il est centré, assez loin de la boîte pour ne pas passer dessous
        var boucle = ra === rb && ext === b;
        var long = G.longueur(ext.x, ext.y, ext.vx, ext.vy) || 1;
        var sortie = ra === rb ? 0 : N.largeurTexte(role, N.police("--police-texte", 12, 400)) / 2 * Math.abs(ext.vx - ext.x) / long;
        // Associations parallèles : rôles décalés le long du trait, sinon ils se recouvrent quand les traits sont verticaux
        var pr = G.pointSur(ext.x, ext.y, ext.vx, ext.vy, recul + 8 + sortie + (ra !== rb && decalage > 0 ? 15 : 0), (boucle ? -6 : -12) * signe);
        N.texteSvg(grp, pr.x, pr.y + 4, role, "cv-role", boucle ? (cote > 0 ? "start" : "end") : "middle");
      }
    }
    etiquettes(a, l.ma, l.ra, cote);
    etiquettes(b, l.mb, l.rb, -cote);
    if (l.nom) {
      var fleche = l.sens === ">" ? " ▸" : "", avant = l.sens === "<" ? "◂ " : "";
      var pn = ra === rb ? milieu : G.pointSur(a.x, a.y, b.x, b.y, G.longueur(a.x, a.y, b.x, b.y) / 2, -10);
      N.texteSvg(grp, pn.x, pn.y + (ra === rb ? 4 : 0), avant + l.nom + fleche, "cv-nom-lien", milieu.ancre || "middle");
    }
    return { groupe: grp, milieu: milieu };
  }

  function dessiner(g, m, avecId) {
    var rects = rectangles(m);
    var parPaire = {};
    m.liens.forEach(function (l) { var k = cleLien(l); (parPaire[k] = parPaire[k] || []).push(l); });
    var milieux = {};
    var gLiens = N.svg("g", { "class": "cv-liens" }, g);
    m.liens.forEach(function (l, i) {
      var grp = parPaire[cleLien(l)], k = grp.indexOf(l), n = grp.length;
      var dec = l.a.toLowerCase() === l.b.toLowerCase() ? k : (k - (n - 1) / 2) * 34;   // écart entre associations parallèles : leurs noms ne se chevauchent pas
      var r = dessinerLien(gLiens, l, i, rects, dec, avecId);
      if (r) milieux[i] = r.milieu;
    });
    // Classes d'association : pointillés du milieu de l'association vers la classe
    m.liens.forEach(function (l, i) {
      var rc = l.classeAsso && rects[l.classeAsso.toLowerCase()], mi = milieux[i];
      if (!rc || !mi) return;
      var p = G.bordRect(rc, mi.x, mi.y);
      N.svg("line", { x1: mi.x, y1: mi.y, x2: p.x, y2: p.y, "class": "cv-trait cv-pointille cv-attache", "data-paire": cleLien(l) }, gLiens);
    });
    var gClasses = N.svg("g", { "class": "cv-classes" }, g);
    m.classes.forEach(function (c) { dessinerClasse(gClasses, c, rects[c.nom.toLowerCase()], avecId); });
    return rects;
  }

  function cadre(rects, m) {
    var xs = [], ys = [];
    Object.keys(rects).forEach(function (k) { var r = rects[k]; xs.push(r.x, r.x + r.l); ys.push(r.y, r.y + r.h); });
    m.liens.forEach(function (l) {
      if (l.a.toLowerCase() === l.b.toLowerCase() && rects[l.a.toLowerCase()]) {
        var r = rects[l.a.toLowerCase()];
        xs.push(r.x - 90, r.x + r.l + 90); ys.push(r.y - 50);
      }
    });
    if (!xs.length) return { x: 0, y: 0, l: 200, h: 80 };
    var x0 = Math.min.apply(null, xs) - 40, y0 = Math.min.apply(null, ys) - 30;
    return { x: x0, y: y0, l: Math.max.apply(null, xs) - x0 + 40, h: Math.max.apply(null, ys) - y0 + 30 };
  }

  /* Vue interactive ------------------------------------------------------------------- */

  function creer(conteneur, ctx) {
    var m = null, ro = ctx.lectureSeule, genreLien = "association", peinture = null;
    var cv = new A.Canevas(conteneur, {
      hauteur: ctx.hauteur,
      lectureSeule: ro,
      libelle: "Diagramme de classes",
      position: function (id) { var c = trouver(id); return { x: c.x, y: c.y }; },
      centre: function (id) { var c = trouver(id), t = tailleClasse(c); return { x: c.x + t.l / 2, y: c.y + t.h / 2 }; },
      surDeplacer: function (id, x, y) { var c = trouver(id); c.x = x; c.y = y; redessiner(); ctx.modifie(m, false); },
      surFinGeste: function () { ctx.modifie(m, true); },
      surLier: function (a, b) {
        var l = { a: trouver(a).nom, b: trouver(b).nom, genre: genreLien, ma: "", ra: "", mb: "", rb: "", nom: "", sens: "", navigable: "", classeAsso: "" };
        var objets = trouver(a).genre === "objet" && trouver(b).genre === "objet";
        if (genreLien === "composition" && !objets) l.ma = "1";
        m.liens.push(l);
        redessiner(); ctx.modifie(m, true);
        cv.definirMode("normal"); majOutils();
        if (!objets && (genreLien === "association" || genreLien === "composition" || genreLien === "agregation")) editerLien(m.liens.length - 1);
      },
      surDoubleClic: function (c, p, e) {
        if (ro) return;
        if (!c) { if (p) nouvelleClasse(p.x, p.y); return; }
        if (c.type === "noeud") editerClasse(c.id, e);
        else editerLien(Number(c.id), e);
      },
      surSupprimer: function (sel) {
        if (sel.type === "noeud") {
          var c = trouver(sel.id);
          m.classes.splice(m.classes.indexOf(c), 1);
          m.liens = m.liens.filter(function (l) { return l.a.toLowerCase() !== c.nom.toLowerCase() && l.b.toLowerCase() !== c.nom.toLowerCase(); });
          m.liens.forEach(function (l) { if (l.classeAsso && l.classeAsso.toLowerCase() === c.nom.toLowerCase()) l.classeAsso = ""; });
        } else m.liens.splice(Number(sel.id), 1);
        cv.selectionner(null, true);
        redessiner(); ctx.modifie(m, true);
      },
      surClic: function (c, e) { if (ctx.surClicElement) ctx.surClicElement(cibleElement(c, e), e); },
      surEchap: majOutils
    });

    function trouver(id) { return m.classes.find(function (c) { return c.nom.toLowerCase() === String(id).toLowerCase(); }); }
    function cibleElement(c, e) {
      if (c.type === "lien") { var l = m.liens[Number(c.id)]; return l ? l.a + "--" + l.b : null; }
      var t = e && e.target && e.target.closest && e.target.closest("[data-cible]");
      return t ? t.getAttribute("data-cible") : (trouver(c.id) || {}).nom;
    }

    function redessiner() {
      if (peinture) return;
      peinture = requestAnimationFrame(function () { peinture = null; dessinerTout(); });
    }
    function dessinerTout() {
      cv.vider();
      if (!m) return;
      dessiner(cv.monde, m, true);
      cv.marquerSelection();
      if (derniersSurlignages) appliquerSurlignage(derniersSurlignages);
    }

    function nomLibre(base) {
      var i = 1;
      while (trouver(base + i)) i++;
      return base + i;
    }
    function nouvelleClasse(x, y) {
      var c = { nom: nomLibre(ctx.options.objets ? "objet" : "Classe"), genre: ctx.options.objets ? "objet" : "classe", type: ctx.options.objets ? "Classe" : "", stereotype: "", attributs: [], methodes: [], x: A.disposition.aligner(x - 60), y: A.disposition.aligner(y - 30) };
      m.classes.push(c);
      dessinerTout(); ctx.modifie(m, false);   // entre dans l'historique à la validation du formulaire
      cv.selectionner({ type: "noeud", id: c.nom });
      editerClasse(c.nom, null, function () {   // formulaire annulé : la classe n'est pas créée
        m.classes.splice(m.classes.indexOf(c), 1);
        cv.selectionner(null, true);
        dessinerTout(); ctx.modifie(m, false);
      });
    }

    function positionFormulaire(e, id, type) {
      if (e && e.clientX != null) return { x: e.clientX + 10, y: e.clientY + 10 };
      var el = cv.monde.querySelector("[" + (type === "lien" ? "data-lien" : "data-noeud") + '="' + CSS.escape(String(id)) + '"]');
      if (!el) return {};
      var r = el.getBoundingClientRect();
      return { x: r.right + 8, y: r.top };
    }

    function editerClasse(id, e, surAnnuler) {
      var c = trouver(id);
      if (!c) return;
      var pos = positionFormulaire(e, id, "noeud");
      var membres = c.attributs.map(E().ecrireMembre).join("\n");
      var methodes = (c.methodes || []).map(E().ecrireMethode).join("\n");
      var objet = c.genre === "objet";
      var champs = objet ? [
        { nom: "nom", libelle: "Nom de l'objet", valeur: c.nom },
        { nom: "type", libelle: "Classe", valeur: c.type },
        { nom: "attributs", libelle: "Valeurs (une par ligne)", type: "zone", valeur: membres, lignes: Math.max(3, c.attributs.length + 1), placeholder: "pleine = true" }
      ] : [
        { nom: "nom", libelle: "Nom", valeur: c.nom },
        { nom: "genre", libelle: "Genre", type: "choix", valeur: c.genre, options: [["classe", "Classe"], ["abstraite", "Classe abstraite"], ["interface", "Interface"], ["enumeration", "Énumération"]] },
        { nom: "attributs", libelle: "Attributs (un par ligne)", type: "zone", valeur: membres, lignes: Math.max(3, c.attributs.length + 1),
          aide: "nom : type [multiplicité] {PK}", placeholder: "id : int {PK}\nnom : varchar" }
      ];
      if (ctx.options.methodes || methodes) champs.push({ nom: "methodes", libelle: "Méthodes (une par ligne)", type: "zone", valeur: methodes, lignes: 2, placeholder: "+ age() : int" });
      A.formulaire.ouvrir(cv.racine, {
        x: pos.x, y: pos.y, titre: objet ? "Objet" : "Classe",
        champs: champs,
        surAnnuler: surAnnuler,
        surValider: function (v) {
          var nom = v.nom.trim();
          if (!A.syntaxe.nomValide(nom) || /[-]/.test(nom)) return "Nom invalide : lettres, chiffres et _ seulement.";
          var autre = trouver(nom);
          if (autre && autre !== c) return "Une autre classe s'appelle déjà « " + nom + " ».";
          if (objet && !A.syntaxe.nomValide(v.type.trim())) return "Classe invalide : lettres, chiffres et _ seulement.";
          var r = E().lireMembres(v.attributs + (v.methodes != null ? "\n" + v.methodes : ""), nom);
          if (r.erreurs.length) return r.erreurs[0].message;
          var ancien = c.nom;
          c.nom = nom;
          if (objet) c.type = v.type.trim(); else c.genre = v.genre;
          c.attributs = r.attributs;
          c.methodes = r.methodes;
          if (ancien !== nom) m.liens.forEach(function (l) {
            if (l.a === ancien) l.a = nom;
            if (l.b === ancien) l.b = nom;
            if (l.classeAsso === ancien) l.classeAsso = nom;
          });
          dessinerTout(); ctx.modifie(m, true);
        },
        surSupprimer: function () { cv.selectionner({ type: "noeud", id: c.nom }, true); cv.options.surSupprimer({ type: "noeud", id: c.nom }); },
        surFermer: function () { cv.racine.focus({ preventScroll: true }); }
      });
    }

    function editerLien(i, e) {
      var l = m.liens[i];
      if (!l) return;
      var pos = positionFormulaire(e, i, "lien");
      var classes = [["", "(aucune)"]].concat(m.classes.map(function (c) { return [c.nom, c.nom]; }));
      A.formulaire.ouvrir(cv.racine, {
        x: pos.x, y: pos.y, titre: "Lien " + l.a + " – " + l.b,
        champs: [
          { nom: "genre", libelle: "Type", type: "choix", valeur: l.genre, options: [["association", "Association"], ["composition", "Composition (losange côté " + l.a + ")"], ["agregation", "Agrégation (losange côté " + l.a + ")"], ["heritage", l.a + " hérite de " + l.b], ["realisation", l.a + " réalise " + l.b], ["dependance", l.a + " dépend de " + l.b]] },
          { nom: "ma", libelle: "Multiplicité côté " + l.a, valeur: l.ma, placeholder: "1, 0..1, *, 1..*" },
          { nom: "ra", libelle: "Rôle côté " + l.a, valeur: l.ra },
          { nom: "mb", libelle: "Multiplicité côté " + l.b, valeur: l.mb, placeholder: "1, 0..1, *, 1..*" },
          { nom: "rb", libelle: "Rôle côté " + l.b, valeur: l.rb },
          { nom: "nom", libelle: "Nom de l'association", valeur: l.nom },
          { nom: "sens", libelle: "Sens de lecture", type: "choix", valeur: l.sens, options: [["", "(aucun)"], [">", l.a + " ▸ " + l.b], ["<", l.a + " ◂ " + l.b]] },
          { nom: "navigable", libelle: "Navigabilité", type: "choix", valeur: l.navigable, options: [["", "(dans les deux sens)"], ["b", "vers " + l.b], ["a", "vers " + l.a]] },
          { nom: "classeAsso", libelle: "Classe d'association", type: "choix", valeur: l.classeAsso, options: classes }
        ],
        actions: [{ libelle: "Inverser", action: function () {
          A.formulaire.fermer(false);
          var x = l.a; l.a = l.b; l.b = x; x = l.ma; l.ma = l.mb; l.mb = x; x = l.ra; l.ra = l.rb; l.rb = x;
          if (l.navigable) l.navigable = l.navigable === "a" ? "b" : "a";
          if (l.sens) l.sens = l.sens === ">" ? "<" : ">";
          dessinerTout(); ctx.modifie(m, true); editerLien(i);
        } }],
        surValider: function (v) {
          var ok = function (t) { return !t.trim() || N.multiplicite(t); };
          if (!ok(v.ma) || !ok(v.mb)) return "Multiplicité invalide. Exemples : 1, 0..1, *, 1..*, 2..5.";
          l.genre = v.genre; l.ma = v.ma.trim(); l.ra = v.ra.trim(); l.mb = v.mb.trim(); l.rb = v.rb.trim();
          l.nom = v.nom.trim(); l.sens = v.sens; l.navigable = v.genre === "association" ? v.navigable : ""; l.classeAsso = v.classeAsso;
          dessinerTout(); ctx.modifie(m, true);
        },
        surSupprimer: function () { cv.options.surSupprimer({ type: "lien", id: String(i) }); },
        surFermer: function () { cv.racine.focus({ preventScroll: true }); }
      });
    }

    /* Barre d'outils de l'éditeur */
    var boutonLier = null, choixGenre = null;
    function majOutils() { if (boutonLier) boutonLier.classList.toggle("actif", cv.mode === "lier"); }
    function outils() {
      if (ro) return [];
      var ajout = N.bouton(ctx.options.objets ? "+ Objet" : "+ Classe", "petit", function () {
        var r = cv.svg.getBoundingClientRect(), p = cv.point({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 3 });
        var rects = rectangles(m), q = A.disposition.placeLibre(p, Object.keys(rects).map(function (k) { return rects[k]; }), 75, 45, 170, 110);
        nouvelleClasse(q.x, q.y);
      }, ctx.options.objets ? "Ajouter un objet (ou double-clic sur le fond)" : "Ajouter une classe (ou double-clic sur le fond)");
      choixGenre = N.el("select", "atelier-choix");
      [["association", "Association"], ["composition", "Composition"], ["agregation", "Agrégation"], ["heritage", "Héritage"], ["realisation", "Réalisation"], ["dependance", "Dépendance"]].forEach(function (o) {
        var opt = N.el("option", null, o[1]); opt.value = o[0]; choixGenre.appendChild(opt);
      });
      choixGenre.setAttribute("aria-label", "Type du prochain lien");
      choixGenre.addEventListener("change", function () { genreLien = choixGenre.value; cv.definirMode("lier"); majOutils(); });
      boutonLier = N.bouton("Relier", "petit", function () { cv.definirMode(cv.mode === "lier" ? "normal" : "lier"); majOutils(); },
        "Relier deux classes : glisser de la première à la seconde");
      return [ajout, choixGenre, boutonLier];
    }

    /* Surlignage des cibles (erreurs, écarts, remarques) */
    var derniersSurlignages = null;
    function elementsCible(cible) {
      if (!cible) return [];
      var t = String(cible);
      if (t.indexOf("--") > 0) {
        var p = t.split("--").map(function (x) { return x.trim().toLowerCase(); }).sort().join("~");
        return Array.prototype.slice.call(cv.monde.querySelectorAll('[data-paire="' + CSS.escape(p) + '"]'));
      }
      var membre = Array.prototype.filter.call(cv.monde.querySelectorAll("[data-cible]"), function (e) { return e.getAttribute("data-cible").toLowerCase() === t.toLowerCase(); });
      if (membre.length) return membre;
      var nom = t.split(".")[0];
      return Array.prototype.slice.call(cv.monde.querySelectorAll('[data-noeud="' + CSS.escape(nom) + '"]')).concat(
        Array.prototype.filter.call(cv.monde.querySelectorAll("[data-noeud]"), function (e) { return e.getAttribute("data-noeud").toLowerCase() === nom.toLowerCase() && e.getAttribute("data-noeud") !== nom; }));
    }
    function appliquerSurlignage(liste) {
      cv.surligner(liste.map(function (s) { return { classe: s.classe, elements: elementsCible(s.cible) }; }));
    }

    var premier = true;
    return {
      canevas: cv,
      afficher: function (modele) {
        m = modele;
        var place = placer(m, false);
        dessinerTout();
        if (premier || place) { premier = false; requestAnimationFrame(function () { cv.ajuster(1); }); }
        if (place) ctx.modifie(m, false);
      },
      outils: outils,
      surligner: function (liste) { derniersSurlignages = liste; appliquerSurlignage(liste); },
      effacerSurlignage: function () { derniersSurlignages = null; cv.effacerSurlignage(); },
      reorganiser: function () { if (!m) return; placer(m, true); dessinerTout(); ctx.modifie(m, true); requestAnimationFrame(function () { cv.ajuster(1); }); },
      ajuster: function () { cv.ajuster(1); },
      focus: function () { cv.racine.focus(); }
    };
  }

  /* Rendu statique (solution, revue d'un quiz, impression) ---------------------------------- */

  function statique(modele) {
    var m = N.copie(modele);
    placer(m, false);
    var svg = N.svg("svg", { "class": "atelier-svg statique", role: "img" });
    var g = N.svg("g", null, svg);
    var rects = dessiner(g, m, false);
    var b = cadre(rects, m);
    svg.setAttribute("viewBox", b.x + " " + b.y + " " + b.l + " " + b.h);
    svg.setAttribute("width", Math.round(b.l));
    return svg;
  }

  A.vues.classes = { creer: creer, statique: statique, reorganisable: true, aideVide: "Double-cliquer sur le fond pour ajouter une classe, ou écrire dans la vue texte." };
})(window.Atelier);
