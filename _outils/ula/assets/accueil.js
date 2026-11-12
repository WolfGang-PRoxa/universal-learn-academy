/* ==========================================================================
   Accueil d'Universal Learn Academy (_outils/ula/accueil.html)
   Servi par le serveur local à la place de /index.html (et des accueils de
   domaine absents). Tout passe par l'API /api/ula/… (extension
   _outils/ula/serveur/extension.js) :
     - profils : choisir, créer (prérempli avec le nom de la session), renommer ;
     - cursus : dossiers libres et cours, créer, renommer, déplacer, retirer,
       proposer un cours de son espace au catalogue ;
     - cours installés (explore/), par domaine, à ajouter à son cursus ;
     - catalogue en ligne : télécharger, mettre à jour, supprimer un cours.
   ========================================================================== */
(function () {
  "use strict";

  var DOMAINES = { informatique: "Informatique", mathematiques: "Mathématiques", langues: "Langues", communication: "Communication et projet", sciences: "Sciences", lettres: "Lettres", autres: "Autres" };
  var main = document.getElementById("ula");
  var etat = null, cursus = null, progression = {}, catalogue = null;
  var domaineSeul = (location.pathname.match(/^\/explore\/([^/]+)\/index\.html$/) || [])[1] || null;

  /* -- Outils ------------------------------------------------------------- */

  function el(tag, classe, texte) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte != null) e.textContent = texte;
    return e;
  }
  function bouton(texte, classe, action) {
    var b = el("button", "ula-bouton" + (classe ? " " + classe : ""), texte);
    b.type = "button";
    b.addEventListener("click", function () {
      b.disabled = true;
      Promise.resolve().then(action).catch(afficherErreur).then(function () { b.disabled = false; });
    });
    return b;
  }
  function lien(texte, href, classe) {
    var a = el("a", classe || null, texte);
    a.href = href;
    return a;
  }
  function api(methode, route, corps) {
    var init = { method: methode, headers: {} };
    if (corps !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(corps); }
    return fetch("/api/" + route, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok || (d && d.erreur)) { var e = new Error((d && d.erreur) || "Erreur " + r.status); e.problemes = d && d.problemes; throw e; }
        return d;
      });
    });
  }
  function afficherErreur(e) {
    var texte = e.message + (e.problemes && e.problemes.length ? "\n\n- " + e.problemes.slice(0, 20).join("\n- ") : "");
    return demander({ titre: "Erreur", texte: texte, seulementOk: true });
  }
  function urlPage(chemin) { return "/" + chemin.split("/").map(encodeURIComponent).join("/"); }

  // Petit dialogue (window.prompt n'existe pas dans l'application de bureau)
  function demander(o) {
    var d = document.getElementById("dialogue");
    document.getElementById("dialogue-titre").textContent = o.titre || "";
    var t = document.getElementById("dialogue-texte");
    t.textContent = o.texte || "";
    t.style.whiteSpace = "pre-line";
    t.hidden = !o.texte;
    var zone = document.getElementById("dialogue-champs");
    zone.innerHTML = "";
    var champs = {};
    (o.champs || []).forEach(function (c, i) {
      var id = "champ-" + i;
      var l = el("label", null, c.libelle); l.htmlFor = id;
      var x;
      if (c.choix) {
        x = el("select");
        c.choix.forEach(function (ch) { var op = el("option", null, ch.texte); op.value = ch.valeur; x.appendChild(op); });
      } else if (c.long) x = el("textarea");
      else { x = el("input"); x.type = "text"; }
      x.id = id;
      if (c.valeur != null) x.value = c.valeur;
      zone.appendChild(l); zone.appendChild(x);
      champs[c.nom] = x;
    });
    var err = document.getElementById("dialogue-erreur");
    err.hidden = true;
    var ok = document.getElementById("dialogue-ok");
    ok.textContent = o.ok || "OK";
    d.querySelector("[value=annuler]").hidden = Boolean(o.seulementOk);
    return new Promise(function (resolve) {
      // Réponse lue à l'envoi du formulaire (et pas à l'événement « close », que
      // Chromium peut retarder quand la fenêtre est masquée)
      var fini = false;
      function finir(valeur) {
        if (fini) return;
        fini = true;
        d.onclose = null; form.onsubmit = null; d.oncancel = null;
        if (d.open) d.close(valeur || "");
        if (valeur !== "ok") return resolve(null);
        var r = {};
        Object.keys(champs).forEach(function (k) { r[k] = champs[k].value; });
        resolve(r);
      }
      var form = d.querySelector("form");
      form.onsubmit = function (e) { e.preventDefault(); finir(e.submitter ? e.submitter.value : "ok"); };
      d.oncancel = function () { finir(null); };
      d.onclose = function () { finir(d.returnValue); };
      d.returnValue = "";
      d.showModal();
      var premier = zone.querySelector("input,select,textarea");
      if (premier) { premier.focus(); if (premier.select) premier.select(); }
    });
  }

  /* -- Chargement -------------------------------------------------------------- */

  function charger() {
    return Promise.all([api("GET", "ula/etat"), api("GET", "ula/cursus"), api("GET", "catalogue").catch(function () { return { matieres: [] }; })])
      .then(function (r) {
        etat = r[0]; cursus = r[1];
        progression = {};
        (r[2].matieres || []).forEach(function (m) { if (m.id) progression[m.id] = m; });
        rendre();
      })
      .catch(function (e) {
        main.querySelectorAll("section, #attente").forEach(function (x) { x.remove(); });
        var p = el("p", "ula-erreur", "Le serveur local ne répond pas (" + e.message + "). Lancer lancer.bat (ou l'application), puis recharger la page.");
        main.appendChild(p);
      });
  }

  function coursInstalle(id) {
    return (etat.cours || []).find(function (c) { return c.id === id; }) || null;
  }

  function rendre() {
    main.querySelectorAll("section, #attente, .ula-erreur").forEach(function (x) { x.remove(); });
    if (domaineSeul) {
      var nom = DOMAINES[domaineSeul] || domaineSeul;
      document.getElementById("titre").textContent = nom;
      document.title = nom + " · ULA";
      document.getElementById("chapeau").textContent = "Les cours de ce domaine installés sur ce poste. D'autres cours se téléchargent depuis le catalogue de l'accueil.";
      var fil = document.querySelector(".fil");
      var a = lien("ULA", "/index.html");
      fil.insertBefore(a, document.getElementById("fil-courant"));
      document.getElementById("fil-courant").textContent = nom;
      main.appendChild(sectionCours(domaineSeul));
      return;
    }
    main.appendChild(sectionProfils());
    if (etat.profil) main.appendChild(sectionCursus());
    main.appendChild(sectionCours(null));
    main.appendChild(sectionCatalogue());
    main.appendChild(sectionOutils());
    if (location.hash === "#catalogue") { var s = document.getElementById("catalogue"); if (s) s.scrollIntoView(); }
  }

  /* -- Profils ------------------------------------------------------------------- */

  function sectionProfils() {
    var s = el("section");
    s.appendChild(el("h2", null, "Profil"));
    if (!etat.profils.length) {
      s.appendChild(el("p", null, "Bienvenue ! Choisis ton nom d'utilisateur : ton travail (quiz, TD, TP, suivi) sera rangé dans un dossier à ce nom, à côté du catalogue."));
      var form = el("form", "ula-actions");
      var champ = el("input");
      champ.type = "text"; champ.value = etat.session; champ.setAttribute("aria-label", "Nom d'utilisateur");
      champ.className = "ula-champ";
      var ok = el("button", "ula-bouton principal", "Créer mon profil");
      ok.type = "submit";
      form.appendChild(champ); form.appendChild(ok);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        ok.disabled = true;
        api("POST", "ula/profils", { nom: champ.value }).then(charger).catch(afficherErreur).then(function () { ok.disabled = false; });
      });
      s.appendChild(form);
      return s;
    }
    var liste = el("div", "ula-profils");
    etat.profils.forEach(function (p) {
      var b = el("button", "ula-profil", p.nom);
      b.type = "button";
      b.setAttribute("aria-pressed", String(p.nom === etat.profil));
      b.addEventListener("click", function () {
        if (p.nom === etat.profil) return;
        api("PUT", "ula/profil", { nom: p.nom }).then(charger).catch(afficherErreur);
      });
      liste.appendChild(b);
    });
    s.appendChild(liste);
    s.appendChild(el("p", "ula-note", etat.profil
      ? "Profil actif : « " + etat.profil + " ». Ta progression s'écrit dans le dossier " + etat.profil + "/ (mémorisé sur ce poste)."
      : "Choisis ton profil : la progression s'écrit dans son dossier."));
    var act2 = el("div", "ula-actions");
    act2.appendChild(bouton("Nouveau profil…", "discret", function () { return creerProfil(""); }));
    if (etat.profil) act2.appendChild(bouton("Renommer « " + etat.profil + " »…", "discret", function () {
      return demander({ titre: "Renommer le profil", champs: [{ nom: "nom", libelle: "Nouveau nom", valeur: etat.profil }], ok: "Renommer" }).then(function (r) {
        if (r) return api("POST", "ula/profils/renommer", { ancien: etat.profil, nouveau: r.nom }).then(charger);
      });
    }));
    if (etat.profil) act2.appendChild(bouton("Ouvrir son dossier", "discret", function () { return api("POST", "ula/ouvrir", { chemin: etat.profil }); }));
    s.appendChild(act2);
    return s;
  }

  function creerProfil(valeur) {
    return demander({ titre: "Nouveau profil", texte: "Nom d'utilisateur (le nom du dossier de ton espace).", champs: [{ nom: "nom", libelle: "Nom d'utilisateur", valeur: valeur || "" }], ok: "Créer" })
      .then(function (r) { if (r) return api("POST", "ula/profils", { nom: r.nom }).then(charger); });
  }

  /* -- Cursus ---------------------------------------------------------------------- */

  function dossiers(n, liste) {
    liste = liste || [];
    if (n.type === "profil" || n.type === "dossier") {
      liste.push(n.chemin);
      (n.enfants || []).forEach(function (e) { dossiers(e, liste); });
    }
    return liste;
  }
  function libelleDossier(chemin) {
    var segs = chemin.split("/");
    return segs.length === 1 ? "(racine de mon espace)" : segs.slice(1).join(" › ");
  }

  function resumeProgression(id) {
    var m = progression[id];
    if (!m) return "";
    var faits = m.quiz.filter(function (q) { return q.tentatives && q.tentatives.nombre; }).length;
    var t = (m.travaux || []).filter(function (x) { return x.commences; }).length;
    var parts = [];
    if (m.quiz.length) parts.push(faits + "/" + m.quiz.length + " quiz faits");
    if ((m.travaux || []).length) parts.push(t + "/" + m.travaux.length + " TD commencés");
    return parts.join(" · ");
  }

  function noeudHtml(n) {
    var li = el("li", "ula-noeud");
    var ligne = el("div", "ula-ligne");
    li.appendChild(ligne);
    var outils = el("span", "ula-outils");
    if (n.type === "lien") {
      var c = coursInstalle(n.cours);
      if (c && c.teinte) ligne.dataset.matiere = c.teinte;
      ligne.appendChild(el("span", "ula-pastille"));
      if (c) {
        ligne.appendChild(c.accueil ? lien(c.titre, urlPage(c.accueil), "ula-cours-titre") : el("span", "ula-cours-titre", c.titre));
        var info = [n.nom !== c.titre ? n.nom : null, resumeProgression(n.cours)].filter(Boolean).join(" · ");
        if (info) ligne.appendChild(el("span", "ula-cours-info", info));
      } else {
        ligne.appendChild(el("span", "ula-cours-titre", n.nom));
        ligne.appendChild(el("span", "ula-absent", "cours « " + n.cours + " » non installé"));
        outils.appendChild(lienBouton("Catalogue", "#catalogue"));
      }
    } else if (n.type === "perso") {
      ligne.appendChild(el("span", "ula-pastille"));
      ligne.appendChild(lien(n.nom, urlPage(n.chemin + "/generated_courses/index.html"), "ula-cours-titre"));
      ligne.appendChild(el("span", "ula-cours-info", "cours de ton espace"));
      outils.appendChild(bouton("Proposer ce cours…", "discret", function () { return proposer(n); }));
    } else {
      ligne.appendChild(el("span", "ula-dossier-nom", n.nom));
      var contenu = [n.sousDossiers ? n.sousDossiers + " dossier" + (n.sousDossiers > 1 ? "s" : "") : "", n.fichiers ? n.fichiers + " fichier" + (n.fichiers > 1 ? "s" : "") : ""].filter(Boolean).join(", ");
      if (contenu) ligne.appendChild(el("span", "ula-cours-info", contenu));
      outils.appendChild(bouton("+ Cours", "discret", function () { return ajouterCours(null, n.chemin); }));
      outils.appendChild(bouton("+ Dossier", "discret", function () { return nouveauDossier(n.chemin); }));
    }
    outils.appendChild(bouton("Renommer", "discret", function () {
      return demander({ titre: "Renommer", champs: [{ nom: "nom", libelle: "Nouveau nom", valeur: n.nom }], ok: "Renommer" }).then(function (r) {
        if (r) return api("POST", "ula/cursus/renommer", { chemin: n.chemin, nom: r.nom }).then(charger);
      });
    }));
    outils.appendChild(bouton("Déplacer", "discret", function () {
      var choix = dossiers(cursus.arbre).filter(function (d) { return d !== n.chemin && d.indexOf(n.chemin + "/") !== 0 && d !== n.chemin.split("/").slice(0, -1).join("/"); })
        .map(function (d) { return { valeur: d, texte: libelleDossier(d) }; });
      if (!choix.length) return demander({ titre: "Déplacer", texte: "Aucun autre dossier : en créer un d'abord.", seulementOk: true });
      return demander({ titre: "Déplacer « " + n.nom + " »", champs: [{ nom: "vers", libelle: "Vers le dossier", choix: choix }], ok: "Déplacer" }).then(function (r) {
        if (r) return api("POST", "ula/cursus/deplacer", { chemin: n.chemin, vers: r.vers }).then(charger);
      });
    }));
    outils.appendChild(bouton("Retirer", "discret", function () {
      return demander({ titre: "Retirer « " + n.nom + " »", texte: n.type === "lien" ? "Le cours quitte ton cursus. C'est refusé s'il contient ton travail (tentatives, TD, TP) : le déplacer plutôt." : "Seul un dossier vide peut être retiré.", ok: "Retirer" }).then(function (r) {
        if (r) return api("POST", "ula/cursus/retirer", { chemin: n.chemin }).then(charger);
      });
    }));
    outils.appendChild(bouton("Dossier", "discret", function () { return api("POST", "ula/ouvrir", { chemin: n.chemin }); }));
    ligne.appendChild(outils);
    if (n.type === "dossier" && n.enfants && n.enfants.length) {
      var ul = el("ul");
      n.enfants.forEach(function (e) { ul.appendChild(noeudHtml(e)); });
      li.appendChild(ul);
    }
    return li;
  }
  function lienBouton(texte, href) { return lien(texte, href, "ula-bouton discret"); }

  function sectionCursus() {
    var s = el("section");
    s.appendChild(el("h2", null, "Mon cursus"));
    var a = cursus.arbre;
    if (!a || !a.enfants.length) {
      s.appendChild(el("p", null, "Ton cursus est vide. Crée des dossiers (L1, L2, Prépa, Perso…) et ajoute-y des cours du catalogue : chaque cours y est un lien, sa progression est rangée à côté."));
    } else {
      var ul = el("ul", "ula-arbre");
      a.enfants.forEach(function (e) { ul.appendChild(noeudHtml(e)); });
      s.appendChild(ul);
    }
    var act = el("div", "ula-actions");
    act.appendChild(bouton("+ Dossier", null, function () { return nouveauDossier(etat.profil); }));
    act.appendChild(bouton("+ Cours", null, function () { return ajouterCours(null, etat.profil); }));
    s.appendChild(act);
    return s;
  }

  function nouveauDossier(parent) {
    return demander({ titre: "Nouveau dossier", texte: "Dans : " + libelleDossier(parent), champs: [{ nom: "nom", libelle: "Nom (L1, Prépa, Réorientation…)" }], ok: "Créer" }).then(function (r) {
      if (r) return api("POST", "ula/cursus/dossier", { parent: parent, nom: r.nom }).then(charger);
    });
  }

  function ajouterCours(id, dossier) {
    if (!etat.profil) return demander({ titre: "Ajouter un cours", texte: "Choisis d'abord ton profil.", seulementOk: true });
    var champs = [];
    if (!id) {
      var dejaLa = {};
      (function p(n) { if (n.type === "lien") dejaLa[n.cours] = true; (n.enfants || []).forEach(p); })(cursus.arbre || {});
      var choix = etat.cours.filter(function (c) { return !dejaLa[c.id]; }).map(function (c) { return { valeur: c.id, texte: (DOMAINES[c.domaine] || c.domaine) + " · " + c.titre }; });
      if (!choix.length) return demander({ titre: "Ajouter un cours", texte: "Tous les cours installés sont déjà dans ton cursus. D'autres se téléchargent depuis le catalogue en ligne.", seulementOk: true });
      champs.push({ nom: "cours", libelle: "Cours installé", choix: choix });
    }
    if (!dossier) champs.push({ nom: "dossier", libelle: "Dans le dossier", choix: dossiers(cursus.arbre).map(function (d) { return { valeur: d, texte: libelleDossier(d) }; }) });
    return demander({ titre: "Ajouter un cours à mon cursus", texte: dossier ? "Dans : " + libelleDossier(dossier) : "", champs: champs, ok: "Ajouter" }).then(function (r) {
      if (r) return api("POST", "ula/cursus/ajouter", { cours: id || r.cours, dossier: dossier || r.dossier }).then(charger);
    });
  }

  function proposer(n) {
    return demander({
      titre: "Proposer « " + n.nom + " » au catalogue",
      texte: "L'archive ne contient que les pages générées (generated_courses, generated_quizzes) : ni sources d'enseignants, ni travail personnel. Le contrôle des données personnelles est bloquant. Une page GitHub s'ouvre ensuite : y joindre l'archive.",
      champs: [
        { nom: "titre", libelle: "Titre du cours", valeur: n.nom },
        { nom: "domaine", libelle: "Domaine", choix: Object.keys(DOMAINES).map(function (k) { return { valeur: k, texte: DOMAINES[k] }; }) },
        { nom: "niveau", libelle: "Niveau (Licence 1, Terminale, Prépa…)" },
        { nom: "origine", libelle: "Origine (établissement, formation)" },
        { nom: "description", libelle: "Description", long: true }
      ],
      ok: "Préparer l'archive"
    }).then(function (r) {
      if (!r) return;
      return api("POST", "ula/proposer", { chemin: n.chemin, infos: r }).then(function (p) {
        var texte = "Archive prête : " + p.archive + " (" + p.fichiers + " fichiers)." + (p.avertissements.length ? "\n\nÀ vérifier :\n- " + p.avertissements.slice(0, 10).join("\n- ") : "") + "\n\nLa page GitHub de la proposition va s'ouvrir : y faire glisser l'archive.";
        return demander({ titre: "Proposition prête", texte: texte, ok: "Ouvrir GitHub" }).then(function (ok) {
          api("POST", "ula/ouvrir", { chemin: "propositions" }).catch(function () {});
          if (ok) window.open(p.url, "_blank", "noopener");
        });
      });
    });
  }

  /* -- Cours installés ---------------------------------------------------------------- */

  function sectionCours(domaine) {
    var s = el("section");
    s.appendChild(el("h2", null, domaine ? "Cours" : "Explorer"));
    var cours = etat.cours.filter(function (c) { return !domaine || c.domaine === domaine; });
    if (!cours.length) {
      s.appendChild(el("p", null, "Aucun cours installé" + (domaine ? " dans ce domaine" : "") + ". Le catalogue en ligne, plus bas sur l'accueil, propose de les télécharger."));
      return s;
    }
    var parDomaine = {};
    cours.forEach(function (c) { (parDomaine[c.domaine] = parDomaine[c.domaine] || []).push(c); });
    var dejaLa = {};
    (function p(n) { if (n && n.type === "lien") dejaLa[n.cours] = true; ((n && n.enfants) || []).forEach(p); })(cursus && cursus.arbre);
    Object.keys(parDomaine).forEach(function (d) {
      if (!domaine) s.appendChild(el("h3", null, DOMAINES[d] || d));
      var ul = el("ul", "ula-cartes");
      parDomaine[d].forEach(function (c) {
        var li = el("li", "ula-carte");
        if (c.teinte) li.dataset.matiere = c.teinte;
        var h = el("h3");
        h.appendChild(c.accueil ? lien(c.titre, urlPage(c.accueil)) : document.createTextNode(c.titre));
        li.appendChild(h);
        li.appendChild(el("p", "ula-cours-info", [c.niveau, c.origine].filter(Boolean).join(" · ")));
        if (c.description) li.appendChild(el("p", "ula-note", c.description.length > 180 ? c.description.slice(0, 177) + "…" : c.description));
        var act = el("div", "ula-actions");
        if (etat && etat.profil) {
          if (dejaLa[c.id]) act.appendChild(el("span", "ula-etat", "Dans mon cursus"));
          else act.appendChild(bouton("Ajouter à mon cursus…", "petit", function () { return ajouterCours(c.id, null); }));
        }
        if (!c.accueil) act.appendChild(bouton("Ouvrir le dossier", "discret", function () { return api("POST", "ula/ouvrir", { chemin: c.chemin }); }));
        li.appendChild(act);
        ul.appendChild(li);
      });
      s.appendChild(ul);
    });
    return s;
  }

  /* -- Catalogue en ligne ------------------------------------------------------------------ */

  function sectionCatalogue() {
    var s = el("section");
    s.id = "catalogue";
    s.appendChild(el("h2", null, "Catalogue en ligne"));
    if (etat.source) s.appendChild(el("p", "ula-note", "Ce dossier est la source du catalogue (dépôt git) : ses cours se modifient dans explore/ et se publient avec npm run catalogue (app/). Le catalogue en ligne est affiché pour comparaison."));
    else s.appendChild(el("p", null, "Les cours se téléchargent à la demande, un par un. Une mise à jour d'un cours ne touche jamais à ton travail, rangé dans ton espace."));
    var zone = el("div");
    s.appendChild(zone);
    var act = el("div", "ula-actions");
    act.appendChild(bouton(catalogue ? "Actualiser" : "Afficher le catalogue", "principal", function () { return chargerCatalogue(zone); }));
    s.appendChild(act);
    if (catalogue) rendreCatalogue(zone);
    return s;
  }

  function chargerCatalogue(zone) {
    zone.innerHTML = "";
    zone.appendChild(el("p", "ula-attente", "Lecture du catalogue…"));
    return api("GET", "ula/catalogue").then(function (c) { catalogue = c; rendreCatalogue(zone); })
      .catch(function (e) { zone.innerHTML = ""; zone.appendChild(el("p", "ula-erreur", e.message)); });
  }

  var LIBELLES_ETAT = { absent: "", installe: "Installé", maj: "Mise à jour disponible", source: "Source locale" };

  var LIBELLES_PACK = { absent: "", installe: "Installé", maj: "Mise à jour disponible", partiel: "En partie installé" };

  function taille(o) { return (o / 1e6).toFixed(1).replace(".", ",") + " Mo"; }

  // Packs par niveau d'étude : en tête du catalogue
  function rendrePacks(zone) {
    if (!catalogue.packs || !catalogue.packs.length) return;
    zone.appendChild(el("h3", null, "Packs"));
    var ul = el("ul", "ula-cartes");
    catalogue.packs.forEach(function (p) {
      var li = el("li", "ula-carte");
      if (LIBELLES_PACK[p.etat]) li.appendChild(el("span", "ula-etat", LIBELLES_PACK[p.etat]));
      li.appendChild(el("h3", null, "Pack " + p.titre));
      li.appendChild(el("p", "ula-cours-info", [p.origine, p.nombre + " cours", taille(p.taille)].filter(Boolean).join(" · ")));
      if (p.description) li.appendChild(el("p", "ula-note", p.description));
      var act = el("div", "ula-actions");
      if (!catalogue.source && p.etat !== "installe") act.appendChild(bouton(p.etat === "maj" ? "Mettre à jour le pack" : "Télécharger le pack", "principal", function () { return installerPack(p, zone); }));
      if (etat.profil) act.appendChild(bouton("Ranger dans mon cursus…", p.etat === "installe" ? "principal" : "discret", function () { return rangerPack(p); }));
      li.appendChild(act);
      ul.appendChild(li);
    });
    zone.appendChild(ul);
    zone.appendChild(el("h3", null, "Cours"));
  }

  // Télécharge les cours du pack un par un (progression globale) ; un cours en échec
  // n'arrête pas les autres, et relancer le pack ne reprend que ceux qui manquent
  function installerPack(p, zone) {
    var aFaire = catalogue.cours.filter(function (c) { return p.cours.indexOf(c.id) >= 0 && (c.etat === "absent" || c.etat === "maj"); });
    var suivi = el("p", "ula-attente");
    zone.insertBefore(suivi, zone.firstChild);
    var erreurs = [];
    var chaine = Promise.resolve();
    aFaire.forEach(function (c, i) {
      chaine = chaine.then(function () {
        suivi.textContent = "Pack " + p.titre + " : " + (i + 1) + "/" + aFaire.length + " · " + c.titre + " (" + taille(c.taille) + ")…";
        return api("POST", "ula/catalogue/installer", { id: c.id }).catch(function (e) { erreurs.push(c.titre + " : " + e.message); });
      });
    });
    return chaine.then(function () {
      suivi.remove();
      return api("GET", "ula/catalogue").then(function (c) { catalogue = c; return charger(); });
    }).then(function () {
      if (erreurs.length) return demander({ titre: "Pack incomplet", texte: erreurs.length + " cours n'ont pas pu être installés :\n- " + erreurs.join("\n- ") + "\n\nRelancer « Télécharger le pack » reprend seulement ceux-là.", seulementOk: true });
      if (etat.profil) return rangerPack(p);
    });
  }

  // Range les cours du pack dans un dossier du cursus (nom proposé : L1, L2…), sans
  // déplacer ni dupliquer ceux qui y sont déjà
  function rangerPack(p) {
    return demander({
      titre: "Ranger le pack " + p.titre + " dans mon cursus",
      texte: "Les cours du pack (" + p.cours.length + ") sont ajoutés dans ce dossier ; ceux qui sont déjà dans ton cursus restent où ils sont.",
      champs: [{ nom: "dossier", libelle: "Dossier", valeur: p.court || p.titre }],
      ok: "Ranger"
    }).then(function (r) {
      if (!r) return;
      return api("POST", "ula/cursus/ajouter-pack", { cours: p.cours, dossier: r.dossier }).then(function (x) {
        return charger().then(function () {
          return demander({ titre: "Pack rangé", texte: x.ajoutes.length + " cours ajoutés dans « " + r.dossier + " »" + (x.presents.length ? ", " + x.presents.length + " déjà dans ton cursus." : "."), seulementOk: true });
        });
      });
    });
  }

  function rendreCatalogue(zone) {
    zone.innerHTML = "";
    rendrePacks(zone);
    var ul = el("ul", "ula-cartes");
    catalogue.cours.forEach(function (c) {
      var li = el("li", "ula-carte");
      if (c.teinte) li.dataset.matiere = c.teinte;
      if (LIBELLES_ETAT[c.etat]) li.appendChild(el("span", "ula-etat", LIBELLES_ETAT[c.etat]));
      li.appendChild(el("h3", null, c.titre));
      li.appendChild(el("p", "ula-cours-info", [DOMAINES[c.domaine] || c.domaine, c.niveau, c.origine, (c.taille / 1e6).toFixed(1).replace(".", ",") + " Mo"].filter(Boolean).join(" · ")));
      if (c.description) li.appendChild(el("p", "ula-note", c.description.length > 180 ? c.description.slice(0, 177) + "…" : c.description));
      var act = el("div", "ula-actions");
      if (!catalogue.source) {
        if (c.etat === "absent") act.appendChild(bouton("Télécharger", "principal", function () { return installer(c, zone); }));
        if (c.etat === "maj") act.appendChild(bouton("Mettre à jour", "principal", function () { return installer(c, zone); }));
        if (c.etat === "installe" || c.etat === "maj") act.appendChild(bouton("Supprimer", "discret", function () {
          return demander({ titre: "Supprimer « " + c.titre + " » de ce poste ?", texte: "Les pages du cours sont retirées ; ton travail (tentatives, TD, TP) reste dans ton espace, et le cours se retélécharge à tout moment.", ok: "Supprimer" }).then(function (r) {
            if (r) return api("POST", "ula/catalogue/supprimer", { id: c.id }).then(function () { return charger(); });
          });
        }));
      }
      li.appendChild(act);
      ul.appendChild(li);
    });
    zone.appendChild(ul);
    zone.appendChild(el("p", "ula-note", "Catalogue du " + new Date(catalogue.genere).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) + "."));
  }

  function installer(c, zone) {
    var p = el("p", "ula-attente", "Téléchargement de « " + c.titre + " »…");
    zone.insertBefore(p, zone.firstChild);
    return api("POST", "ula/catalogue/installer", { id: c.id }).then(function () {
      return charger().then(function () {
        if (etat.profil && !(function trouve(n) { return n && (n.type === "lien" && n.cours === c.id || (n.enfants || []).some(trouve)); })(cursus.arbre)) {
          return ajouterCours(c.id, null);
        }
      });
    }).catch(function (e) { p.remove(); throw e; });
  }

  /* -- Outils ------------------------------------------------------------------------- */

  function sectionOutils() {
    var s = el("section");
    s.appendChild(el("h2", null, "Outils"));
    var ol = el("ol", "chapitres");
    [
      ["/_outils/quiz/portail.html", "Mes révisions", "Quiz à reprendre, résultats et TD interactifs des cours de ton cursus."],
      ["/_outils/todo/index.html", "Mon suivi", "Le TODO.md de ton profil : cocher, ajouter, organiser."],
      ["/_outils/environnements/c.html", "Compiler un TP en C", "Windows (MinGW, WSL) et Linux : ce qui est installé, ce qui manque."],
      ["/_outils/environnements/python.html", "Les notebooks Python", "Un environnement Jupyter commun, ouvert par lancer-jupyter."],
      ["/_outils/quiz/demo.html", "Quiz de démonstration", "Les types de questions de l'outil de quiz."],
      ["/_outils/atelier/demo.html", "Atelier de démonstration", "Les éditeurs des TD interactifs."]
    ].forEach(function (x) {
      var li = el("li");
      var a = lien("", x[0], "chapitre");
      a.appendChild(el("span", "chapitre-num"));
      var t = el("span");
      t.appendChild(el("span", "chapitre-titre", x[1]));
      t.appendChild(el("span", "chapitre-resume", x[2]));
      a.appendChild(t);
      li.appendChild(a);
      ol.appendChild(li);
    });
    s.appendChild(ol);
    return s;
  }

  charger();
})();
