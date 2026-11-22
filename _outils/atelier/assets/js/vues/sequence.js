/* ==========================================================================
   Atelier · vue « sequence » : diagramme de séquence UML (interface)
   --------------------------------------------------------------------------
   Participants en colonnes (acteur en bonhomme), lignes de vie en
   pointillés, messages de haut en bas, fragments (alt, boucle, opt)
   encadrés avec leur garde. Édition : « + Participant » ; « + Message »
   puis un clic sur l'émetteur et un sur le destinataire ; double-clic sur
   un participant ou un message pour le modifier, le déplacer ou le
   supprimer. Les fragments se créent dans la vue texte.
   ========================================================================== */
(function (A) {
  'use strict';

  var N = A.noyau,
    G = A.geometrie,
    tr = A.tr;
  var Y0 = 20,
    H_TETE = 38,
    PAS = 40,
    ECART = 60;

  function libelle(p) {
    return p.genre === 'acteur' ? p.nom : p.nom + (p.classe ? ' : ' + p.classe : '');
  }

  function colonnes(m) {
    var x = 30,
      res = {};
    m.participants.forEach(function (p) {
      var l = Math.max(90, Math.ceil(N.largeurTexte(libelle(p), N.police('--police-texte', 13.5, 600))) + 24);
      res[p.nom] = { x: x, l: l, cx: x + l / 2, p: p };
      x += l + ECART;
    });
    res._largeur = x;
    return res;
  }

  // Parcourt les éléments dans l'ordre d'affichage ; appelle f(element, liste, index, profondeur)
  function parcourir(liste, f, profondeur) {
    liste.forEach(function (e, i) {
      f(e, liste, i, profondeur || 0);
      if (e.type === 'fragment')
        e.sections.forEach(function (s) {
          parcourir(s.elements, f, (profondeur || 0) + 1);
        });
    });
  }

  function dessiner(g, m, avecId) {
    var col = colonnes(m),
      y = Y0 + H_TETE + 30,
      messages = [],
      cadres = [],
      ys = new Map();
    // Positions verticales
    (function placer(liste, prof) {
      liste.forEach(function (e) {
        if (e.type === 'message') {
          ys.set(e, y);
          y += e.de === e.vers ? PAS + 14 : PAS;
          messages.push(e);
          return;
        }
        var f = { e: e, y0: y - 18, sections: [], prof: prof };
        y += 22;
        e.sections.forEach(function (s, i) {
          if (i > 0) {
            f.sections.push(y - 16);
            y += 18;
          }
          placer(s.elements, prof + 1);
        });
        f.y1 = y - 12;
        y += 16;
        cadres.push(f);
      });
    })(m.elements, 0);
    var bas = y + 10;

    var gLignes = N.svg('g', { class: 'cv-lignes-vie' }, g);
    m.participants.forEach(function (p) {
      var c = col[p.nom];
      N.svg(
        'line',
        { x1: c.cx, y1: Y0 + H_TETE, x2: c.cx, y2: bas, class: 'cv-ligne-vie', 'data-noeud': avecId ? p.nom : null },
        gLignes,
      );
    });
    // Fragments (derrière les messages)
    var gCadres = N.svg('g', { class: 'cv-fragments' }, g);
    cadres.forEach(function (f) {
      var noms = [];
      parcourir([f.e], function (e) {
        if (e.type === 'message') noms.push(e.de, e.vers);
      });
      var xs = noms
        .map(function (n) {
          return col[n];
        })
        .filter(Boolean);
      if (!xs.length) xs = [col[m.participants[0].nom]];
      var x0 =
        Math.min.apply(
          null,
          xs.map(function (c) {
            return c.cx;
          }),
        ) -
        50 -
        f.prof * 8;
      var x1 =
        Math.max.apply(
          null,
          xs.map(function (c) {
            return c.cx;
          }),
        ) +
        60 +
        f.prof * 8;
      var grp = N.svg('g', { class: 'cv-fragment' }, gCadres);
      N.svg('rect', { x: x0, y: f.y0, width: x1 - x0, height: f.y1 - f.y0, class: 'cv-cadre-fragment' }, grp);
      var titre = f.e.genre,
        lt = Math.ceil(N.largeurTexte(titre, N.police('--police-texte', 12, 700))) + 14;
      N.svg(
        'path',
        { d: 'M' + x0 + ' ' + f.y0 + ' h' + lt + ' v12 l-6 6 H' + x0 + ' Z', class: 'cv-onglet-fragment' },
        grp,
      );
      N.texteSvg(grp, x0 + 6, f.y0 + 13, titre, 'cv-titre-fragment');
      var gardes = f.e.sections.map(function (s) {
        return s.garde;
      });
      if (gardes[0]) N.texteSvg(grp, x0 + lt + 8, f.y0 + 13, '[' + gardes[0] + ']', 'cv-garde');
      f.sections.forEach(function (ys, i) {
        N.svg('line', { x1: x0, y1: ys, x2: x1, y2: ys, class: 'cv-separateur-fragment' }, grp);
        if (gardes[i + 1]) N.texteSvg(grp, x0 + 8, ys + 14, '[' + gardes[i + 1] + ']', 'cv-garde');
      });
    });
    // Messages
    var gMsg = N.svg('g', { class: 'cv-liens' }, g);
    messages.forEach(function (e, i) {
      var a = col[e.de],
        b = col[e.vers];
      if (!a || !b) return;
      var grp = N.svg(
        'g',
        { class: 'cv-message ' + e.genre, 'data-lien': avecId ? String(i) : null, 'data-cible': 'message ' + (i + 1) },
        gMsg,
      );
      var classe = e.genre === 'retour' ? 'cv-trait cv-pointille' : 'cv-trait',
        d,
        p;
      if (a === b) {
        d = 'M' + a.cx + ' ' + ys.get(e) + ' h40 v18 H' + (a.cx + 2);
        N.svg('path', { d: d, class: 'cv-zone-clic' }, grp);
        N.svg('path', { d: d, class: classe }, grp);
        p = G.pointe(
          a.cx + 40,
          ys.get(e) + 18,
          a.cx + 1,
          ys.get(e) + 18,
          e.genre === 'synchrone' ? 'pleine' : 'ouverte',
          10,
        );
        N.texteSvg(grp, a.cx + 46, ys.get(e) + 5, e.texte, 'cv-texte-message');
      } else {
        var x2 = b.cx + (b.cx > a.cx ? -1 : 1);
        d = 'M' + a.cx + ' ' + ys.get(e) + ' L' + x2 + ' ' + ys.get(e);
        N.svg('path', { d: d, class: 'cv-zone-clic' }, grp);
        N.svg('path', { d: d, class: classe }, grp);
        p = G.pointe(a.cx, ys.get(e), x2, ys.get(e), e.genre === 'synchrone' ? 'pleine' : 'ouverte', 10);
        N.texteSvg(grp, (a.cx + b.cx) / 2, ys.get(e) - 7, e.texte, 'cv-texte-message', 'middle');
      }
      N.svg('path', { d: p.d, class: 'cv-pointe' + (p.ouverte ? ' ouverte' : ' pleine') }, grp);
    });
    // Têtes des participants (au-dessus)
    var gTetes = N.svg('g', { class: 'cv-noeuds' }, g);
    m.participants.forEach(function (p) {
      var c = col[p.nom];
      var grp = N.svg(
        'g',
        { class: 'cv-participant ' + p.genre, 'data-noeud': avecId ? p.nom : null, 'data-nom': p.nom },
        gTetes,
      );
      if (p.genre === 'acteur') {
        var x = c.cx,
          t = Y0 + 2;
        N.svg('circle', { cx: x, cy: t + 5, r: 5, class: 'cv-boite' }, grp);
        N.svg(
          'path',
          {
            d:
              'M' +
              x +
              ' ' +
              (t + 10) +
              ' v12 M' +
              (x - 9) +
              ' ' +
              (t + 14) +
              ' h18 M' +
              x +
              ' ' +
              (t + 22) +
              ' l-7 9 M' +
              x +
              ' ' +
              (t + 22) +
              ' l7 9',
            class: 'cv-trait',
          },
          grp,
        );
        N.svg('rect', { x: c.x, y: Y0, width: c.l, height: H_TETE, class: 'cv-zone-clic-rect' }, grp);
        N.texteSvg(grp, x, Y0 + H_TETE + 4, p.nom, 'cv-nom-participant', 'middle');
      } else {
        N.svg('rect', { x: c.x, y: Y0, width: c.l, height: H_TETE - 6, rx: 2, class: 'cv-boite' }, grp);
        var t2 = N.texteSvg(grp, c.cx, Y0 + 21, libelle(p), 'cv-nom-participant objet', 'middle');
        t2.setAttribute('text-decoration', 'underline');
      }
    });
    return { l: col._largeur, h: bas + 10 };
  }

  function creer(conteneur, ctx) {
    var m = null,
      ro = ctx.lectureSeule,
      derniers = null,
      emetteur = null;
    var cv = new A.Canevas(conteneur, {
      hauteur: ctx.hauteur,
      lectureSeule: ro,
      libelle: tr('Diagramme de séquence', 'Sequence diagram'),
      surClic: function (c, e) {
        if (ctx.surClicElement) {
          if (c.type === 'noeud') ctx.surClicElement(c.id);
          else ctx.surClicElement('message ' + (Number(c.id) + 1));
        }
        if (ro || cv.mode !== 'message' || c.type !== 'noeud') return;
        if (!emetteur) {
          emetteur = c.id;
          aide(tr('Cliquer maintenant sur le destinataire.', 'Now click the receiver.'));
          return;
        }
        var de = emetteur,
          vers = c.id;
        emetteur = null;
        cv.definirMode('normal');
        majOutils();
        aide('');
        m.elements.push({ type: 'message', de: de, vers: vers, genre: 'synchrone', texte: '' });
        dessinerTout();
        ctx.modifie(m, true);
        editerMessage(A.editeurs.sequence.messages(m).length - 1, e);
      },
      surDoubleClic: function (c, p, e) {
        if (ro || !c) return;
        if (c.type === 'noeud') editerParticipant(c.id, e);
        else editerMessage(Number(c.id), e);
      },
      surSupprimer: function (sel) {
        if (sel.type === 'noeud') {
          m.participants = m.participants.filter(function (p) {
            return p.nom !== sel.id;
          });
          retirerMessages(function (e) {
            return e.de === sel.id || e.vers === sel.id;
          });
        } else {
          var cible = A.editeurs.sequence.messages(m)[Number(sel.id)];
          retirerMessages(function (e) {
            return e === cible;
          });
        }
        cv.selectionner(null, true);
        dessinerTout();
        ctx.modifie(m, true);
      },
      surEchap: function () {
        emetteur = null;
        aide('');
        majOutils();
      },
    });
    var bulle = N.el('p', 'atelier-canevas-aide');
    bulle.hidden = true;
    cv.racine.appendChild(bulle);
    function aide(t) {
      bulle.textContent = t;
      bulle.hidden = !t;
    }

    function retirerMessages(critere) {
      (function nettoyer(liste) {
        for (var i = liste.length - 1; i >= 0; i--) {
          var e = liste[i];
          if (e.type === 'message' && critere(e)) liste.splice(i, 1);
          else if (e.type === 'fragment')
            e.sections.forEach(function (s) {
              nettoyer(s.elements);
            });
        }
      })(m.elements);
    }
    // Liste qui contient le message numéro i, et sa position
    function emplacement(i) {
      var cible = A.editeurs.sequence.messages(m)[i],
        res = null;
      parcourir(m.elements, function (e, liste, k) {
        if (e === cible) res = { liste: liste, index: k, message: e };
      });
      return res;
    }
    function dessinerTout() {
      cv.vider();
      if (!m) return;
      dessiner(cv.monde, m, true);
      cv.marquerSelection();
      if (derniers) appliquer(derniers);
    }
    function position(e, sel) {
      if (e && e.clientX != null) return { x: e.clientX + 10, y: e.clientY + 10 };
      var el = cv.monde.querySelector(sel);
      if (!el) return {};
      var r = el.getBoundingClientRect();
      return { x: r.right + 8, y: r.top };
    }
    function editerParticipant(nom, e) {
      var p = m.participants.find(function (x) {
          return x.nom === nom;
        }),
        pos = position(e, '[data-nom="' + CSS.escape(nom) + '"]');
      A.formulaire.ouvrir(cv.racine, {
        x: pos.x,
        y: pos.y,
        titre: 'Participant',
        champs: [
          { nom: 'nom', libelle: tr('Nom', 'Name'), valeur: p.nom },
          {
            nom: 'genre',
            libelle: tr('Genre', 'Kind'),
            type: 'choix',
            valeur: p.genre,
            options: tr(
              [
                ['objet', 'Objet'],
                ['acteur', 'Acteur'],
              ],
              [
                ['objet', 'Object'],
                ['acteur', 'Actor'],
              ],
            ),
          },
          { nom: 'classe', libelle: tr('Classe (objet)', 'Class (object)'), valeur: p.classe },
        ],
        actions: [
          {
            libelle: tr('← Déplacer', '← Move'),
            action: function () {
              deplacerParticipant(p, -1);
            },
          },
          {
            libelle: tr('Déplacer →', 'Move →'),
            action: function () {
              deplacerParticipant(p, 1);
            },
          },
        ],
        surValider: function (v) {
          var n = v.nom.trim();
          if (!/^[A-Za-zÀ-ÖØ-öø-ÿ0-9_'·]+$/.test(n))
            return tr('Nom invalide : lettres, chiffres et _ seulement.', 'Invalid name: letters, digits and _ only.');
          if (
            n !== p.nom &&
            m.participants.some(function (x) {
              return x.nom === n;
            })
          )
            return tr('Ce nom est déjà pris.', 'This name is already taken.');
          parcourir(m.elements, function (x) {
            if (x.type === 'message') {
              if (x.de === p.nom) x.de = n;
              if (x.vers === p.nom) x.vers = n;
            }
          });
          p.nom = n;
          p.genre = v.genre;
          p.classe = v.genre === 'objet' ? v.classe.trim() : '';
          dessinerTout();
          ctx.modifie(m, true);
        },
        surSupprimer: function () {
          cv.options.surSupprimer({ type: 'noeud', id: p.nom });
        },
        surFermer: function () {
          cv.racine.focus({ preventScroll: true });
        },
      });
    }
    function deplacerParticipant(p, sens) {
      var i = m.participants.indexOf(p),
        j = i + sens;
      if (j < 0 || j >= m.participants.length) return;
      m.participants[i] = m.participants[j];
      m.participants[j] = p;
      dessinerTout();
      ctx.modifie(m, true);
    }
    function editerMessage(i, e) {
      var em = emplacement(i);
      if (!em) return;
      var x = em.message,
        pos = position(e, '[data-lien="' + i + '"]');
      A.formulaire.ouvrir(cv.racine, {
        x: pos.x,
        y: pos.y,
        titre: 'Message ' + x.de + ' → ' + x.vers,
        champs: [
          { nom: 'texte', libelle: 'Message', valeur: x.texte, placeholder: 'retirer(50)' },
          {
            nom: 'genre',
            libelle: 'Type',
            type: 'choix',
            valeur: x.genre,
            options: tr(
              [
                ['synchrone', 'Synchrone (appel)'],
                ['asynchrone', 'Asynchrone'],
                ['retour', 'Retour'],
              ],
              [
                ['synchrone', 'Synchronous (call)'],
                ['asynchrone', 'Asynchronous'],
                ['retour', 'Return'],
              ],
            ),
          },
        ],
        actions: [
          {
            libelle: tr('↑ Monter', '↑ Move up'),
            action: function () {
              bouger(em, -1);
            },
          },
          {
            libelle: tr('↓ Descendre', '↓ Move down'),
            action: function () {
              bouger(em, 1);
            },
          },
          {
            libelle: tr('Inverser', 'Reverse'),
            action: function () {
              A.formulaire.fermer(false);
              var t = x.de;
              x.de = x.vers;
              x.vers = t;
              dessinerTout();
              ctx.modifie(m, true);
            },
          },
        ],
        surValider: function (v) {
          x.texte = v.texte.trim();
          x.genre = v.genre;
          dessinerTout();
          ctx.modifie(m, true);
        },
        surSupprimer: function () {
          cv.options.surSupprimer({ type: 'lien', id: String(i) });
        },
        surFermer: function () {
          cv.racine.focus({ preventScroll: true });
        },
      });
    }
    function bouger(em, sens) {
      var j = em.index + sens;
      if (j < 0 || j >= em.liste.length) return;
      A.formulaire.fermer(false);
      var t = em.liste[j];
      em.liste[j] = em.liste[em.index];
      em.liste[em.index] = t;
      dessinerTout();
      ctx.modifie(m, true);
    }
    var boutonMsg = null;
    function majOutils() {
      if (boutonMsg) boutonMsg.classList.toggle('actif', cv.mode === 'message');
    }
    function appliquer(liste) {
      cv.surligner(
        liste.map(function (s) {
          var t = String(s.cible || '').toLowerCase();
          var els = Array.prototype.filter.call(cv.monde.querySelectorAll('[data-nom], [data-cible]'), function (e) {
            return (e.getAttribute('data-nom') || e.getAttribute('data-cible') || '').toLowerCase() === t;
          });
          return { classe: s.classe, elements: els };
        }),
      );
    }
    var premier = true;
    return {
      canevas: cv,
      afficher: function (modele) {
        m = modele;
        dessinerTout();
        if (premier) {
          premier = false;
          requestAnimationFrame(function () {
            cv.ajuster(1);
          });
        }
      },
      outils: function () {
        if (ro) return [];
        var ajout = N.bouton(
          '+ Participant',
          'petit',
          function () {
            var i = m.participants.length + 1;
            while (
              m.participants.some(function (p) {
                return p.nom === 'o' + i;
              })
            )
              i++;
            m.participants.push({ nom: 'o' + i, genre: 'objet', classe: '' });
            dessinerTout();
            ctx.modifie(m, true);
            editerParticipant('o' + i);
          },
          tr('Ajouter un participant', 'Add a participant'),
        );
        boutonMsg = N.bouton(
          '+ Message',
          'petit',
          function () {
            emetteur = null;
            cv.definirMode(cv.mode === 'message' ? 'normal' : 'message');
            aide(
              tr(
                cv.mode === 'message' ? "Cliquer sur l'émetteur du message." : '',
                cv.mode === 'message' ? 'Click the sender of the message.' : '',
              ),
            );
            majOutils();
          },
          tr(
            "Ajouter un message : cliquer sur l'émetteur puis sur le destinataire",
            'Add a message: click the sender, then the receiver',
          ),
        );
        return [ajout, boutonMsg];
      },
      surligner: function (liste) {
        derniers = liste;
        appliquer(liste);
      },
      effacerSurlignage: function () {
        derniers = null;
        cv.effacerSurlignage();
      },
      ajuster: function () {
        cv.ajuster(1);
      },
      focus: function () {
        cv.racine.focus();
      },
    };
  }

  function statique(modele) {
    var m = N.copie(modele);
    var svg = N.svg('svg', { class: 'atelier-svg statique', role: 'img' });
    var t = dessiner(N.svg('g', null, svg), m, false);
    svg.setAttribute('viewBox', '10 10 ' + t.l + ' ' + t.h);
    svg.setAttribute('width', Math.round(t.l));
    return svg;
  }

  A.vues.sequence = {
    creer: creer,
    statique: statique,
    get aideVide() {
      return A.tr(
        '« + Participant » puis « + Message » ; ou écrire le diagramme dans la vue texte.',
        '“+ Participant” then “+ Message”; or write the diagram in the text view.',
      );
    },
  };
})(window.Atelier);
