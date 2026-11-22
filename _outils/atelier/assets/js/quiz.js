/* ==========================================================================
   Atelier · type de question « atelier » pour l'outil de quiz
   --------------------------------------------------------------------------
   Atelier.brancherQuiz(QuizApp) ajoute le type « atelier » à QuizApp.types.
   Il est appelé par le démarrage du quiz quand la page charge aussi
   l'atelier. Une question « atelier » contient les mêmes champs qu'un bloc
   d'atelier de TD (editeur, depart, solution, options, tests, attendu…).
   Notation : comparaison avec la solution (score entre 0 et 1) ; SQL :
   exécution et comparaison des résultats ; rédaction ou annotations :
   auto-évaluation, avec la solution affichée.
   ========================================================================== */
(function (A) {
  'use strict';

  var N = A.noyau,
    el = N.el,
    tr = A.tr;

  function configQuestion(q) {
    return {
      id: q.id,
      editeur: q.editeur,
      depart: q.depart,
      solution: q.solution,
      options: q.options || {},
      tests: q.tests,
      titre: q.titre,
      hauteur: q.hauteur,
      vue: q.vue,
      disposition: q.disposition,
      attendu: q.attendu,
      mode: q.mode === 'annoter' ? 'annoter' : 'quiz',
    };
  }

  function modeleSolution(q) {
    var ed = A.editeurs[q.editeur];
    return q.solution != null ? ed.lire(N.lignesDe(q.solution), q.options || {}).modele : null;
  }

  function rendu(q, modele) {
    var v = A.vues[q.editeur];
    try {
      return N.cadreLisible(v.statique(modele, q.options || {})).outerHTML;
    } catch (e) {
      return '<pre>' + N.echapper(A.editeurs[q.editeur].ecrire(modele, q.options || {})) + '</pre>';
    }
  }

  function brancherQuiz(Q) {
    if (!Q || !Q.types || Q.types.atelier) return;
    if (Q.LIBELLES_TYPES) Q.LIBELLES_TYPES.atelier = 'Atelier (diagramme, schéma, table…)'; // français : affiché via QuizApp.libelleType

    Q.types.atelier = {
      consigne: function (q) {
        var ed = A.editeurs[q.editeur];
        if (!ed) return '';
        if (q.mode === 'annoter')
          return tr(
            'Cliquer sur les éléments du dessin pour y poser des remarques, puis valider.',
            'Click the elements of the drawing to add remarks to them, then submit.',
          );
        if (ed.nom === 'sql')
          return tr(
            "Écrire le SQL, l'exécuter pour le tester, puis valider : il est comparé à la solution.",
            'Write the SQL, run it to test it, then submit: it is compared with the solution.',
          );
        if (ed.sansDessin)
          return tr(
            "Rédiger, puis valider : la solution s'affiche pour s'auto-évaluer.",
            'Write, then submit: the solution is shown for self-assessment.',
          );
        return tr(
          'Construire la réponse sur le dessin ou dans la vue texte, puis valider : elle est comparée à la solution.',
          'Build the answer on the drawing or in the text view, then submit: it is compared with the solution.',
        );
      },
      rendre: function (q, zone, etat, ancienne) {
        var div = el('div', 'atelier atelier-question');
        zone.appendChild(div);
        var sauve = ancienne
          ? {
              editeur: q.editeur,
              modele: ancienne.modele,
              annotations: ancienne.annotations,
              reponse: ancienne.reponse,
            }
          : null;
        var esp = new A.Espace(div, configQuestion(q), {
          mode: 'quiz',
          etat: sauve,
          jeux: Q.donnees && Q.donnees.jeux,
          titrePage: Q.donnees && Q.donnees.titre,
          enonce: function () {
            return Q.outils ? Q.outils.texteDe(q.enonce) : '';
          },
          surChangement: function () {
            zone.dispatchEvent(new Event('change', { bubbles: true }));
          },
        });
        return {
          lire: function () {
            if (!esp.ed) return null;
            var v = esp.lire();
            var vide = esp.mode === 'annoter' ? !v.annotations.length && !v.reponse.trim() : esp.ed.estVide(v.modele);
            return vide ? null : v;
          },
          verrouiller: function () {
            esp.verrouiller();
          },
          corriger: function () {
            esp.montrerCorrectionQuiz();
          },
          focus: null,
          espace: esp,
        };
      },
      evaluer: function (q, v) {
        var ed = A.editeurs[q.editeur];
        if (v == null) return Promise.resolve({ score: 0, rapport: null });
        var sol = modeleSolution(q);
        if (q.mode === 'annoter' || (ed.sansDessin && ed.nom !== 'sql') || (!sol && ed.nom !== 'sql')) {
          return Promise.resolve({
            score: null,
            rapport: {
              type: 'indisponible',
              message: tr(
                "Pas de correction automatique : comparer à la solution et s'auto-évaluer, ou demander à Claude.",
                'No automatic marking: compare with the solution and self-assess, or ask Claude.',
              ),
            },
          });
        }
        if (ed.asynchrone) {
          var C = Q.connexion;
          if (!C.executable('sql'))
            return Promise.resolve({
              score: null,
              rapport: {
                type: 'indisponible',
                message: tr(
                  'Pour exécuter et comparer le SQL, ouvrir ce quiz depuis le serveur local (lancer.bat).',
                  'To run and compare the SQL, open this quiz from the local server (lancer.bat).',
                ),
              },
            });
          var jeu = q.options && q.options.jeu && Q.donnees && Q.donnees.jeux && Q.donnees.jeux[q.options.jeu];
          var ev = ed.evaluation(
            v.modele,
            sol,
            Object.assign({}, q.options || {}, { tests: q.tests }),
            jeu ? jeu.script : '',
          );
          return Promise.all(
            ev.demandes.map(function (d) {
              return C.executer(d);
            }),
          ).then(function (reps) {
            var r = ev.interpreter(reps);
            return {
              score: r.score,
              rapport: {
                type: 'atelier',
                editeur: q.editeur,
                message: r.resume,
                ecarts: r.ecarts,
                obtenu: r.obtenu,
                attendu: r.attendu,
              },
            };
          });
        }
        var c = ed.comparer(v.modele, sol, q.options || {});
        var seuil = q.seuil != null ? q.seuil : 1;
        var score = c.score >= seuil ? 1 : c.score;
        return Promise.resolve({
          score: Math.round(score * 100) / 100,
          rapport: { type: 'atelier', editeur: q.editeur, message: c.resume, ecarts: c.ecarts },
        });
      },
      noter: function () {
        return null;
      },
      resume: function (q, v) {
        return v == null
          ? null
          : rendu(q, v.modele) +
              (v.annotations && v.annotations.length
                ? '<ol>' +
                  v.annotations
                    .map(function (a) {
                      return '<li><b>' + N.echapper(a.cible) + '</b> : ' + N.echapper(a.texte) + '</li>';
                    })
                    .join('') +
                  '</ol>'
                : '');
      },
      solution: function (q) {
        var sol = modeleSolution(q),
          h = '';
        if (q.attendu)
          h +=
            '<ol>' +
            q.attendu
              .map(function (x) {
                return '<li>' + (x.cible ? '<b>' + N.echapper(x.cible) + '</b> : ' : '') + x.texte + '</li>';
              })
              .join('') +
            '</ol>';
        if (sol && !(q.mode === 'annoter' && !q.solution)) h += rendu(q, sol);
        return h || tr('<em>Pas de solution de référence.</em>', '<em>No reference solution.</em>');
      },
      resumeTexte: function (q, v) {
        return v == null ? null : v.texte;
      },
      details: function (q) {
        var ed = A.editeurs[q.editeur];
        if (!ed) return '';
        var t = "Question d'atelier « " + ed.libelle + ' ». ' + ed.description;
        if (q.options && Object.keys(q.options).length) t += '\nOptions : ' + JSON.stringify(q.options);
        if (q.depart) t += '\nPoint de départ :\n' + N.lignesDe(q.depart);
        if (q.mode === 'annoter' && q.attendu)
          t +=
            '\nErreurs attendues (à ne pas révéler avant la correction) :\n' +
            q.attendu
              .map(function (x) {
                return '- ' + (x.cible || '') + ' : ' + (Q.outils ? Q.outils.texteDe(x.texte) : x.texte);
              })
              .join('\n');
        return t;
      },
      // Bloc « réponse modèle » quand la note est une auto-évaluation
      blocModele: function (q) {
        var d = el('div', 'atelier-quiz-modele');
        d.innerHTML = Q.types.atelier.solution(q);
        return d;
      },
    };

    // Rapport de correction affiché dans le retour et dans la revue
    Q.rapports = Q.rapports || {};
    Q.rapports.atelier = function (r) {
      var b = el('div', 'atelier-rapport');
      if (r.message) b.appendChild(el('p', 'code-rapport-message', r.message));
      if (r.ecarts && r.ecarts.length) {
        var ul = el('ul', 'atelier-messages');
        r.ecarts.forEach(function (e) {
          var li = el('li', 'atelier-message ' + e.nature);
          var s = el('span', 'atelier-message-corps');
          s.appendChild(
            el(
              'span',
              'atelier-message-niveau',
              tr(
                { manque: 'Manque', exces: 'En trop', different: 'Différent' }[e.nature],
                { manque: 'Missing', exces: 'Extra', different: 'Different' }[e.nature],
              ) || e.nature,
            ),
          );
          s.appendChild(el('span', 'atelier-message-texte', e.message));
          li.appendChild(s);
          ul.appendChild(li);
        });
        b.appendChild(ul);
      }
      if (r.obtenu && r.attendu && Q.code && Q.code.tableSql) {
        var cols = el('div', 'colonnes');
        cols.appendChild(Q.code.tableSql(r.obtenu, tr('Résultat obtenu', 'Result obtained')));
        cols.appendChild(Q.code.tableSql(r.attendu, tr('Résultat attendu', 'Expected result')));
        b.appendChild(cols);
      }
      return b;
    };
  }

  A.brancherQuiz = brancherQuiz;
})(window.Atelier);
