/* ==========================================================================
   Accueil › Soumissions reçues (administrateur du catalogue seulement)
   Section montrée quand le serveur local a un jeton d'administration du service de
   soumission (/api/ula/admin/etat). Liste des soumissions reçues, analyses par l'IA
   choisie (une, la sélection, ou toutes celles à analyser), puis décision :
   accepter (le cours entre dans explore/ en mode dépôt), refuser avec un message,
   bloquer l'installation de l'auteur. Ancre : #administration.
   Sortes : cours (analysés par l'IA), packs et cursus (acceptés dans explore/packs/ et
   explore/cursus/ en mode dépôt), cours de profs (l'administrateur en génère un cours,
   qu'il relie ensuite à la soumission : l'auteur le voit dans son suivi).
   Aides de la page (el, T, api, demander…) : window.ULA_ACCUEIL (accueil.js).
   ========================================================================== */
(function () {
  'use strict';

  var etat = null; // { configure, depot }
  var section = null;
  var liste = [];
  var ia = [];
  var filtre = 'atraiter';
  var filtreSorte = 'toutes';
  var SORTES = ['toutes', 'cours', 'pack', 'cursus', 'sources'];
  var choisies = {};
  var ouvertes = {};
  var details = {};
  var file = [];
  var minuterie = null;
  var verifiee = null;
  var releve = null; // relecture automatique, toutes les 5 min tant que la page est ouverte
  var FILTRES = {
    atraiter: ['recue', 'analyse'],
    acceptee: ['acceptee'],
    refusee: ['refusee'],
    toutes: null,
  };
  var DOMAINES = ['informatique', 'mathematiques', 'langues', 'communication', 'sciences', 'lettres', 'autres'];

  function A() {
    return window.ULA_ACCUEIL;
  }

  function charger() {
    var a = A();
    return a
      .api('GET', 'ula/admin/soumissions')
      .then(function (r) {
        liste = r.soumissions || [];
        section.dataset.erreur = '';
        verifiee = new Date();
      })
      .catch(function (e) {
        liste = [];
        section.dataset.erreur = e.message;
      })
      .then(function () {
        return a.api('GET', 'ula/admin/analyses').catch(function () {
          return { file: [] };
        });
      })
      .then(function (r) {
        file = r.file || [];
        peindre();
        clearTimeout(minuterie);
        if (file.length) minuterie = setTimeout(charger, 3000);
        clearTimeout(releve);
        releve = setTimeout(charger, 5 * 60 * 1000);
      });
  }

  function chargerIa() {
    return A()
      .api('GET', 'ia/connectees')
      .then(function (r) {
        ia = (r.ia || []).filter(function (x) {
          return x.ok;
        });
      })
      .catch(function () {
        ia = [];
      });
  }

  function sorteDe(s) {
    return s.type || 'cours';
  }
  function deLaSorte(s) {
    return filtreSorte === 'toutes' || sorteDe(s) === filtreSorte;
  }
  function visibles() {
    var etats = FILTRES[filtre];
    return liste.filter(function (s) {
      return deLaSorte(s) && (!etats || etats.indexOf(s.etat) >= 0);
    });
  }

  function enFile(id) {
    return file.find(function (x) {
      return x.id === id;
    });
  }

  function choixIa() {
    var a = A();
    var sel = a.el('select', 'ula-admin-ia');
    sel.setAttribute('aria-label', a.T('admin.ia'));
    ia.forEach(function (x) {
      var o = a.el('option', null, x.nom);
      o.value = x.fournisseur;
      sel.appendChild(o);
    });
    if (!ia.length) {
      var o = a.el('option', null, a.T('admin.aucuneIa'));
      o.value = '';
      sel.appendChild(o);
      sel.disabled = true;
    }
    try {
      var memo = localStorage.getItem('ula-admin-ia');
      if (
        memo &&
        ia.some(function (x) {
          return x.fournisseur === memo;
        })
      )
        sel.value = memo;
    } catch (e) {
      /* stockage indisponible */
    }
    sel.addEventListener('change', function () {
      try {
        localStorage.setItem('ula-admin-ia', sel.value);
      } catch (e) {
        /* stockage indisponible */
      }
    });
    return sel;
  }

  function analyser(ids, fournisseur) {
    var a = A();
    if (!fournisseur) return a.afficherErreur(new Error(a.T('admin.aucuneIa')));
    if (!ids.length) return a.afficherErreur(new Error(a.T('admin.rienAAnalyser')));
    return a.api('POST', 'ula/admin/analyser', { ids: ids, fournisseur: fournisseur }).then(function () {
      choisies = {};
      return charger();
    });
  }

  function peindre() {
    var a = A();
    var T = a.T;
    var el = a.el;
    section.replaceChildren();
    section.appendChild(el('h2', null, T('admin.titre')));
    section.appendChild(el('p', 'ula-note', T(etat.depot ? 'admin.aideDepot' : 'admin.aide')));
    if (section.dataset.erreur) {
      section.appendChild(el('p', 'ula-erreur', section.dataset.erreur));
      section.appendChild(a.bouton(T('admin.reessayer'), null, charger));
      return;
    }

    // Barre : IA, analyses groupées, filtres
    var barre = el('div', 'ula-admin-barre');
    var sel = choixIa();
    barre.appendChild(sel);
    var nChoisies = Object.keys(choisies).length;
    barre.appendChild(
      a.bouton(T('admin.analyserSelection', { n: nChoisies }), nChoisies ? 'principal' : null, function () {
        return analyser(Object.keys(choisies), sel.value);
      }),
    );
    var aAnalyser = liste.filter(function (s) {
      return sorteDe(s) === 'cours' && s.etat === 'recue' && !(s.local && s.local.analyse) && !enFile(s.id);
    });
    barre.appendChild(
      a.bouton(T('admin.analyserTout', { n: aAnalyser.length }), null, function () {
        return analyser(
          aAnalyser.map(function (s) {
            return s.id;
          }),
          sel.value,
        );
      }),
    );
    barre.appendChild(a.bouton(T('admin.actualiser'), 'leger', charger));
    section.appendChild(barre);

    var onglets = el('div', 'ula-admin-filtres');
    onglets.setAttribute('role', 'tablist');
    Object.keys(FILTRES).forEach(function (f) {
      var etats = FILTRES[f];
      var n = liste.filter(function (s) {
        return deLaSorte(s) && (!etats || etats.indexOf(s.etat) >= 0);
      }).length;
      var b = el('button', 'ula-admin-filtre', T('admin.filtre.' + f) + ' (' + n + ')');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(f === filtre));
      b.addEventListener('click', function () {
        filtre = f;
        peindre();
      });
      onglets.appendChild(b);
    });
    section.appendChild(onglets);

    // Sortes présentes : le filtre n'apparaît que s'il y en a plusieurs
    var presentes = SORTES.filter(function (k) {
      return (
        k === 'toutes' ||
        liste.some(function (s) {
          return sorteDe(s) === k;
        })
      );
    });
    if (presentes.indexOf(filtreSorte) < 0) filtreSorte = 'toutes';
    if (presentes.length > 2) {
      var sortes = el('div', 'ula-admin-filtres ula-admin-sortes');
      sortes.setAttribute('role', 'tablist');
      sortes.setAttribute('aria-label', T('admin.sortes'));
      presentes.forEach(function (k) {
        var n = liste.filter(function (s) {
          return k === 'toutes' || sorteDe(s) === k;
        }).length;
        var b = el(
          'button',
          'ula-admin-filtre',
          T(k === 'toutes' ? 'admin.sorte.toutes' : 'admin.sorte.' + k) + ' (' + n + ')',
        );
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', String(k === filtreSorte));
        b.addEventListener('click', function () {
          filtreSorte = k;
          peindre();
        });
        sortes.appendChild(b);
      });
      section.appendChild(sortes);
    }

    if (file.length)
      section.appendChild(
        el(
          'p',
          'ula-note',
          T('admin.file', {
            n: file.length,
            etape: T('admin.etape.' + file[0].etape),
          }),
        ),
      );

    var v = visibles();
    if (!liste.length) section.appendChild(el('p', 'ula-vide', T('admin.aucuneRecue')));
    else if (!v.length) section.appendChild(el('p', 'ula-note', T('admin.vide')));
    if (verifiee)
      section.appendChild(
        el(
          'p',
          'ula-note',
          T('admin.verifiee', {
            heure: verifiee.toLocaleTimeString(document.documentElement.lang || 'fr', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          }),
        ),
      );
    v.forEach(function (s) {
      section.appendChild(carte(s, sel));
    });
  }

  function badge(texte, genre) {
    var b = A().el('span', 'ula-admin-badge', texte);
    if (genre) b.dataset.genre = genre;
    return b;
  }

  function carte(s, sel) {
    var a = A();
    var T = a.T;
    var el = a.el;
    var d = el('details', 'ula-soumission ula-admin-soumission');
    d.dataset.etat = s.etat;
    d.open = Boolean(ouvertes[s.id]);
    d.addEventListener('toggle', function () {
      ouvertes[s.id] = d.open;
      if (d.open && !details[s.id]) chargerDetail(s, d, sel);
    });
    var resume = el('summary');
    var cocher = el('input');
    cocher.type = 'checkbox';
    cocher.checked = Boolean(choisies[s.id]);
    cocher.setAttribute('aria-label', T('admin.choisir', { titre: s.titre || s.id }));
    cocher.addEventListener('click', function (e) {
      e.stopPropagation();
    });
    cocher.addEventListener('change', function () {
      if (cocher.checked) choisies[s.id] = true;
      else delete choisies[s.id];
      peindre();
    });
    resume.appendChild(cocher);
    resume.appendChild(el('strong', null, ' ' + (s.titre || s.id) + ' '));
    if (sorteDe(s) !== 'cours') resume.appendChild(badge(T('sorte.' + sorteDe(s)), 'sorte'));
    resume.appendChild(badge(T('etatSoumission.' + s.etat), s.etat));
    var an = s.analyse || (s.local && s.local.analyse);
    if (an && an.recommandation)
      resume.appendChild(
        badge(T('admin.ia.recommande', { r: T('recommandation.' + an.recommandation) }), an.recommandation),
      );
    var f = enFile(s.id);
    if (f) resume.appendChild(badge('⏳ ' + T('admin.etape.' + f.etape)));
    resume.appendChild(
      el(
        'span',
        'ula-note',
        ' · ' +
          (sorteDe(s) === 'pack' || sorteDe(s) === 'cursus' ? '' : a.nomDomaine(s.domaine) + ' · ') +
          (s.pseudonyme ? s.pseudonyme + ' · ' : '') +
          a.dateHeure(s.recue) +
          ' · n° ' +
          s.id,
      ),
    );
    d.appendChild(resume);
    var corps = el('div', 'ula-admin-corps');
    d.appendChild(corps);
    if (d.open) {
      if (details[s.id]) peindreDetail(s, details[s.id], corps, sel);
      else chargerDetail(s, d, sel);
    }
    return d;
  }

  function chargerDetail(s, d, sel) {
    var corps = d.querySelector('.ula-admin-corps');
    corps.replaceChildren(A().el('p', 'ula-note', A().T('admin.chargement')));
    return A()
      .api('GET', 'ula/admin/soumissions/' + s.id)
      .then(function (x) {
        details[s.id] = x;
        peindreDetail(s, x, corps, sel);
      })
      .catch(function (e) {
        corps.replaceChildren(A().el('p', 'ula-erreur', e.message));
      });
  }

  function ligneInfo(dl, terme, valeur) {
    if (!valeur) return;
    dl.appendChild(A().el('dt', null, terme));
    dl.appendChild(A().el('dd', null, valeur));
  }

  function peindreDetail(s, x, corps, sel) {
    var a = A();
    var T = a.T;
    var el = a.el;
    corps.replaceChildren();
    var m = x.manifeste || {};
    var fiche = m.fiche || {};
    var sorte = sorteDe(s);
    var dl = el('dl', 'ula-infos');
    ligneInfo(dl, T('admin.info.description'), fiche.description);
    ligneInfo(dl, T('admin.info.niveau'), fiche.niveau);
    ligneInfo(dl, T('admin.info.origine'), fiche.origine);
    ligneInfo(dl, T('admin.info.dossier'), sorte === 'pack' ? fiche.dossier || (m.contenu || {}).dossier : '');
    ligneInfo(dl, T('admin.info.etablissement'), fiche.etablissement);
    ligneInfo(dl, T('admin.info.attentes'), fiche.attentes);
    ligneInfo(dl, T('admin.info.pseudonyme'), m.pseudonyme);
    if (m.contenu) {
      var titres = m.titres || {};
      var nom = function (id) {
        return titres[id] ? titres[id] + ' (' + id + ')' : id;
      };
      ligneInfo(
        dl,
        T('liste.cours'),
        Array.isArray(m.contenu.cours)
          ? m.contenu.cours.map(nom).join(', ')
          : (m.contenu.packs || [])
              .map(function (p) {
                return T('liste.packDossier', { dossier: p.dossier }) + ' : ' + p.cours.map(nom).join(', ');
              })
              .join('\n'),
      );
    }
    if (sorte === 'sources') {
      ligneInfo(
        dl,
        T('sources.fichiers'),
        (m.fichiers || [])
          .map(function (f) {
            return f.nom + ' (' + Math.max(1, Math.round(f.taille / 1024)) + ' Ko)';
          })
          .join('\n'),
      );
      var decl = m.declarations || {};
      ligneInfo(
        dl,
        T('admin.info.declarations'),
        [decl.droits ? T('admin.info.droits') : '', decl.personnel ? T('admin.info.personnel') : '']
          .filter(Boolean)
          .join(' · '),
      );
    }
    var res = x.resultat || s.resultat;
    if (res) ligneInfo(dl, T('admin.info.resultat'), res.titre + (res.cours ? ' (' + res.cours + ')' : ''));
    ligneInfo(dl, T('admin.info.generations'), a.resumeGenerations(m.generations || [], true));
    var dec = m.declare || {};
    ligneInfo(dl, T('admin.info.declare'), [dec.outil, dec.modele, dec.effort, dec.duree].filter(Boolean).join(' · '));
    ligneInfo(dl, T('admin.info.ressources'), dec.ressources);
    ligneInfo(dl, T('admin.info.notes'), dec.notes);
    ligneInfo(
      dl,
      T('admin.info.verificationAuteur'),
      (m.verification || [])
        .map(function (v) {
          return T('admin.verif.' + v.id) + ' : ' + T('etatEtape.' + v.etat);
        })
        .join(' · '),
    );
    ligneInfo(dl, T('admin.info.taille'), x.taille ? Math.max(1, Math.round(x.taille / 1024)) + ' Ko' : '');
    corps.appendChild(dl);

    var an = (x.local && x.local.analyse) || x.analyse;
    if (an) {
      var bloc = el('div', 'ula-admin-analyse');
      bloc.dataset.genre = an.recommandation || '';
      bloc.appendChild(
        el(
          'h3',
          null,
          T('admin.analyse', {
            r: T('recommandation.' + an.recommandation),
            ia: [an.ia, an.modele].filter(Boolean).join(' · '),
            date: a.dateHeure(an.date),
          }) + (an.note != null ? ' · ' + an.note + '/10' : ''),
        ),
      );
      if (an.resume) bloc.appendChild(el('p', null, an.resume));
      if (an.details && an.details.length) {
        var ul = el('ul');
        an.details.forEach(function (t) {
          ul.appendChild(el('li', null, t));
        });
        bloc.appendChild(ul);
      }
      if (an.verifications && an.verifications.length)
        bloc.appendChild(
          el(
            'p',
            'ula-note',
            T('admin.verificationsLocales') +
              ' ' +
              an.verifications
                .map(function (v) {
                  return T('admin.verif.' + v.id) + ' : ' + T('etatEtape.' + v.etat);
                })
                .join(' · '),
          ),
        );
      corps.appendChild(bloc);
    }
    if (x.local && x.local.erreur)
      corps.appendChild(el('p', 'ula-erreur', T('admin.erreurAnalyse') + ' ' + x.local.erreur.texte));
    if (x.message) corps.appendChild(el('p', 'ula-note', T('admin.messageEnvoye') + ' ' + x.message));

    var actions = el('div', 'ula-actions');
    if (sorte === 'cours' && !enFile(s.id))
      actions.appendChild(
        a.bouton(T(an ? 'admin.reanalyser' : 'admin.analyser'), an ? null : 'principal', function () {
          return analyser([s.id], sel.value).then(function () {
            delete details[s.id];
          });
        }),
      );
    actions.appendChild(
      a.bouton(
        T(sorte === 'sources' ? 'admin.dossierSources' : 'admin.dossier'),
        sorte === 'sources' ? 'principal' : null,
        function () {
          return a.api('POST', 'ula/admin/soumissions/' + s.id + '/dossier', {});
        },
      ),
    );
    if (s.etat !== 'acceptee')
      actions.appendChild(
        a.bouton(T('admin.accepter'), an && an.recommandation === 'accepter' ? 'principal' : null, function () {
          return accepter(s, fiche, m);
        }),
      );
    if (sorte === 'sources' && s.etat === 'acceptee')
      actions.appendChild(
        a.bouton(T(res ? 'admin.relierAutre' : 'admin.relier'), res ? null : 'principal', function () {
          return relier(s, res);
        }),
      );
    if (s.etat !== 'refusee')
      actions.appendChild(
        a.bouton(T('admin.refuser'), null, function () {
          return refuser(s, an);
        }),
      );
    actions.appendChild(
      a.bouton(T('admin.bloquer'), 'leger', function () {
        return bloquer(s);
      }),
    );
    corps.appendChild(actions);

    var hist = el('ol', 'ula-historique');
    (x.historique || []).forEach(function (h) {
      var li = el('li');
      li.appendChild(el('time', null, a.dateHeure(h.date)));
      li.appendChild(el('span', null, ' ' + h.texte));
      hist.appendChild(li);
    });
    if (hist.children.length) corps.appendChild(hist);
  }

  // Identifiant proposé pour un pack ou un cursus (même règle que manifestes.mjs)
  function slug(t) {
    return String(t || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }

  function accepter(s, fiche, m) {
    var sorte = sorteDe(s);
    if (sorte !== 'cours') return accepterAutre(s, fiche, m || {}, sorte);
    var a = A();
    var T = a.T;
    var champs = [
      {
        nom: 'domaine',
        libelle: T('admin.champ.domaine'),
        choix: DOMAINES.map(function (d) {
          return { valeur: d, texte: a.nomDomaine(d) };
        }),
        valeur: fiche.domaine || s.domaine,
      },
      { nom: 'id', libelle: T('admin.champ.id'), valeur: fiche.id || '' },
      { nom: 'pack', libelle: T('admin.champ.pack'), valeur: '' },
      { nom: 'message', libelle: T('admin.champ.messageAccepter'), long: true, valeur: T('admin.messageAccepter') },
    ];
    if (etat.depot) champs.push({ nom: 'remplacer', libelle: T('admin.champ.remplacer'), case: true, valeur: false });
    return a
      .demander({
        titre: T('admin.accepterTitre', { titre: s.titre || s.id }),
        texte: T(etat.depot ? 'admin.accepterDepot' : 'admin.accepterArchive'),
        champs: champs,
        ok: T('admin.accepter'),
      })
      .then(function (r) {
        if (!r) return;
        return a.api('POST', 'ula/admin/soumissions/' + s.id + '/decision', Object.assign({ decision: 'accepter' }, r));
      })
      .then(function (x) {
        if (!x) return;
        delete details[s.id];
        var i = x.decision && x.decision.integration;
        return a
          .demander({
            titre: T('admin.accepteeTitre'),
            texte:
              i && i.mode === 'depot'
                ? T('admin.accepteeDepot') + (i.sortie && i.sortie.length ? '\n\n' + i.sortie.join('\n') : '')
                : T('admin.accepteeArchive', { archive: (i && i.archive) || '' }),
            seulementOk: true,
          })
          .then(charger);
      });
  }

  // Pack, cursus ou cours de profs
  function accepterAutre(s, fiche, m, sorte) {
    var a = A();
    var T = a.T;
    var liste_ = sorte === 'pack' || sorte === 'cursus';
    var champs = [];
    if (liste_) {
      if (etat.depot)
        champs.push(
          { nom: 'id', libelle: T('admin.champ.idListe'), valeur: slug(fiche.titre || s.titre) },
          { nom: 'remplacer', libelle: T('admin.champ.remplacerListe'), case: true, valeur: false },
        );
    } else
      champs.push(
        { nom: 'titre', libelle: T('admin.champ.titreGenere'), valeur: '' },
        { nom: 'cours', libelle: T('admin.champ.coursGenere'), valeur: '' },
      );
    champs.push({
      nom: 'message',
      libelle: T('admin.champ.messageAccepter'),
      long: true,
      valeur: T('admin.messageAccepter.' + sorte),
    });
    return a
      .demander({
        titre: T('admin.accepterTitre', { titre: s.titre || s.id }),
        texte: liste_
          ? T(etat.depot ? 'admin.accepterListeDepot' : 'admin.accepterListeArchive')
          : T('admin.accepterSources'),
        champs: champs,
        ok: T('admin.accepter'),
      })
      .then(function (r) {
        if (!r) return;
        return a.api(
          'POST',
          'ula/admin/soumissions/' + s.id + '/decision',
          Object.assign({ decision: 'accepter', type: sorte }, r),
        );
      })
      .then(function (x) {
        if (!x) return;
        delete details[s.id];
        var i = x.decision && x.decision.integration;
        var texte = !liste_
          ? T('admin.accepteeSources')
          : i && i.mode === 'depot'
            ? T('admin.accepteeListeDepot') + (i.sortie && i.sortie.length ? '\n\n' + i.sortie.join('\n') : '')
            : T('admin.accepteeListeArchive', { archive: (i && i.archive) || '' });
        return a.demander({ titre: T('admin.accepteeTitre'), texte: texte, seulementOk: true }).then(charger);
      });
  }

  // Relier aux cours de profs le cours généré à partir d'eux
  function relier(s, res) {
    var a = A();
    var T = a.T;
    return a
      .demander({
        titre: T('admin.relierTitre', { titre: s.titre || s.id }),
        texte: T('admin.relierAide'),
        champs: [
          { nom: 'titre', libelle: T('admin.champ.titreGenere'), valeur: (res && res.titre) || '' },
          { nom: 'cours', libelle: T('admin.champ.coursGenere'), valeur: (res && res.cours) || '' },
        ],
        ok: T('admin.relier'),
        valider: function (c) {
          return c.titre.value.trim() !== '';
        },
      })
      .then(function (r) {
        if (!r) return;
        return a
          .api('POST', 'ula/admin/soumissions/' + s.id + '/decision', {
            decision: 'relier',
            titre: r.titre,
            cours: r.cours,
          })
          .then(function () {
            delete details[s.id];
            return charger();
          });
      });
  }

  function refuser(s, an) {
    var a = A();
    var T = a.T;
    return a
      .demander({
        titre: T('admin.refuserTitre', { titre: s.titre || s.id }),
        texte: T('admin.refuserAide'),
        champs: [{ nom: 'message', libelle: T('admin.champ.message'), long: true, valeur: (an && an.resume) || '' }],
        ok: T('admin.refuser'),
      })
      .then(function (r) {
        if (!r) return;
        return a
          .api('POST', 'ula/admin/soumissions/' + s.id + '/decision', { decision: 'refuser', message: r.message })
          .then(function () {
            delete details[s.id];
            return charger();
          });
      });
  }

  function bloquer(s) {
    var a = A();
    var T = a.T;
    return a
      .demander({
        titre: T('admin.bloquerTitre'),
        texte: T('admin.bloquerAide'),
        champs: [{ nom: 'raison', libelle: T('admin.champ.raison'), valeur: '' }],
        ok: T('admin.bloquer'),
      })
      .then(function (r) {
        if (!r) return;
        return a.api('POST', 'ula/admin/soumissions/' + s.id + '/bloquer', { raison: r.raison }).then(charger);
      });
  }

  function placer(main) {
    var apres = document.getElementById('soumissions') || document.getElementById('cursus-section');
    var avant = apres ? apres.nextSibling : null;
    // La section des cours installés suit sinon la section des profils
    if (avant) main.insertBefore(section, avant);
    else main.appendChild(section);
  }

  window.ULA_ADMIN = {
    /** Appelée à chaque rendu de l'accueil : la section se replace (état gardé). */
    rendre: function (main) {
      if (etat === null) {
        etat = { configure: false };
        A()
          .api('GET', 'ula/admin/etat')
          .then(function (r) {
            etat = r;
            if (!r.configure) return;
            section = A().el('section', 'ula-admin');
            section.id = 'administration';
            placer(main);
            return chargerIa()
              .then(charger)
              .then(function () {
                if (location.hash === '#administration') section.scrollIntoView({ block: 'start' });
              });
          })
          .catch(function () {});
        return;
      }
      if (!etat.configure || !section) return;
      main.appendChild(section);
      peindre();
    },
  };
})();
