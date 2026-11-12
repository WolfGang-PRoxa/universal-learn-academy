/* ==========================================================================
   Atelier · espace de travail (Atelier.Espace)
   --------------------------------------------------------------------------
   Un espace par bloc <div class="atelier"> de la page (ou par question de
   quiz). Il assemble :
     - la barre : titre, bascule Dessin / Les deux / Texte, annuler et
       rétablir, Vérifier, Comparer, Solution, Claude, menu ;
     - la vue graphique de l'éditeur (Atelier.vues[nom]) et la vue texte,
       synchronisées : une modification du dessin réécrit le texte ; un
       texte sans erreur met le dessin à jour (sinon, les erreurs s'affichent
       et le dessin garde la dernière version valide) ;
     - les résultats : contrôles, écarts avec la solution, correction de
       Claude, solution ; un clic sur un message éclaire l'élément visé ;
     - la sauvegarde (Atelier.Sauvegarde), sauf pour un exemple ou un quiz.
   Modes (config.mode) : exercice (défaut), exemple (modifiable, non
   enregistré), lecture (dessin seul), annoter (le dessin est fixe : on
   pose des remarques sur ses éléments et on rédige une réponse), quiz.
   ========================================================================== */
(function (A) {
  "use strict";

  var N = A.noyau, el = N.el;
  var LIBELLES_NIVEAU = { erreur: "Erreur", attention: "Attention", info: "Remarque" };
  var LIBELLES_ECART = { manque: "Manque", exces: "En trop", different: "Différent" };
  var grammaireEnregistree = false;

  function Q() { return window.QuizApp || null; }
  function lireMemoire(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function ecrireMemoire(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* indisponible */ } }

  // Coloration des syntaxes de l'atelier dans l'éditeur de texte (highlight.js)
  function enregistrerGrammaire() {
    if (grammaireEnregistree || !window.hljs) return;
    grammaireEnregistree = true;
    window.hljs.registerLanguage("atelier", function (hljs) {
      return {
        name: "Atelier",
        case_insensitive: true,
        keywords: { keyword: "classe abstraite interface enumeration énumération automate initial final noeud nœud etat état temps acteur objet participant alt sinon fin boucle opt oriente non" },
        contains: [
          { className: "comment", begin: /^\s*--/, end: /$/ },
          { className: "comment", begin: /(^|\s)\/\//, end: /$/ },
          hljs.QUOTE_STRING_MODE,
          { className: "title", begin: /_[#\wÀ-ÿ]+_/ },
          { className: "variable", begin: /#[\wÀ-ÿ]+/ },
          { className: "meta", begin: /\{[^}]*\}|\[[^\]]*\]|<<[^>]*>>/ },
          { className: "operator", begin: /<\|--|--\|>|\.\.\|>|<\|\.\.|\*--|--\*|o--|--o|-->|<--|->>|->|--|\.\.>|<\.\.|\|/ },
          { className: "number", begin: /\b\d+(\.\.\d+|\.\.\*)?\b/ }
        ]
      };
    });
  }

  function Espace(racine, config, contexte) {
    var self = this;
    this.racine = racine;
    this.config = config;
    this.ctx = contexte || {};
    this.mode = config.mode || this.ctx.mode || "exercice";
    this.ed = A.editeurs[config.editeur];
    this.vueDef = A.vues[config.editeur];
    this.options = config.options || {};
    this.lectureSeule = this.mode === "lecture" || this.mode === "annoter";
    if (!this.ed || !this.vueDef) { this.erreurFatale("Éditeur inconnu : « " + config.editeur + " »."); return; }
    var d = this.ed.lire(N.lignesDe(config.depart), this.options);
    this.depart = d.modele;
    if (config.depart && d.erreurs.length) console.warn("[atelier] départ de « " + config.id + " » :", d.erreurs);
    if (config.solution != null) {
      var s = this.ed.lire(N.lignesDe(config.solution), this.options);
      this.solution = s.modele;
      if (s.erreurs.length) console.warn("[atelier] solution de « " + config.id + " » :", s.erreurs);
    }
    this.solutionTexte = config.solution != null ? N.lignesDe(config.solution) : null;
    if (config.disposition) {
      appliquerDisposition(this.depart, config.disposition);
      if (this.solution) appliquerDisposition(this.solution, config.disposition);
    }
    this.historique = new A.Historique();
    this.erreursTexte = [];
    this.resultats = {};

    // État enregistré (travail précédent), sinon le travail fait sur papier (champ « papier »), sinon le départ
    this.papier = this.mode === "exercice" && config.papier != null ? N.travailPapier(this.ed, config.papier, this.options) : null;
    if (this.papier && this.papier.erreurs.length) console.warn("[atelier] travail papier de « " + config.id + " » :", this.papier.erreurs);
    var sauve = this.ctx.etat || null;
    this.etat = sauve && sauve.editeur === config.editeur ? sauve : this.papier ? N.copie(this.papier.etat) : { editeur: config.editeur };
    this.modele = this.etat.modele && this.mode !== "annoter" && this.mode !== "lecture" ? this.etat.modele : N.copie(this.depart);
    this.historique.vider(this.modele);
    this.construire();
    this.vue.afficher(this.modele, this.depart);
    this.texte = this.etat.texte != null && this.mode !== "lecture" && this.mode !== "annoter" ? this.etat.texte : this.ed.ecrire(this.modele, this.options);
    if (this.editeurTexte) { this.editeurTexte.definir(this.texte); this.analyserTexte(true); }
    if (this.etat.annotations) this.dessinerAnnotations();
    if (this.etat.correction) this.afficherCorrection(this.etat.correction);
    if (this.etat.solutionVue) this.afficherSolution();
    this.majBoutons();
    this.majPied();
    racine.classList.add("atelier-pret");
  }

  function appliquerDisposition(modele, disposition) {
    var liste = modele.classes || modele.noeuds || (modele.cas && modele.acteurs.concat(modele.cas));
    if (!liste) return;
    liste.forEach(function (x) {
      var p = disposition[x.nom];
      if (p) { x.x = p[0]; x.y = p[1]; }
    });
  }

  var P = Espace.prototype;

  P.erreurFatale = function (texte) {
    this.racine.innerHTML = "";
    this.racine.appendChild(el("p", "atelier-alerte", texte));
  };

  /* Construction ---------------------------------------------------------------- */

  P.construire = function () {
    var self = this, r = this.racine, ed = this.ed;
    r.innerHTML = "";
    r.classList.add("mode-" + this.mode);
    if (ed.sansDessin) r.classList.add("sans-dessin");

    // Barre du haut
    var tete = el("div", "atelier-tete");
    tete.appendChild(el("span", "atelier-titre", this.config.titre || ed.libelle));
    if (!ed.sansDessin && this.mode !== "lecture") {
      var vues = el("div", "atelier-vues");
      vues.setAttribute("role", "group");
      vues.setAttribute("aria-label", "Affichage");
      this.boutonsVue = {};
      [["dessin", this.vueDef.libelleVue || "Dessin"], ["les-deux", "Les deux"], ["texte", "Texte"]].forEach(function (v) {
        var b = el("button", "atelier-vue-choix", v[1]);
        b.type = "button";
        b.addEventListener("click", function () { self.choisirVue(v[0], true); });
        vues.appendChild(b);
        self.boutonsVue[v[0]] = b;
      });
      tete.appendChild(vues);
    }
    tete.appendChild(el("span", "espace"));
    var actions = el("div", "atelier-actions");
    var editable = !this.lectureSeule;
    if (editable) {
      this.bAnnuler = N.bouton("↶", "petit discret", function () { self.annuler(); }, "Annuler (Ctrl+Z)");
      this.bRetablir = N.bouton("↷", "petit discret", function () { self.retablir(); }, "Rétablir (Ctrl+Y)");
      actions.appendChild(this.bAnnuler);
      actions.appendChild(this.bRetablir);
    }
    if (this.mode !== "lecture") {
      if (editable) actions.appendChild(N.bouton("Vérifier", "petit", function () { self.verifier(); }, "Contrôler le travail (erreurs de forme, sans dévoiler la solution)"));
      var attendus = this.mode === "annoter" && (this.config.attendu || []).length;
      if ((this.solution || attendus) && this.mode !== "quiz") {
        if (!ed.sansDessin || ed.asynchrone || attendus) actions.appendChild(N.bouton("Comparer", "petit", function () { self.comparer(); }, "Comparer à la solution proposée : score et écarts"));
        this.bSolution = N.bouton(this.config.solution_source === "enseignant" ? "Correction" : "Solution", "petit", function () { self.basculerSolution(); }, "Afficher ou masquer la solution");
        actions.appendChild(this.bSolution);
      }
      if (this.mode === "exercice" || this.mode === "annoter") {
        var bc = N.bouton("Claude", "petit bouton-claude", function (e) { self.menuClaude(bc, e); }, "Demander de l'aide à Claude, ou faire corriger son travail");
        actions.appendChild(bc);
      }
    }
    var menu = N.bouton("⋯", "petit discret", function (e) { self.menu(menu, e); }, "Plus d'actions");
    actions.appendChild(menu);
    tete.appendChild(actions);
    r.appendChild(tete);

    if (this.config.consigne) { var c = el("div", "atelier-consigne"); c.innerHTML = this.config.consigne; r.appendChild(c); }
    if (this.papier && this.papier.note) r.appendChild(el("p", "atelier-aide atelier-note-papier", "Sur ta copie papier : " + this.papier.note));

    this.barreOutils = el("div", "atelier-outils");
    r.appendChild(this.barreOutils);

    // Corps : dessin et texte
    this.corps = el("div", "atelier-corps");
    this.panDessin = el("div", "atelier-panneau-dessin");
    this.bandeau = el("p", "atelier-bandeau");
    this.bandeau.hidden = true;
    this.panDessin.appendChild(this.bandeau);
    if (this.vueDef.aideVide && !this.lectureSeule) {
      this.aideVide = el("p", "atelier-aide-vide", this.vueDef.aideVide);
      this.aideVide.hidden = true;
      this.panDessin.appendChild(this.aideVide);
    }
    this.corps.appendChild(this.panDessin);
    if (!ed.sansDessin) {
      this.panTexte = el("div", "atelier-panneau-texte");
      this.corps.appendChild(this.panTexte);
    }
    r.appendChild(this.corps);

    var ctx = {
      lectureSeule: this.lectureSeule,
      options: this.options,
      hauteur: this.config.hauteur || this.options.hauteur,
      editeur: ed,
      jeu: function () { return self.jeu(); },
      modifie: function (m, fin) { self.depuisVue(m, fin); }
    };
    if (this.mode === "annoter") ctx.surClicElement = function (cible, e) { self.annoter(cible, e); };
    this.vue = this.vueDef.creer(this.panDessin, ctx);
    (this.vue.outils ? this.vue.outils() : []).forEach(function (b) { self.barreOutils.appendChild(b); });
    if (!this.barreOutils.childElementCount) this.barreOutils.hidden = true;

    if (this.panTexte) this.construireTexte();

    this.zoneAnnotations = el("div", "atelier-annotations");
    this.zoneAnnotations.hidden = this.mode !== "annoter";
    r.appendChild(this.zoneAnnotations);
    if (this.mode === "annoter") this.construireAnnotations();

    this.zoneResultats = el("div", "atelier-resultats");
    this.zoneResultats.setAttribute("aria-live", "polite");
    r.appendChild(this.zoneResultats);

    this.pied = el("div", "atelier-pied");
    r.appendChild(this.pied);

    // Raccourcis : Ctrl+Z / Ctrl+Y hors des champs de saisie
    r.addEventListener("keydown", function (e) {
      if (!(e.ctrlKey || e.metaKey) || self.lectureSeule) return;
      var t = e.target;
      if (t.closest && t.closest("input, textarea, select, .atelier-formulaire")) return;
      if (e.key === "z" || e.key === "Z") { e.preventDefault(); if (e.shiftKey) self.retablir(); else self.annuler(); }
      else if (e.key === "y" || e.key === "Y") { e.preventDefault(); self.retablir(); }
    });

    var pref = lireMemoire("atelier:vue:" + ed.nom);
    this.choisirVue(this.config.vue || pref || (r.clientWidth >= 960 && this.mode !== "lecture" ? "les-deux" : "dessin"), false);
  };

  P.construireTexte = function () {
    var self = this, q = Q();
    enregistrerGrammaire();
    var entete = el("div", "atelier-texte-entete");
    entete.appendChild(el("span", "atelier-texte-titre", "Vue texte"));
    var aide = el("details", "atelier-aide-syntaxe");
    aide.appendChild(el("summary", null, "Syntaxe"));
    var corps = el("div", "atelier-aide-corps");
    corps.innerHTML = this.ed.aide || "";
    aide.appendChild(corps);
    entete.appendChild(aide);
    this.panTexte.appendChild(entete);
    var lignes = Math.max(8, Math.min(22, Math.round((this.config.hauteur || 380) / 21)));
    if (q && q.code && q.code.editeur) {
      this.editeurTexte = q.code.editeur(this.panTexte, { langage: "atelier", hljs: "atelier", valeur: "", lignes: lignes, lectureSeule: this.lectureSeule, libelle: "Vue texte : " + this.ed.libelle });
    } else {
      var z = el("textarea", "atelier-redaction mono");
      z.rows = lignes;
      z.readOnly = this.lectureSeule;
      this.panTexte.appendChild(z);
      this.editeurTexte = { valeur: function () { return z.value; }, definir: function (v) { z.value = v; }, saisie: z, focus: function () { z.focus(); } };
    }
    this.erreursZone = el("ul", "atelier-erreurs-syntaxe");
    this.erreursZone.hidden = true;
    this.panTexte.appendChild(this.erreursZone);
    var attente = null, saisie = this.editeurTexte.saisie;
    saisie.addEventListener("input", function () {
      clearTimeout(attente);
      attente = setTimeout(function () { self.analyserTexte(false); }, 280);
    });
    saisie.addEventListener("focus", function () { self.texteActif = true; });
    saisie.addEventListener("blur", function () { self.texteActif = false; });
  };

  P.choisirVue = function (v, memoriser) {
    if (this.ed.sansDessin) v = "dessin";
    if (this.mode === "lecture") v = "dessin";
    this.vueCourante = v;
    this.corps.setAttribute("data-vue", v);
    var bs = this.boutonsVue || {};
    Object.keys(bs).forEach(function (k) { bs[k].classList.toggle("actif", k === v); bs[k].setAttribute("aria-pressed", k === v ? "true" : "false"); });
    this.barreOutils.classList.toggle("masque", v === "texte");
    if (memoriser) ecrireMemoire("atelier:vue:" + this.ed.nom, v);
    var vue = this.vue;
    if (vue && vue.ajuster && v !== "texte") requestAnimationFrame(function () { vue.ajuster(); });
  };

  /* Synchronisation ------------------------------------------------------------------ */

  // Le dessin a changé (fin : fin d'un geste, à mettre dans l'historique)
  P.depuisVue = function (modele, fin) {
    this.modele = modele;
    this.texte = this.ed.ecrire(modele, this.options);
    if (this.editeurTexte && !this.texteActif) {
      this.editeurTexte.definir(this.texte);
      this.montrerErreursTexte([]);
    }
    if (fin) this.historique.enregistrer(modele);
    this.changement();
  };

  // Le texte a changé : s'il est valide, il remplace le modèle
  P.analyserTexte = function (initial) {
    if (!this.editeurTexte) return;
    var t = this.editeurTexte.valeur();
    this.texte = t;
    var r = this.ed.lire(t, this.options);
    this.montrerErreursTexte(r.erreurs);
    if (r.erreurs.length) { if (!initial) this.changement(); return; }
    if (initial && JSON.stringify(stripPositions(r.modele)) === JSON.stringify(stripPositions(this.modele))) return;
    var m = this.ed.fusionner ? this.ed.fusionner(r.modele, this.modele) : r.modele;
    this.modele = m;
    this.vue.afficher(m, this.depart);
    if (!initial) { this.historique.enregistrer(m); this.changement(); }
  };

  function stripPositions(m) {
    return JSON.parse(JSON.stringify(m, function (k, v) { return k === "x" || k === "y" || k === "ligne" || k === "id" ? undefined : v; }));
  }

  P.montrerErreursTexte = function (erreurs) {
    this.erreursTexte = erreurs;
    if (!this.erreursZone) return;
    var self = this;
    this.erreursZone.innerHTML = "";
    this.erreursZone.hidden = !erreurs.length;
    erreurs.forEach(function (e) {
      var li = el("li");
      var b = el("button", "atelier-lien-erreur", (e.ligne ? "Ligne " + e.ligne + " : " : "") + e.message);
      b.type = "button";
      b.addEventListener("click", function () { self.allerLigne(e.ligne); });
      li.appendChild(b);
      self.erreursZone.appendChild(li);
    });
    this.bandeau.hidden = !erreurs.length || this.vueCourante === "texte";
    this.bandeau.textContent = erreurs.length ? "La vue texte contient " + N.pluriel(erreurs.length, "erreur") + " : le dessin montre la dernière version valide." : "";
    this.majPied();
  };

  P.allerLigne = function (n) {
    if (!this.editeurTexte || !n) return;
    var z = this.editeurTexte.saisie, lignes = z.value.split("\n"), pos = 0;
    for (var i = 0; i < n - 1 && i < lignes.length; i++) pos += lignes[i].length + 1;
    if (this.vueCourante === "dessin") this.choisirVue("les-deux", false);
    z.focus();
    z.setSelectionRange(pos, pos + (lignes[n - 1] || "").length);
  };

  P.annuler = function () { var m = this.historique.annuler(); if (m) this.remplacer(m); };
  P.retablir = function () { var m = this.historique.retablir(); if (m) this.remplacer(m); };
  P.remplacer = function (m) {
    this.modele = m;
    this.vue.afficher(m, this.depart);
    this.texte = this.ed.ecrire(m, this.options);
    if (this.editeurTexte) { this.editeurTexte.definir(this.texte); this.montrerErreursTexte([]); }
    this.changement();
  };

  P.reinitialiser = function () {
    if (!window.confirm("Revenir au départ de l'exercice ? Ton travail sur cet atelier sera effacé.")) return;
    this.historique.enregistrer(this.modele);
    this.etat.correction = null;
    delete this.etat.papier;
    this.remplacer(N.copie(this.depart));
    this.historique.enregistrer(this.modele);
    this.fermerResultat("controles"); this.fermerResultat("comparaison"); this.fermerResultat("correction");
  };

  // Après tout changement : sauvegarde, rafraîchissement des résultats ouverts
  P.changement = function () {
    this.majBoutons();
    if (this.resultats.controles) this.verifier(true);
    if (this.resultats.comparaison) this.resultats.comparaison.classList.add("perime");
    this.enregistrer();
    if (this.ctx.surChangement) this.ctx.surChangement(this);
  };

  P.majBoutons = function () {
    if (this.bAnnuler) this.bAnnuler.disabled = !this.historique.peutAnnuler();
    if (this.bRetablir) this.bRetablir.disabled = !this.historique.peutRetablir();
    if (this.aideVide) this.aideVide.hidden = !this.ed.estVide(this.modele);
  };

  /* Sauvegarde --------------------------------------------------------------------------- */

  P.enregistrer = function () {
    if (!this.ctx.sauvegarde || this.mode === "exemple" || this.mode === "lecture" || this.mode === "quiz") return;
    var e = this.etat;
    if (this.mode !== "annoter") {
      e.modele = this.modele;
      e.texte = this.texte !== this.ed.ecrire(this.modele, this.options) ? this.texte : null;
    }
    e.editeur = this.config.editeur;
    e.maj = new Date().toISOString();
    e.resume = this.ed.estVide(this.modele) && !(e.annotations && e.annotations.length) ? "vide" : "commencé";
    var self = this;
    this.ctx.sauvegarde.enregistrer(this.config.id, e, function (statut) { self.statutSauvegarde = statut; self.majPied(); });
  };

  // Remet le travail fait sur papier, tel qu'il a été saisi
  P.reprendrePapier = function () {
    if (!this.papier || !window.confirm("Remettre ta réponse sur papier, telle qu'elle a été saisie ? Ce que tu as fait ici depuis sera remplacé.")) return;
    this.historique.enregistrer(this.modele);
    this.etat.correction = null;
    this.etat.papier = N.copie(this.papier.etat.papier);
    this.remplacer(N.copie(this.papier.etat.modele));
    if (this.papier.etat.texte != null && this.editeurTexte) { this.editeurTexte.definir(this.papier.etat.texte); this.analyserTexte(true); this.enregistrer(); }
    this.historique.enregistrer(this.modele);
    this.fermerResultat("controles"); this.fermerResultat("comparaison"); this.fermerResultat("correction");
  };

  P.majPied = function () {
    if (!this.pied) return;
    var t = [];
    if (this.etat.papier) t.push("Repris de ta copie papier" + (this.etat.papier.source ? " (" + this.etat.papier.source + ")" : ""));
    if (this.erreursTexte.length) t.push(N.pluriel(this.erreursTexte.length, "erreur de syntaxe", "erreurs de syntaxe"));
    var s = this.statutSauvegarde;
    if (this.mode === "exemple") t.push("Exemple : les modifications ne sont pas enregistrées");
    else if (this.mode === "quiz") t.push("");
    else if (this.ctx.sauvegarde && this.mode !== "lecture") {
      t.push(s === "serveur" ? "Enregistré dans le dossier de la matière" : s === "local" ? "Enregistré dans ce navigateur" : s === "en-cours" ? "Enregistrement…" : s === "erreur" ? "Enregistrement impossible sur le serveur (gardé dans ce navigateur)" : "");
    }
    this.pied.textContent = t.filter(Boolean).join(" · ");
    this.pied.hidden = !this.pied.textContent;
  };

  /* Résultats -------------------------------------------------------------------------- */

  P.section = function (cle, titre, classe) {
    var self = this;
    this.fermerResultat(cle);
    var s = el("section", "atelier-resultat " + (classe || cle));
    var t = el("div", "atelier-resultat-tete");
    t.appendChild(el("p", "atelier-resultat-titre", titre));
    t.appendChild(N.bouton("×", "atelier-mini", function () { self.fermerResultat(cle); }, "Fermer"));
    s.appendChild(t);
    var ordre = ["controles", "comparaison", "correction", "solution"];
    var suivant = null;
    for (var i = ordre.indexOf(cle) + 1; i < ordre.length && !suivant; i++) suivant = this.resultats[ordre[i]] || null;
    this.zoneResultats.insertBefore(s, suivant);
    this.resultats[cle] = s;
    return s;
  };
  P.fermerResultat = function (cle) {
    var s = this.resultats[cle];
    if (s) s.remove();
    delete this.resultats[cle];
    if (cle === "solution") { this.etat.solutionVue = false; if (this.bSolution) this.bSolution.classList.remove("actif"); }
    this.surlignerTout();
  };

  // Liste de messages cliquables ; chaque message peut viser un élément (cible)
  P.listeMessages = function (messages, libelleDe, classeDe) {
    var self = this, ul = el("ul", "atelier-messages");
    messages.forEach(function (m) {
      var li = el("li", "atelier-message " + classeDe(m));
      var b = el(m.cible ? "button" : "span", "atelier-message-corps");
      if (m.cible) {
        b.type = "button";
        b.title = "Montrer l'élément concerné";
        b.addEventListener("click", function () { self.montrerCible(m.cible, classeDe(m)); });
      }
      b.appendChild(el("span", "atelier-message-niveau", libelleDe(m)));
      b.appendChild(el("span", "atelier-message-texte", m.message));
      li.appendChild(b);
      ul.appendChild(li);
    });
    return ul;
  };

  P.montrerCible = function (cible, classe) {
    if (this.vueCourante === "texte") this.choisirVue("les-deux", false);
    this.vue.surligner([{ cible: cible, classe: "focus " + classe }].concat(this.surlignagesCourants()));
    var self = this;
    clearTimeout(this.minuterieFocus);
    this.minuterieFocus = setTimeout(function () { self.surlignerTout(); }, 2600);
  };

  P.surlignagesCourants = function () {
    var liste = [];
    (this.derniersControles || []).forEach(function (m) { if (m.cible && m.niveau !== "info") liste.push({ cible: m.cible, classe: m.niveau }); });
    if (this.resultats.comparaison || this.ecartsVisibles) (this.derniereComparaison && this.derniereComparaison.ecarts || []).forEach(function (e) { if (e.cible) liste.push({ cible: e.cible, classe: e.nature }); });
    if (this.resultats.correction && this.etat.correction) (this.etat.correction.remarques || []).forEach(function (x) { if (x.cible) liste.push({ cible: x.cible, classe: "remarque" }); });
    (this.etat.annotations || []).forEach(function (x) { liste.push({ cible: x.cible, classe: "annotation" }); });
    return liste;
  };
  P.surlignerTout = function () {
    if (!this.vue) return;
    var l = this.surlignagesCourants();
    if (l.length) this.vue.surligner(l); else this.vue.effacerSurlignage();
  };

  P.verifier = function (silencieux) {
    var self = this, ed = this.ed;
    var msgs = this.erreursTexte.map(function (e) { return N.message("erreur", "Vue texte, " + (e.ligne ? "ligne " + e.ligne + " : " : "") + e.message); });
    msgs = msgs.concat(ed.controler(this.modele, this.options, this.config.tests) || []);
    this.derniersControles = msgs;
    var s = this.section("controles", "Contrôles");
    var graves = msgs.filter(function (m) { return m.niveau !== "info"; });
    s.appendChild(el("p", "atelier-resultat-resume " + (msgs.some(function (m) { return m.niveau === "erreur"; }) ? "erreur" : graves.length ? "attention" : "ok"),
      !msgs.length ? "Aucun problème de forme détecté." + (this.solution ? " Pour la justesse, comparer à la solution ou demander à Claude." : "") :
        N.pluriel(msgs.filter(function (m) { return m.niveau === "erreur"; }).length, "erreur") + ", " + N.pluriel(msgs.filter(function (m) { return m.niveau === "attention"; }).length, "point", "points") + " d'attention, " + N.pluriel(msgs.filter(function (m) { return m.niveau === "info"; }).length, "remarque") + "."));
    if (msgs.length) s.appendChild(this.listeMessages(msgs, function (m) { return LIBELLES_NIVEAU[m.niveau] || m.niveau; }, function (m) { return m.niveau; }));
    this.surlignerTout();
    // SQL : exécution et comparaison du résultat, sans montrer la solution
    if (ed.asynchrone && !silencieux) this.evaluerAsynchrone(s, false);
  };

  // Évaluation par le serveur (SQL) ; montrerScore : pour « Comparer »
  P.evaluerAsynchrone = function (section, montrerScore) {
    var self = this, C = Q() && Q().connexion;
    var zone = el("div", "atelier-evaluation");
    section.appendChild(zone);
    if (!C || !C.executable || !C.executable("sql")) {
      zone.appendChild(el("p", "atelier-aide", "Pour exécuter et comparer le résultat, ouvrir la page depuis le serveur local (studies/lancer.bat)."));
      return Promise.resolve(null);
    }
    var jeu = this.jeu();
    var ev = this.ed.evaluation(this.modele, this.solution, Object.assign({}, this.options, { tests: this.config.tests }), jeu ? jeu.script : "");
    zone.appendChild(el("p", "atelier-aide attente", "Exécution…"));
    return Promise.all(ev.demandes.map(function (d) { return C.executer(d); })).then(function (reps) {
      var r = ev.interpreter(reps);
      zone.innerHTML = "";
      zone.appendChild(el("p", "atelier-resultat-resume " + (r.score === 1 ? "ok" : r.score === null ? "info" : "erreur"), r.resume));
      if (r.details && r.details.length) zone.appendChild(self.listeMessages(r.details.map(function (x) { return { message: x.nom + " : " + x.message, niveau: x.ok ? "ok" : "erreur" }; }),
        function (m) { return m.niveau === "ok" ? "✓" : "✗"; }, function (m) { return m.niveau; }));
      if (r.obtenu && Q().code && Q().code.tableSql) zone.appendChild(Q().code.tableSql(r.obtenu, "Ton résultat"));
      return r;
    }).catch(function (e) {
      zone.innerHTML = "";
      zone.appendChild(el("p", "atelier-alerte", "Exécution impossible : " + e.message));
      return null;
    });
  };

  P.comparer = function () {
    if (!this.solution && !(this.mode === "annoter" && this.config.attendu)) return;
    var self = this, s = this.section("comparaison", this.mode === "annoter" ? "Comparaison avec les erreurs attendues" : "Comparaison avec la " + (this.config.solution_source === "enseignant" ? "correction" : "solution proposée"));
    if (this.mode === "annoter") { this.comparerAnnotations(s); return; }
    if (this.ed.asynchrone) { this.evaluerAsynchrone(s, true); return; }
    var c = this.ed.comparer(this.modele, this.solution, this.options);
    this.derniereComparaison = c;
    if (!c) { s.appendChild(el("p", "atelier-aide", "Pas de comparaison automatique pour ce type de travail : afficher la solution, ou demander une correction à Claude.")); return; }
    var jauge = el("div", "atelier-jauge");
    var barre = el("span", "atelier-jauge-barre");
    barre.style.setProperty("--score", Math.round(c.score * 100) + "%");
    jauge.appendChild(barre);
    s.appendChild(jauge);
    s.appendChild(el("p", "atelier-resultat-resume " + (c.score === 1 ? "ok" : c.score >= 0.7 ? "attention" : "erreur"), c.resume));
    if (c.ecarts.length) s.appendChild(this.listeMessages(c.ecarts, function (e) { return LIBELLES_ECART[e.nature] || e.nature; }, function (e) { return e.nature; }));
    s.appendChild(el("p", "atelier-aide", "Une modélisation admet souvent plusieurs réponses justes : un écart n'est pas forcément une erreur. En cas de doute, demander à Claude."));
    this.surlignerTout();
  };

  P.basculerSolution = function () {
    if (this.resultats.solution) { this.fermerResultat("solution"); this.enregistrer(); return; }
    if (!this.etat.solutionVue && this.mode !== "exemple" && !window.confirm("Afficher la " + (this.config.solution_source === "enseignant" ? "correction" : "solution proposée") + " ? Mieux vaut essayer d'abord « Vérifier » et « Comparer ».")) return;
    this.afficherSolution();
    this.enregistrer();
  };

  P.afficherSolution = function () {
    if (!this.solution && !this.config.attendu) return;
    var s = this.section("solution", this.config.solution_source === "enseignant" ? "Correction" : this.solution ? "Solution proposée" : "Erreurs attendues");
    this.etat.solutionVue = true;
    if (this.bSolution) this.bSolution.classList.add("actif");
    if (this.mode === "annoter" && this.config.attendu) {
      var ol = el("ol", "atelier-attendu");
      this.config.attendu.forEach(function (x) { var li = el("li"); li.innerHTML = (x.cible ? "<b>" + N.echapper(x.cible) + "</b> : " : "") + x.texte; ol.appendChild(li); });
      s.appendChild(ol);
    }
    if (this.solution && !(this.mode === "annoter" && !this.config.solution)) {
      try { s.appendChild(N.cadreLisible(this.vueDef.statique(this.solution, this.options), "atelier-solution-rendu")); } catch (e) { console.error(e); }
      if (!this.ed.sansDessin && this.solutionTexte) {
        var d = el("details", "atelier-solution-texte");
        d.appendChild(el("summary", null, "Syntaxe texte de la solution"));
        var p = el("pre"), c = el("code", "language-plaintext");
        c.textContent = this.solutionTexte;
        p.appendChild(c);
        d.appendChild(p);
        s.appendChild(d);
      }
    }
    if (this.config.explication) { var x = el("div", "atelier-explication"); x.innerHTML = this.config.explication; s.appendChild(x); }
    if (window.Charte) { try { window.Charte.preparerCode(s); window.Charte.rendreMaths(s); } catch (e) { /* facultatif */ } }
  };

  /* Annotations (mode « annoter ») ------------------------------------------------------ */

  P.construireAnnotations = function () {
    var self = this, z = this.zoneAnnotations;
    z.appendChild(el("p", "atelier-annotations-titre", "Remarques"));
    z.appendChild(el("p", "atelier-aide", "Cliquer sur un élément du dessin (classe, attribut, association…) pour y poser une remarque."));
    this.listeAnnotations = el("ol", "atelier-liste-annotations");
    z.appendChild(this.listeAnnotations);
    var lab = el("label", "atelier-champ");
    lab.appendChild(el("span", "atelier-champ-libelle", this.config.question_reponse || "Réponse rédigée"));
    this.zoneReponse = el("textarea", "atelier-redaction");
    this.zoneReponse.rows = 5;
    this.zoneReponse.value = this.etat.reponse || "";
    this.zoneReponse.addEventListener("input", function () { self.etat.reponse = self.zoneReponse.value; self.enregistrer(); });
    lab.appendChild(this.zoneReponse);
    z.appendChild(lab);
  };

  P.annoter = function (cible, e) {
    if (!cible || this.mode !== "annoter") return;
    var self = this, liste = this.etat.annotations = this.etat.annotations || [];
    var existante = liste.find(function (x) { return x.cible === cible; });
    A.formulaire.ouvrir(this.panDessin, {
      x: e && e.clientX ? e.clientX + 8 : null, y: e && e.clientY ? e.clientY + 8 : null,
      titre: "Remarque sur « " + cible + " »",
      champs: [{ nom: "texte", libelle: "Quel est le problème ?", type: "zone", lignes: 3, valeur: existante ? existante.texte : "" }],
      surValider: function (v) {
        var t = v.texte.trim();
        if (existante) { if (t) existante.texte = t; else liste.splice(liste.indexOf(existante), 1); }
        else if (t) liste.push({ cible: cible, texte: t });
        self.dessinerAnnotations();
        self.enregistrer();
      },
      surSupprimer: existante ? function () { liste.splice(liste.indexOf(existante), 1); self.dessinerAnnotations(); self.enregistrer(); } : null
    });
  };

  P.dessinerAnnotations = function () {
    if (!this.listeAnnotations) return;
    var self = this;
    this.listeAnnotations.innerHTML = "";
    (this.etat.annotations || []).forEach(function (a) {
      var li = el("li");
      var b = el("button", "atelier-annotation", "");
      b.type = "button";
      b.appendChild(el("b", null, a.cible));
      b.appendChild(document.createTextNode(" : " + a.texte));
      b.addEventListener("click", function (e) { self.annoter(a.cible, e); });
      li.appendChild(b);
      self.listeAnnotations.appendChild(li);
    });
    if (!(this.etat.annotations || []).length) this.listeAnnotations.appendChild(el("li", "atelier-aide", "Aucune remarque pour l'instant."));
    this.surlignerTout();
  };

  P.comparerAnnotations = function (s) {
    var attendu = this.config.attendu || [], faites = this.etat.annotations || [];
    var trouves = attendu.filter(function (x) { return faites.some(function (a) { return N.memeCible(a.cible, x.cible); }); });
    s.appendChild(el("p", "atelier-resultat-resume " + (trouves.length === attendu.length ? "ok" : "attention"),
      N.pluriel(faites.length, "remarque posée", "remarques posées") + " ; " + trouves.length + " des " + attendu.length + " éléments attendus sont annotés. La justesse des explications se juge avec la solution, ou avec Claude."));
  };

  /* Menus -------------------------------------------------------------------------------- */

  P.petitMenu = function (ancre, items) {
    var self = this;
    A.formulaire.fermer(true);
    var m = el("div", "atelier-menu");
    m.setAttribute("role", "menu");
    items.filter(Boolean).forEach(function (it) {
      var b = el("button", "atelier-menu-item", it[0]);
      b.type = "button";
      b.setAttribute("role", "menuitem");
      b.addEventListener("click", function () { fermer(); it[1](); });
      m.appendChild(b);
    });
    this.racine.appendChild(m);
    var ra = this.racine.getBoundingClientRect(), rb = ancre.getBoundingClientRect();
    m.style.top = (rb.bottom - ra.top + 4) + "px";
    m.style.right = Math.max(4, ra.right - rb.right) + "px";
    function dehors(e) { if (!m.contains(e.target)) fermer(); }
    function fermer() { m.remove(); document.removeEventListener("pointerdown", dehors, true); }
    setTimeout(function () { document.addEventListener("pointerdown", dehors, true); }, 0);
    var premier = m.querySelector("button");
    if (premier) premier.focus();
    m.addEventListener("keydown", function (e) { if (e.key === "Escape") { fermer(); ancre.focus(); } });
    return self;
  };

  P.menu = function (ancre) {
    var self = this;
    this.petitMenu(ancre, [
      this.vue.reorganiser && !this.lectureSeule ? ["Réorganiser le dessin", function () { self.vue.reorganiser(); }] : null,
      this.vue.ajuster ? ["Recadrer le dessin", function () { self.vue.ajuster(); }] : null,
      ["Plein écran", function () { self.pleinEcran(); }],
      !this.lectureSeule && this.mode !== "quiz" ? ["Revenir au départ", function () { self.reinitialiser(); }] : null,
      this.papier && !this.lectureSeule ? ["Reprendre ma copie papier", function () { self.reprendrePapier(); }] : null,
      this.editeurTexte ? ["Copier le texte", function () { navigator.clipboard && navigator.clipboard.writeText(self.texte || ""); }] : null
    ]);
  };

  P.menuClaude = function (ancre) {
    var self = this;
    this.petitMenu(ancre, [
      ["Poser une question sur l'exercice", function () { A.claudeAtelier.aide(self); }],
      ["Faire corriger mon travail", function () { A.claudeAtelier.corriger(self); }]
    ]);
  };

  P.pleinEcran = function () {
    var r = this.racine, self = this;
    var oui = !r.classList.contains("atelier-plein");
    r.classList.toggle("atelier-plein", oui);
    document.body.classList.toggle("atelier-plein-ouvert", oui);
    if (oui) {
      this.surEchapPlein = function (e) { if (e.key === "Escape" && !A.formulaire.estOuvert()) self.pleinEcran(); };
      document.addEventListener("keydown", this.surEchapPlein);
      if (!this.bFermerPlein) {
        this.bFermerPlein = N.bouton("Quitter le plein écran", "petit atelier-quitter-plein", function () { self.pleinEcran(); });
      }
      r.querySelector(".atelier-tete").appendChild(this.bFermerPlein);
    } else {
      document.removeEventListener("keydown", this.surEchapPlein);
      if (this.bFermerPlein) this.bFermerPlein.remove();
    }
    if (this.vue.ajuster) requestAnimationFrame(function () { self.vue.ajuster(); });
  };

  /* Correction de Claude ------------------------------------------------------------------ */

  P.afficherCorrection = function (c) {
    var s = this.section("correction", "Correction de Claude", "correction");
    if (c.note != null) {
      var mots = c.note >= 1 ? "juste" : c.note >= 0.75 ? "presque juste" : c.note >= 0.5 ? "en partie juste" : c.note > 0 ? "à reprendre" : "faux";
      s.appendChild(el("p", "atelier-resultat-resume " + (c.note >= 0.75 ? "ok" : c.note >= 0.5 ? "attention" : "erreur"), "Appréciation : " + mots + " (" + Math.round(c.note * 100) + " %)"));
    }
    var corps = el("div", "atelier-correction-texte");
    corps.innerHTML = Q() && Q().markdown ? Q().markdown(c.commentaire || "") : N.echapper(c.commentaire || "");
    s.appendChild(corps);
    if (c.remarques && c.remarques.length) {
      s.appendChild(this.listeMessages(c.remarques.map(function (r) { return { message: r.message, cible: r.cible, niveau: r.niveau || "remarque" }; }),
        function (m) { return LIBELLES_NIVEAU[m.niveau] || "Remarque"; }, function (m) { return m.niveau === "erreur" ? "erreur" : m.niveau === "attention" ? "attention" : "remarque"; }));
    }
    var pied = el("p", "atelier-aide", "Correction faite le " + new Date(c.date || Date.now()).toLocaleDateString("fr-FR") + (c.modele ? " · " + String(c.modele).replace(/^claude-/, "") : "") + (c.perimee ? " · le travail a changé depuis" : ""));
    s.appendChild(pied);
    this.surlignerTout();
  };

  /* Contexte ------------------------------------------------------------------------------- */

  P.jeu = function () {
    var nom = this.options.jeu;
    if (!nom) return null;
    var j = this.ctx.jeux && this.ctx.jeux[nom];
    return j ? Object.assign({ nom: nom }, j) : null;
  };

  // Travail lisible par Claude et par les archives
  P.travailTexte = function () {
    var t = this.mode === "annoter" ? "" : (this.texte || this.ed.ecrire(this.modele, this.options));
    if (this.mode === "annoter") {
      t = "Remarques posées sur le diagramme :\n" + ((this.etat.annotations || []).map(function (a, i) { return (i + 1) + ". " + a.cible + " : " + a.texte; }).join("\n") || "(aucune)");
      if (this.etat.reponse) t += "\n\nRéponse rédigée :\n" + this.etat.reponse;
    }
    return t;
  };

  /* Quiz ---------------------------------------------------------------------------------- */

  // Après validation : plus de modification possible (le dessin reste consultable)
  P.verrouiller = function () {
    this.racine.classList.add("verrou");
    this.lectureSeule = true;
    if (this.editeurTexte && this.editeurTexte.desactiver) this.editeurTexte.desactiver(true);
    if (this.zoneReponse) this.zoneReponse.readOnly = true;
    this.racine.querySelectorAll(".atelier-outils button, .atelier-actions button").forEach(function (b) {
      if (!/⋯/.test(b.textContent)) b.disabled = true;
    });
    // Le dessin reste consultable (déplacement de la vue, zoom), plus modifiable
    var cv = this.vue.canevas;
    if (cv) {
      cv.options.lectureSeule = true;
      cv.options.surDoubleClic = cv.options.surSupprimer = cv.options.surLier = null;
      cv.definirMode("normal");
      cv.racine.classList.add("lecture");
    }
    this.panDessin.querySelectorAll("input, textarea").forEach(function (x) { x.readOnly = true; });
    this.panDessin.querySelectorAll("select, button:not(.atelier-mini)").forEach(function (x) { x.disabled = true; });
  };

  // Après la correction d'une question : écarts éclairés sur le dessin
  P.montrerCorrectionQuiz = function () {
    if (!this.solution || this.ed.asynchrone || this.mode === "annoter") return;
    this.derniereComparaison = this.ed.comparer(this.modele, this.solution, this.options);
    this.ecartsVisibles = true;
    this.surlignerTout();
  };

  // Lecture du travail (quiz)
  P.lire = function () {
    return { modele: N.copie(this.modele), texte: this.travailTexte(), annotations: N.copie(this.etat.annotations || []), reponse: this.etat.reponse || "" };
  };

  A.Espace = Espace;
})(window.Atelier);
