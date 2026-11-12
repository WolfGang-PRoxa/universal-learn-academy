/* ==========================================================================
   Outil TODO · page de suivi (_outils/todo/index.html)
   --------------------------------------------------------------------------
   Affiche TODO.md tâche par tâche et le modifie : cocher, ajouter, modifier,
   déplacer (glisser, ou flèches sur la poignée), supprimer ; renommer,
   déplacer et créer listes, paragraphes, sections et sous-sections ; vue
   « texte brut » pour tout le reste. Chaque changement est enregistré dans
   le fichier une demi-seconde plus tard.

   D'où vient le fichier :
   - page servie par le serveur local (studies/lancer.bat) : routes
     /api/todo/fichier de _outils/todo/serveur/extension.js ;
   - page ouverte depuis le disque : TODO.md choisi une fois (Edge, Chrome),
     puis rouvert d'un clic (poignée gardée dans IndexedDB).
   Lecture et écriture du Markdown : markdown-todo.js (window.TodoMarkdown).
   ========================================================================== */
(function () {
  "use strict";

  var M = window.TodoMarkdown;
  var PORT = 5178;
  var DELAI_ENREGISTREMENT = 500;
  var app = document.getElementById("todo-app");
  if (!app || !M) return;

  var etat = {
    source: null, doc: null, version: null, texteEnregistre: null,
    vue: "taches", filtre: "tout", recherche: "",
    edition: null,                // { type, id } : l'élément en cours de modification
    annuler: [], retablir: [],
    enAttente: false, enregistrement: false, relancer: false, minuteur: null,
    erreur: null, conflit: null, derniere: null,
    plies: lireStockage("plies") || {},
    focus: null
  };
  var zones = {};

  /* Outils ------------------------------------------------------------------- */

  function el(balise, classe, texte) {
    var e = document.createElement(balise);
    if (classe) e.className = classe;
    if (texte !== undefined && texte !== null) e.textContent = texte;
    return e;
  }
  function echapper(t) {
    return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function normaliser(t) {
    return String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function lireStockage(cle) {
    try { return JSON.parse(localStorage.getItem("studies-todo-" + cle)); } catch (e) { return null; }
  }
  function ecrireStockage(cle, valeur) {
    try { localStorage.setItem("studies-todo-" + cle, JSON.stringify(valeur)); } catch (e) { /* stockage indisponible */ }
  }
  function ancre(t) {
    return "s-" + normaliser(t.replace(/`[^`]*`/g, "")).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  }

  var ICONES = {
    crayon: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    corbeille: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
    haut: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    bas: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    poignee: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    annuler: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    retablir: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
    fichier: '<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/>'
  };
  function icone(nom) {
    return '<svg class="todo-icone" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONES[nom] + "</svg>";
  }
  function bouton(nom, libelle, action, classe) {
    var b = el("button", "todo-bouton" + (classe ? " " + classe : ""));
    b.type = "button";
    b.innerHTML = icone(nom);
    b.title = libelle;
    b.setAttribute("aria-label", libelle);
    b.addEventListener("click", function (e) { e.stopPropagation(); action(e); });
    return b;
  }
  function boutonTexte(texte, action, classe) {
    var b = el("button", "todo-action" + (classe ? " " + classe : ""), texte);
    b.type = "button";
    b.addEventListener("click", function (e) { e.preventDefault(); action(e); });
    return b;
  }

  /* Markdown affiché ----------------------------------------------------------- */

  // Texte d'une ligne : code, gras, italique, liens (relatifs à studies/)
  function enLigne(t) {
    var codes = [];
    var s = echapper(t).replace(/`([^`]+)`/g, function (_, c) {
      codes.push("<code>" + c + "</code>");
      return "\u0000" + (codes.length - 1) + "\u0000";
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(«])\*([^*\s][^*]*?)\*(?=[\s).,;:!?»]|$)/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, texte, url) {
        var u = url.replace(/&amp;/g, "&");
        if (/^(https?:|#)/.test(u)) return '<a href="' + echapper(u) + '">' + texte + "</a>";
        if (/^[a-z]+:/i.test(u)) return texte;
        return '<a href="../' + echapper(u.replace(/^\//, "")) + '">' + texte + "</a>";
      });
    return s.replace(/\u0000(\d+)\u0000/g, function (_, n) { return codes[Number(n)]; });
  }

  // Bloc de texte : tableaux, listes numérotées, séparateurs, paragraphes
  function texteEnHtml(lignes) {
    var html = [], i = 0;
    function cellules(l) { return l.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map(function (c) { return c.trim(); }); }
    while (i < lignes.length) {
      var l = lignes[i];
      if (/^\s*\|/.test(l)) {
        var rangs = [];
        while (i < lignes.length && /^\s*\|/.test(lignes[i])) { rangs.push(lignes[i]); i += 1; }
        var tete = cellules(rangs[0]), corps = rangs.slice(1).filter(function (r) { return !/^\s*\|[\s:|-]+\|?\s*$/.test(r); });
        html.push('<div class="tableau"><table><thead><tr>' + tete.map(function (c) { return "<th>" + enLigne(c) + "</th>"; }).join("") +
          "</tr></thead><tbody>" + corps.map(function (r) {
            return "<tr>" + cellules(r).map(function (c) { return "<td>" + enLigne(c) + "</td>"; }).join("") + "</tr>";
          }).join("") + "</tbody></table></div>");
      } else if (/^\d+[.)] /.test(l)) {
        var items = [];
        while (i < lignes.length && (/^\d+[.)] /.test(lignes[i]) || /^\s+\S/.test(lignes[i]))) {
          if (/^\d+[.)] /.test(lignes[i])) items.push(lignes[i].replace(/^\d+[.)] /, ""));
          else items[items.length - 1] += " " + lignes[i].trim();
          i += 1;
        }
        html.push("<ol>" + items.map(function (x) { return "<li>" + enLigne(x) + "</li>"; }).join("") + "</ol>");
      } else if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) {
        html.push("<hr>"); i += 1;
      } else {
        var p = [];
        while (i < lignes.length && !/^\s*\|/.test(lignes[i]) && !/^\d+[.)] /.test(lignes[i]) && !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lignes[i])) { p.push(lignes[i].trim()); i += 1; }
        html.push("<p>" + enLigne(p.join(" ")) + "</p>");
      }
    }
    return html.join("");
  }

  /* Filtres ------------------------------------------------------------------- */

  function filtreActif() { return etat.filtre !== "tout" || etat.recherche !== ""; }

  function sousCases(it) {
    return it.suite.map(function (l) { return M.SOUS_CASE.exec(l); }).filter(Boolean);
  }
  function itemVisible(it) {
    if (etat.recherche && normaliser(it.texte + " " + it.suite.join(" ")).indexOf(normaliser(etat.recherche)) < 0) return false;
    if (etat.filtre === "tout") return true;
    var ouverte = it.marque === " " || sousCases(it).some(function (m) { return m[2] === " "; });
    var faite = (it.marque !== null && it.marque !== " ") || sousCases(it).some(function (m) { return m[2] !== " "; });
    return etat.filtre === "afaire" ? ouverte : faite;
  }
  function blocsVisibles(blocs) {
    return blocs.some(function (b) { return b.type === "liste" && b.items.some(itemVisible); });
  }
  function tousBlocs(sec) {
    var t = sec.blocs.slice();
    (sec.sous || []).forEach(function (s) { t.push.apply(t, s.blocs); });
    return t;
  }

  /* Enregistrement ---------------------------------------------------------------- */

  function changer(operation) {
    var avant = M.ecrire(etat.doc);
    if (operation() === false) { afficher(); return false; }
    var apres = M.ecrire(etat.doc);
    if (apres !== avant) {
      etat.annuler.push(avant);
      if (etat.annuler.length > 100) etat.annuler.shift();
      etat.retablir = [];
      planifier();
    }
    afficher();
    return true;
  }

  function planifier() {
    etat.enAttente = true;
    clearTimeout(etat.minuteur);
    etat.minuteur = setTimeout(sauver, DELAI_ENREGISTREMENT);
    majStatut();
  }

  function sauver(forcer) {
    clearTimeout(etat.minuteur);
    if (etat.enregistrement) { etat.relancer = true; return Promise.resolve(); }
    var texte = M.ecrire(etat.doc);
    if (texte === etat.texteEnregistre && !forcer) { etat.enAttente = false; majStatut(); return Promise.resolve(); }
    etat.enregistrement = true;
    majStatut();
    return etat.source.ecrire(texte, etat.version, forcer === true).then(function (r) {
      etat.version = r.version;
      etat.texteEnregistre = texte;
      etat.erreur = null;
      etat.conflit = null;
      etat.derniere = new Date();
    }).catch(function (e) {
      if (e.conflit) etat.conflit = e.conflit;
      else etat.erreur = e.message || String(e);
    }).then(function () {
      etat.enregistrement = false;
      etat.enAttente = M.ecrire(etat.doc) !== etat.texteEnregistre;
      if (etat.conflit) { afficherConflit(); majStatut(); return; }
      if (etat.relancer || (etat.enAttente && !etat.erreur)) { etat.relancer = false; planifier(); return; }
      majStatut();
    });
  }

  function annuler() {
    if (!etat.annuler.length) return;
    etat.retablir.push(M.ecrire(etat.doc));
    etat.doc = M.lire(etat.annuler.pop());
    etat.edition = null;
    planifier();
    afficher();
    notifier("Modification annulée.");
  }
  function retablir() {
    if (!etat.retablir.length) return;
    etat.annuler.push(M.ecrire(etat.doc));
    etat.doc = M.lire(etat.retablir.pop());
    etat.edition = null;
    planifier();
    afficher();
  }

  // Changement fait ailleurs (Claude, l'éditeur, une autre page) : la page se
  // met à jour d'elle-même quand rien n'est en cours
  function verifierDisque() {
    if (!etat.source || etat.enAttente || etat.enregistrement || etat.edition || etat.conflit || etat.vue === "texte") return;
    etat.source.lire().then(function (d) {
      if (d.texte === etat.texteEnregistre) { etat.version = d.version; return; }
      if (etat.enAttente || etat.enregistrement || etat.edition) return;
      etat.doc = M.lire(d.texte);
      etat.version = d.version;
      etat.texteEnregistre = d.texte;
      afficher();
      notifier("TODO.md a été modifié ailleurs : la page est à jour.");
    }).catch(function () { /* nouvel essai au prochain passage */ });
  }

  /* Sources : serveur local, fichier choisi sur le disque ---------------------------- */

  function appel(methode, corps) {
    var init = { method: methode, headers: {}, cache: "no-store" };
    if (corps) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(corps); }
    return fetch("/api/todo/fichier", init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        var e;
        if (r.status === 409) { e = new Error(d.erreur); e.conflit = d; throw e; }
        if (!r.ok) { e = new Error(d.erreur || "Erreur " + r.status); e.statut = r.status; throw e; }
        return d;
      });
    });
  }
  var serveur = {
    libelle: "serveur local",
    lire: function () { return appel("GET"); },
    ecrire: function (texte, version, forcer) { return appel("PUT", { texte: texte, version: version, forcer: forcer }); }
  };

  function surDisque(poignee) {
    function lireFichier() {
      return poignee.getFile().then(function (f) {
        return f.text().then(function (t) { return { texte: t, version: f.lastModified + "-" + f.size }; });
      });
    }
    return {
      libelle: "fichier " + poignee.name + " ouvert depuis le disque",
      lire: lireFichier,
      ecrire: function (texte, version, forcer) {
        return lireFichier().then(function (actuel) {
          if (!forcer && actuel.version !== version && actuel.texte !== texte) {
            var e = new Error("TODO.md a changé depuis son ouverture.");
            e.conflit = actuel;
            throw e;
          }
          return poignee.createWritable().then(function (w) {
            return w.write(texte).then(function () { return w.close(); });
          });
        }).then(lireFichier).then(function (f) { return { version: f.version }; });
      }
    };
  }

  // Poignée du fichier choisi, gardée d'une visite à l'autre
  function base() {
    return new Promise(function (ok, ko) {
      var r = indexedDB.open("studies-todo", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("poignees"); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { ko(r.error); };
    });
  }
  function garderPoignee(p) {
    return base().then(function (db) {
      return new Promise(function (ok) {
        var t = db.transaction("poignees", "readwrite");
        t.objectStore("poignees").put(p, "todo");
        t.oncomplete = ok; t.onerror = ok;
      });
    }).catch(function () { /* sans IndexedDB : il faudra rechoisir le fichier */ });
  }
  function poigneeGardee() {
    return base().then(function (db) {
      return new Promise(function (ok) {
        var r = db.transaction("poignees").objectStore("poignees").get("todo");
        r.onsuccess = function () { ok(r.result || null); };
        r.onerror = function () { ok(null); };
      });
    }).catch(function () { return null; });
  }

  function ouvrirPoignee(p) {
    var options = { mode: "readwrite" };
    return p.queryPermission(options).then(function (s) {
      return s === "granted" ? s : p.requestPermission(options);
    }).then(function (s) {
      if (s !== "granted") throw new Error("Accès au fichier refusé.");
      var source = surDisque(p);
      return source.lire().then(function (d) {
        if (!/^todo\.md$/i.test(p.name)) notifier("Fichier ouvert : " + p.name + " (et non TODO.md).");
        charger(source, d);
      });
    });
  }

  function choisirFichier() {
    window.showOpenFilePicker({
      id: "studies-todo",
      types: [{ description: "Markdown", accept: { "text/markdown": [".md"] } }],
      multiple: false
    }).then(function (liste) {
      var p = liste[0];
      return garderPoignee(p).then(function () { return ouvrirPoignee(p); });
    }).catch(function (e) {
      if (e && e.name !== "AbortError") notifier("Impossible d'ouvrir le fichier : " + e.message);
    });
  }

  function accueilSansFichier(raison, erreur) {
    app.innerHTML = "";
    var c = el("section", "todo-ouvrir");
    c.appendChild(el("h2", null, "Ouvrir TODO.md"));
    var surDisqueSeul = !/^https?:$/.test(location.protocol);
    var p1 = el("p");
    if (raison === "extension") {
      p1.innerHTML = "Le serveur local tourne, mais sans l'outil de suivi : il a démarré avant sa création. Fermer sa fenêtre, puis relancer <code>studies/lancer.bat</code>.";
    } else if (raison === "serveur") {
      p1.textContent = "Le serveur local ne répond pas comme prévu" + (erreur ? " (" + erreur.message + ")" : "") + ".";
    } else {
      p1.innerHTML = "Avec le serveur local (<code>studies/lancer.bat</code>), la page lit et enregistre <code>TODO.md</code> d'elle-même.";
    }
    c.appendChild(p1);
    var actions = el("div", "todo-ouvrir-actions");
    if (surDisqueSeul) {
      var lien = el("a", "todo-action principal", "Ouvrir via le serveur local");
      lien.href = "http://127.0.0.1:" + PORT + "/_outils/todo/index.html";
      lien.hidden = true;
      actions.appendChild(lien);
      fetch("http://127.0.0.1:" + PORT + "/api/ping", { mode: "no-cors" }).then(function () { lien.hidden = false; }).catch(function () {
        var p = el("p", "todo-aide");
        p.innerHTML = "Le serveur local n'est pas lancé : double-cliquer sur <code>studies/lancer.bat</code>, puis recharger cette page.";
        c.insertBefore(p, actions);
      });
    }
    if (window.showOpenFilePicker) {
      var p2 = el("p");
      p2.innerHTML = "Ou, sans serveur : choisir <code>TODO.md</code>, à la racine du dossier <code>studies</code>. Edge le lit et l'enregistre directement ; il demande ton accord à chaque visite.";
      c.appendChild(p2);
      actions.appendChild(boutonTexte("Choisir TODO.md…", choisirFichier));
      poigneeGardee().then(function (p) {
        if (!p) return;
        actions.insertBefore(boutonTexte("Rouvrir " + p.name, function () {
          ouvrirPoignee(p).catch(function (e) { notifier(e.message); });
        }, "principal"), actions.firstChild);
      });
    } else if (surDisqueSeul) {
      c.appendChild(el("p", "todo-aide", "Ce navigateur ne sait pas ouvrir un fichier du disque en écriture : passer par le serveur local, ou par Edge ou Chrome."));
    }
    c.appendChild(actions);
    app.appendChild(c);
  }

  /* Chargement ----------------------------------------------------------------------- */

  function charger(source, d) {
    etat.source = source;
    etat.doc = M.lire(d.texte);
    etat.version = d.version;
    etat.texteEnregistre = d.texte;
    etat.annuler = []; etat.retablir = [];
    etat.erreur = null; etat.conflit = null; etat.enAttente = false;
    construireCadre();
    afficher();
    if (location.hash) {
      var cible = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (cible) cible.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }

  var surveillance = false;
  function surveiller() {
    if (surveillance) return;
    surveillance = true;
    setInterval(verifierDisque, 15000);
    window.addEventListener("focus", verifierDisque);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && etat.enAttente) sauver();
      else if (!document.hidden) verifierDisque();
    });
    window.addEventListener("beforeunload", function (e) {
      if (etat.enAttente || etat.enregistrement) { sauver(); e.preventDefault(); e.returnValue = ""; }
    });
    document.addEventListener("keydown", function (e) {
      var saisie = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      var ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === "s") { e.preventDefault(); if (etat.source) sauver(); return; }
      if (saisie || !ctrl || etat.vue === "texte") return;
      if (e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); annuler(); }
      else if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) { e.preventDefault(); retablir(); }
    });
  }

  /* Cadre : état, barre d'outils, contenu ------------------------------------------------ */

  function construireCadre() {
    app.innerHTML = "";
    zones.outils = barreOutils();
    zones.conflit = el("div", "todo-conflit-zone");
    zones.contenu = el("div", "todo-contenu-zone");
    app.appendChild(zones.outils);
    app.appendChild(zones.conflit);
    app.appendChild(zones.contenu);
    surveiller();
  }

  function segment(options, valeur, action) {
    var g = el("div", "todo-segment");
    g.setAttribute("role", "group");
    options.forEach(function (o) {
      var b = el("button", o[0] === valeur ? "actif" : null, o[1]);
      b.type = "button";
      b.dataset.valeur = o[0];
      b.setAttribute("aria-pressed", String(o[0] === valeur));
      b.addEventListener("click", function () { action(o[0]); });
      g.appendChild(b);
    });
    return g;
  }
  function majSegment(g, valeur) {
    Array.prototype.forEach.call(g.children, function (b) {
      b.classList.toggle("actif", b.dataset.valeur === valeur);
      b.setAttribute("aria-pressed", String(b.dataset.valeur === valeur));
    });
  }

  function barreOutils() {
    var b = el("div", "todo-outils");
    zones.vue = segment([["taches", "Tâches"], ["texte", "Texte brut"]], etat.vue, function (v) {
      if (v === etat.vue) return;
      if (etat.vue === "texte" && zones.brut && zones.brut.value !== M.ecrire(etat.doc) &&
          !window.confirm("Abandonner les changements du texte brut ?")) return;
      etat.vue = v; etat.edition = null; afficher();
    });
    zones.filtre = segment([["tout", "Tout"], ["afaire", "À faire"], ["faites", "Faites"]], etat.filtre, function (v) {
      etat.filtre = v; afficher();
    });
    var recherche = el("input", "todo-recherche");
    recherche.type = "search";
    recherche.placeholder = "Chercher une tâche…";
    recherche.setAttribute("aria-label", "Chercher une tâche");
    recherche.addEventListener("input", function () { etat.recherche = recherche.value.trim(); afficher(); });
    zones.recherche = recherche;
    zones.plier = boutonTexte("Tout replier", function () {
      var s = M.structure(etat.doc), tout = s.sections.every(function (x) { return etat.plies[x.titre.texte]; });
      s.sections.forEach(function (x) { if (tout) delete etat.plies[x.titre.texte]; else etat.plies[x.titre.texte] = true; });
      ecrireStockage("plies", etat.plies);
      afficher();
    });
    zones.annuler = bouton("annuler", "Annuler (Ctrl+Z)", annuler);
    zones.retablir = bouton("retablir", "Rétablir (Ctrl+Y)", retablir);
    zones.statut = el("span", "todo-statut");
    zones.statut.setAttribute("role", "status");
    [zones.vue, zones.filtre, recherche, zones.plier, zones.annuler, zones.retablir, zones.statut].forEach(function (x) { b.appendChild(x); });
    return b;
  }

  function majStatut() {
    if (!zones.statut) return;
    var s = zones.statut, texte, classe;
    if (etat.conflit) { texte = "Conflit : TODO.md a changé ailleurs"; classe = "erreur"; }
    else if (etat.erreur) { texte = "Non enregistré : " + etat.erreur; classe = "erreur"; }
    else if (etat.enregistrement) { texte = "Enregistrement…"; classe = "en-cours"; }
    else if (etat.enAttente) { texte = "Modifications en attente"; classe = "en-cours"; }
    else if (etat.derniere) { texte = "Enregistré à " + etat.derniere.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); classe = "ok"; }
    else { texte = "À jour"; classe = "ok"; }
    s.textContent = texte;
    s.className = "todo-statut " + classe;
    s.title = "Source : " + (etat.source ? etat.source.libelle : "aucune") + (etat.erreur ? " · Ctrl+S pour réessayer" : "");
    if (zones.annuler) zones.annuler.disabled = !etat.annuler.length;
    if (zones.retablir) zones.retablir.disabled = !etat.retablir.length;
  }

  function majCompteurs() {
    var n = M.compter(etat.doc.blocs);
    function ecrire(cle, v) { var d = document.querySelector('[data-todo="' + cle + '"]'); if (d) d.textContent = v; }
    ecrire("taches", n.taches);
    ecrire("faites", n.faites + (n.taches ? " (" + Math.round(100 * n.faites / n.taches) + " %)" : ""));
    ecrire("restantes", n.taches - n.faites);
    ecrire("fichier", etat.source ? etat.source.libelle : "—");
  }

  function afficherConflit() {
    zones.conflit.innerHTML = "";
    if (!etat.conflit) return;
    var c = el("div", "todo-conflit");
    var p = el("p");
    p.innerHTML = "<strong>TODO.md a changé depuis son ouverture</strong> (Claude, l'éditeur ou une autre page l'a modifié). Tes derniers changements ne sont pas enregistrés.";
    c.appendChild(p);
    var a = el("div", "todo-ouvrir-actions");
    a.appendChild(boutonTexte("Charger la version du disque", function () {
      etat.annuler.push(M.ecrire(etat.doc));
      etat.doc = M.lire(etat.conflit.texte);
      etat.version = etat.conflit.version;
      etat.texteEnregistre = etat.conflit.texte;
      etat.conflit = null; etat.enAttente = false; etat.edition = null;
      afficher();
      notifier("Version du disque chargée. Annuler (Ctrl+Z) retrouve la tienne.");
    }, "principal"));
    a.appendChild(boutonTexte("Garder mes changements (écraser)", function () {
      etat.conflit = null; afficherConflit(); sauver(true);
    }));
    c.appendChild(a);
    zones.conflit.appendChild(c);
  }

  /* Affichage -------------------------------------------------------------------------- */

  function afficher() {
    if (!etat.doc || !zones.contenu) return;
    majSegment(zones.vue, etat.vue);
    majSegment(zones.filtre, etat.filtre);
    [zones.filtre, zones.recherche, zones.plier].forEach(function (x) { x.hidden = etat.vue === "texte"; });
    var s = M.structure(etat.doc);
    zones.plier.textContent = s.sections.length && s.sections.every(function (x) { return etat.plies[x.titre.texte]; }) ? "Tout déplier" : "Tout replier";
    var nouveau = etat.vue === "texte" ? vueTexteBrut() : vueTaches(s);
    zones.contenu.replaceChildren(nouveau);
    afficherConflit();
    majCompteurs();
    majStatut();
    if (etat.focus) {
      var f = zones.contenu.querySelector('[data-focus="' + etat.focus + '"]');
      etat.focus = null;
      if (f) f.focus({ preventScroll: true });
    }
  }

  function vueTexteBrut() {
    var d = el("div", "todo-brut");
    var ta = el("textarea", "todo-brut-texte");
    ta.value = M.ecrire(etat.doc);
    ta.spellcheck = false;
    ta.setAttribute("aria-label", "Texte de TODO.md");
    zones.brut = ta;
    d.appendChild(el("p", "todo-aide", "Le fichier tel quel, en Markdown. « Appliquer » l'enregistre ; la vue Tâches se met à jour."));
    d.appendChild(ta);
    var a = el("div", "todo-ouvrir-actions");
    a.appendChild(boutonTexte("Appliquer", function () {
      var t = ta.value;
      changer(function () { etat.doc = M.lire(t); });
      notifier("Texte appliqué.");
    }, "principal"));
    a.appendChild(boutonTexte("Rétablir le texte du fichier", function () { ta.value = M.ecrire(etat.doc); }));
    d.appendChild(a);
    return d;
  }

  function vueTaches(s) {
    var corps = el("div", "todo-corps");
    corps.appendChild(vuePlan(s));
    var contenu = el("div", "todo-contenu");
    if (!filtreActif() && s.intro.length) {
      var intro = el("div", "todo-intro");
      vueBlocs(s.intro, null).forEach(function (x) { intro.appendChild(x); });
      contenu.appendChild(intro);
    }
    var visibles = 0;
    s.sections.forEach(function (sec) {
      var v = vueSection(sec);
      if (v) { contenu.appendChild(v); visibles += 1; }
    });
    if (!visibles) contenu.appendChild(el("p", "todo-vide", etat.recherche ? "Aucune tâche ne correspond à « " + etat.recherche + " »." : "Aucune tâche dans ce filtre."));
    corps.appendChild(contenu);
    return corps;
  }

  function vuePlan(s) {
    var nav = el("nav", "todo-plan");
    nav.setAttribute("aria-label", "Sections de TODO.md");
    nav.appendChild(el("p", "todo-plan-titre", "Sections"));
    var ol = el("ol");
    s.sections.forEach(function (sec) {
      var n = M.compter(tousBlocs(sec));
      var li = el("li");
      var a = el("a");
      a.href = "#" + ancre(sec.titre.texte);
      a.innerHTML = '<span class="todo-plan-nom">' + enLigne(sec.titre.texte) + "</span>" +
        (n.taches ? '<span class="todo-plan-compte">' + n.faites + "/" + n.taches + "</span>" : "");
      a.addEventListener("click", function () {
        if (etat.plies[sec.titre.texte]) { delete etat.plies[sec.titre.texte]; ecrireStockage("plies", etat.plies); afficher(); }
      });
      li.appendChild(a);
      if (n.taches) li.appendChild(barre(n));
      ol.appendChild(li);
    });
    nav.appendChild(ol);
    nav.appendChild(formulaireTitre(null, "+ Nouvelle section"));
    return nav;
  }

  function barre(n) {
    var b = el("span", "todo-barre");
    var r = el("span");
    r.style.setProperty("--p", n.taches ? n.faites / n.taches : 0);
    b.appendChild(r);
    b.title = n.faites + " faite" + (n.faites > 1 ? "s" : "") + " sur " + n.taches;
    return b;
  }

  function compte(n) {
    if (!n.taches) return null;
    var c = el("span", "todo-compte" + (n.faites === n.taches ? " complet" : ""), n.faites + " / " + n.taches);
    c.title = n.faites + " faite" + (n.faites > 1 ? "s" : "") + " sur " + n.taches;
    return c;
  }

  /* Sections et sous-sections ---------------------------------------------------------- */

  function vueSection(sec) {
    var tous = tousBlocs(sec);
    if (filtreActif() && !blocsVisibles(tous)) return null;
    var plie = !!etat.plies[sec.titre.texte] && !filtreActif();
    var s = el("section", "todo-section" + (plie ? " plie" : ""));
    s.id = ancre(sec.titre.texte);
    var tete = el("header", "todo-section-tete");
    var plier = bouton("chevron", plie ? "Déplier la section" : "Replier la section", function () {
      if (etat.plies[sec.titre.texte]) delete etat.plies[sec.titre.texte]; else etat.plies[sec.titre.texte] = true;
      ecrireStockage("plies", etat.plies);
      afficher();
    }, "todo-plier");
    plier.setAttribute("aria-expanded", String(!plie));
    tete.appendChild(plier);
    tete.appendChild(titreModifiable(sec.titre, "h2"));
    var n = M.compter(tous), c = compte(n);
    if (c) { tete.appendChild(c); tete.appendChild(barre(n)); }
    tete.appendChild(actionsTitre(sec.titre));
    s.appendChild(tete);
    if (plie) return s;
    var corps = el("div", "todo-section-corps");
    vueBlocs(sec.blocs, sec.titre).forEach(function (x) { corps.appendChild(x); });
    sec.sous.forEach(function (sous) {
      var v = vueSousSection(sous);
      if (v) corps.appendChild(v);
    });
    if (!filtreActif()) corps.appendChild(ajouts(sec.titre, true));
    s.appendChild(corps);
    return s;
  }

  function vueSousSection(sous) {
    if (filtreActif() && !blocsVisibles(sous.blocs)) return null;
    var a = el("article", "todo-matiere");
    var teinte = /teinte `([\w-]+)`/.exec(sous.titre.texte);
    if (teinte) a.setAttribute("data-matiere", teinte[1]);
    a.id = ancre(sous.titre.texte);
    var tete = el("header", "todo-matiere-tete");
    tete.appendChild(titreModifiable(sous.titre, "h3"));
    var n = M.compter(sous.blocs), c = compte(n);
    if (c) { tete.appendChild(c); tete.appendChild(barre(n)); }
    tete.appendChild(actionsTitre(sous.titre));
    a.appendChild(tete);
    vueBlocs(sous.blocs, sous.titre).forEach(function (x) { a.appendChild(x); });
    if (!filtreActif()) a.appendChild(ajouts(sous.titre, false));
    return a;
  }

  function titreModifiable(b, balise) {
    if (etat.edition && etat.edition.type === "titre" && etat.edition.id === b.id) {
      var f = el("form", "todo-edition-titre");
      var i = el("input", "todo-champ");
      i.value = b.texte;
      i.setAttribute("aria-label", "Titre");
      i.dataset.focus = "titre:" + b.id;
      etat.focus = "titre:" + b.id;
      f.appendChild(i);
      f.appendChild(boutonTexte("OK", function () { f.requestSubmit(); }, "principal"));
      f.appendChild(boutonTexte("Annuler", fermerEdition));
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = i.value;
        etat.edition = null;
        changer(function () { return M.renommerTitre(etat.doc, b.id, v); });
      });
      i.addEventListener("keydown", function (e) { if (e.key === "Escape") fermerEdition(); });
      return f;
    }
    var h = el(balise, "todo-titre");
    h.innerHTML = enLigne(b.texte.replace(/\s+—\s+.*$/, ""));
    var reste = / — (.*)$/.exec(b.texte);
    if (reste) {
      var petit = el("small", "todo-titre-detail");
      petit.innerHTML = enLigne(reste[1]);
      h.appendChild(petit);
    }
    h.addEventListener("dblclick", function () { ouvrirEdition("titre", b.id); });
    return h;
  }

  function actionsTitre(b) {
    var a = el("div", "todo-actions");
    a.appendChild(bouton("crayon", "Renommer", function () { ouvrirEdition("titre", b.id); }));
    a.appendChild(bouton("haut", "Monter", function () { changer(function () { return M.deplacerTitre(etat.doc, b.id, -1); }); }));
    a.appendChild(bouton("bas", "Descendre", function () { changer(function () { return M.deplacerTitre(etat.doc, b.id, 1); }); }));
    a.appendChild(bouton("corbeille", "Supprimer, avec tout son contenu", function () {
      var p = M.portee(etat.doc, b.id), blocs = etat.doc.blocs.slice(p.debut + 1, p.fin), n = M.compter(blocs);
      if (blocs.length && !window.confirm("Supprimer « " + b.texte.replace(/`/g, "") + " » et tout son contenu" + (n.taches ? " (" + n.taches + " tâches)" : "") + " ? (Ctrl+Z annule)")) return;
      changer(function () { return M.supprimerTitre(etat.doc, b.id); });
    }));
    return a;
  }

  // Boutons d'ajout en bas d'une section ou sous-section
  function ajouts(titre, section) {
    var cle = titre.id;
    var d = el("div", "todo-ajouts");
    var e = etat.edition;
    if (e && e.id === cle && e.type === "nouvelle-liste") { d.appendChild(formulaireListe(titre)); return d; }
    if (e && e.id === cle && e.type === "nouveau-texte") { d.appendChild(formulaireTexte(titre)); return d; }
    d.appendChild(boutonTexte("+ Liste", function () { ouvrirEdition("nouvelle-liste", cle); }));
    d.appendChild(boutonTexte("+ Paragraphe", function () { ouvrirEdition("nouveau-texte", cle); }));
    if (section) d.appendChild(formulaireTitre(titre, "+ Sous-section"));
    return d;
  }

  function formulaireListe(titre) {
    var f = el("form", "todo-formulaire");
    var nom = el("input", "todo-champ");
    nom.placeholder = "Titre de la liste (Cours, TD, Quiz…), facultatif";
    nom.setAttribute("aria-label", "Titre de la liste");
    nom.dataset.focus = "nouvelle-liste:" + titre.id;
    etat.focus = nom.dataset.focus;
    var tache = el("input", "todo-champ");
    tache.placeholder = "Première tâche";
    tache.setAttribute("aria-label", "Première tâche");
    tache.required = true;
    f.appendChild(nom);
    f.appendChild(tache);
    var a = el("div", "todo-ouvrir-actions");
    a.appendChild(boutonTexte("Créer la liste", function () { f.requestSubmit(); }, "principal"));
    a.appendChild(boutonTexte("Annuler", fermerEdition));
    f.appendChild(a);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var n = nom.value, t = tache.value;
      if (!t.trim()) { tache.focus(); return; }
      etat.edition = null;
      changer(function () { return Boolean(M.ajouterListe(etat.doc, titre.id, n, t)); });
    });
    f.addEventListener("keydown", function (e) {
      if (e.key === "Escape") fermerEdition();
      if (e.key === "Enter" && e.target.tagName === "INPUT") {
        e.preventDefault();
        if (e.target === nom && !tache.value.trim()) tache.focus(); else f.requestSubmit();
      }
    });
    return f;
  }

  function formulaireTexte(titre) {
    var f = el("form", "todo-formulaire");
    var ta = el("textarea", "todo-champ");
    ta.rows = 3;
    ta.placeholder = "Paragraphe en Markdown (« Fait : … », remarque, tableau)";
    ta.setAttribute("aria-label", "Nouveau paragraphe");
    ta.dataset.focus = "nouveau-texte:" + titre.id;
    etat.focus = ta.dataset.focus;
    f.appendChild(ta);
    var a = el("div", "todo-ouvrir-actions");
    a.appendChild(boutonTexte("Ajouter", function () { f.requestSubmit(); }, "principal"));
    a.appendChild(boutonTexte("Annuler", fermerEdition));
    f.appendChild(a);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = ta.value;
      etat.edition = null;
      changer(function () { return Boolean(M.ajouterTexte(etat.doc, titre.id, v)); });
    });
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Escape") fermerEdition();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) f.requestSubmit();
    });
    return f;
  }

  // Nouvelle section (parent null) ou sous-section : un bouton, puis un champ
  function formulaireTitre(parent, libelle) {
    var cle = parent ? parent.id : "racine";
    if (!(etat.edition && etat.edition.type === "nouveau-titre" && etat.edition.id === cle)) {
      return boutonTexte(libelle, function () { ouvrirEdition("nouveau-titre", cle); }, parent ? null : "todo-plan-ajout");
    }
    var f = el("form", "todo-formulaire" + (parent ? "" : " todo-plan-ajout"));
    var i = el("input", "todo-champ");
    i.placeholder = parent ? "Titre de la sous-section (matière — `dossier`…)" : "Titre de la section";
    i.setAttribute("aria-label", i.placeholder);
    i.dataset.focus = "nouveau-titre:" + cle;
    etat.focus = i.dataset.focus;
    f.appendChild(i);
    var a = el("div", "todo-ouvrir-actions");
    a.appendChild(boutonTexte("Créer", function () { f.requestSubmit(); }, "principal"));
    a.appendChild(boutonTexte("Annuler", fermerEdition));
    f.appendChild(a);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = i.value, cree = null;
      etat.edition = null;
      changer(function () { cree = M.ajouterTitre(etat.doc, v, parent ? parent.id : null); return Boolean(cree); });
      if (cree) {
        var cible = document.getElementById(ancre(cree.texte));
        if (cible) cible.scrollIntoView({ block: "start" });
      }
    });
    i.addEventListener("keydown", function (e) { if (e.key === "Escape") fermerEdition(); });
    return f;
  }

  function ouvrirEdition(type, id) { etat.edition = { type: type, id: id }; afficher(); }
  function fermerEdition() { etat.edition = null; afficher(); }

  /* Blocs : texte et listes -------------------------------------------------------------- */

  function vueBlocs(blocs, titre) {
    var vues = [];
    blocs.forEach(function (b) {
      var v = b.type === "liste" ? vueListe(b) : b.type === "texte" ? vueTexte(b) : vueTitreMineur(b);
      if (v) vues.push(v);
    });
    return vues;
  }

  function vueTitreMineur(b) {
    if (filtreActif()) return null;
    var d = el("div", "todo-titre-fichier");
    d.appendChild(titreModifiable(b, "p"));
    return d;
  }

  function vueTexte(b) {
    if (filtreActif()) return null;
    var d = el("div", "todo-texte");
    if (etat.edition && etat.edition.type === "texte" && etat.edition.id === b.id) {
      var f = el("form", "todo-formulaire");
      var ta = el("textarea", "todo-champ todo-mono");
      ta.value = b.lignes.join("\n");
      ta.rows = Math.min(16, b.lignes.length + 2);
      ta.setAttribute("aria-label", "Texte du paragraphe");
      ta.dataset.focus = "texte:" + b.id;
      etat.focus = ta.dataset.focus;
      f.appendChild(ta);
      var a = el("div", "todo-ouvrir-actions");
      a.appendChild(boutonTexte("Enregistrer", function () { f.requestSubmit(); }, "principal"));
      a.appendChild(boutonTexte("Annuler", fermerEdition));
      f.appendChild(a);
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = ta.value;
        etat.edition = null;
        changer(function () { return M.modifierTexte(etat.doc, b.id, v); });
      });
      ta.addEventListener("keydown", function (e) {
        if (e.key === "Escape") fermerEdition();
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) f.requestSubmit();
      });
      d.appendChild(f);
      return d;
    }
    var rendu = el("div", "todo-texte-rendu");
    rendu.innerHTML = texteEnHtml(b.lignes);
    rendu.addEventListener("dblclick", function (e) { if (e.target.tagName !== "A") ouvrirEdition("texte", b.id); });
    d.appendChild(rendu);
    d.appendChild(actionsBloc(b));
    return d;
  }

  function actionsBloc(b) {
    var a = el("div", "todo-actions");
    if (b.type === "liste") a.appendChild(bouton("crayon", b.etiquette ? "Renommer la liste" : "Donner un titre à la liste", function () { ouvrirEdition("liste", b.id); }));
    else a.appendChild(bouton("crayon", "Modifier le texte", function () { ouvrirEdition("texte", b.id); }));
    a.appendChild(bouton("haut", "Monter", function () { changer(function () { return M.deplacerBloc(etat.doc, b.id, -1); }); }));
    a.appendChild(bouton("bas", "Descendre", function () { changer(function () { return M.deplacerBloc(etat.doc, b.id, 1); }); }));
    a.appendChild(bouton("corbeille", b.type === "liste" ? "Supprimer la liste" : "Supprimer le paragraphe", function () {
      var n = b.type === "liste" ? b.items.length : 0;
      if (n > 1 && !window.confirm("Supprimer la liste « " + (b.etiquette || "sans titre") + " » et ses " + n + " éléments ? (Ctrl+Z annule)")) return;
      changer(function () { return M.supprimerBloc(etat.doc, b.id); });
    }));
    return a;
  }

  function vueListe(b) {
    if (filtreActif() && !b.items.some(itemVisible)) return null;
    var d = el("div", "todo-liste");
    d.dataset.bloc = b.id;
    var tete = el("div", "todo-liste-tete");
    if (etat.edition && etat.edition.type === "liste" && etat.edition.id === b.id) {
      var f = el("form", "todo-edition-titre");
      var i = el("input", "todo-champ");
      i.value = b.etiquette || "";
      i.placeholder = "Titre de la liste (vide : sans titre)";
      i.setAttribute("aria-label", "Titre de la liste");
      i.dataset.focus = "liste:" + b.id;
      etat.focus = i.dataset.focus;
      f.appendChild(i);
      f.appendChild(boutonTexte("OK", function () { f.requestSubmit(); }, "principal"));
      f.appendChild(boutonTexte("Annuler", fermerEdition));
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = i.value;
        etat.edition = null;
        changer(function () { return M.renommerListe(etat.doc, b.id, v); });
      });
      i.addEventListener("keydown", function (e) { if (e.key === "Escape") fermerEdition(); });
      tete.appendChild(f);
    } else if (b.etiquette) {
      var etiquette = el("span", "todo-etiquette" + (b.etiquette.length > 40 ? " longue" : ""));
      etiquette.innerHTML = enLigne(b.etiquette);
      etiquette.addEventListener("dblclick", function () { ouvrirEdition("liste", b.id); });
      tete.appendChild(etiquette);
      var c = compte(M.compter([b]));
      if (c) tete.appendChild(c);
      tete.appendChild(actionsBloc(b));
    }
    // Liste sans titre : pas d'en-tête ; ses actions vont dans la ligne d'ajout
    if (tete.firstChild) d.appendChild(tete);

    var ul = el("ul", "todo-items");
    b.items.forEach(function (it, k) {
      if (itemVisible(it)) ul.appendChild(vueItem(b, it, k));
    });
    // Déposer sous la dernière tâche : en fin de liste
    ul.addEventListener("dragover", function (e) {
      if (!glisse || e.target !== ul) return;
      e.preventDefault();
      nettoyerCibles();
      ul.classList.add("cible-fin");
    });
    ul.addEventListener("drop", function (e) {
      if (!glisse || e.target !== ul) return;
      e.preventDefault();
      var id = glisse;
      changer(function () { return M.deplacer(etat.doc, id, b.id, b.items.length); });
    });
    d.appendChild(ul);

    if (!filtreActif()) {
      var f2 = el("form", "todo-ajout");
      var champ = el("input", "todo-ajout-champ");
      champ.placeholder = "Ajouter une tâche…";
      champ.setAttribute("aria-label", "Ajouter une tâche à la liste " + (b.etiquette || ""));
      champ.dataset.focus = "ajout:" + b.id;
      f2.appendChild(champ);
      f2.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = champ.value;
        if (!v.trim()) return;
        etat.focus = "ajout:" + b.id;
        changer(function () { return Boolean(M.ajouter(etat.doc, b.id, v)); });
      });
      if (!tete.firstChild) f2.appendChild(actionsBloc(b));
      d.appendChild(f2);
    }
    return d;
  }

  /* Tâches ------------------------------------------------------------------------------ */

  var glisse = null;
  function nettoyerCibles() {
    document.querySelectorAll(".cible-avant, .cible-apres, .cible-fin").forEach(function (x) {
      x.classList.remove("cible-avant", "cible-apres", "cible-fin");
    });
  }

  function vueItem(b, it, k) {
    if (etat.edition && etat.edition.type === "item" && etat.edition.id === it.id) return vueEditionItem(b, it);
    var classe = "todo-item" + (it.marque === null ? " note" : it.marque !== " " ? " faite" : "");
    var li = el("li", classe);
    li.dataset.item = it.id;

    var poignee = el("button", "todo-poignee");
    poignee.type = "button";
    poignee.innerHTML = icone("poignee");
    poignee.title = "Glisser pour déplacer (ou flèches haut et bas)";
    poignee.setAttribute("aria-label", "Déplacer : " + it.texte.slice(0, 60));
    poignee.dataset.focus = "poignee:" + it.id;
    poignee.addEventListener("pointerdown", function () { li.draggable = true; });
    poignee.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      var pos = e.key === "ArrowUp" ? k - 1 : k + 2;
      if (pos < 0 || pos > b.items.length) return;
      etat.focus = "poignee:" + it.id;
      changer(function () { return M.deplacer(etat.doc, it.id, b.id, pos); });
    });
    li.appendChild(poignee);

    if (it.marque !== null) {
      var c = el("input", "todo-case");
      c.type = "checkbox";
      c.checked = it.marque !== " ";
      c.setAttribute("aria-label", (c.checked ? "Faite : " : "À faire : ") + it.texte.slice(0, 80));
      c.addEventListener("change", function () { changer(function () { return M.basculer(etat.doc, it.id); }); });
      li.appendChild(c);
    } else {
      li.appendChild(el("span", "todo-puce"));
    }

    var corps = el("div", "todo-item-corps");
    var texte = el("div", "todo-item-texte");
    texte.innerHTML = enLigne(it.texte);
    texte.addEventListener("dblclick", function (e) { if (e.target.tagName !== "A") ouvrirEdition("item", it.id); });
    corps.appendChild(texte);
    if (it.suite.length) corps.appendChild(vueSuite(it));
    li.appendChild(corps);

    var a = el("div", "todo-actions");
    a.appendChild(bouton("crayon", "Modifier", function () { ouvrirEdition("item", it.id); }));
    a.appendChild(bouton("corbeille", "Supprimer", function () {
      changer(function () { return M.supprimer(etat.doc, it.id); });
      notifier("Tâche supprimée.", "Annuler", annuler);
    }));
    li.appendChild(a);

    li.addEventListener("dragstart", function (e) {
      glisse = it.id;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", it.texte);
      li.classList.add("glisse");
    });
    li.addEventListener("dragend", function () {
      li.draggable = false;
      li.classList.remove("glisse");
      glisse = null;
      nettoyerCibles();
    });
    li.addEventListener("dragover", function (e) {
      if (!glisse || glisse === it.id) return;
      e.preventDefault();
      e.stopPropagation();
      var r = li.getBoundingClientRect(), apres = e.clientY > r.top + r.height / 2;
      nettoyerCibles();
      li.classList.add(apres ? "cible-apres" : "cible-avant");
    });
    li.addEventListener("drop", function (e) {
      if (!glisse || glisse === it.id) return;
      e.preventDefault();
      e.stopPropagation();
      var id = glisse, pos = k + (li.classList.contains("cible-apres") ? 1 : 0);
      changer(function () { return M.deplacer(etat.doc, id, b.id, pos); });
    });
    return li;
  }

  // Lignes indentées d'une tâche : sous-tâches à cocher, puces, texte
  function vueSuite(it) {
    var ul = el("ul", "todo-sous");
    it.suite.forEach(function (l, i) {
      var m = M.SOUS_CASE.exec(l);
      var li = el("li");
      var profondeur = Math.floor((/^\s*/.exec(l)[0].length - 2) / 2);
      if (profondeur > 0) li.style.setProperty("--profondeur", profondeur);
      if (m) {
        var c = el("input", "todo-case");
        c.type = "checkbox";
        c.checked = m[2] !== " ";
        var t = (m[3] || "").trim();
        c.setAttribute("aria-label", (c.checked ? "Faite : " : "À faire : ") + t.slice(0, 80));
        c.addEventListener("change", function () { changer(function () { return M.basculerSous(etat.doc, it.id, i); }); });
        li.className = "sous-tache" + (c.checked ? " faite" : "");
        li.appendChild(c);
        var s = el("span");
        s.innerHTML = enLigne(t);
        li.appendChild(s);
      } else {
        var puce = /^\s+[-*] (.*)$/.exec(l);
        li.className = puce ? "sous-puce" : "sous-texte";
        li.innerHTML = enLigne(puce ? puce[1] : l.trim());
      }
      ul.appendChild(li);
    });
    return ul;
  }

  function listesDuDocument() {
    var s = M.structure(etat.doc), r = [];
    function prendre(blocs, chemin) {
      blocs.forEach(function (b) {
        if (b.type === "liste") r.push({ id: b.id, nom: chemin + " › " + (b.etiquette ? b.etiquette.replace(/`/g, "").slice(0, 40) : "liste") });
      });
    }
    prendre(s.intro, "Début");
    s.sections.forEach(function (sec) {
      var n = sec.titre.texte.replace(/`/g, "").slice(0, 30);
      prendre(sec.blocs, n);
      sec.sous.forEach(function (sous) { prendre(sous.blocs, n + " › " + sous.titre.texte.replace(/\s+—.*$/, "").replace(/`/g, "").slice(0, 30)); });
    });
    return r;
  }

  function vueEditionItem(b, it) {
    var li = el("li", "todo-item edition");
    var f = el("form", "todo-formulaire");
    var ta = el("textarea", "todo-champ");
    ta.value = it.texte + (it.suite.length ? "\n" + it.suite.join("\n") : "");
    ta.rows = Math.min(14, it.suite.length + 2);
    ta.setAttribute("aria-label", "Texte de la tâche");
    ta.dataset.focus = "item:" + it.id;
    etat.focus = ta.dataset.focus;
    f.appendChild(ta);
    f.appendChild(el("p", "todo-aide", "Première ligne : la tâche. Lignes suivantes : détails ou sous-tâches (« - [ ] … »). Ctrl+Entrée enregistre, Échap annule."));
    var reglages = el("div", "todo-reglages");
    var lType = el("label", null, "Type ");
    var type = el("select");
    [["tache", "Tâche à cocher"], ["note", "Note, sans case"]].forEach(function (o) {
      var op = el("option", null, o[1]); op.value = o[0]; type.appendChild(op);
    });
    type.value = it.marque === null ? "note" : "tache";
    lType.appendChild(type);
    reglages.appendChild(lType);
    var lListe = el("label", null, "Liste ");
    var liste = el("select");
    listesDuDocument().forEach(function (x) {
      var op = el("option", null, x.nom); op.value = x.id; liste.appendChild(op);
    });
    liste.value = b.id;
    lListe.appendChild(liste);
    reglages.appendChild(lListe);
    f.appendChild(reglages);
    var a = el("div", "todo-ouvrir-actions");
    a.appendChild(boutonTexte("Enregistrer", function () { f.requestSubmit(); }, "principal"));
    a.appendChild(boutonTexte("Annuler", fermerEdition));
    f.appendChild(a);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = ta.value, note = type.value === "note", cible = liste.value;
      etat.edition = null;
      changer(function () {
        if (!M.modifier(etat.doc, it.id, v, note)) return false;
        if (cible !== b.id) M.deplacer(etat.doc, it.id, cible);
        return true;
      });
    });
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Escape") fermerEdition();
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) f.requestSubmit();
    });
    li.appendChild(f);
    return li;
  }

  /* Notifications ------------------------------------------------------------------------- */

  var notification = null;
  function notifier(texte, action, surAction) {
    if (notification) notification.remove();
    var n = el("div", "todo-notification");
    n.setAttribute("role", "status");
    n.appendChild(el("span", null, texte));
    if (action) n.appendChild(boutonTexte(action, function () { n.remove(); surAction(); }));
    document.body.appendChild(n);
    notification = n;
    setTimeout(function () { if (notification === n) { n.classList.add("sortie"); setTimeout(function () { n.remove(); }, 400); } }, action ? 6000 : 3500);
  }

  /* Démarrage ----------------------------------------------------------------------------- */

  function demarrer() {
    if (/^https?:$/.test(location.protocol)) {
      serveur.lire().then(function (d) { charger(serveur, d); }).catch(function (e) {
        accueilSansFichier(e.statut === 404 ? "extension" : "serveur", e);
      });
    } else {
      accueilSansFichier("disque");
    }
  }

  window.TodoPage = { etat: etat, sauver: sauver };
  demarrer();
})();
