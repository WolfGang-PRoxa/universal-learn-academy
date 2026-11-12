/* ==========================================================================
   Quiz · types de questions (QuizApp.types)
   --------------------------------------------------------------------------
   Chaque type fournit :
     consigne              phrase d'aide sous l'énoncé (facultative)
     rendre(q, zone, etat, ancienne)
                           construit la zone de réponse ; etat garde, pour la
                           tentative, l'ordre tiré au sort (il est archivé, si
                           bien qu'une reprise retrouve le même affichage) ;
                           ancienne est la réponse déjà donnée.
                           Renvoie { lire, verrouiller, corriger, choisir?, focus? }.
     noter(q, v)           score entre 0 et 1, ou null (auto-évaluation) ;
                           peut renvoyer une promesse (type code).
     resume(q, v)          la réponse donnée, en HTML
     solution(q)           la bonne réponse, en HTML
     acceptees(q)          toutes les réponses acceptées (facultatif)
     details(q, etat)      description textuelle de la question pour Claude
                           (choix, éléments…), dans l'ordre affiché
     attendu               true : afficher la réponse attendue quand c'est faux
   Le type « code » est défini dans code.js.
   ========================================================================== */
(function (A) {
  "use strict";

  var O = A.outils, el = O.el, html = O.html, echapper = O.echapper;
  var LETTRES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var compteurNoms = 0;
  var T = {};

  function verrouiller(zone) {
    zone.classList.add("verrou");
    zone.querySelectorAll("input, select, textarea, button").forEach(function (x) { x.disabled = true; });
  }
  function majCoches(liste) {
    liste.querySelectorAll(".choix").forEach(function (lab) {
      lab.classList.toggle("coche", lab.querySelector("input").checked);
    });
  }
  function texteLettre(q, etat, k) {
    var pos = etat && etat.ordre ? etat.ordre.indexOf(k) : k;
    return LETTRES[pos] + ". " + O.texteDe(q.choix[k]);
  }
  function listeChoix(q, etat) {
    var ordre = etat && etat.ordre ? etat.ordre : O.indices(q.choix.length);
    return "Choix proposés :\n" + ordre.map(function (k, pos) { return LETTRES[pos] + ". " + O.texteDe(q.choix[k]); }).join("\n");
  }

  function rendreChoix(q, zone, etat, ancienne, multiple, classeListe) {
    if (!etat.ordre) etat.ordre = q.melanger === false ? O.indices(q.choix.length) : O.melanger(O.indices(q.choix.length));
    var liste = el("div", "choix-liste" + (multiple ? " multi" : "") + (classeListe ? " " + classeListe : ""));
    liste.setAttribute("role", multiple ? "group" : "radiogroup");
    var nom = "q" + (++compteurNoms);
    var labels = {};
    etat.ordre.forEach(function (k, pos) {
      var lab = el("label", "choix");
      var inp = el("input");
      inp.type = multiple ? "checkbox" : "radio";
      inp.name = nom;
      inp.value = k;
      if (multiple ? (ancienne || []).indexOf(k) >= 0 : ancienne === k) inp.checked = true;
      lab.appendChild(inp);
      lab.appendChild(el("span", "choix-lettre", LETTRES[pos]));
      lab.appendChild(html("span", "choix-texte", q.choix[k]));
      liste.appendChild(lab);
      labels[k] = lab;
    });
    liste.addEventListener("change", function () { majCoches(liste); });
    majCoches(liste);
    zone.appendChild(liste);
    return { liste: liste, labels: labels };
  }

  /* QCM à une réponse ----------------------------------------------------------- */

  T.qcm = {
    consigne: "Une seule réponse.",
    rendre: function (q, zone, etat, ancienne) {
      var r = rendreChoix(q, zone, etat, ancienne, false);
      return {
        lire: function () {
          var c = r.liste.querySelector("input:checked");
          return c ? Number(c.value) : null;
        },
        verrouiller: function () { verrouiller(r.liste); },
        corriger: function (v) {
          r.labels[q.reponse].classList.add("juste");
          if (v != null && v !== q.reponse) r.labels[v].classList.add("faux");
        },
        choisir: function (pos) {
          var inp = r.liste.querySelectorAll("input")[pos];
          if (inp && !inp.disabled) { inp.checked = true; majCoches(r.liste); inp.dispatchEvent(new Event("change", { bubbles: true })); }
        }
      };
    },
    noter: function (q, v) { return v === q.reponse ? 1 : 0; },
    resume: function (q, v) { return v == null ? null : q.choix[v]; },
    solution: function (q) { return q.choix[q.reponse]; },
    details: listeChoix,
    resumeTexte: function (q, v, etat) { return v == null ? null : texteLettre(q, etat, v); }
  };

  /* QCM à plusieurs réponses ------------------------------------------------------ */

  T["qcm-multi"] = {
    consigne: "Plusieurs réponses possibles : cocher toutes les bonnes.",
    rendre: function (q, zone, etat, ancienne) {
      var r = rendreChoix(q, zone, etat, ancienne, true);
      return {
        lire: function () {
          var v = Array.prototype.map.call(r.liste.querySelectorAll("input:checked"), function (i) { return Number(i.value); });
          return v.length ? v.sort(function (a, b) { return a - b; }) : null;
        },
        verrouiller: function () { verrouiller(r.liste); },
        corriger: function (v) {
          v = v || [];
          q.choix.forEach(function (_, k) {
            var bon = q.reponses.indexOf(k) >= 0, coche = v.indexOf(k) >= 0;
            if (bon && coche) r.labels[k].classList.add("juste");
            else if (bon) r.labels[k].classList.add("manquee");
            else if (coche) r.labels[k].classList.add("faux");
          });
        },
        choisir: function (pos) {
          var inp = r.liste.querySelectorAll("input")[pos];
          if (inp && !inp.disabled) { inp.checked = !inp.checked; majCoches(r.liste); inp.dispatchEvent(new Event("change", { bubbles: true })); }
        }
      };
    },
    noter: function (q, v) {
      if (!v) return 0;
      var bons = v.filter(function (k) { return q.reponses.indexOf(k) >= 0; }).length;
      return Math.max(0, (bons - (v.length - bons)) / q.reponses.length);
    },
    resume: function (q, v) {
      return v == null ? null : "<ul>" + v.map(function (k) { return "<li>" + q.choix[k] + "</li>"; }).join("") + "</ul>";
    },
    solution: function (q) {
      return "<ul>" + q.reponses.map(function (k) { return "<li>" + q.choix[k] + "</li>"; }).join("") + "</ul>";
    },
    details: listeChoix,
    resumeTexte: function (q, v, etat) { return v == null ? null : v.map(function (k) { return texteLettre(q, etat, k); }).join("\n"); }
  };

  /* Vrai ou faux ------------------------------------------------------------------- */

  T["vrai-faux"] = {
    rendre: function (q, zone, etat, ancienne) {
      var pseudo = { choix: ["Vrai", "Faux"], melanger: false };
      var r = rendreChoix(pseudo, zone, etat, ancienne == null ? null : (ancienne ? 0 : 1), false, "vf");
      var bon = q.reponse ? 0 : 1;
      return {
        lire: function () {
          var c = r.liste.querySelector("input:checked");
          return c ? c.value === "0" : null;
        },
        verrouiller: function () { verrouiller(r.liste); },
        corriger: function (v) {
          r.labels[bon].classList.add("juste");
          if (v != null && (v ? 0 : 1) !== bon) r.labels[v ? 0 : 1].classList.add("faux");
        },
        choisir: function (pos) {
          var inp = r.liste.querySelectorAll("input")[pos];
          if (inp && !inp.disabled) { inp.checked = true; majCoches(r.liste); inp.dispatchEvent(new Event("change", { bubbles: true })); }
        }
      };
    },
    noter: function (q, v) { return v === q.reponse ? 1 : 0; },
    resume: function (q, v) { return v == null ? null : (v ? "Vrai" : "Faux"); },
    solution: function (q) { return q.reponse ? "Vrai" : "Faux"; },
    details: function () { return "Répondre par Vrai ou Faux."; }
  };

  /* Réponse courte ----------------------------------------------------------------- */

  function champTexte(zone, ancienne, options) {
    var ligne = el("div", "champ-ligne");
    var champ = el("input", "champ");
    champ.type = "text";
    champ.autocomplete = "off";
    champ.spellcheck = false;
    if (options && options.decimal) champ.inputMode = "decimal";
    champ.setAttribute("aria-label", "Votre réponse");
    if (ancienne != null) champ.value = ancienne;
    ligne.appendChild(champ);
    if (options && options.unite) ligne.appendChild(el("span", "champ-unite", options.unite));
    zone.appendChild(ligne);
    return champ;
  }

  T["reponse-courte"] = {
    consigne: "Réponse libre, en quelques mots.",
    rendre: function (q, zone, etat, ancienne) {
      var champ = champTexte(zone, ancienne);
      return {
        lire: function () { var v = champ.value.trim(); return v ? v : null; },
        verrouiller: function () { champ.disabled = true; },
        corriger: function (v) { champ.classList.add(T["reponse-courte"].noter(q, v) ? "juste" : "faux"); },
        focus: champ
      };
    },
    noter: function (q, v) {
      if (v == null) return 0;
      var n = O.normaliser(v, q.casse, q.accents);
      return q.reponses.some(function (r) { return O.normaliser(r, q.casse, q.accents) === n; }) ? 1 : 0;
    },
    resume: function (q, v) { return v == null ? null : echapper(v); },
    solution: function (q) { return q.reponses[0]; },
    acceptees: function (q) { return q.reponses.map(String); },
    details: function (q) {
      return "Réponse libre attendue" + (q.casse ? " (la casse compte)" : "") + (q.accents ? " (les accents comptent)" : "") + ".";
    },
    attendu: true
  };

  /* Réponse numérique -------------------------------------------------------------- */

  T.numerique = {
    consigne: "Réponse numérique.",
    rendre: function (q, zone, etat, ancienne) {
      var champ = champTexte(zone, ancienne, { decimal: true, unite: q.unite });
      return {
        lire: function () { var v = champ.value.trim(); return v ? v : null; },
        verrouiller: function () { champ.disabled = true; },
        corriger: function (v) { champ.classList.add(T.numerique.noter(q, v) ? "juste" : "faux"); },
        focus: champ
      };
    },
    noter: function (q, v) {
      if (v == null) return 0;
      var x = Number(String(v).replace(/\s/g, "").replace(",", "."));
      if (isNaN(x)) return 0;
      return Math.abs(x - q.reponse) <= (q.tolerance || 0) + 1e-9 ? 1 : 0;
    },
    resume: function (q, v) { return v == null ? null : echapper(v) + (q.unite ? " " + echapper(q.unite) : ""); },
    solution: function (q) {
      var s = String(q.reponse).replace(".", ",") + (q.unite ? " " + q.unite : "");
      return q.tolerance ? s + " <small>(à ± " + String(q.tolerance).replace(".", ",") + " près)</small>" : s;
    },
    details: function (q) { return "Réponse numérique" + (q.unite ? " en " + q.unite : "") + (q.tolerance ? ", tolérance ± " + q.tolerance : "") + "."; },
    attendu: true
  };

  /* Texte ou code à trous ------------------------------------------------------------- */

  T.trous = {
    consigne: "Compléter chaque trou.",
    rendre: function (q, zone, etat, ancienne) {
      var conteneur = html("div", q.code ? "trous-code" : "trous-texte",
        q.texte.replace(/\{\{(\d+)\}\}/g, '<span data-trou="$1"></span>'));
      var champs = [];
      if (!etat.ordres) etat.ordres = {};
      conteneur.querySelectorAll("[data-trou]").forEach(function (marque) {
        var k = Number(marque.getAttribute("data-trou"));
        var t = q.trous[k], champ;
        if (t.choix) {
          if (!etat.ordres[k]) etat.ordres[k] = t.melanger === false ? O.indices(t.choix.length) : O.melanger(O.indices(t.choix.length));
          champ = el("select", "trou");
          champ.appendChild(el("option", null, "…")).value = "";
          etat.ordres[k].forEach(function (i) {
            var o = el("option", null, t.choix[i]);
            o.value = i;
            champ.appendChild(o);
          });
          if (ancienne && ancienne[k] != null) champ.value = ancienne[k];
        } else {
          champ = el("input", "champ trou");
          champ.type = "text";
          champ.autocomplete = "off";
          champ.spellcheck = false;
          champ.size = Math.max(6, Math.max.apply(null, t.reponses.map(function (r) { return r.length; })) + 2);
          if (ancienne && ancienne[k] != null) champ.value = ancienne[k];
        }
        champ.setAttribute("aria-label", "Trou " + (k + 1));
        marque.replaceWith(champ);
        champs[k] = champ;
      });
      zone.appendChild(conteneur);
      return {
        lire: function () {
          var v = champs.map(function (c) {
            if (c.tagName === "SELECT") return c.value === "" ? null : Number(c.value);
            var t = c.value.trim();
            return t ? t : null;
          });
          return v.some(function (x) { return x != null; }) ? v : null;
        },
        verrouiller: function () { champs.forEach(function (c) { c.disabled = true; }); },
        corriger: function (v) {
          champs.forEach(function (c, k) {
            var ok = T.trous.bonTrou(q.trous[k], v ? v[k] : null, q);
            c.classList.add(ok ? "juste" : "faux");
            if (!ok) {
              var t = q.trous[k];
              c.insertAdjacentElement("afterend", el("span", "trou-solution", t.choix ? t.choix[t.reponse] : t.reponses[0]));
            }
          });
        },
        focus: champs[0]
      };
    },
    bonTrou: function (t, v, q) {
      if (v == null) return false;
      if (t.choix) return v === t.reponse;
      var casse = t.casse != null ? t.casse : q.casse, accents = t.accents != null ? t.accents : q.accents;
      var n = O.normaliser(v, casse, accents);
      return t.reponses.some(function (r) { return O.normaliser(r, casse, accents) === n; });
    },
    noter: function (q, v) {
      if (!v) return 0;
      var bons = q.trous.filter(function (t, k) { return T.trous.bonTrou(t, v[k], q); }).length;
      return bons / q.trous.length;
    },
    resume: function (q, v) {
      if (v == null) return null;
      return v.map(function (x, k) {
        var t = q.trous[k];
        return (k + 1) + ". " + (x == null ? "—" : (t.choix ? t.choix[x] : echapper(x)));
      }).join(" · ");
    },
    solution: function (q) {
      return q.trous.map(function (t, k) { return (k + 1) + ". " + (t.choix ? t.choix[t.reponse] : t.reponses[0]); }).join(" · ");
    },
    acceptees: function (q) {
      return q.trous.map(function (t, k) { return (k + 1) + ". " + (t.choix ? O.texteDe(t.choix[t.reponse]) : t.reponses.join(" / ")); });
    },
    details: function (q) {
      var texte = O.texteDe(q.texte.replace(/\{\{(\d+)\}\}/g, function (_, k) { return "[trou " + (Number(k) + 1) + "]"; }));
      var choix = q.trous.map(function (t, k) { return t.choix ? "Trou " + (k + 1) + " : liste déroulante (" + t.choix.map(O.texteDe).join(", ") + ")" : "Trou " + (k + 1) + " : saisie libre"; });
      return "Texte à compléter" + (q.code ? " (code)" : "") + " :\n" + texte + "\n" + choix.join("\n");
    }
  };

  /* Association ----------------------------------------------------------------------- */

  T.association = {
    consigne: "Associer chaque élément de gauche à un élément de droite.",
    rendre: function (q, zone, etat, ancienne) {
      var droites = q.paires.map(function (p) { return p[1]; }).concat(q.intrus || []);
      if (!etat.ordre) etat.ordre = O.melanger(O.indices(droites.length));
      if (!etat.lignes) etat.lignes = q.melanger === false ? O.indices(q.paires.length) : O.melanger(O.indices(q.paires.length));
      var grille = el("div", "assoc");
      var selects = [], lignes = [];
      etat.lignes.forEach(function (i) {
        var ligne = el("div", "assoc-ligne");
        ligne.appendChild(html("div", "assoc-gauche", q.paires[i][0]));
        var s = el("select");
        s.appendChild(el("option", null, "— choisir —")).value = "";
        etat.ordre.forEach(function (j) {
          var o = el("option");
          o.value = j;
          o.textContent = O.texteDe(droites[j]);
          s.appendChild(o);
        });
        if (ancienne && ancienne[i] != null && ancienne[i] >= 0) s.value = ancienne[i];
        s.setAttribute("aria-label", "Associé à « " + O.texteDe(q.paires[i][0]) + " »");
        ligne.appendChild(s);
        grille.appendChild(ligne);
        selects[i] = s;
        lignes[i] = ligne;
      });
      zone.appendChild(grille);
      return {
        lire: function () {
          var v = selects.map(function (s) { return s.value === "" ? -1 : Number(s.value); });
          return v.some(function (x) { return x >= 0; }) ? v : null;
        },
        verrouiller: function () { selects.forEach(function (s) { s.disabled = true; }); },
        corriger: function (v) {
          lignes.forEach(function (ligne, i) {
            var ok = v && v[i] === i;
            ligne.classList.add(ok ? "juste" : "faux");
            if (!ok) ligne.appendChild(html("div", "assoc-solution", "→ " + q.paires[i][1]));
          });
        }
      };
    },
    noter: function (q, v) {
      if (!v) return 0;
      return v.filter(function (x, i) { return x === i; }).length / q.paires.length;
    },
    resume: function (q, v) {
      if (v == null) return null;
      var droites = q.paires.map(function (p) { return p[1]; }).concat(q.intrus || []);
      return "<ul>" + q.paires.map(function (p, i) {
        return "<li>" + p[0] + " → " + (v[i] >= 0 ? droites[v[i]] : "—") + "</li>";
      }).join("") + "</ul>";
    },
    solution: function (q) {
      return "<ul>" + q.paires.map(function (p) { return "<li>" + p[0] + " → " + p[1] + "</li>"; }).join("") + "</ul>";
    },
    details: function (q) {
      var droites = q.paires.map(function (p) { return p[1]; }).concat(q.intrus || []);
      return "Éléments à associer :\n" + q.paires.map(function (p) { return "- " + O.texteDe(p[0]); }).join("\n") +
        "\nPropositions :\n" + droites.map(function (d) { return "- " + O.texteDe(d); }).join("\n");
    }
  };

  /* Remise en ordre ------------------------------------------------------------------- */

  T.ordre = {
    consigne: "Remettre dans l'ordre : glisser les éléments, ou utiliser les flèches.",
    rendre: function (q, zone, etat, ancienne) {
      if (!etat.ordre) {
        var o = O.melanger(O.indices(q.elements.length)), essais = 0;
        while (o.every(function (x, i) { return x === i; }) && essais++ < 10) o = O.melanger(o);
        etat.ordre = o;
      }
      var depart = ancienne || etat.ordre;
      var liste = el("ol", "ordre-liste");
      var glisse = null;
      function signaler() { liste.dispatchEvent(new Event("change", { bubbles: true })); }
      function majBoutons() {
        var items = liste.children;
        for (var i = 0; i < items.length; i++) {
          var b = items[i].querySelectorAll(".ordre-boutons button");
          b[0].disabled = i === 0 || liste.classList.contains("verrou");
          b[1].disabled = i === items.length - 1 || liste.classList.contains("verrou");
        }
      }
      depart.forEach(function (k) {
        var li = el("li", "ordre-item");
        li.dataset.k = k;
        li.draggable = true;
        li.appendChild(el("span", "ordre-poignee", "⋮⋮")).setAttribute("aria-hidden", "true");
        li.appendChild(html("span", "ordre-texte", q.elements[k]));
        var bs = el("span", "ordre-boutons");
        var haut = el("button", null, "↑"), bas = el("button", null, "↓");
        haut.type = bas.type = "button";
        haut.setAttribute("aria-label", "Monter");
        bas.setAttribute("aria-label", "Descendre");
        haut.addEventListener("click", function () {
          if (li.previousElementSibling) liste.insertBefore(li, li.previousElementSibling);
          majBoutons(); haut.focus(); signaler();
        });
        bas.addEventListener("click", function () {
          if (li.nextElementSibling) liste.insertBefore(li.nextElementSibling, li);
          majBoutons(); bas.focus(); signaler();
        });
        bs.appendChild(haut); bs.appendChild(bas);
        li.appendChild(bs);
        li.addEventListener("dragstart", function (e) {
          if (liste.classList.contains("verrou")) { e.preventDefault(); return; }
          glisse = li; li.classList.add("glisse");
          e.dataTransfer.effectAllowed = "move";
          try { e.dataTransfer.setData("text/plain", ""); } catch (x) { /* Firefox */ }
        });
        li.addEventListener("dragend", function () { li.classList.remove("glisse"); glisse = null; majBoutons(); signaler(); });
        li.addEventListener("dragover", function (e) {
          if (!glisse || glisse === li) return;
          e.preventDefault();
          var r = li.getBoundingClientRect();
          liste.insertBefore(glisse, e.clientY < r.top + r.height / 2 ? li : li.nextSibling);
        });
        liste.appendChild(li);
      });
      zone.appendChild(liste);
      majBoutons();
      return {
        lire: function () { return Array.prototype.map.call(liste.children, function (li) { return Number(li.dataset.k); }); },
        verrouiller: function () {
          liste.classList.add("verrou");
          Array.prototype.forEach.call(liste.children, function (li) { li.draggable = false; });
          majBoutons();
        },
        corriger: function () {
          Array.prototype.forEach.call(liste.children, function (li, i) {
            li.classList.add(Number(li.dataset.k) === i ? "juste" : "faux");
          });
        }
      };
    },
    noter: function (q, v) {
      if (!v) return 0;
      return v.filter(function (k, i) { return k === i; }).length / q.elements.length;
    },
    resume: function (q, v) {
      return v == null ? null : "<ol>" + v.map(function (k) { return "<li>" + q.elements[k] + "</li>"; }).join("") + "</ol>";
    },
    solution: function (q) {
      return "<ol>" + q.elements.map(function (e) { return "<li>" + e + "</li>"; }).join("") + "</ol>";
    },
    details: function (q, etat) {
      var ordre = etat && etat.ordre ? etat.ordre : O.indices(q.elements.length);
      return "Éléments à remettre dans l'ordre (ordre de départ affiché) :\n" + ordre.map(function (k) { return "- " + O.texteDe(q.elements[k]); }).join("\n");
    }
  };

  /* Question ouverte -------------------------------------------------------------------- */

  T.ouverte = {
    consigne: "Rédiger sa réponse, puis la comparer à la réponse modèle : s'auto-évaluer, ou la faire corriger par Claude.",
    rendre: function (q, zone, etat, ancienne) {
      var zoneTexte = el("textarea", "champ zone");
      zoneTexte.setAttribute("aria-label", "Votre réponse");
      zoneTexte.placeholder = "Votre réponse…";
      if (ancienne != null) zoneTexte.value = ancienne;
      zone.appendChild(zoneTexte);
      return {
        lire: function () { return zoneTexte.value.trim(); },
        verrouiller: function () { zoneTexte.disabled = true; },
        corriger: function () { /* la réponse modèle s'affiche dans le retour */ },
        focus: zoneTexte
      };
    },
    noter: function () { return null; },
    resume: function (q, v) { return v ? echapper(v).replace(/\n/g, "<br>") : null; },
    solution: function (q) { return q.reponse_modele; },
    details: function (q) {
      return "Question ouverte (rédaction)." + (q.criteres && q.criteres.length ? "\nPoints attendus (à ne pas révéler avant la correction) :\n" +
        q.criteres.map(function (c) { return "- " + O.texteDe(c); }).join("\n") : "");
    }
  };

  // Réponse donnée, en texte (archives, Claude)
  function resumeTexte(q, v, etat) {
    var t = T[q.type];
    if (t.resumeTexte) return t.resumeTexte(q, v, etat);
    var r = t.resume(q, v);
    return r == null ? null : O.texteDe(r);
  }

  A.types = T;
  A.resumeTexte = resumeTexte;
  A.LETTRES = LETTRES;
})(window.QuizApp);
