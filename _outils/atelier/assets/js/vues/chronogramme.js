/* ==========================================================================
   Atelier · vue « chronogramme » (interface)
   --------------------------------------------------------------------------
   Grille : une ligne par processus, une colonne par unité de temps. Choisir
   un état dans la palette, puis cliquer ou glisser sur les cases pour les
   peindre ; la gomme les vide ; recliquer une case dans le même état la
   vide aussi. Le nom d'une ligne se modifie en cliquant dessus.
   Avec l'option niveaux, chaque ligne est dessinée comme un signal : un
   palier par case à la hauteur de son niveau, un front vertical entre deux
   cases de niveaux différents, le repère de l'état (marques) sur l'impulsion ;
   graduations remplace les instants par les bits à coder.
   ========================================================================== */
(function (A) {
  "use strict";

  var N = A.noyau, el = N.el;

  function classeEtat(m, code) {
    var i = m.etats.findIndex(function (e) { return e.code === code; });
    return i < 0 ? "" : "etat-" + Math.min(i, 5);
  }

  function pasDe(m) { return A.editeurs.chronogramme.pasDe(m); }
  function niveauDe(o, code) { return A.editeurs.chronogramme.niveauDe(o, code); }

  // Hauteur d'un niveau dans la case, en % depuis le haut : 1 en haut, 0 au milieu, -1 en bas
  function hauteur(niv) { return 50 - 26 * niv; }

  // Contenu d'une case : couleur de l'état, ou, en tracé de signal, palier, front et repère
  function remplirCase(td, m, l, k, o) {
    var c = l.cases[k];
    var repere = td.classList.contains("repere");
    if (!(o && o.niveaux)) {
      td.className = "chrono-case " + (c ? classeEtat(m, c) : "vide") + (repere ? " repere" : "");
      return;
    }
    td.className = "chrono-case signal" + (c ? " peinte" : " vide") + (repere ? " repere" : "");
    td.innerHTML = "";
    var niv = niveauDe(o, c);
    if (niv == null) return;
    var y = hauteur(niv);
    td.style.setProperty("--y", y + "%");
    td.appendChild(el("span", "chrono-palier"));
    var prec = k > 0 ? niveauDe(o, l.cases[k - 1]) : null;
    if (prec != null && prec !== niv) {
      var y0 = hauteur(prec);
      var f = el("span", "chrono-front");
      f.style.setProperty("--y0", Math.min(y, y0) + "%");
      f.style.setProperty("--h", Math.abs(y - y0) + "%");
      td.appendChild(f);
    }
    var marque = c && o.marques && o.marques[c];
    if (marque) td.appendChild(el("span", "chrono-marque " + (niv < 0 ? "dessous" : "dessus"), marque));
  }
  function nbCases(m) { return Math.round((m.fin - m.debut) / pasDe(m)); }

  // Largeur d'une case, en rem : 1,9 jusqu'à 25 cases ; au-delà, les cases rétrécissent pour que la
  // grille tienne dans la colonne d'un quiz (48rem), sans descendre sous 0,8 (elle défile alors).
  // Au-delà de 120 cases (un Gantt sur 336 jours), elles ne se visent plus à la souris : la grille
  // tient quand même, dense, et se remplit par la vue texte
  function plancher(n) { return n > 120 ? 0.08 : 0.8; }
  function largeurCase(n) { return Math.max(plancher(n), Math.min(1.9, Math.floor(4800 / n) / 100)); }

  // Une graduation toutes les « saut » cases : assez espacées pour ne pas se chevaucher (une colonne
  // de 1,9rem loge trois chiffres), et sur des valeurs rondes (0, 200, 400… plutôt que 0, 150, 300…)
  function sautDe(m, largeur) {
    var long = Math.max(String(m.debut).length, String(m.fin).length), pas = pasDe(m);
    var saut = Math.max(1, Math.ceil((long * 0.48 + 0.3) / largeur));
    function ronde(v) { var f = v / Math.pow(10, Math.floor(Math.log10(v) + 1e-9)); return [1, 2, 5].some(function (x) { return Math.abs(f - x) < 1e-6; }); }
    while (saut > 1 && !ronde(saut * pas)) saut++;
    return saut;
  }

  function grille(m, avecCases, o) {
    var signal = Boolean(o && o.niveaux);
    var t = el("table", "chrono-grille" + (signal ? " signal" : "") + (nbCases(m) > 120 ? " dense" : ""));
    var etiquettes = A.editeurs.chronogramme.graduationsDe(o, nbCases(m));
    var tete = el("thead"), tr = el("tr");
    var pas = pasDe(m), n = nbCases(m), largeur = largeurCase(n), saut = sautDe(m, largeur);
    if (largeur < 1.9) t.style.setProperty("--chrono-case", largeur + "rem");
    tr.appendChild(el("th", "chrono-coin"));
    // Une graduation plus large que sa colonne déborde sur la suivante, laissée vide, sans l'élargir
    function graduation(classe, k, valeur) {
      var th = el("th", classe, saut > 1 ? null : String(valeur));
      if (saut > 1 && k % saut === 0) th.appendChild(el("span", "chrono-graduation", String(valeur)));
      return th;
    }
    if (etiquettes) {
      etiquettes.forEach(function (e) { tr.appendChild(el("th", "chrono-temps centre", e)); });
      tr.appendChild(el("th", "chrono-temps fin"));
    } else {
      for (var k = 0; k < n; k++) tr.appendChild(graduation("chrono-temps", k, m.debut + k * pas));
      tr.appendChild(graduation("chrono-temps fin", n, m.fin));
    }
    tete.appendChild(tr);
    t.appendChild(tete);
    var corps = el("tbody");
    m.lignes.forEach(function (l, i) {
      var r = el("tr");
      r.setAttribute("data-nom", l.nom);
      var th = el("th", "chrono-nom");
      th.appendChild(avecCases ? avecCases.nom(l, i) : document.createTextNode(l.nom));
      r.appendChild(th);
      l.cases.forEach(function (c, k) {
        var td = el("td", "chrono-case" + (saut > 1 && k % saut === 0 && !etiquettes ? " repere" : ""));
        remplirCase(td, m, l, k, o);
        td.setAttribute("data-case", i + ":" + k);
        td.title = l.nom + ", de " + (m.debut + k * pas) + " à " + (m.debut + (k + 1) * pas) + (c ? " : " + (m.etats.find(function (e) { return e.code === c; }) || {}).libelle : "");
        r.appendChild(td);
      });
      r.appendChild(el("td", "chrono-marge"));
      corps.appendChild(r);
    });
    t.appendChild(corps);
    return t;
  }

  // Pastille d'un état : sa couleur, ou, en tracé de signal, un petit palier à sa hauteur
  function pastille(m, code, o) {
    if (!(o && o.niveaux) || !code) return el("span", "chrono-pastille " + (code ? classeEtat(m, code) : "gomme"));
    var p = el("span", "chrono-pastille signal");
    p.style.setProperty("--y", hauteur(niveauDe(o, code)) + "%");
    return p;
  }

  function legende(m, o) {
    var d = el("div", "chrono-legende");
    m.etats.forEach(function (e) {
      var x = el("span", "chrono-etiquette");
      x.appendChild(pastille(m, e.code, o));
      x.appendChild(el("span", null, e.libelle + " (" + e.code + ")"));
      d.appendChild(x);
    });
    return d;
  }

  function creer(conteneur, ctx) {
    var m = null, ro = ctx.lectureSeule, derniers = null, pinceau = null, peinture = null, o = ctx.options || {};
    var racine = el("div", "atelier-chrono" + (ro ? " lecture" : ""));
    var palette = el("div", "chrono-palette");
    var zone = el("div", "chrono-zone");
    racine.appendChild(palette);
    racine.appendChild(zone);
    conteneur.appendChild(racine);

    function dessinerPalette() {
      palette.innerHTML = "";
      if (!m) return;
      if (ro) { palette.appendChild(legende(m, o)); return; }
      if (pinceau === null || !m.etats.some(function (e) { return e.code === pinceau; }) && pinceau !== "") pinceau = m.etats[0] ? m.etats[0].code : "";
      m.etats.concat([{ code: "", libelle: "Gomme" }]).forEach(function (e) {
        var b = el("button", "chrono-pinceau" + (pinceau === e.code ? " actif" : ""));
        b.type = "button";
        b.appendChild(pastille(m, e.code, o));
        b.appendChild(el("span", null, e.libelle));
        b.setAttribute("aria-pressed", pinceau === e.code ? "true" : "false");
        b.addEventListener("click", function () { pinceau = e.code; dessinerPalette(); });
        palette.appendChild(b);
      });
    }

    // Une grille plus large que la zone : ses cases rétrécissent pour tenir, jusqu'au plancher
    function ajusterLargeur() {
      var t = zone.querySelector(".chrono-grille"), td = t && t.querySelector(".chrono-case");
      var dispo = zone.clientWidth;
      if (!td || !dispo || t.scrollWidth <= dispo) return;
      var n = nbCases(m), w = td.getBoundingClientRect().width;
      var autre = t.getBoundingClientRect().width - n * w;
      var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      t.style.setProperty("--chrono-case", Math.max(plancher(n), Math.floor((dispo - autre - 2) / n / rem * 100) / 100) + "rem");
    }

    function dessiner() {
      zone.innerHTML = "";
      if (!m) return;
      if (!m.lignes.length) zone.appendChild(el("p", "chrono-vide", ro ? "Aucune ligne." : "Aucune ligne : « + Ligne » pour commencer."));
      else zone.appendChild(grille(m, ro ? null : {
        nom: function (l, i) {
          var b = N.bouton(l.nom, "chrono-bouton-nom", function (e) { editerLigne(i, e); }, "Renommer ou supprimer « " + l.nom + " »");
          return b;
        }
      }, o));
      if (derniers) appliquer(derniers);
      requestAnimationFrame(ajusterLargeur);
    }

    // Peinture au glisser
    zone.addEventListener("pointerdown", function (e) {
      var td = e.target.closest && e.target.closest("[data-case]");
      if (!td) return;
      if (ctx.surClicElement) { var r = td.closest("tr"); ctx.surClicElement(r.getAttribute("data-nom"), e); }
      if (ro) return;
      e.preventDefault();
      var p = td.getAttribute("data-case").split(":").map(Number);
      var actuel = m.lignes[p[0]].cases[p[1]];
      peinture = { valeur: actuel === pinceau ? null : (pinceau || null), derniere: p };
      peindre(td);
      zone.setPointerCapture(e.pointerId);
    });
    zone.addEventListener("pointermove", function (e) {
      if (!peinture) return;
      var sous = document.elementFromPoint(e.clientX, e.clientY);
      var td = sous && sous.closest && sous.closest("[data-case]");
      if (td && zone.contains(td)) peindreJusque(td);
    });
    function finir() { if (peinture) { peinture = null; ctx.modifie(m, true); } }
    zone.addEventListener("pointerup", finir);
    zone.addEventListener("pointercancel", finir);
    // Un glissé rapide saute des cases : on remplit celles qu'il a franchies sur la même ligne
    function peindreJusque(td) {
      var p = td.getAttribute("data-case").split(":").map(Number), d = peinture.derniere;
      if (d[0] === p[0]) {
        for (var k = d[1], sens = p[1] > d[1] ? 1 : -1; k !== p[1]; k += sens) {
          var c = zone.querySelector('[data-case="' + p[0] + ":" + k + '"]');
          if (c) peindre(c);
        }
      }
      peindre(td);
      peinture.derniere = p;
    }
    function peindre(td) {
      var p = td.getAttribute("data-case").split(":").map(Number);
      if (m.lignes[p[0]].cases[p[1]] === peinture.valeur) return;
      var l = m.lignes[p[0]];
      l.cases[p[1]] = peinture.valeur;
      remplirCase(td, m, l, p[1], o);
      // En tracé de signal, le front de la case suivante change aussi
      var suivante = td.nextElementSibling;
      if (o.niveaux && suivante && suivante.hasAttribute("data-case")) remplirCase(suivante, m, l, p[1] + 1, o);
      ctx.modifie(m, false);
    }

    function editerLigne(i, e) {
      var l = m.lignes[i];
      A.formulaire.ouvrir(racine, {
        x: e && e.clientX ? e.clientX + 8 : null, y: e && e.clientY ? e.clientY + 8 : null, titre: "Ligne",
        champs: [{ nom: "nom", libelle: "Nom", valeur: l.nom }],
        actions: [
          { libelle: "↑ Monter", action: function () { bouger(i, -1); } },
          { libelle: "↓ Descendre", action: function () { bouger(i, 1); } }
        ],
        surValider: function (v) { if (!v.nom.trim()) return "Le nom est obligatoire."; l.nom = v.nom.trim().replace(/:/g, ""); dessiner(); ctx.modifie(m, true); },
        surSupprimer: function () { m.lignes.splice(i, 1); dessiner(); ctx.modifie(m, true); }
      });
    }
    function bouger(i, sens) {
      var j = i + sens;
      if (j < 0 || j >= m.lignes.length) return;
      A.formulaire.fermer(false);
      var t = m.lignes[i]; m.lignes[i] = m.lignes[j]; m.lignes[j] = t;
      dessiner(); ctx.modifie(m, true);
    }
    function reglerTemps() {
      A.formulaire.ouvrir(racine, {
        titre: "Intervalle de temps",
        champs: [{ nom: "debut", libelle: "Début", valeur: String(m.debut) }, { nom: "fin", libelle: "Fin", valeur: String(m.fin) },
          { nom: "pas", libelle: "Durée d'une case", valeur: String(pasDe(m)) }],
        surValider: function (v) {
          var d = Number(v.debut), f = Number(v.fin), p = Number(v.pas), ancien = pasDe(m);
          if (!Number.isInteger(d) || !Number.isInteger(f) || f <= d) return "Début et fin : des entiers croissants.";
          if (!Number.isInteger(p) || p < 1 || (f - d) % p) return "La durée d'une case est un entier qui divise l'intervalle.";
          if ((f - d) / p > 120) return "120 cases au plus.";
          // Chaque nouvelle case reprend l'état qu'avait la ligne à son premier instant
          m.lignes.forEach(function (l) {
            var c = [];
            for (var t = d; t < f; t += p) c.push(t >= m.debut && t < m.fin ? l.cases[Math.floor((t - m.debut) / ancien)] : null);
            l.cases = c;
          });
          m.debut = d; m.fin = f; m.pas = p;
          dessiner(); ctx.modifie(m, true);
        }
      });
    }
    function appliquer(lst) {
      zone.querySelectorAll(".surligne").forEach(function (e) { e.className = e.className.replace(/\s*surligne(-\S+)?/g, ""); });
      lst.forEach(function (s) {
        zone.querySelectorAll("tr[data-nom]").forEach(function (r) {
          if (r.getAttribute("data-nom").toLowerCase() === String(s.cible || "").toLowerCase()) r.classList.add("surligne", "surligne-" + (s.classe || "info"));
        });
      });
    }

    return {
      afficher: function (modele) { m = modele; dessinerPalette(); dessiner(); },
      outils: function () {
        if (ro) return [];
        return [
          N.bouton("+ Ligne", "petit", function () {
            var i = m.lignes.length + 1;
            while (m.lignes.some(function (l) { return l.nom === "P" + i; })) i++;
            var c = [];
            for (var k = nbCases(m); k > 0; k--) c.push(null);
            m.lignes.push({ nom: "P" + i, cases: c });
            dessiner(); ctx.modifie(m, true);
          }, "Ajouter une ligne"),
          N.bouton("Temps…", "petit", reglerTemps, "Régler l'intervalle de temps")
        ];
      },
      surligner: function (lst) { derniers = lst; appliquer(lst); },
      effacerSurlignage: function () { derniers = null; appliquer([]); },
      focus: function () { var b = palette.querySelector("button"); if (b) b.focus(); }
    };
  }

  function statique(modele, options) {
    var d = el("div", "atelier-chrono lecture");
    d.appendChild(legende(modele, options));
    var z = el("div", "chrono-zone");
    z.appendChild(grille(modele, null, options));
    d.appendChild(z);
    return d;
  }

  A.vues.chronogramme = { creer: creer, statique: statique, libelleVue: "Grille" };
})(window.Atelier);
