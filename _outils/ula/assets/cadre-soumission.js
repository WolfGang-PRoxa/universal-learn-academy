/* ==========================================================================
   Cadre de suivi des soumissions (_outils/ula/cadre-soumission.html)
   Suit les soumissions actives du profil (/api/ula/soumissions/actives) : étapes de
   la vérification locale, correction par l'IA, envoi. Il apparaît en glissant depuis
   le bas, se réduit en pastille, et se ferme une fois la soumission vue.

   Hôte : application installée (window.cadreSoumission, posé par
   _outils/app/cadre-pont.js) ou page de l'accueil qui l'a mis dans une iframe
   (messages « ula:cadre »). L'hôte place le cadre ; le cadre lui donne sa hauteur.
   ========================================================================== */
(function () {
  'use strict';

  var TEXTES = window.ULA_TEXTES || { fr: {} };
  var LANGUE = (navigator.userAgent.match(/\bULA-langue\/(\w+)/) || [])[1] || 'fr';
  if (!TEXTES[LANGUE]) LANGUE = 'fr';
  document.documentElement.lang = LANGUE;
  function T(cle, vars) {
    var d = TEXTES[LANGUE];
    var x = d[cle] != null ? d[cle] : TEXTES.fr[cle] != null ? TEXTES.fr[cle] : cle;
    return x.replace(/\{(\w+)\}/g, function (m, k) {
      return vars && vars[k] != null ? String(vars[k]) : m;
    });
  }
  // Thème choisi dans les cours (même origine : même stockage)
  try {
    var theme = localStorage.getItem('charte-theme');
    if (theme === 'clair' || theme === 'sombre') document.documentElement.dataset.theme = theme;
  } catch (e) {
    /* stockage indisponible */
  }

  var hote = {
    taille: function (h) {
      if (window.cadreSoumission) window.cadreSoumission.taille(h);
      else if (window.parent !== window) window.parent.postMessage({ ula: 'cadre', type: 'taille', hauteur: h }, '*');
    },
    masquer: function () {
      if (window.cadreSoumission) window.cadreSoumission.masquer();
      else if (window.parent !== window) window.parent.postMessage({ ula: 'cadre', type: 'masquer' }, '*');
    },
    ouvrir: function (id) {
      var hash = '#soumission=' + encodeURIComponent(id);
      if (window.cadreSoumission) window.cadreSoumission.ouvrir(hash);
      else if (window.parent !== window) window.parent.postMessage({ ula: 'cadre', type: 'ouvrir', hash: hash }, '*');
    },
  };

  var cadre = document.getElementById('cadre');
  var reduit = false;
  var derniere = '';
  var ACTIFS = { verification: 1, correction: 1, envoi: 1 };
  var SYMBOLES = { ok: '✓', avertissement: '!', echec: '✕', non_faite: '–', attente: '', en_cours: '' };

  function el(tag, classe, texte) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte != null) e.textContent = texte;
    return e;
  }
  function boutonIcone(texte, titre, action) {
    var b = el('button', 'icone-bouton', texte);
    b.type = 'button';
    b.title = titre;
    b.setAttribute('aria-label', titre);
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      action();
    });
    return b;
  }
  function api(methode, route, corps) {
    var init = { method: methode, headers: {} };
    if (corps !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(corps);
    }
    return fetch('/api/' + route, init).then(function (r) {
      return r.json();
    });
  }

  function bilan(s) {
    if (s.etat === 'verification') return T('cadre.verification');
    if (s.etat === 'correction') return T('cadre.correction');
    if (s.etat === 'envoi') return T('cadre.envoi');
    if (s.etat === 'suspendue')
      return T(s.suspension && s.suspension.raison === 'python' ? 'cadre.python' : 'cadre.suspendue');
    if (s.etat === 'prete') return s.erreurEnvoi ? T('cadre.erreurEnvoi') : T('cadre.prete');
    if (s.distant)
      return (
        T('cadre.distant', { id: s.distant.id, etat: T('etatSoumission.' + s.etat) }) +
        (s.distant.message ? ' ' + s.distant.message : '')
      );
    if (s.etat === 'annulee') return T('cadre.annulee');
    return T('etatSoumission.' + s.etat);
  }

  function vue(s) {
    api('POST', 'ula/soumissions/' + s.id + '/action', { action: 'vue' }).catch(function () {});
  }

  function peindre(liste) {
    if (!liste.length) {
      cadre.classList.remove('visible');
      setTimeout(function () {
        if (!cadre.classList.contains('visible')) {
          cadre.hidden = true;
          hote.masquer();
        }
      }, 320);
      derniere = '';
      return;
    }
    var s = liste[0];
    var cle = JSON.stringify([s.id, s.etat, s.etapes, reduit, liste.length]);
    if (cle === derniere) return;
    derniere = cle;
    var actif = Boolean(ACTIFS[s.etat]);
    var etapes = s.etapes || [];
    var faites = etapes.filter(function (e) {
      return e.etat !== 'attente' && e.etat !== 'en_cours';
    }).length;
    var fin = s.etat === 'suspendue' || s.etat === 'refusee' || s.erreurEnvoi ? 'suspendue' : actif ? '' : 'ok';
    cadre.dataset.fin = fin;
    cadre.classList.toggle('reduit', reduit);
    cadre.replaceChildren();
    cadre.setAttribute('role', 'status');
    cadre.setAttribute('aria-live', 'polite');

    var tete = el('div', 'tete');
    var titres = el('div');
    titres.style.flex = '1';
    titres.style.minWidth = '0';
    titres.appendChild(el('h1', null, T('cadre.titre')));
    titres.appendChild(el('p', null, s.fiche ? s.fiche.titre : ''));
    tete.appendChild(titres);
    tete.appendChild(
      boutonIcone('–', T('cadre.reduire'), function () {
        reduit = true;
        peindre(liste);
      }),
    );
    if (!actif)
      tete.appendChild(
        boutonIcone('×', T('cadre.fermer'), function () {
          vue(s);
          peindre(liste.slice(1));
        }),
      );
    cadre.appendChild(tete);

    var pastille = el('div', 'pastille');
    var point = el('span', null, actif ? '⏳' : fin === 'suspendue' ? '⚠' : '✓');
    point.setAttribute('aria-hidden', 'true');
    pastille.appendChild(point);
    pastille.appendChild(
      el('span', null, actif ? T('cadre.pastille', { fait: faites, total: etapes.length }) : bilan(s)),
    );
    cadre.appendChild(pastille);

    var detail = el('div', 'detail');
    var barre = el('div', 'progression');
    var remplissage = el('i');
    remplissage.style.width = (etapes.length ? Math.round((faites / etapes.length) * 100) : 0) + '%';
    barre.appendChild(remplissage);
    barre.setAttribute('role', 'progressbar');
    barre.setAttribute('aria-valuemin', '0');
    barre.setAttribute('aria-valuemax', String(etapes.length));
    barre.setAttribute('aria-valuenow', String(faites));
    detail.appendChild(barre);
    var ol = el('ol');
    etapes.forEach(function (e) {
      var li = el('li');
      li.dataset.etat = e.etat;
      var rond = el('span', 'etat', SYMBOLES[e.etat] || '');
      rond.setAttribute('aria-hidden', 'true');
      li.appendChild(rond);
      li.appendChild(el('span', null, e.libelle));
      li.title = T('etatEtape.' + e.etat);
      ol.appendChild(li);
    });
    detail.appendChild(ol);
    detail.appendChild(el('p', 'bilan', bilan(s)));
    var actions = el('div', 'actions');
    var voir = el(
      'button',
      s.etat === 'suspendue' ? 'principal' : '',
      T(s.etat === 'suspendue' ? 'cadre.choisir' : 'cadre.detail'),
    );
    voir.type = 'button';
    voir.addEventListener('click', function () {
      hote.ouvrir(s.id);
    });
    actions.appendChild(voir);
    if (liste.length > 1) actions.appendChild(el('span', 'bilan', T('cadre.autres', { n: liste.length - 1 })));
    detail.appendChild(actions);
    cadre.appendChild(detail);

    cadre.hidden = false;
    requestAnimationFrame(function () {
      cadre.classList.add('visible');
      hote.taille(Math.max(Math.ceil(cadre.getBoundingClientRect().height), cadre.scrollHeight + 2) + 16);
    });
  }

  cadre.addEventListener('click', function () {
    if (!reduit) return;
    reduit = false;
    derniere = '';
    suivre();
  });

  var minuterie = null;
  function suivre() {
    clearTimeout(minuterie);
    api('GET', 'ula/soumissions/actives')
      .then(function (r) {
        var liste = (r.soumissions || []).slice().sort(function (a, b) {
          return (ACTIFS[b.etat] ? 1 : 0) - (ACTIFS[a.etat] ? 1 : 0);
        });
        peindre(liste);
        minuterie = setTimeout(
          suivre,
          liste.some(function (s) {
            return ACTIFS[s.etat];
          })
            ? 700
            : 3000,
        );
      })
      .catch(function () {
        minuterie = setTimeout(suivre, 5000);
      });
  }
  suivre();
})();
