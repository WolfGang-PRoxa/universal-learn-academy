/* ==========================================================================
   Atelier · vue « code » (interface)
   --------------------------------------------------------------------------
   Éditeur de code de l'outil de quiz (coloration, numéros de ligne,
   indentation). Quand le serveur local sait exécuter le langage (C, Python,
   JavaScript), un bouton « Exécuter » et la sortie sous l'éditeur ; sinon
   (Ruby), le code s'écrit et se relit seulement.
   ========================================================================== */
(function (A) {
  "use strict";

  var N = A.noyau, el = N.el;

  function Q() { return window.QuizApp || {}; }
  function langageDe(o) { return (o && o.langage) || "ruby"; }

  function creer(conteneur, ctx) {
    var m = null, o = ctx.options || {}, langage = langageDe(o);
    var racine = el("div", "atelier-code-libre");
    var ed, q = Q();
    function surSaisie() { m.code = ed.valeur(); ctx.modifie(m, false); }
    if (q.code && q.code.editeur) {
      ed = q.code.editeur(racine, { langage: langage, hljs: langage, valeur: "", lignes: o.lignes || 10, lectureSeule: ctx.lectureSeule, surExecuter: executer,
        libelle: "Code " + (A.editeurs.code.LANGAGES[langage] || langage) });
      ed.saisie.addEventListener("input", surSaisie);
      ed.saisie.addEventListener("change", function () { ctx.modifie(m, true); });
    } else {
      var z = el("textarea", "atelier-redaction mono");
      z.rows = o.lignes || 10;
      z.readOnly = Boolean(ctx.lectureSeule);
      z.spellcheck = false;
      racine.appendChild(z);
      ed = { valeur: function () { return z.value; }, definir: function (v) { z.value = v; }, focus: function () { z.focus(); }, saisie: z };
      z.addEventListener("input", surSaisie);
    }
    var barre = el("div", "code-barre"), b = null;
    var aide = el("span", "code-aide");
    var sortie = el("div", "code-sortie");
    sortie.hidden = true;
    sortie.setAttribute("aria-live", "polite");
    if (["c", "python", "javascript"].indexOf(langage) >= 0) {
      b = N.bouton("Exécuter", "petit", executer, "Exécuter le code (Ctrl+Entrée)");
      barre.appendChild(b);
    }
    barre.appendChild(aide);
    racine.appendChild(barre);
    racine.appendChild(sortie);
    conteneur.appendChild(racine);

    function executable() { var C = Q().connexion; return Boolean(b && C && C.executable && C.executable(langage)); }
    function majAide() {
      var nom = A.editeurs.code.LANGAGES[langage] || langage;
      if (!b) aide.textContent = nom + " · Tab indente · le code s'écrit et se relit, sans exécution";
      else if (executable()) aide.textContent = "Ctrl+Entrée exécute le programme";
      else aide.textContent = "Pour exécuter le code, ouvrir la page depuis le serveur local (studies/lancer.bat).";
      if (b) b.disabled = !executable();
    }
    majAide();
    if (Q().connexion && Q().connexion.surChangement) Q().connexion.surChangement(majAide);

    function executer() {
      if (!executable()) { majAide(); return; }
      var C = Q().connexion;
      b.disabled = true;
      sortie.hidden = false;
      sortie.innerHTML = "";
      sortie.appendChild(el("p", "sortie-message attente", "Exécution…"));
      C.executer({ langage: langage, code: ed.valeur() }).then(function (r) {
        Q().code.afficherResultat(sortie, langage, r);
      }).catch(function (e) {
        sortie.innerHTML = "";
        sortie.appendChild(el("pre", "brut sortie-erreur", e.message));
      }).finally(function () { b.disabled = false; });
    }

    return {
      afficher: function (modele) { m = modele; if (ed.valeur() !== (m.code || "")) ed.definir(m.code || ""); },
      surligner: function () {}, effacerSurlignage: function () {},
      focus: function () { ed.focus(); }
    };
  }

  function statique(modele, options) {
    var p = el("pre"), c = el("code", "language-" + langageDe(options));
    c.textContent = modele.code || "";
    p.appendChild(c);
    return p;
  }

  A.vues.code = { creer: creer, statique: statique };
})(window.Atelier);
