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
  'use strict';

  // Identifiants des domaines ; leurs noms sont dans textes.js (domaine.<id>)
  var DOMAINES = ['informatique', 'mathematiques', 'langues', 'communication', 'sciences', 'lettres', 'autres'];
  var main = document.getElementById('ula');
  var etat = null,
    cursus = null,
    progression = {},
    catalogue = null;
  var domaineSeul = (location.pathname.match(/^\/explore\/([^/]+)\/index\.html$/) || [])[1] || null;

  /* -- Textes (textes.js) ---------------------------------------------------- */

  // Langue de l'application (cours.js la lit dans l'agent utilisateur et prévient
  // par « ula:langue ») ; français hors de l'application
  var TEXTES = window.ULA_TEXTES || { fr: {} };
  function langue() {
    var l = window.ulaLangueCourante ? window.ulaLangueCourante() : 'fr';
    return TEXTES[l] ? l : 'fr';
  }
  function locale() {
    return langue() === 'en' ? 'en-GB' : 'fr-FR';
  }
  function T(cle, vars) {
    var d = TEXTES[langue()];
    var x = d[cle] != null ? d[cle] : TEXTES.fr[cle] != null ? TEXTES.fr[cle] : cle;
    return x.replace(/\{(\w+)\}/g, function (m, k) {
      return vars && vars[k] != null ? String(vars[k]) : m;
    });
  }
  // Variante au singulier (clé « .un ») quand n vaut 1
  function Tn(cle, n, vars) {
    vars = vars || {};
    if (vars.n == null) vars.n = n;
    var d = TEXTES[langue()];
    return T(n === 1 && d[cle + '.un'] != null ? cle + '.un' : cle, vars);
  }
  function nomDomaine(id) {
    var x = T('domaine.' + id);
    return x === 'domaine.' + id ? id : x;
  }

  /* -- Outils ------------------------------------------------------------- */

  function el(tag, classe, texte) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte != null) e.textContent = texte;
    return e;
  }
  function bouton(texte, classe, action) {
    var b = el('button', 'ula-bouton' + (classe ? ' ' + classe : ''), texte);
    b.type = 'button';
    b.addEventListener('click', function () {
      b.disabled = true;
      Promise.resolve()
        .then(action)
        .catch(afficherErreur)
        .then(function () {
          b.disabled = false;
        });
    });
    return b;
  }
  function lien(texte, href, classe) {
    var a = el('a', classe || null, texte);
    a.href = href;
    return a;
  }
  function api(methode, route, corps) {
    var init = { method: methode, headers: {} };
    if (corps !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(corps);
    }
    return fetch('/api/' + route, init).then(function (r) {
      return r
        .json()
        .catch(function () {
          return {};
        })
        .then(function (d) {
          if (!r.ok || (d && d.erreur)) {
            var e = new Error((d && d.erreur) || T('erreur.statut', { statut: r.status }));
            e.problemes = d && d.problemes;
            throw e;
          }
          return d;
        });
    });
  }
  function afficherErreur(e) {
    var texte = e.message + (e.problemes && e.problemes.length ? '\n\n- ' + e.problemes.slice(0, 20).join('\n- ') : '');
    return demander({ titre: T('dialogue.erreur'), texte: texte, seulementOk: true });
  }
  function urlPage(chemin) {
    return '/' + chemin.split('/').map(encodeURIComponent).join('/');
  }

  // Petit dialogue (window.prompt n'existe pas dans l'application de bureau)
  function demander(o) {
    var d = document.getElementById('dialogue');
    document.getElementById('dialogue-titre').textContent = o.titre || '';
    var t = document.getElementById('dialogue-texte');
    t.textContent = o.texte || '';
    t.style.whiteSpace = 'pre-line';
    t.hidden = !o.texte;
    var zone = document.getElementById('dialogue-champs');
    zone.innerHTML = '';
    var champs = {};
    (o.champs || []).forEach(function (c, i) {
      var id = 'champ-' + i;
      var l = el('label', null, c.libelle);
      l.htmlFor = id;
      var x;
      if (c.choix) {
        x = el('select');
        c.choix.forEach(function (ch) {
          var op = el('option', null, ch.texte);
          op.value = ch.valeur;
          x.appendChild(op);
        });
      } else if (c.long) x = el('textarea');
      else if (c.case) {
        x = el('input');
        x.type = 'checkbox';
        x.checked = c.valeur !== false;
      } else {
        x = el('input');
        x.type = 'text';
      }
      x.id = id;
      if (c.valeur != null && !c.case) x.value = c.valeur;
      if (c.case) {
        l.textContent = '';
        l.className = 'ula-case';
        l.appendChild(x);
        l.appendChild(document.createTextNode(' ' + c.libelle));
        zone.appendChild(l);
      } else {
        zone.appendChild(l);
        zone.appendChild(x);
      }
      champs[c.nom] = x;
    });
    var err = document.getElementById('dialogue-erreur');
    err.hidden = true;
    var ok = document.getElementById('dialogue-ok');
    ok.textContent = o.ok || 'OK';
    d.querySelector('[value=annuler]').textContent = T('dialogue.annuler');
    d.querySelector('[value=annuler]').hidden = Boolean(o.seulementOk);
    return new Promise(function (resolve) {
      // Réponse lue à l'envoi du formulaire (et pas à l'événement « close », que
      // Chromium peut retarder quand la fenêtre est masquée)
      var fini = false;
      function finir(valeur) {
        if (fini) return;
        fini = true;
        d.onclose = null;
        form.onsubmit = null;
        d.oncancel = null;
        if (d.open) d.close(valeur || '');
        if (valeur !== 'ok') return resolve(null);
        var r = {};
        Object.keys(champs).forEach(function (k) {
          r[k] = champs[k].type === 'checkbox' ? champs[k].checked : champs[k].value;
        });
        resolve(r);
      }
      var form = d.querySelector('form');
      form.onsubmit = function (e) {
        e.preventDefault();
        finir(e.submitter ? e.submitter.value : 'ok');
      };
      d.oncancel = function () {
        finir(null);
      };
      d.onclose = function () {
        finir(d.returnValue);
      };
      d.returnValue = '';
      d.showModal();
      var premier = zone.querySelector('input,select,textarea');
      if (premier) {
        premier.focus();
        if (premier.select) premier.select();
      }
    });
  }

  /* -- Chargement -------------------------------------------------------------- */

  function charger() {
    return Promise.all([
      api('GET', 'ula/etat'),
      api('GET', 'ula/cursus'),
      api('GET', 'catalogue').catch(function () {
        return { matieres: [] };
      }),
    ])
      .then(function (r) {
        etat = r[0];
        cursus = r[1];
        progression = {};
        (r[2].matieres || []).forEach(function (m) {
          if (m.id) progression[m.id] = m;
        });
        rendre();
        if (etat.profil && !domaineSeul)
          chargerSoumissions().then(function () {
            if (
              soumissions.some(function (x) {
                return x.cadre;
              })
            )
              montrerCadre();
          });
        api('GET', 'ula/catalogue/travail')
          .then(function (t) {
            if (t.actif) suivreTravail();
          })
          .catch(function () {});
      })
      .catch(function (e) {
        main.querySelectorAll('section, #attente').forEach(function (x) {
          x.remove();
        });
        var p = el('p', 'ula-erreur', T('erreur.serveur', { message: e.message }));
        main.appendChild(p);
      });
  }

  function coursInstalle(id) {
    return (
      (etat.cours || []).find(function (c) {
        return c.id === id;
      }) || null
    );
  }

  function rendre() {
    main.querySelectorAll('section, #attente, .ula-erreur').forEach(function (x) {
      x.remove();
    });
    if (domaineSeul) {
      var nom = nomDomaine(domaineSeul);
      document.getElementById('titre').textContent = nom;
      document.title = nom + ' · ULA';
      document.getElementById('chapeau').textContent = T('domaine.chapeau');
      var fil = document.querySelector('.fil');
      if (!fil.querySelector('a')) fil.insertBefore(lien('ULA', '/index.html'), document.getElementById('fil-courant'));
      document.getElementById('fil-courant').textContent = nom;
      main.appendChild(sectionCours(domaineSeul));
      return;
    }
    // Profils : volet latéral repliable dès qu'il en existe un ; sinon, accueil de création
    var page = main.parentNode;
    var ancien = page.querySelector(':scope > .ula-volet-profils');
    if (ancien) ancien.remove();
    page.classList.toggle('avec-volet', etat.profils.length > 0);
    if (etat.profils.length) {
      page.insertBefore(voletProfils(), main);
      if (window.charteVoletLateral) window.charteVoletLateral();
    } else main.appendChild(sectionProfils());
    if (etat.profil) {
      main.appendChild(sectionCursus());
      var so = sectionSoumissions();
      if (so) main.appendChild(so);
    }
    // Soumissions reçues : seulement chez l'administrateur du catalogue (admin-soumissions.js)
    if (window.ULA_ADMIN) window.ULA_ADMIN.rendre(main);
    main.appendChild(sectionCatalogue());
    main.appendChild(sectionOutils());
    if (location.hash === '#catalogue') {
      var s = document.getElementById('catalogue');
      if (s) s.scrollIntoView();
    }
  }

  /* -- Profils ------------------------------------------------------------------- */

  function sectionProfils() {
    var s = el('section');
    s.appendChild(el('h2', null, T('profil.titre')));
    if (!etat.profils.length) {
      s.appendChild(el('p', null, T('profil.bienvenue')));
      var form = el('form', 'ula-actions');
      var champ = el('input');
      champ.type = 'text';
      champ.value = etat.session;
      champ.setAttribute('aria-label', T('profil.nomAria'));
      champ.className = 'ula-champ';
      var choix = el('select');
      choix.className = 'ula-champ';
      choix.setAttribute('aria-label', T('profil.cursusAria'));
      var aucun = el('option', null, T('profil.cursusAucun'));
      aucun.value = '';
      choix.appendChild(aucun);
      var caseL = el('label', 'ula-case');
      var caseT = el('input');
      caseT.type = 'checkbox';
      caseT.checked = true;
      caseL.appendChild(caseT);
      caseL.appendChild(document.createTextNode(' ' + T('profil.telecharger')));
      var ok = el('button', 'ula-bouton principal', T('profil.creer'));
      ok.type = 'submit';
      form.appendChild(champ);
      form.appendChild(choix);
      form.appendChild(caseL);
      form.appendChild(ok);
      cursusExemples().then(function (liste) {
        liste.forEach(function (c) {
          var o = el(
            'option',
            null,
            T('profil.cursusOption', { titre: c.titre, n: c.nombre, taille: taille(c.taille) }),
          );
          o.value = c.id;
          choix.appendChild(o);
        });
        if (liste.length) choix.value = liste[0].id;
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        ok.disabled = true;
        creerProfil2(champ.value, choix.value, caseT.checked)
          .catch(afficherErreur)
          .then(function () {
            ok.disabled = false;
          });
      });
      s.appendChild(form);
      s.appendChild(el('p', 'ula-note', T('profil.cursusNote')));
      return s;
    }
    return s;
  }

  function voletProfils() {
    var s = el('aside', 'volet-lateral ula-volet-profils');
    s.id = 'profils';
    s.setAttribute('aria-labelledby', 'profils-titre');
    var titre = el('h2', null, T('profil.titrePluriel'));
    titre.id = 'profils-titre';
    s.appendChild(titre);
    var liste = el('div', 'ula-profils');
    etat.profils.forEach(function (p) {
      var b = el('button', 'ula-profil', p.nom);
      b.title = p.nom;
      b.type = 'button';
      b.setAttribute('aria-pressed', String(p.nom === etat.profil));
      b.addEventListener('click', function () {
        if (p.nom === etat.profil) return;
        api('PUT', 'ula/profil', { nom: p.nom }).then(charger).catch(afficherErreur);
      });
      liste.appendChild(b);
    });
    s.appendChild(liste);
    s.appendChild(el('p', 'ula-note', etat.profil ? T('profil.actif', { nom: etat.profil }) : T('profil.choisir')));
    var act2 = el('div', 'ula-actions');
    act2.appendChild(
      bouton(T('profil.nouveau'), 'discret', function () {
        return creerProfil('');
      }),
    );
    if (etat.profil)
      act2.appendChild(
        bouton(T('profil.renommer', { nom: etat.profil }), 'discret', function () {
          return demander({
            titre: T('profil.renommerTitre'),
            champs: [{ nom: 'nom', libelle: T('profil.nouveauNom'), valeur: etat.profil }],
            ok: T('profil.renommerOk'),
          }).then(function (r) {
            if (r) return api('POST', 'ula/profils/renommer', { ancien: etat.profil, nouveau: r.nom }).then(charger);
          });
        }),
      );
    if (etat.profil)
      act2.appendChild(
        bouton(T('profil.ouvrirDossier'), 'discret', function () {
          return api('POST', 'ula/ouvrir', { chemin: etat.profil });
        }),
      );
    s.appendChild(act2);
    return s;
  }

  // Cursus exemples du catalogue en ligne (liste vide si le catalogue ne répond pas)
  function cursusExemples() {
    return api('GET', 'ula/catalogue')
      .then(function (c) {
        catalogue = catalogue || c;
        return c.cursus || [];
      })
      .catch(function () {
        return [];
      });
  }

  function creerProfil(valeur) {
    return cursusExemples().then(function (liste) {
      var options = [{ valeur: '', texte: T('profil.aucunCursus') }].concat(
        liste.map(function (c) {
          return {
            valeur: c.id,
            texte: T('profil.cursusChoix', { titre: c.titre, n: c.nombre, taille: taille(c.taille) }),
          };
        }),
      );
      return demander({
        titre: T('profil.nouveauTitre'),
        texte: T('profil.nouveauTexte') + (liste.length ? '' : '\n' + T('profil.horsLigne')),
        champs: [
          { nom: 'nom', libelle: T('profil.nomAria'), valeur: valeur || '' },
          { nom: 'cursus', libelle: T('profil.cursusAria'), choix: options },
          { nom: 'telecharger', libelle: T('profil.telecharger'), case: true, valeur: true },
        ],
        ok: T('profil.creerOk'),
      }).then(function (r) {
        if (r) return creerProfil2(r.nom, r.cursus, r.telecharger);
      });
    });
  }

  function creerProfil2(nom, cursus, telecharger) {
    return api('POST', 'ula/profils', { nom: nom, cursus: cursus || null, telecharger: telecharger !== false }).then(
      function (r) {
        return charger().then(function () {
          return compteRenduCursus(r.cursusExemple);
        });
      },
    );
  }

  function compteRenduCursus(x) {
    if (!x) return;
    if (x.erreur) return demander({ titre: T('profil.cree'), texte: x.erreur, seulementOk: true });
    if (x.telechargement) suivreTravail();
    var texte = Tn('cursus.pret', x.cours, {
      titre: x.titre,
      dossiers: x.dossiers
        .map(function (d) {
          return d.split('/').pop();
        })
        .join(', '),
    });
    if (x.telechargement) texte += '\n' + Tn('cursus.telechargement', x.aTelecharger);
    else if (x.aTelecharger) texte += '\n' + Tn('cursus.restants', x.aTelecharger);
    return demander({ titre: T('cursus.pretTitre'), texte: texte, seulementOk: true });
  }

  // Bandeau des téléchargements en arrière-plan (cursus exemple, « Tout télécharger »)
  var suivi = null;
  function suivreTravail() {
    if (suivi) return;
    var bandeau = el('p', 'ula-attente');
    bandeau.id = 'ula-travail';
    main.insertBefore(bandeau, main.querySelector('section'));
    suivi = setInterval(function () {
      api('GET', 'ula/catalogue/travail')
        .then(function (t) {
          var b = document.getElementById('ula-travail') || bandeau;
          if (!b.isConnected) main.insertBefore(b, main.querySelector('section'));
          if (t.actif) {
            b.textContent =
              T('travail.progression', { fait: t.faits + t.deja, total: t.total }) +
              (t.enCours ? ' · ' + t.enCours + '…' : '');
            return;
          }
          clearInterval(suivi);
          suivi = null;
          b.remove();
          charger().then(function () {
            if (t.erreurs && t.erreurs.length)
              demander({
                titre: T('travail.incompletTitre'),
                texte: Tn('travail.incomplet', t.erreurs.length, {
                  liste: t.erreurs
                    .map(function (e) {
                      return e.id + ' : ' + e.erreur;
                    })
                    .join('\n- '),
                }),
                seulementOk: true,
              });
          });
        })
        .catch(function () {});
    }, 1500);
  }

  /* -- Cursus ---------------------------------------------------------------------- */

  function dossiers(n, liste) {
    liste = liste || [];
    if (n.type === 'profil' || n.type === 'dossier') {
      liste.push(n.chemin);
      (n.enfants || []).forEach(function (e) {
        dossiers(e, liste);
      });
    }
    return liste;
  }
  function libelleDossier(chemin) {
    var segs = chemin.split('/');
    return segs.length === 1 ? T('cursus.racine') : segs.slice(1).join(' › ');
  }

  function resumeProgression(id) {
    var m = progression[id];
    if (!m) return '';
    var faits = m.quiz.filter(function (q) {
      return q.tentatives && q.tentatives.nombre;
    }).length;
    var t = (m.travaux || []).filter(function (x) {
      return x.commences;
    }).length;
    var parts = [];
    if (m.quiz.length) parts.push(T('cursus.quizFaits', { faits: faits, total: m.quiz.length }));
    if ((m.travaux || []).length) parts.push(T('cursus.tdCommences', { faits: t, total: m.travaux.length }));
    return parts.join(' · ');
  }

  // Menu « ⋯ » d'un bloc ou d'un cours : les actions rares (renommer, déplacer…)
  // restent à portée sans encombrer les boutons des cours
  function menuActions(boutons, libelle) {
    var d = el('details', 'ula-menu');
    var s = el('summary', 'ula-menu-bouton', '⋯');
    s.title = libelle || T('cursus.actions');
    s.setAttribute('aria-label', libelle || T('cursus.actions'));
    d.appendChild(s);
    var liste = el('div', 'ula-menu-liste');
    boutons.forEach(function (b) {
      b.addEventListener('click', function () {
        d.open = false;
      });
      liste.appendChild(b);
    });
    d.appendChild(liste);
    return d;
  }
  document.addEventListener('click', function (e) {
    document.querySelectorAll('details.ula-menu[open]').forEach(function (d) {
      if (!d.contains(e.target)) d.open = false;
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape')
      document.querySelectorAll('details.ula-menu[open]').forEach(function (d) {
        d.open = false;
      });
  });

  // Actions d'un dossier, d'un cours ou d'un cours de l'espace (menu « ⋯ »)
  function actionsNoeud(n) {
    var b = [];
    if (n.type === 'dossier') {
      b.push(
        bouton(T('cursus.ajouterCours'), null, function () {
          return ajouterCours(null, n.chemin);
        }),
      );
      b.push(
        bouton(T('cursus.sousDossier'), null, function () {
          return nouveauDossier(n.chemin);
        }),
      );
    }
    if (n.type === 'perso')
      b.push(
        bouton(T('cursus.soumettre'), null, function () {
          return soumettre(n);
        }),
      );
    b.push(
      bouton(T('cursus.renommer'), null, function () {
        return demander({
          titre: T('cursus.renommerTitre'),
          champs: [{ nom: 'nom', libelle: T('profil.nouveauNom'), valeur: n.nom }],
          ok: T('profil.renommerOk'),
        }).then(function (r) {
          if (r) return api('POST', 'ula/cursus/renommer', { chemin: n.chemin, nom: r.nom }).then(charger);
        });
      }),
    );
    b.push(
      bouton(T('cursus.deplacer'), null, function () {
        var choix = dossiers(cursus.arbre)
          .filter(function (d) {
            return (
              d !== n.chemin && d.indexOf(n.chemin + '/') !== 0 && d !== n.chemin.split('/').slice(0, -1).join('/')
            );
          })
          .map(function (d) {
            return { valeur: d, texte: libelleDossier(d) };
          });
        if (!choix.length)
          return demander({ titre: T('cursus.deplacerTitre'), texte: T('cursus.deplacerAucun'), seulementOk: true });
        return demander({
          titre: T('cursus.deplacerNom', { nom: n.nom }),
          champs: [{ nom: 'vers', libelle: T('cursus.versDossier'), choix: choix }],
          ok: T('cursus.deplacerOk'),
        }).then(function (r) {
          if (r) return api('POST', 'ula/cursus/deplacer', { chemin: n.chemin, vers: r.vers }).then(charger);
        });
      }),
    );
    b.push(
      bouton(T('cursus.retirer'), null, function () {
        return demander({
          titre: T('cursus.retirerTitre', { nom: n.nom }),
          texte: n.type === 'lien' ? T('cursus.retirerCours') : T('cursus.retirerDossier'),
          ok: T('cursus.retirerOk'),
        }).then(function (r) {
          if (r) return api('POST', 'ula/cursus/retirer', { chemin: n.chemin }).then(charger);
        });
      }),
    );
    b.push(
      bouton(T('cursus.ouvrirDossier'), null, function () {
        return api('POST', 'ula/ouvrir', { chemin: n.chemin });
      }),
    );
    return b;
  }

  // Bouton de cours : pastille de la couleur de la matière, titre, ligne d'état.
  // Avec href, le cours s'ouvre ; avec action (cours absent : téléchargement), elle
  // est lancée au clic.
  function boutonCours(o) {
    var x = o.href ? lien('', o.href, 'ula-cours-bouton') : el('button', 'ula-cours-bouton');
    if (!o.href) x.type = 'button';
    if (o.teinte) x.dataset.matiere = o.teinte;
    if (o.absent) x.classList.add('absent');
    x.appendChild(el('span', 'ula-pastille'));
    var t = el('span', 'ula-cours-texte');
    t.appendChild(el('span', 'ula-cours-titre', o.titre));
    if (o.info) t.appendChild(el('span', 'ula-cours-info', o.info));
    x.appendChild(t);
    if (o.action) {
      x.addEventListener('click', function () {
        if (x.disabled) return;
        x.disabled = true;
        Promise.resolve()
          .then(o.action)
          .catch(afficherErreur)
          .then(function () {
            x.disabled = false;
          });
      });
    } else if (!o.href) x.disabled = true;
    return x;
  }

  function itemCursus(n) {
    var li = el('li', 'ula-item');
    var b;
    if (n.type === 'lien') {
      var c = coursInstalle(n.cours);
      if (c) {
        var info = resumeProgression(n.cours);
        b = boutonCours({
          titre: c.titre,
          teinte: c.teinte,
          info: info || (c.accueil ? '' : T('cursus.infoOuvrirDossier')),
          href: c.accueil ? urlPage(c.accueil) : null,
          action: c.accueil
            ? null
            : function () {
                return api('POST', 'ula/ouvrir', { chemin: c.chemin });
              },
        });
      } else {
        b = boutonCours({
          titre: n.nom,
          absent: true,
          info: etat.source ? T('cursus.absentExplore') : T('cursus.aTelecharger'),
          action: etat.source
            ? null
            : function () {
                return api('POST', 'ula/catalogue/installer-tout', { ids: [n.cours] }).then(suivreTravail);
              },
        });
      }
    } else {
      b = boutonCours({
        titre: n.nom,
        info: T('cursus.coursEspace'),
        href: urlPage(n.chemin + '/generated_courses/index.html'),
      });
    }
    li.appendChild(b);
    li.appendChild(menuActions(actionsNoeud(n), T('cursus.actionsSur', { nom: n.nom })));
    return li;
  }

  function nombreCours(n) {
    var k = 0;
    (function p(x) {
      (x.enfants || []).forEach(function (e) {
        if (e.type === 'dossier') p(e);
        else k++;
      });
    })(n);
    return k;
  }

  // En-tête d'un bloc : titre, ligne d'information, menu « ⋯ » éventuel
  function teteBloc(niveau, titre, info, menu) {
    var tete = el('div', 'ula-bloc-tete');
    var titres = el('div', 'ula-bloc-titres');
    titres.appendChild(el(niveau, null, titre));
    if (info) titres.appendChild(el('p', 'ula-cours-info', info));
    tete.appendChild(titres);
    if (menu) tete.appendChild(menu);
    return tete;
  }

  // Grilles de blocs sans trous : la grille extérieure a des colonnes de la largeur
  // d'un bouton de cours ; chaque bloc s'étend sur autant de colonnes qu'il a de cours
  // (toute la largeur au plus), et ses boutons se rangent sur ce même nombre de
  // colonnes. Un gros dossier occupe une bande entière, les petits se placent côte à
  // côte ; le dernier bloc d'une ligne s'élargit jusqu'au bord : ni trou, ni bloc
  // court à côté d'un bloc haut, et l'ordre est gardé.
  var observateur = window.ResizeObserver
    ? new ResizeObserver(function (entrees) {
        entrees.forEach(function (e) {
          repartir(e.target);
        });
      })
    : null;
  function repartir(grille) {
    var colonnes = getComputedStyle(grille).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    var ligne = 0,
      dernier = null;
    function etendre(b, place) {
      if (b && place > 0) b.style.gridColumn = 'span ' + (parseInt(b.dataset.span, 10) + place);
    }
    Array.prototype.forEach.call(grille.children, function (b) {
      var n = Math.max(1, Math.min(colonnes, parseInt(b.dataset.cours, 10) || 1));
      // Le bloc ne tient plus sur la ligne : le précédent s'élargit jusqu'au bord,
      // et celui-ci ouvre la ligne suivante (l'ordre du cursus est gardé)
      if (ligne + n > colonnes) {
        etendre(dernier, colonnes - ligne);
        ligne = 0;
      }
      b.dataset.span = n;
      b.style.gridColumn = 'span ' + n;
      b.style.setProperty('--colonnes', n);
      ligne += n;
      dernier = b;
      if (ligne === colonnes) {
        ligne = 0;
        dernier = null;
      }
    });
    etendre(dernier, ligne ? colonnes - ligne : 0);
  }
  function ajusterBlocs(grille) {
    requestAnimationFrame(function () {
      repartir(grille);
    });
    if (observateur) observateur.observe(grille);
    else
      window.addEventListener('resize', function () {
        repartir(grille);
      });
  }

  // Bloc d'un dossier du cursus : ses cours en grille de boutons, puis ses sous-dossiers
  function blocDossier(n, sous) {
    var bloc = el(sous ? 'div' : 'li', sous ? 'ula-sous-bloc' : 'ula-bloc');
    var k = nombreCours(n);
    if (!sous) bloc.dataset.cours = k;
    bloc.appendChild(
      teteBloc(
        sous ? 'h4' : 'h3',
        n.nom,
        Tn('cursus.nbCours', k),
        menuActions(actionsNoeud(n), T('cursus.actionsDossier', { nom: n.nom })),
      ),
    );
    var enfants = n.enfants || [];
    var cours = enfants.filter(function (e) {
      return e.type !== 'dossier';
    });
    if (cours.length) {
      var ul = el('ul', 'ula-boutons');
      cours.forEach(function (e) {
        ul.appendChild(itemCursus(e));
      });
      bloc.appendChild(ul);
    }
    enfants
      .filter(function (e) {
        return e.type === 'dossier';
      })
      .forEach(function (d) {
        bloc.appendChild(blocDossier(d, true));
      });
    if (!enfants.length) bloc.appendChild(el('p', 'ula-note', T('cursus.dossierVide')));
    return bloc;
  }

  function sectionCursus() {
    var s = el('section');
    s.id = 'cursus-section';
    s.appendChild(el('h2', null, T('cursus.titre')));
    var a = cursus.arbre;
    if (!a || !a.enfants.length) {
      s.appendChild(el('p', null, T('cursus.vide')));
    } else {
      var blocs = el('ul', 'ula-blocs ula-adaptatif');
      // Les cours rangés à la racine de l'espace forment leur propre bloc, en tête
      var aLaRacine = a.enfants.filter(function (e) {
        return e.type !== 'dossier';
      });
      if (aLaRacine.length) {
        var r = el('li', 'ula-bloc');
        r.appendChild(teteBloc('h3', T('cursus.horsDossier'), Tn('cursus.nbCours', aLaRacine.length), null));
        var ul = el('ul', 'ula-boutons');
        aLaRacine.forEach(function (e) {
          ul.appendChild(itemCursus(e));
        });
        r.appendChild(ul);
        r.dataset.cours = aLaRacine.length;
        blocs.appendChild(r);
      }
      // Un dossier sans aucun cours mais qui contient des fichiers (papiers, logiciel…)
      // n'est pas une partie du cursus : il ne prend pas de bloc, juste un bouton discret
      var autres = [];
      a.enfants
        .filter(function (e) {
          return e.type === 'dossier';
        })
        .forEach(function (d) {
          if (!nombreCours(d) && (d.fichiers || d.sousDossiers || (d.enfants || []).length)) autres.push(d);
          else blocs.appendChild(blocDossier(d, false));
        });
      if (blocs.childNodes.length) {
        s.appendChild(blocs);
        ajusterBlocs(blocs);
      }
      if (autres.length) {
        var ligne = el('div', 'ula-actions ula-autres');
        ligne.appendChild(el('span', 'ula-cours-info', T('cursus.autresDossiers')));
        autres.forEach(function (d) {
          ligne.appendChild(
            bouton(d.nom, 'discret', function () {
              return api('POST', 'ula/ouvrir', { chemin: d.chemin });
            }),
          );
        });
        s.appendChild(ligne);
      }
    }
    var act = el('div', 'ula-actions');
    var manquants = [];
    (function p(n) {
      if (n && n.type === 'lien' && !coursInstalle(n.cours)) manquants.push(n.cours);
      ((n && n.enfants) || []).forEach(p);
    })(a);
    if (manquants.length && !etat.source)
      act.appendChild(
        bouton(Tn('cursus.toutTelecharger', manquants.length), 'principal', function () {
          return api('POST', 'ula/catalogue/installer-tout', { ids: manquants }).then(suivreTravail);
        }),
      );
    act.appendChild(
      bouton(T('cursus.plusDossier'), null, function () {
        return nouveauDossier(etat.profil);
      }),
    );
    act.appendChild(
      bouton(T('cursus.plusCours'), null, function () {
        return ajouterCours(null, etat.profil);
      }),
    );
    s.appendChild(act);
    return s;
  }

  function nouveauDossier(parent) {
    return demander({
      titre: T('cursus.nouveauDossier'),
      texte: T('cursus.dans', { dossier: libelleDossier(parent) }),
      champs: [{ nom: 'nom', libelle: T('cursus.nomDossier') }],
      ok: T('cursus.creer'),
    }).then(function (r) {
      if (r) return api('POST', 'ula/cursus/dossier', { parent: parent, nom: r.nom }).then(charger);
    });
  }

  function ajouterCours(id, dossier) {
    if (!etat.profil)
      return demander({ titre: T('cursus.ajouterTitre'), texte: T('cursus.choisirProfil'), seulementOk: true });
    var champs = [];
    if (!id) {
      var dejaLa = {};
      (function p(n) {
        if (n.type === 'lien') dejaLa[n.cours] = true;
        (n.enfants || []).forEach(p);
      })(cursus.arbre || {});
      var choix = etat.cours
        .filter(function (c) {
          return !dejaLa[c.id];
        })
        .map(function (c) {
          return { valeur: c.id, texte: nomDomaine(c.domaine) + ' · ' + c.titre };
        });
      if (!choix.length)
        return demander({ titre: T('cursus.ajouterTitre'), texte: T('cursus.tousDeja'), seulementOk: true });
      champs.push({ nom: 'cours', libelle: T('cursus.coursInstalle'), choix: choix });
    }
    if (!dossier)
      champs.push({
        nom: 'dossier',
        libelle: T('cursus.dansDossier'),
        choix: dossiers(cursus.arbre).map(function (d) {
          return { valeur: d, texte: libelleDossier(d) };
        }),
      });
    return demander({
      titre: T('cursus.ajouterMonCursus'),
      texte: dossier ? T('cursus.dans', { dossier: libelleDossier(dossier) }) : '',
      champs: champs,
      ok: T('cursus.ajouter'),
    }).then(function (r) {
      if (r)
        return api('POST', 'ula/cursus/ajouter', { cours: id || r.cours, dossier: dossier || r.dossier }).then(charger);
    });
  }

  /* -- Soumissions de cours (« Soumettre ce cours », « Mes soumissions ») --------------- */

  var soumissions = [];
  var ACTIFS = { verification: 1, correction: 1, envoi: 1 };
  var OUTILS_IA = ['', 'Claude', 'ChatGPT', 'Gemini', 'other'];

  function duree(ms) {
    if (ms == null) return '';
    var m = Math.round(ms / 60000);
    return m < 1
      ? Math.max(1, Math.round(ms / 1000)) + ' s'
      : m < 60
        ? m + ' min'
        : Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  }
  function dateHeure(iso) {
    try {
      return new Date(iso).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
      return iso;
    }
  }

  function resumeGenerations(g, court) {
    if (!g.length) return T(court ? 'soumettre.aucuneMesureCourt' : 'soumettre.aucuneMesure');
    var ia = {};
    var total = 0;
    g.forEach(function (x) {
      var cle = (x.fournisseur || '?') + (x.modele ? ' · ' + x.modele : '') + (x.effort ? ' · ' + x.effort : '');
      ia[cle] = (ia[cle] || 0) + 1;
      total += x.dureeMs || 0;
    });
    return T(court ? 'soumettre.mesuresCourt' : 'soumettre.mesures', {
      n: g.length,
      ia: Object.keys(ia)
        .map(function (k) {
          return k + ' (' + ia[k] + ')';
        })
        .join(', '),
      duree: duree(total),
    });
  }

  function soumettre(n) {
    return api('GET', 'ula/soumissions/apercu?chemin=' + encodeURIComponent(n.chemin)).then(function (a) {
      var f = a.fiche || {};
      return demander({
        titre: T('soumettre.titre', { nom: n.nom }),
        texte: T('soumettre.texte') + '\n\n' + resumeGenerations(a.generations || []),
        champs: [
          { nom: 'titre', libelle: T('proposer.titreCours'), valeur: f.titre || n.nom },
          {
            nom: 'domaine',
            libelle: T('proposer.domaine'),
            valeur: f.domaine,
            choix: DOMAINES.map(function (k) {
              return { valeur: k, texte: nomDomaine(k) };
            }),
          },
          { nom: 'niveau', libelle: T('proposer.niveau'), valeur: f.niveau },
          { nom: 'origine', libelle: T('proposer.origine'), valeur: f.origine },
          { nom: 'description', libelle: T('proposer.description'), valeur: f.description, long: true },
          {
            nom: 'outil',
            libelle: T('soumettre.outil'),
            choix: OUTILS_IA.map(function (k) {
              return {
                valeur: k,
                texte: k === '' ? T('soumettre.outilAucun') : k === 'other' ? T('soumettre.outilAutre') : k,
              };
            }),
          },
          { nom: 'modele', libelle: T('soumettre.modele') },
          { nom: 'effort', libelle: T('soumettre.effort') },
          { nom: 'duree', libelle: T('soumettre.duree') },
          { nom: 'ressources', libelle: T('soumettre.ressources'), long: true },
          { nom: 'notes', libelle: T('soumettre.notes'), long: true },
          { nom: 'pseudonyme', libelle: T('soumettre.pseudonyme') },
          { nom: 'licence', libelle: T('soumettre.licence'), case: true, valeur: false },
        ],
        ok: T('soumettre.verifier'),
      }).then(function (r) {
        if (!r) return;
        return api('POST', 'ula/soumissions', {
          chemin: n.chemin,
          infos: {
            titre: r.titre,
            domaine: r.domaine,
            niveau: r.niveau,
            origine: r.origine,
            description: r.description,
          },
          declare: {
            outil: r.outil,
            modele: r.modele,
            effort: r.effort,
            duree: r.duree,
            ressources: r.ressources,
            notes: r.notes,
          },
          pseudonyme: r.pseudonyme,
          licence: r.licence === true,
        }).then(function () {
          montrerCadre();
          return chargerSoumissions();
        });
      });
    });
  }

  function chargerSoumissions() {
    return api('GET', 'ula/soumissions')
      .then(function (r) {
        soumissions = r.soumissions || [];
        var ancienne = document.getElementById('soumissions');
        var nouvelle = sectionSoumissions();
        if (ancienne && nouvelle) ancienne.replaceWith(nouvelle);
        else if (ancienne) ancienne.remove();
        else if (nouvelle) {
          var apres = document.getElementById('cursus-section');
          if (apres && apres.nextSibling) main.insertBefore(nouvelle, apres.nextSibling);
          else main.appendChild(nouvelle);
        }
        ouvrirDepuisAncre();
        suivreSoumissions();
      })
      .catch(function () {});
  }

  var suiviSoumissions = null;
  function suivreSoumissions() {
    clearTimeout(suiviSoumissions);
    if (
      soumissions.some(function (x) {
        return ACTIFS[x.etat];
      })
    )
      suiviSoumissions = setTimeout(chargerSoumissions, 1500);
  }

  function agirSoumission(id, action) {
    return api('POST', 'ula/soumissions/' + id + '/action', { action: action }).then(function () {
      montrerCadre();
      return chargerSoumissions();
    });
  }

  function sectionSoumissions() {
    if (!soumissions.length) return null;
    var s = el('section');
    s.id = 'soumissions';
    s.appendChild(el('h2', null, T('soumissions.titre')));
    s.appendChild(el('p', 'ula-note', T('soumissions.aide')));
    soumissions.forEach(function (x) {
      s.appendChild(carteSoumission(x));
    });
    return s;
  }

  function carteSoumission(x) {
    var d = el('details', 'ula-soumission');
    d.id = 'soumission-' + x.id;
    d.dataset.etat = x.etat;
    if (ouvertes[x.id] || ACTIFS[x.etat] || x.etat === 'suspendue' || x.cadre) d.open = true;
    d.addEventListener('toggle', function () {
      ouvertes[x.id] = d.open;
    });
    var sum = el('summary');
    sum.appendChild(el('span', 'ula-soumission-titre', x.fiche.titre));
    sum.appendChild(el('span', 'ula-etat ula-etat-' + x.etat, T('etatSoumission.' + x.etat)));
    sum.appendChild(el('span', 'ula-note', dateHeure(x.cree)));
    d.appendChild(sum);

    // Suspendue : les trois choix
    if (x.etat === 'suspendue' && x.suspension) {
      var b = el('div', 'ula-suspension');
      b.appendChild(
        el('p', null, T(x.suspension.raison === 'python' ? 'soumissions.python' : 'soumissions.suspendue')),
      );
      var ul = el('ul');
      x.suspension.problemes.slice(0, 15).forEach(function (p) {
        ul.appendChild(el('li', null, p));
      });
      if (x.suspension.problemes.length > 15)
        ul.appendChild(el('li', null, T('soumissions.etAutres', { n: x.suspension.problemes.length - 15 })));
      b.appendChild(ul);
      var actions = el('div', 'ula-actions');
      if (x.suspension.raison === 'python') {
        var py = lien(T('soumissions.installerPython'), 'https://www.python.org/downloads/', 'ula-bouton principal');
        py.target = '_blank';
        py.rel = 'noopener';
        actions.appendChild(py);
      } else
        actions.appendChild(
          bouton(T('soumissions.corrigerIa'), 'principal', function () {
            return agirSoumission(x.id, 'corriger-ia');
          }),
        );
      actions.appendChild(
        bouton(T('soumissions.reverifier'), null, function () {
          return agirSoumission(x.id, 'reverifier');
        }),
      );
      actions.appendChild(
        bouton(T('soumissions.annuler'), null, function () {
          return demander({
            titre: T('soumissions.annulerTitre'),
            texte: T('soumissions.annulerTexte'),
            ok: T('soumissions.annuler'),
          }).then(function (ok) {
            if (ok) return agirSoumission(x.id, 'annuler');
          });
        }),
      );
      b.appendChild(actions);
      d.appendChild(b);
    }
    if (x.etat === 'prete') {
      var pr = el('div', x.erreurEnvoi ? 'ula-suspension' : null);
      pr.appendChild(
        el(
          'p',
          x.erreurEnvoi ? null : 'ula-note',
          x.erreurEnvoi ? T('soumissions.erreurEnvoi', { erreur: x.erreurEnvoi }) : T('soumissions.prete'),
        ),
      );
      var ap = el('div', 'ula-actions');
      if (x.erreurEnvoi) {
        ap.appendChild(
          bouton(T('soumissions.reessayer'), 'principal', function () {
            return agirSoumission(x.id, 'envoyer');
          }),
        );
        ap.appendChild(
          bouton(T('soumissions.exporter'), null, function () {
            return agirSoumission(x.id, 'exporter');
          }),
        );
      }
      ap.appendChild(
        bouton(T('soumissions.annuler'), null, function () {
          return agirSoumission(x.id, 'annuler');
        }),
      );
      pr.appendChild(ap);
      d.appendChild(pr);
    }
    if (x.distant) {
      var ds = el('div', 'ula-distant');
      ds.appendChild(el('p', null, T('soumissions.numero', { id: x.distant.id, etat: T('etatSoumission.' + x.etat) })));
      if (x.distant.analyse && x.distant.analyse.recommandation)
        ds.appendChild(
          el(
            'p',
            null,
            T('soumissions.analyse', {
              ia: x.distant.analyse.ia || '',
              recommandation: T('recommandation.' + x.distant.analyse.recommandation),
            }) + (x.distant.analyse.resume ? ' ' + x.distant.analyse.resume : ''),
          ),
        );
      if (x.distant.message)
        ds.appendChild(el('p', 'ula-message', T('soumissions.message', { message: x.distant.message })));
      if (x.distant.verifie)
        ds.appendChild(el('p', 'ula-note', T('soumissions.verifie', { date: dateHeure(x.distant.verifie) })));
      var ad = el('div', 'ula-actions');
      ad.appendChild(
        bouton(T('soumissions.actualiser'), null, function () {
          return agirSoumission(x.id, 'actualiser');
        }),
      );
      ds.appendChild(ad);
      d.appendChild(ds);
    }
    if (x.etat === 'correction' && x.correction) {
      var c = el('div', 'ula-suspension');
      c.appendChild(el('p', null, T('soumissions.correction')));
      if (x.correction.journal && x.correction.journal.length)
        c.appendChild(el('p', 'ula-note', x.correction.journal[x.correction.journal.length - 1]));
      d.appendChild(c);
    }

    // Étapes de la vérification
    if (x.etapes && x.etapes.length) {
      d.appendChild(el('h3', null, T('soumissions.verification')));
      var ol = el('ol', 'ula-etapes');
      x.etapes.forEach(function (e) {
        var li = el('li');
        li.dataset.etat = e.etat;
        li.appendChild(el('span', 'ula-etape-nom', e.libelle));
        li.appendChild(el('span', 'ula-note', T('etatEtape.' + e.etat)));
        if (e.detail && e.detail.length) {
          var dd = el('details');
          dd.appendChild(el('summary', null, T('soumissions.detail', { n: e.detail.length })));
          var pre = el('pre', null, e.detail.join('\n'));
          dd.appendChild(pre);
          li.appendChild(dd);
        }
        ol.appendChild(li);
      });
      d.appendChild(ol);
    }

    // Informations envoyées avec le cours
    d.appendChild(el('h3', null, T('soumissions.infos')));
    var m = x.manifeste || {};
    var dl = el('dl', 'ula-infos');
    function ligne(k, v) {
      if (v == null || v === '') return;
      dl.appendChild(el('dt', null, T(k)));
      dl.appendChild(el('dd', null, v));
    }
    ligne('proposer.domaine', nomDomaine(x.fiche.domaine));
    ligne('proposer.niveau', x.fiche.niveau);
    ligne('soumettre.pseudonyme', m.pseudonyme);
    var dec = m.declare || {};
    ligne('soumettre.outil', dec.outil === 'other' ? T('soumettre.outilAutre') : dec.outil);
    ligne('soumettre.modele', dec.modele);
    ligne('soumettre.effort', dec.effort);
    ligne('soumettre.duree', dec.duree);
    ligne('soumettre.ressources', dec.ressources);
    ligne('soumettre.notes', dec.notes);
    ligne('soumissions.mesurees', resumeGenerations(m.generations || [], true));
    d.appendChild(dl);
    if ((m.generations || []).length) {
      var t = el('table', 'ula-generations');
      var th = el('tr');
      [
        'soumissions.colFichier',
        'soumissions.colIa',
        'soumissions.colModele',
        'soumissions.colEffort',
        'soumissions.colDuree',
        'soumissions.colRessources',
      ].forEach(function (k) {
        th.appendChild(el('th', null, T(k)));
      });
      t.appendChild(th);
      m.generations.forEach(function (g) {
        var tr = el('tr');
        [g.fichier, g.fournisseur, g.modele, g.effort, duree(g.dureeMs), (g.ressources || []).join(', ')].forEach(
          function (v) {
            tr.appendChild(el('td', null, v == null ? '' : String(v)));
          },
        );
        t.appendChild(tr);
      });
      d.appendChild(t);
    }

    // Historique complet
    d.appendChild(el('h3', null, T('soumissions.historique')));
    var h = el('ol', 'ula-historique');
    x.historique
      .slice()
      .reverse()
      .forEach(function (e) {
        var li = el('li');
        li.appendChild(el('time', 'ula-note', dateHeure(e.date)));
        li.appendChild(el('span', null, ' ' + e.texte));
        h.appendChild(li);
      });
    d.appendChild(h);
    return d;
  }

  var ouvertes = {};
  function ouvrirDepuisAncre() {
    var m = location.hash.match(/^#soumission=([\w-]+)/);
    if (!m) return;
    var d = document.getElementById('soumission-' + decodeURIComponent(m[1]));
    if (!d) return;
    d.open = true;
    ouvertes[m[1]] = true;
    d.scrollIntoView({ block: 'start' });
    history.replaceState(null, '', location.pathname + location.search);
  }
  window.addEventListener('hashchange', ouvrirDepuisAncre);

  // Cadre en bas à droite : l'application installée le pose elle-même sur la fenêtre ;
  // ailleurs (navigateur, outils seuls), l'accueil le montre dans une iframe
  var cadre = null;
  function montrerCadre() {
    if (/\bStudiesApp\//.test(navigator.userAgent) || domaineSeul) return;
    if (cadre) {
      cadre.contentWindow.location.reload();
      cadre.hidden = false;
      return;
    }
    cadre = el('iframe', 'ula-cadre');
    cadre.title = T('cadre.titre');
    cadre.src = '/_outils/ula/cadre-soumission.html';
    document.body.appendChild(cadre);
  }
  window.addEventListener('message', function (e) {
    if (!cadre || e.source !== cadre.contentWindow || !e.data || e.data.ula !== 'cadre') return;
    if (e.data.type === 'taille') {
      cadre.hidden = false;
      cadre.style.height = Math.min(Number(e.data.hauteur) || 200, window.innerHeight - 24) + 'px';
    } else if (e.data.type === 'masquer') cadre.hidden = true;
    else if (e.data.type === 'ouvrir') {
      location.hash = e.data.hash;
      ouvrirDepuisAncre();
    }
  });

  /* -- Cours installés ---------------------------------------------------------------- */

  function sectionCours(domaine) {
    var s = el('section');
    s.appendChild(el('h2', null, T('explorer.cours')));
    remplirCours(s, domaine);
    return s;
  }

  // Cours installés sur ce poste (d'un domaine, ou tous, rangés par domaine)
  function coursDejaDansCursus() {
    var dejaLa = {};
    (function p(n) {
      if (n && n.type === 'lien') dejaLa[n.cours] = true;
      ((n && n.enfants) || []).forEach(p);
    })(cursus && cursus.arbre);
    return dejaLa;
  }

  function remplirCours(s, domaine) {
    var cours = etat.cours.filter(function (c) {
      return !domaine || c.domaine === domaine;
    });
    if (!cours.length) {
      s.appendChild(el('p', null, domaine ? T('explorer.aucunDomaine') : T('explorer.aucun')));
      return s;
    }
    var parDomaine = {};
    cours.forEach(function (c) {
      (parDomaine[c.domaine] = parDomaine[c.domaine] || []).push(c);
    });
    var dejaLa = coursDejaDansCursus();
    Object.keys(parDomaine).forEach(function (d) {
      if (!domaine) s.appendChild(el('h3', null, nomDomaine(d)));
      var ul = el('ul', 'ula-cartes');
      parDomaine[d].forEach(function (c) {
        var li = el('li', 'ula-carte');
        if (c.teinte) li.dataset.matiere = c.teinte;
        var h = el('h3');
        h.appendChild(c.accueil ? lien(c.titre, urlPage(c.accueil)) : document.createTextNode(c.titre));
        li.appendChild(h);
        li.appendChild(el('p', 'ula-cours-info', [c.niveau, c.origine].filter(Boolean).join(' · ')));
        if (c.description)
          li.appendChild(
            el('p', 'ula-note', c.description.length > 180 ? c.description.slice(0, 177) + '…' : c.description),
          );
        var act = el('div', 'ula-actions');
        if (etat && etat.profil) {
          if (dejaLa[c.id]) act.appendChild(el('span', 'ula-etat', T('explorer.dansCursus')));
          else
            act.appendChild(
              bouton(T('explorer.ajouter'), 'petit', function () {
                return ajouterCours(c.id, null);
              }),
            );
        }
        if (!c.accueil)
          act.appendChild(
            bouton(T('cursus.ouvrirDossier'), 'discret', function () {
              return api('POST', 'ula/ouvrir', { chemin: c.chemin });
            }),
          );
        li.appendChild(act);
        ul.appendChild(li);
      });
      s.appendChild(ul);
    });
    return s;
  }

  /* -- Catalogue en ligne ------------------------------------------------------------------ */

  // Catalogue : un seul endroit pour les cours, en deux vues. « Installés » : les cours
  // déjà sur ce poste (ouvrir, ajouter au cursus) ; « Tous les cours » : le catalogue en
  // ligne (télécharger, mettre à jour, supprimer, packs et cursus exemples).
  var vueCatalogue = null;
  function sectionCatalogue() {
    var s = el('section');
    s.id = 'catalogue';
    s.appendChild(el('h2', null, T('catalogue.titre')));
    if (etat.source) s.appendChild(el('p', 'ula-note', T('catalogue.source')));
    else s.appendChild(el('p', null, T('catalogue.intro')));
    if (!vueCatalogue) {
      try {
        vueCatalogue = localStorage.getItem('ula-vue-catalogue');
      } catch (e) {
        /* stockage indisponible */
      }
      if (vueCatalogue !== 'installes' && vueCatalogue !== 'tous')
        vueCatalogue = etat.cours.length ? 'installes' : 'tous';
    }
    var onglets = el('div', 'ula-onglets');
    onglets.setAttribute('role', 'tablist');
    var contenu = el('div');
    contenu.setAttribute('role', 'tabpanel');
    [
      ['installes', T('catalogue.vueInstalles', { n: etat.cours.length })],
      ['tous', catalogue ? T('catalogue.vueTous', { n: catalogue.cours.length }) : T('catalogue.vueTousSans')],
    ].forEach(function (o) {
      var b = el('button', 'ula-onglet', o[1]);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(o[0] === vueCatalogue));
      b.addEventListener('click', function () {
        if (vueCatalogue === o[0]) return;
        vueCatalogue = o[0];
        try {
          localStorage.setItem('ula-vue-catalogue', vueCatalogue);
        } catch (e) {
          /* stockage indisponible */
        }
        s.replaceWith(sectionCatalogue());
      });
      onglets.appendChild(b);
    });
    s.appendChild(onglets);
    s.appendChild(contenu);
    if (vueCatalogue === 'installes') {
      remplirCours(contenu, null);
      return s;
    }
    var zone = el('div');
    contenu.appendChild(zone);
    var act = el('div', 'ula-actions');
    act.appendChild(
      bouton(T('catalogue.actualiser'), 'discret', function () {
        return chargerCatalogue(zone).then(function () {
          s.replaceWith(sectionCatalogue());
        });
      }),
    );
    contenu.appendChild(act);
    if (catalogue) rendreCatalogue(zone);
    else
      chargerCatalogue(zone).then(function () {
        if (catalogue && s.isConnected) s.replaceWith(sectionCatalogue());
      });
    return s;
  }

  function chargerCatalogue(zone) {
    zone.innerHTML = '';
    zone.appendChild(el('p', 'ula-attente', T('catalogue.lecture')));
    return api('GET', 'ula/catalogue')
      .then(function (c) {
        catalogue = c;
        rendreCatalogue(zone);
      })
      .catch(function (e) {
        zone.innerHTML = '';
        zone.appendChild(el('p', 'ula-erreur', e.message));
      });
  }

  // Libellé de l'état d'un cours ou d'un pack du catalogue (vide : absent)
  var CLES_ETAT = {
    installe: 'catalogue.installe',
    maj: 'catalogue.maj',
    source: 'catalogue.sourceLocale',
    partiel: 'catalogue.partiel',
  };
  function libelleEtat(e) {
    return CLES_ETAT[e] ? T(CLES_ETAT[e]) : '';
  }

  function taille(o) {
    return T('catalogue.mo', {
      n: (o / 1e6).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    });
  }

  // Packs par niveau d'étude : en tête du catalogue
  function rendreCursus(zone) {
    if (!catalogue.cursus || !catalogue.cursus.length) return;
    zone.appendChild(el('h3', null, T('catalogue.cursusExemples')));
    var ul = el('ul', 'ula-cartes');
    catalogue.cursus.forEach(function (c) {
      var li = el('li', 'ula-carte');
      li.appendChild(el('h3', null, T('catalogue.cursus', { titre: c.titre })));
      li.appendChild(
        el(
          'p',
          'ula-cours-info',
          [
            c.origine,
            c.packs
              .map(function (x) {
                return x.dossier;
              })
              .join(', '),
            Tn('cursus.nbCours', c.nombre),
            taille(c.taille),
          ]
            .filter(Boolean)
            .join(' · '),
        ),
      );
      if (c.description) li.appendChild(el('p', 'ula-note', c.description));
      var act = el('div', 'ula-actions');
      if (etat.profil)
        act.appendChild(
          bouton(T('explorer.ajouter'), 'principal', function () {
            return demander({
              titre: T('catalogue.cursus', { titre: c.titre }),
              texte: T('catalogue.cursusTexte', {
                dossiers: c.packs
                  .map(function (x) {
                    return x.dossier;
                  })
                  .join(', '),
              }),
              champs: [{ nom: 'telecharger', libelle: T('profil.telecharger'), case: true, valeur: !catalogue.source }],
              ok: T('cursus.ajouter'),
            }).then(function (r) {
              if (r)
                return api('POST', 'ula/cursus/appliquer', { id: c.id, telecharger: r.telecharger }).then(function (x) {
                  return charger().then(function () {
                    return compteRenduCursus(x);
                  });
                });
            });
          }),
        );
      li.appendChild(act);
      ul.appendChild(li);
    });
    zone.appendChild(ul);
  }

  function rendrePacks(zone) {
    if (!catalogue.packs || !catalogue.packs.length) return;
    zone.appendChild(el('h3', null, T('catalogue.packs')));
    // Un bloc par pack : en-tête (état, titre, nombre de cours, taille, actions), puis
    // ses cours en grille de boutons : un cours installé s'ouvre, un cours absent se
    // télécharge au clic
    var parId = {};
    catalogue.cours.forEach(function (c) {
      parId[c.id] = c;
    });
    var ul = el('ul', 'ula-blocs ula-packs ula-adaptatif');
    catalogue.packs.forEach(function (p) {
      var li = el('li', 'ula-bloc');
      li.dataset.cours = p.cours.length;
      var tete = el('div', 'ula-bloc-tete');
      var titres = el('div', 'ula-bloc-titres');
      if (libelleEtat(p.etat)) titres.appendChild(el('span', 'ula-etat', libelleEtat(p.etat)));
      titres.appendChild(el('h3', null, T('catalogue.pack', { titre: p.titre })));
      titres.appendChild(
        el(
          'p',
          'ula-cours-info',
          [p.origine, Tn('cursus.nbCours', p.nombre), taille(p.taille)].filter(Boolean).join(' · '),
        ),
      );
      tete.appendChild(titres);
      li.appendChild(tete);
      if (p.description) li.appendChild(el('p', 'ula-note', p.description));
      var act = el('div', 'ula-actions');
      if (!catalogue.source && p.etat !== 'installe')
        act.appendChild(
          bouton(p.etat === 'maj' ? T('catalogue.majPack') : T('catalogue.telechargerPack'), 'principal', function () {
            return installerPack(p, zone);
          }),
        );
      if (etat.profil)
        act.appendChild(
          bouton(T('catalogue.rangerPack'), p.etat === 'installe' ? 'principal' : null, function () {
            return rangerPack(p);
          }),
        );
      if (act.childNodes.length) li.appendChild(act);
      var grille = el('ul', 'ula-boutons');
      p.cours.forEach(function (id) {
        var c = parId[id] || { id: id, titre: id, etat: 'absent', taille: 0 };
        var local = coursInstalle(id);
        var item = el('li', 'ula-item');
        if (local) {
          item.appendChild(
            boutonCours({
              titre: local.titre,
              teinte: local.teinte || c.teinte,
              info: [
                c.etat === 'maj' ? T('catalogue.infoMaj') : null,
                resumeProgression(id) || (local.accueil ? T('catalogue.ouvrir') : T('cursus.infoOuvrirDossier')),
              ]
                .filter(Boolean)
                .join(' · '),
              href: local.accueil ? urlPage(local.accueil) : null,
              action: local.accueil
                ? null
                : function () {
                    return api('POST', 'ula/ouvrir', { chemin: local.chemin });
                  },
            }),
          );
        } else {
          item.appendChild(
            boutonCours({
              titre: c.titre,
              teinte: c.teinte,
              absent: true,
              info: catalogue.source
                ? T('cursus.absentExplore')
                : T('catalogue.infoTelecharger', { taille: taille(c.taille) }),
              action: catalogue.source
                ? null
                : function () {
                    return installer(c, zone);
                  },
            }),
          );
        }
        grille.appendChild(item);
      });
      li.appendChild(grille);
      ul.appendChild(li);
    });
    zone.appendChild(ul);
    ajusterBlocs(ul);
    zone.appendChild(el('h3', null, T('catalogue.cours')));
  }

  // Télécharge les cours du pack un par un (progression globale) ; un cours en échec
  // n'arrête pas les autres, et relancer le pack ne reprend que ceux qui manquent
  function installerPack(p, zone) {
    var aFaire = catalogue.cours.filter(function (c) {
      return p.cours.indexOf(c.id) >= 0 && (c.etat === 'absent' || c.etat === 'maj');
    });
    var suivi = el('p', 'ula-attente');
    zone.insertBefore(suivi, zone.firstChild);
    var erreurs = [];
    var chaine = Promise.resolve();
    aFaire.forEach(function (c, i) {
      chaine = chaine.then(function () {
        suivi.textContent = T('catalogue.packProgression', {
          titre: p.titre,
          i: i + 1,
          n: aFaire.length,
          cours: c.titre,
          taille: taille(c.taille),
        });
        return api('POST', 'ula/catalogue/installer', { id: c.id }).catch(function (e) {
          erreurs.push(c.titre + ' : ' + e.message);
        });
      });
    });
    return chaine
      .then(function () {
        suivi.remove();
        return api('GET', 'ula/catalogue').then(function (c) {
          catalogue = c;
          return charger();
        });
      })
      .then(function () {
        if (erreurs.length)
          return demander({
            titre: T('catalogue.packIncompletTitre'),
            texte: Tn('catalogue.packIncomplet', erreurs.length, { liste: erreurs.join('\n- ') }),
            seulementOk: true,
          });
        if (etat.profil) return rangerPack(p);
      });
  }

  // Range les cours du pack dans un dossier du cursus (nom proposé : L1, L2…), sans
  // déplacer ni dupliquer ceux qui y sont déjà
  function rangerPack(p) {
    return demander({
      titre: T('catalogue.rangerTitre', { titre: p.titre }),
      texte: T('catalogue.rangerTexte', { n: p.cours.length }),
      champs: [{ nom: 'dossier', libelle: T('catalogue.dossier'), valeur: p.court || p.titre }],
      ok: T('catalogue.ranger'),
    }).then(function (r) {
      if (!r) return;
      return api('POST', 'ula/cursus/ajouter-pack', { cours: p.cours, dossier: r.dossier }).then(function (x) {
        return charger().then(function () {
          return demander({
            titre: T('catalogue.rangeTitre'),
            texte: x.presents.length
              ? T('catalogue.rangeDeja', { n: x.ajoutes.length, dossier: r.dossier, deja: x.presents.length })
              : Tn('catalogue.range', x.ajoutes.length, { dossier: r.dossier }),
            seulementOk: true,
          });
        });
      });
    });
  }

  function rendreCatalogue(zone) {
    zone.innerHTML = '';
    rendreCursus(zone);
    rendrePacks(zone);
    var dejaLa = coursDejaDansCursus();
    var ul = el('ul', 'ula-cartes');
    catalogue.cours.forEach(function (c) {
      var li = el('li', 'ula-carte');
      if (c.teinte) li.dataset.matiere = c.teinte;
      if (c.etat !== 'partiel' && libelleEtat(c.etat)) li.appendChild(el('span', 'ula-etat', libelleEtat(c.etat)));
      var local = etat.cours.find(function (x) {
        return x.id === c.id;
      });
      var titre = el('h3');
      titre.appendChild(
        local && local.accueil ? lien(c.titre, urlPage(local.accueil)) : document.createTextNode(c.titre),
      );
      li.appendChild(titre);
      li.appendChild(
        el(
          'p',
          'ula-cours-info',
          [nomDomaine(c.domaine), c.niveau, c.origine, taille(c.taille)].filter(Boolean).join(' · '),
        ),
      );
      if (c.description)
        li.appendChild(
          el('p', 'ula-note', c.description.length > 180 ? c.description.slice(0, 177) + '…' : c.description),
        );
      var act = el('div', 'ula-actions');
      if (local && etat.profil) {
        if (dejaLa[c.id]) act.appendChild(el('span', 'ula-etat', T('explorer.dansCursus')));
        else
          act.appendChild(
            bouton(T('explorer.ajouter'), 'petit', function () {
              return ajouterCours(c.id, null);
            }),
          );
      }
      if (!catalogue.source) {
        if (c.etat === 'absent')
          act.appendChild(
            bouton(T('catalogue.telecharger'), 'principal', function () {
              return installer(c, zone);
            }),
          );
        if (c.etat === 'maj')
          act.appendChild(
            bouton(T('catalogue.mettreAJour'), 'principal', function () {
              return installer(c, zone);
            }),
          );
        if (c.etat === 'installe' || c.etat === 'maj')
          act.appendChild(
            bouton(T('catalogue.supprimer'), 'discret', function () {
              return demander({
                titre: T('catalogue.supprimerTitre', { titre: c.titre }),
                texte: T('catalogue.supprimerTexte'),
                ok: T('catalogue.supprimer'),
              }).then(function (r) {
                if (r)
                  return api('POST', 'ula/catalogue/supprimer', { id: c.id }).then(function () {
                    return charger();
                  });
              });
            }),
          );
      }
      li.appendChild(act);
      ul.appendChild(li);
    });
    zone.appendChild(ul);
    zone.appendChild(
      el(
        'p',
        'ula-note',
        T('catalogue.date', {
          date: new Date(catalogue.genere).toLocaleDateString(locale(), {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }),
        }),
      ),
    );
  }

  function installer(c, zone) {
    var p = el('p', 'ula-attente', T('catalogue.telechargement', { titre: c.titre }));
    zone.insertBefore(p, zone.firstChild);
    return api('POST', 'ula/catalogue/installer', { id: c.id })
      .then(function () {
        return charger().then(function () {
          if (
            etat.profil &&
            !(function trouve(n) {
              return n && ((n.type === 'lien' && n.cours === c.id) || (n.enfants || []).some(trouve));
            })(cursus.arbre)
          ) {
            return ajouterCours(c.id, null);
          }
        });
      })
      .catch(function (e) {
        p.remove();
        throw e;
      });
  }

  /* -- Outils ------------------------------------------------------------------------- */

  // « Mon suivi » (page du TODO.md) sert au développement de l'application : l'outil
  // n'est que dans le dépôt ula, ni dans l'application installée ni dans le dépôt
  // public. Ses liens n'apparaissent que si la page existe.
  var SUIVI = '/_outils/todo/index.html';
  var suiviConnu = null;
  function suiviPresent() {
    if (!suiviConnu) {
      suiviConnu = fetch(SUIVI, { method: 'HEAD', cache: 'no-store' })
        .then(function (r) {
          return r.ok;
        })
        .catch(function () {
          return false;
        });
    }
    return suiviConnu;
  }

  function sectionOutils() {
    var s = el('section');
    s.appendChild(el('h2', null, T('outils.titre')));
    var ol = el('ol', 'chapitres');
    [
      ['/_outils/quiz/portail.html', 'outils.revisions'],
      [SUIVI, 'outils.suivi'],
      ['/_outils/environnements/c.html', 'outils.c'],
      ['/_outils/environnements/python.html', 'outils.python'],
      ['/_outils/quiz/demo.html', 'outils.quizDemo'],
      ['/_outils/atelier/demo.html', 'outils.atelierDemo'],
    ].forEach(function (x) {
      var li = el('li');
      // « Mon suivi » : seulement là où l'outil existe (dépôt ula)
      if (x[0] === SUIVI) {
        li.hidden = true;
        suiviPresent().then(function (oui) {
          li.hidden = !oui;
        });
      }
      var a = lien('', x[0], 'chapitre');
      a.appendChild(el('span', 'chapitre-num'));
      var t = el('span');
      t.appendChild(el('span', 'chapitre-titre', T(x[1])));
      t.appendChild(el('span', 'chapitre-resume', T(x[1] + 'Aide')));
      a.appendChild(t);
      li.appendChild(a);
      ol.appendChild(li);
    });
    s.appendChild(ol);
    return s;
  }

  /* -- Textes fixes de la page, changement de langue ------------------------------ */

  function textesPage() {
    document.documentElement.lang = langue();
    if (!domaineSeul) {
      document.title = T('page.titre');
      document.getElementById('chapeau').textContent = T('page.chapeau');
    }
    var attente = document.getElementById('attente');
    if (attente) attente.textContent = T('page.attente');
    var pied = document.querySelector('.pied');
    if (pied) {
      var liens = pied.querySelectorAll('a');
      if (liens[0]) liens[0].textContent = T('page.revisions');
      if (liens[1]) liens[1].textContent = T('page.suivi');
      var piedSuivi = pied.querySelector('.pied-suivi');
      if (piedSuivi)
        suiviPresent().then(function (oui) {
          piedSuivi.hidden = !oui;
        });
    }
  }

  document.addEventListener('ula:langue', function () {
    textesPage();
    if (etat) rendre();
  });

  // Aides partagées avec la section des soumissions reçues (admin-soumissions.js)
  window.ULA_ACCUEIL = {
    el: el,
    bouton: bouton,
    T: T,
    api: api,
    demander: demander,
    afficherErreur: afficherErreur,
    dateHeure: dateHeure,
    duree: duree,
    resumeGenerations: resumeGenerations,
    nomDomaine: nomDomaine,
  };

  textesPage();
  charger();
})();
