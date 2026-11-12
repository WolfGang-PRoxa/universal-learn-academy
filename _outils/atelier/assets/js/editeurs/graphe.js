/* ==========================================================================
   Atelier · éditeur « graphe » : graphes et automates (logique)
   --------------------------------------------------------------------------
   Syntaxe :
     oriente                  (ou « non oriente » ; défaut : orienté, ou non
                              orienté si tous les arcs s'écrivent --)
     automate                 active états initiaux et finaux
     initial q0
     final q2 q3
     noeud A B C              (ou « etat » : nœuds sans arc)
     q0 -> q1 : a, b          arc orienté avec étiquette(s)
     A -- B : 5               arête (graphe non orienté), poids ou étiquette
     q1 -> q1 : a             boucle
   Pour un automate, les étiquettes sont des symboles séparés par des
   virgules ; ε (ou eps) pour une ε-transition.
   PERT potentiel-étapes (option pert) :
     etape E2 15 15           étape, date au plus tôt, date au plus tard
     Debut -> E2 : T2 15      tâche : un arc avec son nom et sa durée
     E2 -> E3 : fictive       tâche fictive, en pointillés
   Options : deterministe, complet, alphabet, afn (plusieurs états
   initiaux permis), pondere, pert. Tests (config.tests) :
     { "acceptes": ["ab", "aab"], "rejetes": ["", "ba"] }
   La comparaison de deux automates teste l'égalité des langages.
   ========================================================================== */
(function (A) {
  "use strict";

  var N = A.noyau, S = A.syntaxe, msg = N.message, ecart = N.ecart;
  var NOEUD = "[A-Za-zÀ-ÖØ-öø-ÿ0-9_'·{}]+";
  var RE_ARC = new RegExp("^(" + NOEUD + ")\\s*(<->|->|<-|--)\\s*(" + NOEUD + ")\\s*(?::\\s*(.*))?$");
  var RE_ETAPE = new RegExp("^[ée]tape\\s+(" + NOEUD + ")(?:\\s+(\\S+)\\s+(\\S+))?$", "i");
  var EPS = /^(ε|eps|epsilon)$/i;

  /* Lecture ------------------------------------------------------------------- */

  function lire(texte, options) {
    var pert = Boolean(options && options.pert);
    var erreurs = [], m = { oriente: true, automate: false, pert: pert, noeuds: [], arcs: [] }, orientation = null, tirets = 0, fleches = 0;
    function noeud(nom) {
      var n = m.noeuds.find(function (x) { return x.nom === nom; });
      if (!n) { n = { nom: nom, initial: false, final: false }; if (pert) { n.tot = ""; n.tard = ""; } m.noeuds.push(n); }
      return n;
    }
    S.lignes(texte).forEach(function (l) {
      var t = l.texte, x;
      if (/^non[\s-]+orient[ée]$/i.test(t)) { orientation = false; return; }
      if (/^orient[ée]$/i.test(t)) { orientation = true; return; }
      if (/^automate$/i.test(t)) { m.automate = true; orientation = true; return; }
      if (pert && (x = t.match(RE_ETAPE))) {
        var e = noeud(x[1]);
        e.tot = x[2] && x[2] !== "?" ? x[2] : "";
        e.tard = x[3] && x[3] !== "?" ? x[3] : "";
        return;
      }
      if ((x = t.match(/^(initial|initiaux|final|finaux|finals|noeuds?|nœuds?|etats?|états?|sommets?)\s+(.+)$/i))) {
        var mot = x[1].toLowerCase();
        x[2].split(/[\s,]+/).filter(Boolean).forEach(function (nom) {
          if (!new RegExp("^" + NOEUD + "$").test(nom)) { erreurs.push(S.erreur(l.num, "Nom de nœud invalide : « " + nom + " »."));
            return; }
          var n = noeud(nom);
          if (/^initi/.test(mot)) { n.initial = true; m.automate = true; }
          else if (/^fin/.test(mot)) { n.final = true; m.automate = true; }
        });
        return;
      }
      if ((x = t.match(RE_ARC))) {
        var a = x[1], op = x[2], b = x[3], et = (x[4] || "").trim();
        noeud(a); noeud(b);
        if (op === "--") tirets++; else fleches++;
        if (op === "<-") m.arcs.push({ a: b, b: a, etiquette: et });
        else {
          m.arcs.push({ a: a, b: b, etiquette: et });
          if (op === "<->") m.arcs.push({ a: b, b: a, etiquette: et });
        }
        return;
      }
      erreurs.push(S.erreur(l.num, "Ligne illisible : « " + t + " ». Exemples : q0 -> q1 : a   ou   A -- B : 5"));
    });
    if (orientation === null) m.oriente = !(tirets && !fleches);
    else m.oriente = orientation;
    if (m.oriente && tirets && orientation !== false) erreurs.push({ ligne: 0, message: "Graphe orienté : les arcs s'écrivent « -> » (les « -- » sont réservés aux graphes non orientés)." });
    if (m.automate) m.oriente = true;
    return { modele: m, erreurs: erreurs };
  }

  function ecrire(m) {
    if (!m) return "";
    var t = [];
    if (m.pert) {
      m.noeuds.forEach(function (n) { t.push("etape " + n.nom + (n.tot || n.tard ? " " + (n.tot || "?") + " " + (n.tard || "?") : "")); });
      m.arcs.forEach(function (x) { t.push(x.a + " -> " + x.b + (x.etiquette ? " : " + x.etiquette : "")); });
      return t.join("\n");
    }
    if (m.automate) t.push("automate");
    else if (!m.oriente) t.push("non oriente");
    var ini = m.noeuds.filter(function (n) { return n.initial; }).map(function (n) { return n.nom; });
    var fin = m.noeuds.filter(function (n) { return n.final; }).map(function (n) { return n.nom; });
    if (ini.length) t.push("initial " + ini.join(" "));
    if (fin.length) t.push("final " + fin.join(" "));
    var relies = new Set();
    m.arcs.forEach(function (x) { relies.add(x.a); relies.add(x.b); });
    var seuls = m.noeuds.filter(function (n) { return !relies.has(n.nom) && !n.initial && !n.final; }).map(function (n) { return n.nom; });
    if (seuls.length) t.push("noeud " + seuls.join(" "));
    m.arcs.forEach(function (x) { t.push(x.a + (m.oriente ? " -> " : " -- ") + x.b + (x.etiquette ? " : " + x.etiquette : "")); });
    return t.join("\n");
  }

  function fusionner(nouveau, ancien) {
    if (!ancien) return nouveau;
    nouveau.noeuds.forEach(function (n) {
      var v = ancien.noeuds.find(function (x) { return x.nom === n.nom; });
      if (v) { n.x = v.x; n.y = v.y; }
    });
    return nouveau;
  }

  /* Automates : symboles, simulation, déterminisation --------------------------------- */

  function symboles(etiquette) {
    return String(etiquette || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean)
      .map(function (s) { return EPS.test(s) ? "ε" : s; });
  }
  function alphabet(m, options) {
    if (options && options.alphabet) return options.alphabet.slice();
    var a = new Set();
    m.arcs.forEach(function (x) { symboles(x.etiquette).forEach(function (s) { if (s !== "ε") a.add(s); }); });
    return Array.from(a).sort();
  }
  // Découpe un mot en symboles : caractère par caractère si tous les symboles ont une lettre
  function decouperMot(mot, alpha) {
    mot = String(mot);
    if (alpha.every(function (s) { return s.length === 1; })) return mot.split("");
    return mot.trim() ? mot.trim().split(/\s+/) : [];
  }
  function fermeture(m, etats) {
    var pile = Array.from(etats), vus = new Set(etats);
    while (pile.length) {
      var e = pile.pop();
      m.arcs.forEach(function (x) {
        if (x.a === e && symboles(x.etiquette).indexOf("ε") >= 0 && !vus.has(x.b)) { vus.add(x.b); pile.push(x.b); }
      });
    }
    return vus;
  }
  function transition(m, etats, s) {
    var r = new Set();
    etats.forEach(function (e) {
      m.arcs.forEach(function (x) { if (x.a === e && symboles(x.etiquette).indexOf(s) >= 0) r.add(x.b); });
    });
    return fermeture(m, r);
  }
  function initiaux(m) { return fermeture(m, m.noeuds.filter(function (n) { return n.initial; }).map(function (n) { return n.nom; })); }
  function acceptant(m, etats) {
    return Array.from(etats).some(function (e) { var n = m.noeuds.find(function (x) { return x.nom === e; }); return n && n.final; });
  }
  function accepte(m, mot, alpha) {
    var etats = initiaux(m);
    decouperMot(mot, alpha || alphabet(m)).forEach(function (s) { etats = transition(m, etats, s); });
    return acceptant(m, etats);
  }

  // Plus court mot sur lequel deux automates diffèrent, ou null (langages égaux)
  function motDistinctif(m1, m2, alpha, limite) {
    var cle = function (e) { return Array.from(e).sort().join(","); };
    var depart = [initiaux(m1), initiaux(m2)];
    var file = [{ e: depart, mot: [] }], vus = new Set([cle(depart[0]) + "|" + cle(depart[1])]);
    limite = limite || 5000;
    while (file.length && vus.size < limite) {
      var x = file.shift();
      if (acceptant(m1, x.e[0]) !== acceptant(m2, x.e[1])) return { mot: x.mot, accepte1: acceptant(m1, x.e[0]) };
      for (var i = 0; i < alpha.length; i++) {
        var s = alpha[i], suiv = [transition(m1, x.e[0], s), transition(m2, x.e[1], s)];
        var k = cle(suiv[0]) + "|" + cle(suiv[1]);
        if (!vus.has(k)) { vus.add(k); file.push({ e: suiv, mot: x.mot.concat([s]) }); }
      }
    }
    return null;
  }
  function motLisible(mot, alpha) {
    if (!mot.length) return "le mot vide ε";
    return "« " + (alpha.every(function (s) { return s.length === 1; }) ? mot.join("") : mot.join(" ")) + " »";
  }

  /* PERT potentiel-étapes --------------------------------------------------------------- */

  // « T5 3 » ou « T5 : 3 » : { nom, duree } ; « fictive » : { fictive: true } ; autre chose : null
  function tachePert(etiquette) {
    var t = String(etiquette || "").trim();
    if (/^fictif|^fictive$/i.test(t)) return { fictive: true, duree: 0 };
    var x = t.match(/^(.+?)\s*[:\s]\s*(\d+(?:[.,]\d+)?)$/);
    return x ? { nom: x[1].trim(), duree: Number(x[2].replace(",", ".")) } : null;
  }
  function datePert(v) {
    var t = String(v == null ? "" : v).trim().replace(",", ".");
    return t !== "" && !isNaN(Number(t)) ? Number(t) : null;
  }

  // Tâches réelles : durée, tâches qui les précèdent (à travers les fictives), dates des étapes de départ et d'arrivée.
  // La comparaison porte sur elles, pas sur les étapes, dont les noms sont libres
  function tachesPert(m) {
    var parNom = {}, liste = [];
    m.noeuds.forEach(function (n) { parNom[n.nom] = n; });
    function arrivees(etape, vus) {
      if (vus[etape]) return [];
      vus[etape] = true;
      var r = [];
      m.arcs.forEach(function (a) {
        var t = a.b === etape && tachePert(a.etiquette);
        if (t) r = r.concat(t.fictive ? arrivees(a.a, vus) : [t.nom]);
      });
      return r;
    }
    m.arcs.forEach(function (a) {
      var t = tachePert(a.etiquette);
      if (!t || t.fictive) return;
      liste.push({ nom: t.nom, duree: t.duree, arc: a.a + "->" + a.b, avant: arrivees(a.a, {}), debut: datePert(parNom[a.a].tot), fin: datePert(parNom[a.b].tard) });
    });
    return liste;
  }

  function controlerPert(m) {
    var res = [], vus = {}, paires = {}, parNom = {};
    m.noeuds.forEach(function (n) {
      parNom[n.nom] = n;
      var o = datePert(n.tot), r = datePert(n.tard);
      if (o != null && r != null && o > r) res.push(msg("erreur", "Étape « " + n.nom + " » : la date au plus tôt dépasse la date au plus tard.", n.nom));
    });
    m.arcs.forEach(function (a) {
      var cible = a.a + "->" + a.b, t = tachePert(a.etiquette), na = parNom[a.a], nb = parNom[a.b];
      if (!t) { res.push(msg("attention", "L'arc « " + a.a + " → " + a.b + " » doit porter une tâche et sa durée (T5 3), ou « fictive ».", cible)); return; }
      if (!t.fictive) {
        if (vus[N.cle(t.nom)]) res.push(msg("erreur", "La tâche « " + t.nom + " » apparaît deux fois.", cible));
        vus[N.cle(t.nom)] = true;
      }
      if (paires[cible]) res.push(msg("attention", "Deux arcs relient « " + a.a + " » à « " + a.b + " » : ajouter une étape et une tâche fictive pour les distinguer.", cible));
      paires[cible] = true;
      var oa = datePert(na.tot), ob = datePert(nb.tot), ra = datePert(na.tard), rb = datePert(nb.tard);
      if (oa != null && ob != null && ob < oa + t.duree) res.push(msg("erreur", "Étape « " + a.b + " » : sa date au plus tôt ne laisse pas à « " + (t.nom || "la tâche fictive") + " » le temps de finir.", a.b));
      if (ra != null && rb != null && ra > rb - t.duree) res.push(msg("erreur", "Étape « " + a.a + " » : sa date au plus tard ne laisse pas à « " + (t.nom || "la tâche fictive") + " » le temps de finir.", a.a));
    });
    // Circuit : on retire les étapes sans arc entrant ; il reste au moins le circuit
    var restants = m.noeuds.map(function (n) { return n.nom; }), retire = true;
    while (retire) {
      retire = false;
      restants = restants.filter(function (n) {
        var entree = m.arcs.some(function (a) { return a.b === n && restants.indexOf(a.a) >= 0; });
        if (!entree) retire = true;
        return entree;
      });
    }
    if (restants.length) res.push(msg("erreur", "Le graphe contient un circuit (" + restants.join(", ") + ") : un PERT n'en a pas.", restants[0]));
    var debuts = m.noeuds.filter(function (n) { return !m.arcs.some(function (a) { return a.b === n.nom; }); });
    var fins = m.noeuds.filter(function (n) { return !m.arcs.some(function (a) { return a.a === n.nom; }); });
    if (debuts.length > 1) res.push(msg("attention", "Plusieurs étapes de début (" + debuts.map(function (n) { return n.nom; }).join(", ") + ") : un PERT n'en a qu'une."));
    if (fins.length > 1) res.push(msg("attention", "Plusieurs étapes de fin (" + fins.map(function (n) { return n.nom; }).join(", ") + ") : un PERT n'en a qu'une."));
    return res;
  }

  function comparerPert(m, sol) {
    function faits(g) {
      var f = [];
      tachesPert(g).forEach(function (t) {
        var k = N.cle(t.nom);
        f.push("T|" + k, "D|" + k + "|" + t.duree, "O|" + k + "|" + t.debut, "F|" + k + "|" + t.fin);
        t.avant.forEach(function (x) { f.push("P|" + k + "|" + N.cle(x)); });
      });
      return f;
    }
    var st = N.f1(faits(m), faits(sol), { T: 2, P: 2 }), ecarts = [], manque = new Set(st.manquants);
    var etu = {}, reference = {};
    tachesPert(m).forEach(function (t) { etu[N.cle(t.nom)] = t; });
    tachesPert(sol).forEach(function (t) { reference[N.cle(t.nom)] = t; });
    function nom(k) { return (etu[k] || reference[k] || { nom: k }).nom; }
    function arc(k) { return etu[k] ? etu[k].arc : undefined; }
    st.manquants.forEach(function (f) {
      var p = f.split("|"), k = p[1];
      if (p[0] === "T") ecarts.push(ecart("manque", "Il manque la tâche « " + nom(k) + " »."));
      else if (manque.has("T|" + k)) return;
      else if (p[0] === "D") ecarts.push(ecart("different", "« " + nom(k) + " » n'a pas la bonne durée.", arc(k)));
      else if (p[0] === "P") ecarts.push(ecart("manque", "« " + nom(k) + " » doit attendre la fin de « " + nom(p[2]) + " ».", arc(k)));
      else if (p[0] === "O") ecarts.push(ecart("different", "Étape de départ de « " + nom(k) + " » : date au plus tôt différente de la solution.", arc(k)));
      else if (p[0] === "F") ecarts.push(ecart("different", "Étape d'arrivée de « " + nom(k) + " » : date au plus tard différente de la solution.", arc(k)));
    });
    st.exces.forEach(function (f) {
      var p = f.split("|"), k = p[1];
      if (p[0] === "T") ecarts.push(ecart("exces", "La tâche « " + nom(k) + " » n'apparaît pas dans la solution.", arc(k)));
      else if (p[0] === "P" && !st.exces.some(function (g) { return g === "T|" + k; })) ecarts.push(ecart("exces", "« " + nom(k) + " » n'a pas à attendre « " + nom(p[2]) + " ».", arc(k)));
    });
    return { score: st.score, ecarts: ecarts, resume: st.score === 1 ? "Identique à la solution proposée : mêmes tâches, mêmes précédences, mêmes dates." : Math.round(st.score * 100) + " % de concordance avec la solution · " + N.pluriel(ecarts.length, "écart") };
  }

  /* Contrôles ----------------------------------------------------------------------- */

  function accessibles(m) {
    var vus = new Set(), pile = m.noeuds.filter(function (n) { return n.initial; }).map(function (n) { return n.nom; });
    pile.forEach(function (n) { vus.add(n); });
    while (pile.length) {
      var e = pile.pop();
      m.arcs.forEach(function (x) { if (x.a === e && !vus.has(x.b)) { vus.add(x.b); pile.push(x.b); } });
    }
    return vus;
  }

  function controler(m, options, tests) {
    options = options || {};
    var res = [];
    if (!m || !m.noeuds.length) return [msg("info", "Le graphe est vide pour l'instant.")];
    if (m.pert) return controlerPert(m);
    if (m.automate) {
      var ini = m.noeuds.filter(function (n) { return n.initial; });
      if (!ini.length) res.push(msg("erreur", "Aucun état initial : écrire « initial q0 » (ou le cocher sur le dessin)."));
      else if (ini.length > 1 && !options.afn) res.push(msg("attention", "Plusieurs états initiaux (" + ini.map(function (n) { return n.nom; }).join(", ") + ") : un automate fini déterministe n'en a qu'un."));
      if (!m.noeuds.some(function (n) { return n.final; })) res.push(msg("attention", "Aucun état final : l'automate ne reconnaît aucun mot."));
      if (ini.length) {
        var acc = accessibles(m);
        m.noeuds.forEach(function (n) { if (!acc.has(n.nom)) res.push(msg("attention", "L'état « " + n.nom + " » n'est pas accessible depuis l'état initial.", n.nom)); });
      }
      m.arcs.forEach(function (x) {
        if (!symboles(x.etiquette).length) res.push(msg("erreur", "La transition « " + x.a + " → " + x.b + " » n'a pas de symbole (écrire ε pour une ε-transition).", x.a + "->" + x.b));
      });
      var alpha = alphabet(m, options);
      if (options.deterministe) {
        m.noeuds.forEach(function (n) {
          var vus = {};
          m.arcs.filter(function (x) { return x.a === n.nom; }).forEach(function (x) {
            symboles(x.etiquette).forEach(function (s) {
              if (s === "ε") res.push(msg("erreur", "ε-transition depuis « " + n.nom + " » : interdite dans un automate déterministe.", x.a + "->" + x.b));
              else if (vus[s]) res.push(msg("erreur", "Depuis « " + n.nom + " », deux transitions portent « " + s + " » : l'automate n'est pas déterministe.", n.nom));
              vus[s] = true;
            });
          });
          if (options.complet) alpha.forEach(function (s) {
            if (!vus[s]) res.push(msg("attention", "Automate incomplet : pas de transition « " + s + " » depuis « " + n.nom + " ».", n.nom));
          });
        });
      }
      if (tests && ini.length) {
        (tests.acceptes || []).forEach(function (w) { if (!accepte(m, w, alpha)) res.push(msg("erreur", "Le mot " + motLisible(decouperMot(w, alpha), alpha) + " devrait être accepté.")); });
        (tests.rejetes || []).forEach(function (w) { if (accepte(m, w, alpha)) res.push(msg("erreur", "Le mot " + motLisible(decouperMot(w, alpha), alpha) + " devrait être rejeté.")); });
      }
    } else {
      if (options.pondere) m.arcs.forEach(function (x) {
        if (!x.etiquette || isNaN(Number(String(x.etiquette).replace(",", ".")))) res.push(msg("attention", "L'arc « " + x.a + " – " + x.b + " » n'a pas de poids numérique.", x.a + (m.oriente ? "->" : "--") + x.b));
      });
      var relies = new Set();
      m.arcs.forEach(function (x) { relies.add(x.a); relies.add(x.b); });
      m.noeuds.forEach(function (n) { if (!relies.has(n.nom) && m.noeuds.length > 1) res.push(msg("info", "Le nœud « " + n.nom + " » est isolé.", n.nom)); });
    }
    return res;
  }

  /* Comparaison ------------------------------------------------------------------------ */

  function faits(m) {
    var f = m.noeuds.map(function (n) { return "N|" + n.nom.toLowerCase() + (m.automate ? (n.initial ? "|i" : "") + (n.final ? "|f" : "") : ""); });
    m.arcs.forEach(function (x) {
      var paire = m.oriente ? x.a.toLowerCase() + ">" + x.b.toLowerCase() : [x.a.toLowerCase(), x.b.toLowerCase()].sort().join("~");
      var et = m.automate ? symboles(x.etiquette).sort().join(",") : String(x.etiquette || "").trim().toLowerCase().replace(",", ".");
      f.push("E|" + paire + "|" + et);
    });
    return f;
  }

  function comparer(m, sol, options) {
    if (!sol) return null;
    if (sol.pert) return comparerPert(m, sol);
    var st = N.f1(faits(m), faits(sol)), ecarts = [];
    if (sol.automate) {
      var alpha = Array.from(new Set(alphabet(m).concat(alphabet(sol, options)))).sort();
      if (!m.noeuds.some(function (n) { return n.initial; })) {
        return { score: 0, ecarts: [ecart("different", "Ton automate n'a pas d'état initial.")], resume: "Pas d'état initial." };
      }
      var d = motDistinctif(m, sol, alpha);
      if (!d) {
        if (m.noeuds.length > sol.noeuds.length) ecarts.push(ecart("different", "Même langage, mais ton automate a " + N.pluriel(m.noeuds.length, "état") + " contre " + sol.noeuds.length + " dans la solution : il peut être simplifié."));
        return { score: 1, ecarts: ecarts, resume: "Même langage que la solution : les automates sont équivalents." };
      }
      ecarts.push(ecart("different", "Le mot " + motLisible(d.mot, alpha) + " est " + (d.accepte1 ? "accepté par ton automate mais pas par la solution." : "accepté par la solution mais pas par ton automate.")));
      return { score: Math.min(0.8, st.score * 0.8), ecarts: ecarts, resume: "Langage différent de celui de la solution." };
    }
    var nomsSol = new Set(sol.noeuds.map(function (n) { return n.nom.toLowerCase(); }));
    var nomsEtu = new Set(m.noeuds.map(function (n) { return n.nom.toLowerCase(); }));
    sol.noeuds.forEach(function (n) { if (!nomsEtu.has(n.nom.toLowerCase())) ecarts.push(ecart("manque", "Il manque le nœud « " + n.nom + " ».")); });
    m.noeuds.forEach(function (n) { if (!nomsSol.has(n.nom.toLowerCase())) ecarts.push(ecart("exces", "Le nœud « " + n.nom + " » n'apparaît pas dans la solution.", n.nom)); });
    st.manquants.filter(function (f) { return f[0] === "E"; }).forEach(function (f) {
      var p = f.split("|"), ab = p[1].split(/[>~]/);
      ecarts.push(ecart("manque", "Il manque l'" + (sol.oriente ? "arc « " + ab[0] + " → " + ab[1] : "arête « " + ab[0] + " – " + ab[1]) + " »" + (p[2] ? " (" + p[2] + ")" : "") + "."));
    });
    st.exces.filter(function (f) { return f[0] === "E"; }).forEach(function (f) {
      var p = f.split("|"), ab = p[1].split(/[>~]/);
      ecarts.push(ecart("exces", (m.oriente ? "L'arc « " + ab[0] + " → " + ab[1] : "L'arête « " + ab[0] + " – " + ab[1]) + " »" + (p[2] ? " (" + p[2] + ")" : "") + " n'apparaît pas dans la solution.", ab[0] + (m.oriente ? "->" : "--") + ab[1]));
    });
    return { score: st.score, ecarts: ecarts, resume: st.score === 1 ? "Identique à la solution proposée." : Math.round(st.score * 100) + " % de concordance avec la solution · " + N.pluriel(ecarts.length, "écart") };
  }

  A.editeurs.graphe = {
    nom: "graphe",
    // Options reconnues (champ « options » d'un atelier), vérifiées par outils/verifier.js
    options: {
      oriente: "false : graphe non orienté",
      automate: "true : automate (états initiaux et finals)",
      deterministe: "true : l'automate doit être déterministe",
      complet: "true : l'automate doit être complet",
      afn: "true : plusieurs états initiaux permis",
      pondere: "true : chaque arc porte un poids numérique",
      alphabet: "alphabet imposé, par exemple [\"a\", \"b\"]",
      pert: "true : PERT potentiel-étapes, étapes datées et tâches fictives"
    },
    libelle: "Graphe",
    description: "Graphe ou automate : un arc par ligne (A -> B : étiquette), états initiaux et finaux déclarés par « initial » et « final ». PERT : etape E2 15 15, puis A -> E2 : T2 15, ou fictive.",
    aide: "<ul><li>Arc orienté : <code>A -&gt; B</code>, avec étiquette : <code>q0 -&gt; q1 : a, b</code> ; arête d'un graphe non orienté : <code>A -- B : 5</code>.</li>" +
      "<li>Automate : <code>automate</code>, puis <code>initial q0</code> et <code>final q2</code>. <code>ε</code> pour une ε-transition.</li>" +
      "<li>Nœud sans arc : <code>noeud X</code>. Écrire <code>non oriente</code> en tête pour un graphe non orienté.</li>" +
      "<li>PERT : <code>etape E2 15 15</code> (date au plus tôt, date au plus tard), <code>Debut -&gt; E2 : T2 15</code> (tâche et durée), <code>E2 -&gt; E3 : fictive</code>.</li></ul>",
    vide: function (options) { return { oriente: !(options && options.oriente === false), automate: Boolean(options && options.automate), pert: Boolean(options && options.pert), noeuds: [], arcs: [] }; },
    lire: lire,
    ecrire: ecrire,
    fusionner: fusionner,
    controler: controler,
    comparer: comparer,
    accepte: accepte,
    alphabet: alphabet,
    motDistinctif: motDistinctif,
    symboles: symboles,
    tachePert: tachePert,
    cibles: function (m) {
      var t = (m && m.noeuds || []).map(function (n) { return n.nom; });
      (m && m.arcs || []).forEach(function (x) { t.push(x.a + (m.oriente ? "->" : "--") + x.b); });
      return t;
    },
    estVide: function (m) { return !m || !m.noeuds.length; }
  };
})(window.Atelier);
