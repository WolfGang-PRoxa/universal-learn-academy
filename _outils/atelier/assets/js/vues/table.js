/* ==========================================================================
   Atelier · vue « table » : grille de valeurs (interface)
   --------------------------------------------------------------------------
   Tableau de cases à remplir. Entrée ou ↓ passe à la ligne suivante, ↑ à la
   précédente. Selon les options : en-têtes modifiables ou non, cases du
   départ verrouillées, ajout et suppression de lignes et de colonnes.
   ========================================================================== */
(function (A) {
  'use strict';

  var N = A.noyau,
    el = N.el,
    trad = A.tr;

  function creer(conteneur, ctx) {
    var m = null,
      ro = ctx.lectureSeule,
      o = ctx.options || {},
      derniers = null;
    var verrou = o.verrou || 'entetes';
    var ajoutLignes = o.lignes !== false,
      ajoutColonnes = Boolean(o.colonnes);
    var fixes = null; // cases verrouillées (« depart »), calculées au premier affichage
    var racine = el('div', 'atelier-table' + (o.mono ? ' mono' : '') + (ro ? ' lecture' : ''));
    var cadre = el('div', 'tableau compact');
    racine.appendChild(cadre);
    conteneur.appendChild(racine);

    function verrouillee(i, j) {
      return ro || (fixes && fixes.has(i + ':' + j));
    }

    function dessiner() {
      cadre.innerHTML = '';
      if (!m) return;
      var t = el('table'),
        tete = el('thead'),
        tr = el('tr');
      tr.appendChild(el('th', 'num', '#'));
      m.colonnes.forEach(function (c, j) {
        var th = el('th');
        th.setAttribute('data-colonne', c);
        if (!ro && verrou === 'aucun') {
          var e = champ(
            c,
            function (v) {
              m.colonnes[j] = v;
            },
            trad('En-tête ' + (j + 1), 'Header ' + (j + 1)),
          );
          th.appendChild(e);
        } else th.appendChild(el('span', null, c));
        if (!ro && ajoutColonnes)
          th.appendChild(
            N.bouton(
              '×',
              'atelier-mini supprimer',
              function () {
                m.colonnes.splice(j, 1);
                m.lignes.forEach(function (l) {
                  l.splice(j, 1);
                });
                fixes = null;
                changer(true);
              },
              trad('Supprimer la colonne « ' + c + ' »', 'Delete the column “' + c + '”'),
            ),
          );
        tr.appendChild(th);
      });
      if (!ro && ajoutColonnes) {
        var thp = el('th', 'ajout');
        thp.appendChild(
          N.bouton(
            '+',
            'atelier-mini',
            function () {
              m.colonnes.push('col' + (m.colonnes.length + 1));
              m.lignes.forEach(function (l) {
                l.push('');
              });
              changer(true);
            },
            trad('Ajouter une colonne', 'Add a column'),
          ),
        );
        tr.appendChild(thp);
      }
      tete.appendChild(tr);
      t.appendChild(tete);
      var corps = el('tbody');
      m.lignes.forEach(function (l, i) {
        var ligne = el('tr');
        ligne.setAttribute('data-ligne', String(i + 1));
        var num = el('td', 'num', String(i + 1));
        if (
          !ro &&
          ajoutLignes &&
          !(
            fixes &&
            Array.from(fixes).some(function (k) {
              return k.indexOf(i + ':') === 0;
            })
          )
        ) {
          num.appendChild(
            N.bouton(
              '×',
              'atelier-mini supprimer',
              function () {
                m.lignes.splice(i, 1);
                changer(true);
              },
              trad('Supprimer la ligne ' + (i + 1), 'Delete row ' + (i + 1)),
            ),
          );
        }
        ligne.appendChild(num);
        m.colonnes.forEach(function (_, j) {
          var td = el('td');
          td.setAttribute('data-case', i + 1 + ':' + (j + 1));
          if (verrouillee(i, j)) {
            td.classList.add('fixe');
            td.textContent = l[j] == null ? '' : l[j];
          } else
            td.appendChild(
              champ(
                l[j],
                function (v) {
                  m.lignes[i][j] = v;
                },
                trad('Ligne ' + (i + 1) + ', ' + m.colonnes[j], 'Row ' + (i + 1) + ', ' + m.colonnes[j]),
                i,
                j,
              ),
            );
          ligne.appendChild(td);
        });
        corps.appendChild(ligne);
      });
      t.appendChild(corps);
      cadre.appendChild(t);
      if (derniers) appliquer(derniers);
    }

    function champ(valeur, affecter, libelle, i, j) {
      var e = el('input', 'atelier-case');
      e.type = 'text';
      e.value = valeur == null ? '' : valeur;
      e.spellcheck = false;
      e.autocomplete = 'off';
      e.setAttribute('aria-label', libelle);
      e.size = Math.max(3, Math.min(24, String(e.value).length + 1));
      e.addEventListener('input', function () {
        affecter(e.value);
        e.size = Math.max(3, Math.min(24, e.value.length + 1));
        ctx.modifie(m, false);
      });
      e.addEventListener('change', function () {
        ctx.modifie(m, true);
      });
      e.addEventListener('keydown', function (ev) {
        if (i == null) return;
        var cible = null;
        if (ev.key === 'Enter' || ev.key === 'ArrowDown') cible = [i + 1, j];
        else if (ev.key === 'ArrowUp') cible = [i - 1, j];
        if (!cible) return;
        ev.preventDefault();
        if (cible[0] >= m.lignes.length && ev.key === 'Enter' && ajoutLignes && !ro) {
          m.lignes.push(
            m.colonnes.map(function () {
              return '';
            }),
          );
          changer(true);
        }
        var suivant = cadre.querySelector('[data-case="' + (cible[0] + 1) + ':' + (cible[1] + 1) + '"] input');
        if (suivant) suivant.focus();
      });
      return e;
    }

    function changer(historique) {
      dessiner();
      ctx.modifie(m, historique);
    }

    function appliquer(lst) {
      cadre.querySelectorAll('.surligne').forEach(function (e) {
        e.className = e.className.replace(/\s*surligne(-\S+)?/g, '');
      });
      lst.forEach(function (s) {
        var t = String(s.cible || ''),
          els = [],
          x;
        if ((x = t.match(/^ligne (\d+)$/i))) els = [cadre.querySelector('[data-ligne="' + x[1] + '"]')];
        else if ((x = t.match(/^case (\d+):(\d+)$/i)))
          els = [cadre.querySelector('[data-case="' + x[1] + ':' + x[2] + '"]')];
        else if ((x = t.match(/^colonne (.+)$/i))) {
          var j = m.colonnes.findIndex(function (c) {
            return c.toLowerCase() === x[1].toLowerCase();
          });
          if (j >= 0)
            els = Array.prototype.slice.call(
              cadre.querySelectorAll(
                '[data-case$=":' + (j + 1) + '"], th[data-colonne="' + CSS.escape(m.colonnes[j]) + '"]',
              ),
            );
        }
        els.filter(Boolean).forEach(function (e) {
          e.classList.add('surligne', 'surligne-' + (s.classe || 'info'));
        });
      });
    }

    return {
      afficher: function (modele, depart) {
        m = modele;
        if (!fixes && verrou === 'depart' && depart) {
          fixes = new Set();
          depart.lignes.forEach(function (l, i) {
            l.forEach(function (v, j) {
              if (String(v).trim()) fixes.add(i + ':' + j);
            });
          });
        }
        dessiner();
      },
      outils: function () {
        if (ro || !ajoutLignes) return [];
        return [
          N.bouton(
            trad('+ Ligne', '+ Row'),
            'petit',
            function () {
              m.lignes.push(
                m.colonnes.map(function () {
                  return '';
                }),
              );
              changer(true);
              var d = cadre.querySelector('[data-ligne="' + m.lignes.length + '"] input');
              if (d) d.focus();
            },
            trad('Ajouter une ligne', 'Add a row'),
          ),
        ];
      },
      surligner: function (lst) {
        derniers = lst;
        appliquer(lst);
      },
      effacerSurlignage: function () {
        derniers = null;
        appliquer([]);
      },
      focus: function () {
        var i = cadre.querySelector('input');
        if (i) i.focus();
      },
    };
  }

  function statique(modele, options) {
    var d = el('div', 'tableau compact' + (options && options.mono ? ' mono' : ''));
    var t = el('table'),
      tr = el('tr');
    (modele.colonnes || []).forEach(function (c) {
      tr.appendChild(el('th', null, c));
    });
    var tete = el('thead');
    tete.appendChild(tr);
    t.appendChild(tete);
    var corps = el('tbody');
    (modele.lignes || []).forEach(function (l) {
      var r = el('tr');
      l.forEach(function (v) {
        r.appendChild(el('td', null, v));
      });
      corps.appendChild(r);
    });
    t.appendChild(corps);
    d.appendChild(t);
    return d;
  }

  A.vues.table = {
    creer: creer,
    statique: statique,
    get libelleVue() {
      return A.tr('Tableau', 'Table');
    },
  };
})(window.Atelier);
