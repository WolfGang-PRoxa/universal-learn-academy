/* ==========================================================================
   Atelier · vue « sql » (interface)
   --------------------------------------------------------------------------
   Éditeur de code de l'outil de quiz (coloration, numéros de ligne,
   Ctrl+Entrée), bouton « Exécuter » et résultat sous l'éditeur. Le jeu de
   données de l'exercice est décrit au-dessus, script compris. L'exécution
   passe par le serveur local (PostgreSQL, PGlite).
   ========================================================================== */
(function (A) {
  "use strict";

  var N = A.noyau, el = N.el;

  function Q() { return window.QuizApp || {}; }

  function zoneJeu(jeu) {
    if (!jeu) return null;
    var d = el("details", "jeu-donnees");
    d.appendChild(el("summary", null, "Données : " + (jeu.titre || jeu.nom)));
    if (jeu.description) { var x = el("div", "jeu-description"); x.innerHTML = jeu.description; d.appendChild(x); }
    var voir = el("details", "jeu-script");
    voir.appendChild(el("summary", null, "Script SQL de création"));
    var p = el("pre"), c = el("code", "language-sql");
    c.textContent = jeu.script || "";
    p.appendChild(c);
    voir.appendChild(p);
    d.appendChild(voir);
    return d;
  }

  function creer(conteneur, ctx) {
    var m = null, o = ctx.options || {}, jeu = ctx.jeu ? ctx.jeu() : null;
    var racine = el("div", "atelier-sql");
    var zj = zoneJeu(jeu);
    if (zj) racine.appendChild(zj);
    var ed, sortie = el("div", "code-sortie");
    sortie.hidden = true;
    sortie.setAttribute("aria-live", "polite");
    var q = Q();
    function surSaisie() { m.code = ed.valeur(); ctx.modifie(m, false); }
    if (q.code && q.code.editeur) {
      ed = q.code.editeur(racine, { langage: "sql", valeur: "", lignes: o.lignes || 6, lectureSeule: ctx.lectureSeule, surExecuter: executer });
      ed.saisie.addEventListener("input", surSaisie);
      ed.saisie.addEventListener("change", function () { ctx.modifie(m, true); });
    } else {
      var z = el("textarea", "atelier-redaction mono");
      z.rows = o.lignes || 6;
      racine.appendChild(z);
      ed = { valeur: function () { return z.value; }, definir: function (v) { z.value = v; }, focus: function () { z.focus(); }, saisie: z };
      z.addEventListener("input", surSaisie);
    }
    var barre = el("div", "code-barre");
    var b = N.bouton("Exécuter", "petit", executer, "Exécuter le code (Ctrl+Entrée)");
    barre.appendChild(b);
    var aide = el("span", "code-aide");
    barre.appendChild(aide);
    racine.appendChild(barre);
    racine.appendChild(sortie);
    conteneur.appendChild(racine);

    function majAide() {
      var C = Q().connexion;
      var ok = C && C.executable && C.executable("sql");
      aide.textContent = ok ? "Ctrl+Entrée · chaque exécution repart des mêmes données" : "Pour exécuter le SQL, ouvrir la page depuis le serveur local (studies/lancer.bat).";
      b.disabled = !ok;
    }
    majAide();
    if (Q().connexion && Q().connexion.surChangement) Q().connexion.surChangement(majAide);

    function executer() {
      var C = Q().connexion;
      if (!C || !C.executable || !C.executable("sql")) { majAide(); return; }
      b.disabled = true;
      sortie.hidden = false;
      sortie.innerHTML = "";
      sortie.appendChild(el("p", "sortie-message attente", "Exécution…"));
      C.executer({ langage: "sql", code: ed.valeur(), jeu: jeu ? jeu.script : "" }).then(function (r) {
        Q().code.afficherResultat(sortie, "sql", r);
      }).catch(function (e) {
        sortie.innerHTML = "";
        sortie.appendChild(el("pre", "brut sortie-erreur", e.message));
      }).finally(function () { b.disabled = false; });
    }

    return {
      afficher: function (modele) { m = modele; if (ed.valeur() !== (m.code || "")) ed.definir(m.code || ""); },
      surligner: function () {}, effacerSurlignage: function () {},
      focus: function () { ed.focus(); },
      executer: executer
    };
  }

  function statique(modele) {
    var p = el("pre"), c = el("code", "language-sql");
    c.textContent = modele.code || "";
    p.appendChild(c);
    return p;
  }

  A.vues.sql = { creer: creer, statique: statique };
})(window.Atelier);
