/* ==========================================================================
   Atelier · Claude (Atelier.claudeAtelier)
   --------------------------------------------------------------------------
   - aide(espace) : panneau de conversation de l'outil de quiz, avec le
     contexte de l'exercice (énoncé, travail en syntaxe texte, contrôles,
     solution si elle a été affichée). Route du serveur : atelier/aide.
   - corriger(espace) : correction structurée (route atelier/corriger) ;
     chaque remarque peut viser un élément du dessin, qui s'éclaire.
   Sans serveur, la demande complète est copiée pour claude.ai.
   ========================================================================== */
(function (A) {
  "use strict";

  var N = A.noyau;
  function Q() { return window.QuizApp || null; }

  function contexte(esp) {
    var c = esp.ctx, ed = esp.ed;
    var controles = ed.controler(esp.modele, esp.options, esp.config.tests) || [];
    var details = ed.description + "\n\nSyntaxe :\n" + texteHtml(ed.aide || "");
    if (Object.keys(esp.options || {}).length) details += "\nOptions de l'exercice : " + JSON.stringify(esp.options);
    if (controles.length) details += "\nContrôles automatiques sur le travail actuel :\n" + controles.map(function (m) { return "- [" + m.niveau + "] " + m.message; }).join("\n");
    if (esp.mode === "annoter") details += "\nL'exercice consiste à repérer les erreurs du diagramme fourni (ci-dessous) en posant des remarques sur ses éléments :\n" + ed.ecrire(esp.depart, esp.options);
    var solution = esp.solutionTexte || "";
    if (esp.config.attendu) solution = (solution ? solution + "\n\n" : "") + "Erreurs attendues :\n" + esp.config.attendu.map(function (x) { return "- " + (x.cible ? x.cible + " : " : "") + texteHtml(x.texte); }).join("\n");
    return {
      quiz: { titre: c.titrePage || document.title, matiere: c.matiere || "", niveau: c.niveau || "" },
      mode: esp.mode,
      question: {
        numero: esp.config.id,
        type: "atelier « " + ed.libelle + " »",
        theme: c.section ? c.section() : "",
        enonce: c.enonce ? c.enonce() : "",
        details: details,
        reponse: esp.travailTexte() || "(vide pour l'instant)",
        corrigee: Boolean(esp.etat.solutionVue),
        solution: solution,
        explication: esp.config.explication ? texteHtml(esp.config.explication) : ""
      }
    };
  }

  function texteHtml(h) {
    var q = Q();
    if (q && q.outils && q.outils.texteDe) return q.outils.texteDe(h);
    var d = document.createElement("div");
    d.innerHTML = h;
    return d.textContent;
  }

  function demandeHorsLigne(esp, consigne) {
    var c = contexte(esp).question;
    return "Je travaille un TD de licence informatique et j'ai besoin de ton aide de tuteur. Réponds en français, en me tutoyant.\n\n" +
      (c.theme ? "Exercice : " + c.theme + "\n" : "") + "Énoncé :\n" + c.enonce + "\n\n" + c.details + "\n\nMon travail (" + c.type + ") :\n" + c.reponse + "\n\n" +
      (c.solution ? "Solution proposée (à utiliser pour me corriger" + (c.corrigee ? "" : ", sans me la donner d'emblée") + ") :\n" + c.solution + "\n\n" : "") + consigne;
  }

  function copierEtOuvrir(texte, messageOk) {
    var q = Q();
    var copie = q && q.outils ? q.outils.copier(texte) : navigator.clipboard.writeText(texte);
    return copie.then(function () {
      if (q && q.outils) q.outils.notifier(messageOk || "Demande copiée : la coller dans claude.ai.");
      window.open("https://claude.ai/new", "_blank", "noopener");
    }).catch(function () { window.prompt("Copier cette demande dans claude.ai :", texte); });
  }

  function aide(esp) {
    var q = Q();
    esp.etat.conversation = esp.etat.conversation || { session: null, messages: [] };
    if (!q || !q.claude) { copierEtOuvrir(demandeHorsLigne(esp, "Ma question : ")); return; }
    q.claude.ouvrir({
      titre: "Claude · " + (esp.config.titre || esp.ed.libelle),
      sousTitre: esp.ctx.section ? esp.ctx.section() : "",
      conversation: esp.etat.conversation,
      route: "atelier/aide",
      contexte: function () { return contexte(esp); },
      accueil: "Pose ta question sur l'exercice. Claude voit l'énoncé et ton travail tel qu'il est maintenant" + (esp.solution ? " ; il connaît la solution, mais ne la donne que si tu la demandes." : "."),
      texteHorsLigne: function (message) { return demandeHorsLigne(esp, "Ma demande : " + message); },
      suggestions: function () {
        var s = [
          { libelle: "Par où commencer ?", message: "Je ne sais pas par où commencer cet exercice. Donne-moi une méthode, sans me donner la réponse." },
          { libelle: "Qu'est-ce qui ne va pas ?", message: "Regarde mon travail actuel : qu'est-ce qui ne va pas ? Mets-moi sur la voie sans tout corriger." },
          { libelle: "Explique la notion", message: "Explique-moi la notion du cours utilisée dans cet exercice, avec un petit exemple." }
        ];
        if (esp.etat.solutionVue) s.push({ libelle: "Pourquoi cette solution ?", message: "Explique-moi pourquoi la solution proposée est construite ainsi, et en quoi mon travail en diffère." });
        return s;
      },
      surMaj: function () { esp.enregistrer(); }
    });
  }

  function corriger(esp) {
    var q = Q(), C = q && q.connexion;
    if (!C || !C.claudeDisponible || !C.claudeDisponible()) {
      copierEtOuvrir(demandeHorsLigne(esp, "Corrige mon travail : ce qui est juste, ce qui est faux ou manque et pourquoi, puis une appréciation d'ensemble."),
        "Demande de correction copiée : la coller dans claude.ai (le serveur local permet de corriger ici même).");
      return;
    }
    var s = esp.section("correction", "Correction de Claude", "correction");
    s.appendChild(N.el("p", "atelier-aide attente", "Claude corrige ton travail…"));
    var ctx = contexte(esp);
    C.json("POST", "atelier/corriger", {
      page: C.page(),
      editeur: esp.config.editeur,
      contexte: ctx,
      cibles: esp.ed.cibles ? esp.ed.cibles(esp.modele).slice(0, 200) : []
    }).then(function (r) {
      r.date = new Date().toISOString();
      esp.etat.correction = r;
      esp.afficherCorrection(r);
      esp.enregistrer();
    }).catch(function (e) {
      s.innerHTML = "";
      s.appendChild(N.el("p", "atelier-alerte", "Correction impossible : " + e.message));
    });
  }

  A.claudeAtelier = { aide: aide, corriger: corriger, contexte: contexte, demandeHorsLigne: demandeHorsLigne };
})(window.Atelier);
