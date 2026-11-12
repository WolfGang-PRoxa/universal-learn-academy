/* ==========================================================================
   Outil TODO · lecture, écriture et opérations sur TODO.md
   --------------------------------------------------------------------------
   Sert à la page (_outils/todo/index.html) et aux tests sous Node (outils/tests.js).

   Le fichier est découpé en blocs, dans l'ordre :
   - titre : une ligne « # … » à « ###### … » ;
   - liste : des lignes « - … » ou « * … », avec ou sans case « [ ] » /
     « [x] », chacune suivie de ses lignes indentées (sous-tâches, détails) ;
     une ligne de texte collée au-dessus de la liste en est l'étiquette
     (« Cours », « Quiz »…) ;
   - texte : tout le reste (paragraphes, tableaux, listes numérotées,
     séparateurs), gardé tel quel.
   Chaque bloc retient le nombre de lignes vides qui le précèdent, si bien
   que ecrire(lire(t)) === t, octet pour octet : ce que la page ne touche pas
   reste identique dans le fichier.
   ========================================================================== */
(function (racine) {
  "use strict";

  var TITRE = /^(#{1,6})(\s+)(.*)$/;
  var PUCE = /^([-*]) (?:\[( |x|X)\] )?(.*)$/;
  var SOUS_CASE = /^(\s+[-*] )\[( |x|X)\]( .*)?$/;
  var compteur = 0;

  function nouvelId(prefixe) { compteur += 1; return prefixe + compteur; }

  /* Lecture ------------------------------------------------------------------ */

  function estEtiquette(ligne) {
    return ligne !== undefined && !/^\s/.test(ligne) && !/^\|/.test(ligne) && !/^\d+[.)] /.test(ligne) && !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(ligne);
  }

  function lireListe(lignes, i) {
    var items = [];
    while (i < lignes.length) {
      var l = lignes[i], m = PUCE.exec(l);
      if (m) {
        items.push({ id: nouvelId("t"), puce: m[1], marque: m[2] === undefined ? null : m[2], texte: m[3], suite: [] });
        i += 1;
      } else if (items.length && /^\s+\S/.test(l)) {
        items[items.length - 1].suite.push(l);
        i += 1;
      } else {
        break;
      }
    }
    return { bloc: { id: nouvelId("b"), type: "liste", avant: 0, etiquette: null, items: items }, suite: i };
  }

  function lire(texte) {
    texte = String(texte);
    var fin = texte.indexOf("\r\n") >= 0 ? "\r\n" : "\n";
    var lignes = texte.split(/\r?\n/);
    var finale = lignes.length > 1 && lignes[lignes.length - 1] === "";
    if (finale) lignes.pop();
    var blocs = [], vides = 0, i = 0;
    while (i < lignes.length) {
      var l = lignes[i];
      if (l === "") { vides += 1; i += 1; continue; }
      var m = TITRE.exec(l);
      if (m) {
        blocs.push({ id: nouvelId("b"), type: "titre", avant: vides, niveau: m[1].length, espace: m[2], texte: m[3] });
        vides = 0; i += 1; continue;
      }
      if (PUCE.test(l)) {
        var r = lireListe(lignes, i);
        r.bloc.avant = vides;
        blocs.push(r.bloc);
        vides = 0; i = r.suite; continue;
      }
      var t = [];
      while (i < lignes.length && lignes[i] !== "" && !TITRE.test(lignes[i]) && !PUCE.test(lignes[i])) {
        t.push(lignes[i]); i += 1;
      }
      if (i < lignes.length && PUCE.test(lignes[i]) && estEtiquette(t[t.length - 1])) {
        var etiquette = t.pop();
        if (t.length) { blocs.push({ id: nouvelId("b"), type: "texte", avant: vides, lignes: t }); vides = 0; }
        var r2 = lireListe(lignes, i);
        r2.bloc.avant = vides;
        r2.bloc.etiquette = etiquette;
        blocs.push(r2.bloc);
        vides = 0; i = r2.suite;
      } else {
        blocs.push({ id: nouvelId("b"), type: "texte", avant: vides, lignes: t });
        vides = 0;
      }
    }
    return { fin: fin, finale: finale, apres: vides, blocs: blocs };
  }

  /* Écriture ------------------------------------------------------------------ */

  function ligneItem(it) {
    return it.puce + " " + (it.marque === null ? "" : "[" + it.marque + "] ") + it.texte;
  }

  function ecrire(doc) {
    var out = [];
    doc.blocs.forEach(function (b) {
      for (var k = 0; k < b.avant; k += 1) out.push("");
      if (b.type === "titre") out.push(new Array(b.niveau + 1).join("#") + (b.espace || " ") + b.texte);
      else if (b.type === "texte") out.push.apply(out, b.lignes);
      else {
        if (b.etiquette !== null && b.etiquette !== undefined) out.push(b.etiquette);
        b.items.forEach(function (it) { out.push(ligneItem(it)); out.push.apply(out, it.suite); });
      }
    });
    for (var k = 0; k < doc.apres; k += 1) out.push("");
    return out.join(doc.fin) + (doc.finale ? doc.fin : "");
  }

  /* Structure : sections (##) et sous-sections (###) ------------------------------ */

  // Vue hiérarchique, refaite à chaque affichage :
  // { intro: [blocs], sections: [{ titre, blocs, sous: [{ titre, blocs }] }] }
  function structure(doc) {
    var s = { intro: [], sections: [] }, section = null, sous = null;
    doc.blocs.forEach(function (b) {
      if (b.type === "titre" && b.niveau === 2) {
        section = { titre: b, blocs: [], sous: [] }; sous = null;
        s.sections.push(section);
      } else if (b.type === "titre" && b.niveau >= 3 && section) {
        sous = { titre: b, blocs: [] };
        section.sous.push(sous);
      } else if (sous) sous.blocs.push(b);
      else if (section) section.blocs.push(b);
      else s.intro.push(b);
    });
    return s;
  }

  function index(doc, id) {
    for (var i = 0; i < doc.blocs.length; i += 1) if (doc.blocs[i].id === id) return i;
    return -1;
  }
  function bloc(doc, id) { var i = index(doc, id); return i < 0 ? null : doc.blocs[i]; }

  // Blocs couverts par un titre : de lui jusqu'au prochain titre de niveau égal ou supérieur
  function portee(doc, idTitre) {
    var i = index(doc, idTitre);
    if (i < 0) return null;
    var niveau = doc.blocs[i].niveau, j = i + 1;
    while (j < doc.blocs.length && !(doc.blocs[j].type === "titre" && doc.blocs[j].niveau <= niveau)) j += 1;
    return { debut: i, fin: j };
  }

  // Fin du contenu propre d'un titre, avant son premier sous-titre
  function finContenu(doc, idTitre) {
    var p = portee(doc, idTitre), j = p.debut + 1;
    while (j < p.fin && doc.blocs[j].type !== "titre") j += 1;
    return j;
  }

  function trouverItem(doc, idItem) {
    for (var i = 0; i < doc.blocs.length; i += 1) {
      var b = doc.blocs[i];
      if (b.type !== "liste") continue;
      for (var k = 0; k < b.items.length; k += 1) if (b.items[k].id === idItem) return { bloc: b, index: k, item: b.items[k] };
    }
    return null;
  }

  /* Comptes -------------------------------------------------------------------- */

  // Tâches (cases) d'un ensemble de blocs, sous-tâches comprises
  function compter(blocs) {
    var n = { taches: 0, faites: 0 };
    blocs.forEach(function (b) {
      if (b.type !== "liste") return;
      b.items.forEach(function (it) {
        if (it.marque !== null) { n.taches += 1; if (it.marque !== " ") n.faites += 1; }
        it.suite.forEach(function (l) {
          var m = SOUS_CASE.exec(l);
          if (m) { n.taches += 1; if (m[2] !== " ") n.faites += 1; }
        });
      });
    });
    return n;
  }

  /* Opérations ----------------------------------------------------------------- */

  // Texte saisi (une ou plusieurs lignes) -> { texte, suite } d'une tâche ; les
  // lignes suivantes sont indentées d'au moins deux espaces
  function decouper(saisie) {
    var lignes = String(saisie).replace(/\r\n?/g, "\n").split("\n");
    while (lignes.length > 1 && lignes[lignes.length - 1].trim() === "") lignes.pop();
    var premiere = lignes.shift().trim();
    var suite = lignes.filter(function (l) { return l.trim() !== ""; }).map(function (l) {
      return /^\s{2,}/.test(l) ? l.replace(/\s+$/, "") : "  " + l.trim();
    });
    return { texte: premiere, suite: suite };
  }

  function basculer(doc, idItem) {
    var r = trouverItem(doc, idItem);
    if (!r || r.item.marque === null) return false;
    r.item.marque = r.item.marque === " " ? "x" : " ";
    return true;
  }

  function basculerSous(doc, idItem, ligne) {
    var r = trouverItem(doc, idItem);
    if (!r) return false;
    var l = r.item.suite[ligne], m = l === undefined ? null : SOUS_CASE.exec(l);
    if (!m) return false;
    r.item.suite[ligne] = m[1] + "[" + (m[2] === " " ? "x" : " ") + "]" + (m[3] || "");
    return true;
  }

  function ajouter(doc, idListe, saisie, options) {
    var b = bloc(doc, idListe);
    if (!b || b.type !== "liste") return null;
    var d = decouper(saisie);
    if (!d.texte) return null;
    var puce = b.items.length ? b.items[0].puce : "-";
    var it = { id: nouvelId("t"), puce: puce, marque: options && options.note ? null : " ", texte: d.texte, suite: d.suite };
    var pos = options && typeof options.position === "number" ? options.position : b.items.length;
    b.items.splice(pos, 0, it);
    return it;
  }

  function modifier(doc, idItem, saisie, note) {
    var r = trouverItem(doc, idItem);
    if (!r) return false;
    var d = decouper(saisie);
    if (!d.texte) return false;
    r.item.texte = d.texte;
    r.item.suite = d.suite;
    if (note === true) r.item.marque = null;
    else if (note === false && r.item.marque === null) r.item.marque = " ";
    return true;
  }

  // Retire un bloc sans coller le suivant au précédent
  function retirerBloc(doc, i) {
    var b = doc.blocs[i], suivant = doc.blocs[i + 1];
    doc.blocs.splice(i, 1);
    if (suivant && suivant.avant === 0 && b.avant > 0 && i > 0) suivant.avant = b.avant;
    if (i === 0 && suivant) suivant.avant = b.avant;
  }

  // Supprime une tâche ; une liste vidée disparaît (sans elle, son étiquette
  // deviendrait un paragraphe à la relecture)
  function supprimer(doc, idItem) {
    var r = trouverItem(doc, idItem);
    if (!r) return false;
    r.bloc.items.splice(r.index, 1);
    if (!r.bloc.items.length) retirerBloc(doc, index(doc, r.bloc.id));
    return true;
  }

  // Déplace une tâche dans une liste (la même ou une autre), à la position donnée
  function deplacer(doc, idItem, idListe, position) {
    var r = trouverItem(doc, idItem), cible = bloc(doc, idListe);
    if (!r || !cible || cible.type !== "liste") return false;
    var memeListe = r.bloc === cible;
    r.bloc.items.splice(r.index, 1);
    if (memeListe && position > r.index) position -= 1;
    position = Math.max(0, Math.min(position === undefined ? cible.items.length : position, cible.items.length));
    cible.items.splice(position, 0, r.item);
    if (!r.bloc.items.length && !memeListe) retirerBloc(doc, index(doc, r.bloc.id));
    return true;
  }

  function renommerListe(doc, idListe, etiquette) {
    var b = bloc(doc, idListe);
    if (!b || b.type !== "liste") return false;
    etiquette = String(etiquette || "").replace(/\s+/g, " ").trim();
    b.etiquette = etiquette && estEtiquette(etiquette) && !PUCE.test(etiquette) && !TITRE.test(etiquette) ? etiquette : null;
    return true;
  }

  function supprimerBloc(doc, idBloc) {
    var i = index(doc, idBloc);
    if (i < 0 || doc.blocs[i].type === "titre") return false;
    retirerBloc(doc, i);
    return true;
  }

  // Nouvelle liste (étiquette et première tâche) à la fin du contenu propre d'un titre
  function ajouterListe(doc, idTitre, etiquette, premiere, note) {
    if (index(doc, idTitre) < 0) return null;
    var d = decouper(premiere || "");
    if (!d.texte) return null;
    var b = { id: nouvelId("b"), type: "liste", avant: 1, etiquette: null, items: [
      { id: nouvelId("t"), puce: "-", marque: note ? null : " ", texte: d.texte, suite: d.suite }
    ] };
    doc.blocs.splice(finContenu(doc, idTitre), 0, b);
    renommerListe(doc, b.id, etiquette);
    return b;
  }

  function ajouterTexte(doc, idTitre, saisie) {
    if (index(doc, idTitre) < 0) return null;
    var lignes = String(saisie || "").replace(/\r\n?/g, "\n").split("\n").filter(function (l) { return l.trim() !== ""; });
    if (!lignes.length) return null;
    var b = { id: nouvelId("b"), type: "texte", avant: 1, lignes: lignes };
    doc.blocs.splice(finContenu(doc, idTitre), 0, b);
    return b;
  }

  function modifierTexte(doc, idBloc, saisie) {
    var b = bloc(doc, idBloc);
    if (!b || b.type !== "texte") return false;
    var lignes = String(saisie || "").replace(/\r\n?/g, "\n").split("\n");
    while (lignes.length && lignes[lignes.length - 1].trim() === "") lignes.pop();
    while (lignes.length && lignes[0].trim() === "") lignes.shift();
    if (!lignes.length) return supprimerBloc(doc, idBloc);
    // Une ligne vide au milieu couperait le bloc : on la supprime
    b.lignes = lignes.filter(function (l) { return l !== ""; });
    return true;
  }

  // Monte ou descend un bloc (liste, texte) parmi les blocs de la même partie
  function deplacerBloc(doc, idBloc, sens) {
    var i = index(doc, idBloc);
    if (i < 0 || doc.blocs[i].type === "titre") return false;
    var j = i + (sens < 0 ? -1 : 1);
    if (j < 0 || j >= doc.blocs.length || doc.blocs[j].type === "titre") return false;
    var a = doc.blocs[i], b = doc.blocs[j];
    doc.blocs[i] = b; doc.blocs[j] = a;
    var av = a.avant; a.avant = b.avant; b.avant = av;
    return true;
  }

  function renommerTitre(doc, idTitre, texte) {
    var b = bloc(doc, idTitre);
    texte = String(texte || "").replace(/\s+/g, " ").trim();
    if (!b || b.type !== "titre" || !texte) return false;
    b.texte = texte;
    return true;
  }

  // Nouvelle section (niveau 2, à la fin du fichier) ou sous-section (niveau 3,
  // à la fin de la section donnée)
  function ajouterTitre(doc, texte, idParent) {
    texte = String(texte || "").replace(/\s+/g, " ").trim();
    if (!texte) return null;
    var b = { id: nouvelId("b"), type: "titre", avant: 1, niveau: idParent ? 3 : 2, espace: " ", texte: texte };
    if (idParent) {
      var p = portee(doc, idParent);
      if (!p) return null;
      doc.blocs.splice(p.fin, 0, b);
    } else {
      doc.blocs.push(b);
    }
    return b;
  }

  function supprimerTitre(doc, idTitre) {
    var p = portee(doc, idTitre);
    if (!p) return false;
    var avant = doc.blocs[p.debut].avant;
    doc.blocs.splice(p.debut, p.fin - p.debut);
    if (doc.blocs[p.debut] && p.debut > 0) doc.blocs[p.debut].avant = Math.max(doc.blocs[p.debut].avant, avant);
    return true;
  }

  // Échange une section ou sous-section avec sa voisine de même niveau, dans le même parent
  function deplacerTitre(doc, idTitre, sens) {
    var p = portee(doc, idTitre);
    if (!p) return false;
    var niveau = doc.blocs[p.debut].niveau, voisine;
    if (sens < 0) {
      var k = p.debut - 1;
      while (k >= 0 && !(doc.blocs[k].type === "titre" && doc.blocs[k].niveau <= niveau)) k -= 1;
      if (k < 0 || doc.blocs[k].niveau !== niveau) return false;
      voisine = portee(doc, doc.blocs[k].id);
      var haut = doc.blocs.slice(voisine.debut, voisine.fin), bas = doc.blocs.slice(p.debut, p.fin);
      doc.blocs.splice.apply(doc.blocs, [voisine.debut, p.fin - voisine.debut].concat(bas, haut));
    } else {
      if (p.fin >= doc.blocs.length || doc.blocs[p.fin].type !== "titre" || doc.blocs[p.fin].niveau !== niveau) return false;
      voisine = portee(doc, doc.blocs[p.fin].id);
      var a = doc.blocs.slice(p.debut, p.fin), c = doc.blocs.slice(voisine.debut, voisine.fin);
      doc.blocs.splice.apply(doc.blocs, [p.debut, voisine.fin - p.debut].concat(c, a));
    }
    return true;
  }

  var TodoMarkdown = {
    lire: lire, ecrire: ecrire, structure: structure, compter: compter, portee: portee,
    trouverItem: trouverItem, bloc: bloc, decouper: decouper, SOUS_CASE: SOUS_CASE,
    basculer: basculer, basculerSous: basculerSous, ajouter: ajouter, modifier: modifier,
    supprimer: supprimer, deplacer: deplacer, renommerListe: renommerListe,
    supprimerBloc: supprimerBloc, ajouterListe: ajouterListe, ajouterTexte: ajouterTexte,
    modifierTexte: modifierTexte, deplacerBloc: deplacerBloc, renommerTitre: renommerTitre,
    ajouterTitre: ajouterTitre, supprimerTitre: supprimerTitre, deplacerTitre: deplacerTitre
  };
  if (typeof module !== "undefined" && module.exports) module.exports = TodoMarkdown;
  else racine.TodoMarkdown = TodoMarkdown;
})(typeof window !== "undefined" ? window : this);
