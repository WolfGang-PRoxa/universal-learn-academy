/* ==========================================================================
   Charte des cours — comportements communs (aucune dépendance obligatoire)
   --------------------------------------------------------------------------
   À charger dans <head> SANS defer : le thème est appliqué avant le premier
   rendu (pas de flash), le reste attend que le DOM soit prêt.

   Ce que fait ce script, pour que les pages restent simples à écrire :
   - thème clair/sombre (bouton dans la barre, choix mémorisé), bascule en cercle ;
   - icône maison vers l'accueil général (cible du premier lien du fil) ;
   - précédent et suivant, dans l'application de bureau seulement ;
   - barre de progression de lecture ;
   - identifiants et ancres « # » sur les h2/h3, sommaire numéroté,
     section courante surlignée, tiroir sur mobile ;
   - enveloppe chaque <pre> dans <figure class="code"> (fichier, langage,
     bouton Copier) puis colore avec highlight.js s'il est chargé ;
   - enveloppe chaque <table> nue dans <div class="tableau"> ;
   - rend les formules \( … \) et \[ … \] avec KaTeX s'il est chargé ;
   - calcule la durée de lecture ([data-duree-lecture]) ;
   - déplie tous les <details> avant impression.
   ========================================================================== */
(function () {
  'use strict';

  var racine = document.documentElement;
  var CLE_THEME = 'charte-theme';

  /* Thème ------------------------------------------------------------------ */

  function lireTheme() {
    try {
      return localStorage.getItem(CLE_THEME);
    } catch (e) {
      return null;
    }
  }
  function ecrireTheme(valeur) {
    try {
      localStorage.setItem(CLE_THEME, valeur);
    } catch (e) {
      /* stockage indisponible */
    }
  }
  function themeEffectif() {
    if (racine.dataset.theme) return racine.dataset.theme;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair';
  }

  var themeMemorise = lireTheme();
  if (themeMemorise === 'clair' || themeMemorise === 'sombre') racine.dataset.theme = themeMemorise;

  /* Outils ----------------------------------------------------------------- */

  function creer(balise, classe, texte) {
    var el = document.createElement(balise);
    if (classe) el.className = classe;
    if (texte != null) el.textContent = texte;
    return el;
  }

  function slug(texte) {
    return (
      texte
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\\\(|\\\)|\\\[|\\\]/g, ' ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'section'
    );
  }

  // Texte d'un titre sans ses ornements (ancre, référence à la diapo, badge)
  function texteTitre(titre) {
    var copie = titre.cloneNode(true);
    copie.querySelectorAll('.ancre, .ref, .badge').forEach(function (n) {
      n.remove();
    });
    return copie.textContent.replace(/\s+/g, ' ').trim();
  }

  // Exécute une étape sans qu'une erreur n'empêche les suivantes
  function etape(nom, fn) {
    try {
      fn();
    } catch (e) {
      console.error('[charte] ' + nom + ' :', e);
    }
  }

  /* Langue de la barre du haut ---------------------------------------------- */

  // L'application installée annonce sa langue dans l'agent utilisateur
  // (« ULA-langue/en ») et appelle window.ulaLangue(code) quand elle change ; sans
  // elle (navigateur, lancer-app.bat), la barre reste en français. Seule la barre
  // est traduite : le contenu des cours reste dans sa langue.
  var langue = (navigator.userAgent.match(/\bULA-langue\/(\w+)/) || [])[1] || 'fr';
  var TEXTES_BARRE = {
    fr: {
      themeClair: 'Passer en thème clair',
      themeSombre: 'Passer en thème sombre',
      soutienTitre: "Soutenir Universal Learn Academy : m'offrir un café (Buy Me a Coffee)",
      soutienAria: 'Offrir un café sur Buy Me a Coffee',
      soutien: 'Offrir un café',
      parametresTitre: 'Paramètres : application, Claude, mises à jour (Ctrl+,)',
      parametres: 'Paramètres',
      aideTitre: 'Aide : documentation et paramétrage guidé (F1)',
      aide: 'Aide',
      precedent: 'Précédent (Alt+←)',
      suivant: 'Suivant (Alt+→)',
      accueilTitre: 'Accueil général : toutes les années et toutes les matières',
      accueil: 'Accueil général',
      quizTitre: "S'entraîner avec le quiz de ce cours",
      synchroEnCours: 'Synchronisation en cours…',
      synchronise: 'Synchronisé',
      synchroA: ' à ',
      synchroLe: ' le ',
      synchroCliquer: '. Cliquer pour synchroniser maintenant.',
      horsLigne: 'Hors ligne',
      horsLigneSuite: ' : nouvel essai plus tard, ou cliquer pour réessayer.',
      synchroMaintenant: 'Synchroniser maintenant',
      synchroImpossible: 'Synchronisation impossible.',
      synchroDetails: ' Cliquer pour les détails.',
      synchroManuelle: ' (synchro automatique désactivée)',
      lienVers: 'Lien vers « {texte} »',
      sommaire: 'Sommaire',
      afficherSommaire: 'Afficher le sommaire',
      copier: 'Copier',
      copie: 'Copié',
      texte: 'Texte',
      pseudoCode: 'Pseudo-code',
      assembleur: 'Assembleur {nom}',
    },
    en: {
      themeClair: 'Switch to light theme',
      themeSombre: 'Switch to dark theme',
      soutienTitre: 'Support Universal Learn Academy: buy me a coffee (Buy Me a Coffee)',
      soutienAria: 'Buy me a coffee on Buy Me a Coffee',
      soutien: 'Buy me a coffee',
      parametresTitre: 'Settings: application, Claude, updates (Ctrl+,)',
      parametres: 'Settings',
      aideTitre: 'Help: documentation and guided setup (F1)',
      aide: 'Help',
      precedent: 'Back (Alt+←)',
      suivant: 'Forward (Alt+→)',
      accueilTitre: 'Main home page: every year and every subject',
      accueil: 'Main home page',
      quizTitre: 'Practise with this course’s quiz',
      synchroEnCours: 'Syncing…',
      synchronise: 'Synced',
      synchroA: ' at ',
      synchroLe: ' on ',
      synchroCliquer: '. Click to sync now.',
      horsLigne: 'Offline',
      horsLigneSuite: ': new attempt later, or click to try again.',
      synchroMaintenant: 'Sync now',
      synchroImpossible: 'Sync not possible.',
      synchroDetails: ' Click for details.',
      synchroManuelle: ' (automatic sync off)',
      lienVers: 'Link to “{texte}”',
      sommaire: 'Contents',
      afficherSommaire: 'Show the contents',
      copier: 'Copy',
      copie: 'Copied',
      texte: 'Text',
      pseudoCode: 'Pseudocode',
      assembleur: '{nom} assembly',
    },
  };
  function tb(cle) {
    return (TEXTES_BARRE[langue] || TEXTES_BARRE.fr)[cle] || TEXTES_BARRE.fr[cle];
  }
  // Libellés à refaire quand la langue change
  var relibeller = [];
  window.ulaLangue = function (code) {
    if (!code || code === langue) return;
    langue = code;
    relibeller.forEach(function (fn) {
      try {
        fn();
      } catch (e) {
        /* bouton retiré */
      }
    });
    afficherSynchro();
    document.dispatchEvent(new CustomEvent('ula:langue', { detail: code }));
  };
  window.ulaLangueCourante = function () {
    return langue;
  };

  /* Barre du haut ---------------------------------------------------------- */

  function installerBarre() {
    document.body
      .insertBefore(creer('div', 'progression'), document.body.firstChild)
      .setAttribute('aria-hidden', 'true');

    var barre = document.querySelector('.barre');
    if (!barre) return;

    var bouton = creer('button', 'bouton-icone bouton-theme');
    bouton.type = 'button';
    function libelle() {
      var texte = themeEffectif() === 'sombre' ? tb('themeClair') : tb('themeSombre');
      bouton.setAttribute('aria-label', texte);
      bouton.title = texte;
    }
    bouton.addEventListener('click', function () {
      var suivant = themeEffectif() === 'sombre' ? 'clair' : 'sombre';
      function appliquer() {
        racine.dataset.theme = suivant;
        ecrireTheme(suivant);
        libelle();
      }
      basculer(bouton, appliquer);
    });
    libelle();
    relibeller.push(libelle);
    installerHistorique(barre);
    installerQuiz(barre);
    installerSoutien(barre);
    installerAccueil(barre);
    installerAide(barre);
    installerParametres(barre);
    barre.appendChild(bouton);
    afficherSynchro();
  }

  // « Offrir un café » (Buy Me a Coffee), dans l'application de bureau seulement
  // (installée ou lancer-app.bat) ; le lien s'ouvre dans le navigateur du système
  // (_outils/app/fenetres.js). Tasse animée : vapeur qui monte, reflet périodique.
  var LIEN_SOUTIEN = 'https://buymeacoffee.com/wolfgang_proxa';
  function installerSoutien(barre) {
    if (!/\bElectron\//.test(navigator.userAgent)) return;
    var a = creer('a', 'bouton-soutien');
    a.href = LIEN_SOUTIEN;
    a.target = '_blank';
    a.rel = 'noopener';

    a.innerHTML =
      '<svg class="soutien-tasse" viewBox="0 0 32 32" aria-hidden="true">' +
      '<g class="soutien-vapeur" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
      '<path d="M11 9c-1.5-1.6 1.5-3.2 0-4.8"/><path d="M15.5 9c-1.5-1.6 1.5-3.2 0-4.8"/><path d="M20 9c-1.5-1.6 1.5-3.2 0-4.8"/>' +
      '</g>' +
      '<path class="soutien-corps" d="M6 12h19v6.5a7.5 7.5 0 0 1-7.5 7.5h-4A7.5 7.5 0 0 1 6 18.5z"/>' +
      '<path class="soutien-anse" d="M25 14h1.5a3.5 3.5 0 0 1 0 7H24.6" fill="none" stroke-width="2.2" stroke-linecap="round"/>' +
      '</svg>' +
      '<span class="soutien-texte"></span>';
    function libelle() {
      a.title = tb('soutienTitre');
      a.setAttribute('aria-label', tb('soutienAria'));
      a.querySelector('.soutien-texte').textContent = tb('soutien');
    }
    libelle();
    relibeller.push(libelle);
    barre.appendChild(a);
  }

  // Paramètres de l'application installée (studies/app), sur toutes les pages : elle
  // se signale dans l'agent utilisateur (« StudiesApp/ ») et ouvre sa fenêtre de
  // paramètres quand une page va vers /_app/parametres (_outils/app/fenetres.js).
  // Ni dans un navigateur, ni avec lancer-app.bat, qui n'ont pas ces paramètres.
  function installerParametres(barre) {
    if (!/\bStudiesApp\//.test(navigator.userAgent)) return;
    var a = creer('a', 'bouton-icone bouton-parametres');
    a.href = '/_app/parametres';
    function libelle() {
      a.title = tb('parametresTitre');
      a.setAttribute('aria-label', tb('parametres'));
    }
    libelle();
    relibeller.push(libelle);
    barre.appendChild(a);
  }

  // Aide de l'application installée (2.6.0) : documentation et paramétrage guidé,
  // ouverts par l'hôte quand une page va vers /_app/aide (_outils/app/fenetres.js)
  function installerAide(barre) {
    if (!/\bStudiesApp\//.test(navigator.userAgent) || !/\bULA-langue\//.test(navigator.userAgent)) return;
    var a = creer('a', 'bouton-icone bouton-aide');
    a.href = '/_app/aide';
    function libelle() {
      a.title = tb('aideTitre');
      a.setAttribute('aria-label', tb('aide'));
    }
    libelle();
    relibeller.push(libelle);
    barre.appendChild(a);
  }

  // Synchronisation du dossier des données (application installée, synchro.js de
  // l'hôte) : l'hôte appelle window.ulaSynchro(etat) une fois la page chargée et à
  // chaque changement ; le bouton nuage apparaît alors avant la roue des paramètres.
  // Clic : synchroniser maintenant (/_app/synchro, _outils/app/fenetres.js), ou la
  // carte Synchronisation des paramètres quand un problème attend. Sans l'hôte
  // (navigateur, lancer-app.bat), personne n'appelle ulaSynchro : pas de bouton.
  var synchroBouton = null,
    synchroEtat = null;
  window.ulaSynchro = function (etat) {
    synchroEtat = etat || null;
    afficherSynchro();
  };
  function heureCourte(iso) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d)) return '';
    var p = function (n) {
      return (n < 10 ? '0' : '') + n;
    };
    var jour =
      d.toDateString() === new Date().toDateString()
        ? ''
        : tb('synchroLe') + p(d.getDate()) + '/' + p(d.getMonth() + 1);
    return p(d.getHours()) + ':' + p(d.getMinutes()) + jour;
  }
  function afficherSynchro() {
    var barre = document.querySelector('.barre');
    if (!barre || !synchroEtat) return;
    if (!synchroBouton) {
      synchroBouton = creer('a', 'bouton-icone bouton-synchro');
      barre.insertBefore(synchroBouton, barre.querySelector('.bouton-parametres'));
    }
    var e = synchroEtat,
      quand = heureCourte(e.a),
      probleme = false,
      texte;
    switch (e.etat) {
      case 'en-cours':
        texte = tb('synchroEnCours');
        break;
      case 'synchronise':
      case 'a-jour':
        texte = tb('synchronise') + (quand ? tb('synchroA') + quand : '') + tb('synchroCliquer');
        break;
      case 'hors-ligne':
        texte = tb('horsLigne') + (quand ? ' (' + quand + ')' : '') + tb('horsLigneSuite');
        break;
      case 'jamais':
        texte = tb('synchroMaintenant');
        break;
      default:
        probleme = true;
        texte = (e.message || tb('synchroImpossible')) + tb('synchroDetails');
    }
    if (!e.auto && !probleme) texte += tb('synchroManuelle');
    synchroBouton.href = probleme ? '/_app/parametres#synchro' : '/_app/synchro';
    synchroBouton.dataset.etat = probleme ? 'probleme' : e.etat;
    synchroBouton.title = texte;
    synchroBouton.setAttribute('aria-label', texte);
  }

  // Précédent et suivant, à gauche du fil : l'application de bureau (_outils/app)
  // n'a pas les boutons d'un navigateur
  function installerHistorique(barre) {
    if (!/\bElectron\//.test(navigator.userAgent)) return;
    function bouton(classe, cle, sens) {
      var b = creer('button', 'bouton-icone ' + classe);
      b.type = 'button';
      function libelle() {
        b.title = tb(cle);
        b.setAttribute('aria-label', tb(cle));
      }
      libelle();
      relibeller.push(libelle);
      b.addEventListener('click', function () {
        history.go(sens);
      });
      return b;
    }
    var precedent = bouton('bouton-precedent', 'precedent', -1);
    var suivant = bouton('bouton-suivant', 'suivant', 1);
    function actualiser() {
      precedent.disabled = !navigation.canGoBack;
      suivant.disabled = !navigation.canGoForward;
    }
    barre.insertBefore(suivant, barre.firstChild);
    barre.insertBefore(precedent, suivant);
    actualiser();
    navigation.addEventListener('currententrychange', actualiser);
  }

  // Bascule du thème : la nouvelle page s'étend en cercle depuis le bouton
  // (View Transitions), sauf si le système demande de réduire les animations.
  function basculer(bouton, appliquer) {
    var calme = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!document.startViewTransition || calme) {
      appliquer();
      return;
    }
    var r = bouton.getBoundingClientRect();
    var x = r.left + r.width / 2,
      y = r.top + r.height / 2;
    var rayon = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    racine.classList.add('bascule-theme');
    var transition = document.startViewTransition(appliquer);
    transition.ready.then(
      function () {
        racine.animate(
          {
            clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + rayon + 'px at ' + x + 'px ' + y + 'px)'],
          },
          { duration: 550, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', pseudoElement: '::view-transition-new(root)' },
        );
      },
      function () {},
    );
    function fin() {
      racine.classList.remove('bascule-theme');
    }
    transition.finished.then(fin, fin);
  }

  // Icône maison, à droite : l'accueil général, cible du premier lien du fil
  // d'Ariane (« studies »). Absente de l'accueil général lui-même, dont le fil
  // commence par la page courante.
  function installerAccueil(barre) {
    var premier = barre.querySelector('.fil > :not(.pastille)');
    if (!premier || premier.tagName !== 'A') return;
    var a = creer('a', 'bouton-icone bouton-accueil');
    a.href = premier.getAttribute('href');
    function libelle() {
      a.title = tb('accueilTitre');
      a.setAttribute('aria-label', tb('accueil'));
    }
    libelle();
    relibeller.push(libelle);
    barre.appendChild(a);
  }

  // Quiz liés à la page : <link rel="quiz" href="…" title="…"> dans l'en-tête.
  // Un lien « Quiz » dans la barre, ou un menu s'il y en a plusieurs.
  function installerQuiz(barre) {
    var liens = document.querySelectorAll('link[rel="quiz"]');
    if (!liens.length) return;
    function lien(l, classe, texte) {
      var a = creer('a', classe, texte);
      a.href = l.getAttribute('href');
      return a;
    }
    if (liens.length === 1) {
      var a = lien(liens[0], 'bouton-quiz', 'Quiz');
      a.title = liens[0].title || tb('quizTitre');
      barre.appendChild(a);
      return;
    }
    var menu = creer('details', 'menu-quiz');
    menu.appendChild(creer('summary', 'bouton-quiz', 'Quiz (' + liens.length + ')'));
    var liste = creer('ul');
    liens.forEach(function (l) {
      var li = creer('li');
      li.appendChild(lien(l, null, l.title || l.getAttribute('href').split('/').pop()));
      liste.appendChild(li);
    });
    menu.appendChild(liste);
    document.addEventListener('click', function (e) {
      if (!menu.contains(e.target)) menu.open = false;
    });
    barre.appendChild(menu);
  }

  /* Titres et sommaire ----------------------------------------------------- */

  function preparerTitres(contenu) {
    var numeroter = !contenu.classList.contains('sans-numeros');
    var pris = {};
    var n2 = 0,
      n3 = 0,
      parentNumerote = false;
    var titres = Array.prototype.slice.call(contenu.querySelectorAll('h2, h3')).filter(function (h) {
      return !h.closest('.entete');
    });

    return titres.map(function (h) {
      var texte = texteTitre(h);

      if (!h.id) {
        var base = slug(texte),
          id = base,
          i = 2;
        while (pris[id] || document.getElementById(id)) id = base + '-' + i++;
        h.id = id;
      }
      pris[h.id] = true;

      // Même logique que les compteurs CSS (section 4 de cours.css)
      var num = '';
      var numerote = numeroter && !h.classList.contains('sans-numero');
      if (h.tagName === 'H2') {
        parentNumerote = numerote;
        if (numerote) {
          n2++;
          n3 = 0;
          num = n2 + '.';
        }
      } else if (numerote) {
        n3++;
        if (parentNumerote) num = n2 + '.' + n3;
      }

      var ancre = creer('a', 'ancre', '#');
      ancre.href = '#' + h.id;
      var libelleAncre = function () {
        ancre.setAttribute('aria-label', tb('lienVers').replace('{texte}', texte));
      };
      libelleAncre();
      relibeller.push(libelleAncre);
      h.appendChild(ancre);

      return { el: h, niveau: h.tagName === 'H2' ? 2 : 3, texte: texte, num: num };
    });
  }

  function construireSommaire(contenu, titres) {
    var nbSections = titres.filter(function (t) {
      return t.niveau === 2;
    }).length;
    if (nbSections < 2 || contenu.classList.contains('sans-sommaire')) return;

    var nav = creer('nav', 'sommaire');
    nav.id = 'sommaire';
    var titreSommaire = nav.appendChild(creer('p', 'sommaire-titre'));
    var libelleSommaire = function () {
      nav.setAttribute('aria-label', tb('sommaire'));
      titreSommaire.textContent = tb('sommaire');
    };
    libelleSommaire();
    relibeller.push(libelleSommaire);

    var liste = creer('ol'),
      sousListe = null,
      dernier = null,
      liens = [];
    titres.forEach(function (t) {
      var li = creer('li'),
        a = creer('a');
      a.href = '#' + t.el.id;
      if (t.num) a.appendChild(creer('span', 'num', t.num));
      a.appendChild(creer('span', null, t.texte));
      li.appendChild(a);
      liens.push({ titre: t.el, lien: a });

      if (t.niveau === 2 || !dernier) {
        liste.appendChild(li);
        dernier = t.niveau === 2 ? li : dernier;
        sousListe = null;
      } else {
        if (!sousListe) {
          sousListe = creer('ol');
          dernier.appendChild(sousListe);
        }
        sousListe.appendChild(li);
      }
    });
    nav.appendChild(liste);

    var page = contenu.closest('.page') || contenu.parentNode;
    page.insertBefore(nav, page.firstChild);
    page.classList.add('avec-sommaire');

    // Tiroir sur petit écran
    var voile = creer('div', 'voile');
    document.body.appendChild(voile);
    var barre = document.querySelector('.barre');
    var bouton = null;
    if (barre) {
      bouton = creer('button', 'bouton-icone bouton-sommaire');
      bouton.type = 'button';
      var libelleBouton = function () {
        bouton.setAttribute('aria-label', tb('afficherSommaire'));
      };
      libelleBouton();
      relibeller.push(libelleBouton);
      bouton.setAttribute('aria-controls', 'sommaire');
      bouton.setAttribute('aria-expanded', 'false');
      barre.insertBefore(bouton, barre.firstChild);
    }
    function basculer(ouvrir) {
      document.body.classList.toggle('sommaire-ouvert', ouvrir);
      if (bouton) bouton.setAttribute('aria-expanded', String(ouvrir));
    }
    if (bouton)
      bouton.addEventListener('click', function () {
        basculer(!document.body.classList.contains('sommaire-ouvert'));
      });
    voile.addEventListener('click', function () {
      basculer(false);
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) basculer(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') basculer(false);
    });

    return { nav: nav, liens: liens };
  }

  /* Suivi du défilement : progression + section courante ------------------ */

  function suivreDefilement(sommaire) {
    var progression = document.querySelector('.progression');
    var actif = null,
      enAttente = false;

    function maj() {
      enAttente = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      if (progression) progression.style.setProperty('--p', max > 0 ? Math.min(1, doc.scrollTop / max) : 0);

      if (!sommaire) return;
      var seuil = (parseFloat(getComputedStyle(doc).scrollPaddingTop) || 60) + 24;
      var courant = sommaire.liens[0];
      for (var i = 0; i < sommaire.liens.length; i++) {
        if (sommaire.liens[i].titre.getBoundingClientRect().top <= seuil) courant = sommaire.liens[i];
        else break;
      }
      if (courant === actif) return;
      if (actif) {
        actif.lien.classList.remove('actif');
        actif.lien.removeAttribute('aria-current');
      }
      actif = courant;
      actif.lien.classList.add('actif');
      actif.lien.setAttribute('aria-current', 'location');

      // Garder le lien actif visible si le sommaire défile
      var nav = sommaire.nav,
        a = actif.lien;
      if (nav.scrollHeight > nav.clientHeight) {
        if (a.offsetTop < nav.scrollTop || a.offsetTop + a.offsetHeight > nav.scrollTop + nav.clientHeight) {
          nav.scrollTop = a.offsetTop - nav.clientHeight / 3;
        }
      }
    }
    function demander() {
      if (!enAttente) {
        enAttente = true;
        requestAnimationFrame(maj);
      }
    }
    window.addEventListener('scroll', demander, { passive: true });
    window.addEventListener('resize', demander);
    maj();
  }

  /* Code ------------------------------------------------------------------- */

  var NOMS_LANGAGES = {
    c: 'C',
    cpp: 'C++',
    h: 'C',
    csharp: 'C#',
    java: 'Java',
    kotlin: 'Kotlin',
    ruby: 'Ruby',
    rb: 'Ruby',
    python: 'Python',
    py: 'Python',
    php: 'PHP',
    javascript: 'JavaScript',
    js: 'JavaScript',
    typescript: 'TypeScript',
    ts: 'TypeScript',
    rust: 'Rust',
    go: 'Go',
    swift: 'Swift',
    lua: 'Lua',
    perl: 'Perl',
    r: 'R',
    ocaml: 'OCaml',
    haskell: 'Haskell',
    scheme: 'Scheme',
    prolog: 'Prolog',
    sql: 'SQL',
    pgsql: 'PostgreSQL',
    bash: 'Bash',
    sh: 'Shell',
    shell: 'Terminal',
    powershell: 'PowerShell',
    dos: 'Batch',
    makefile: 'Makefile',
    x86asm: ['assembleur', 'x86'],
    mipsasm: ['assembleur', 'MIPS'],
    armasm: ['assembleur', 'ARM'],
    vhdl: 'VHDL',
    verilog: 'Verilog',
    html: 'HTML',
    xml: 'XML',
    css: 'CSS',
    json: 'JSON',
    yaml: 'YAML',
    ini: 'INI',
    markdown: 'Markdown',
    latex: 'LaTeX',
    diff: 'Diff',
    plaintext: ['texte'],
    text: ['texte'],
    pseudo: ['pseudoCode'],
  };
  // Nom affiché d'un langage : traduit pour les entrées [clé, nom] ci-dessus
  function nomDuLangage(langue) {
    var n = NOMS_LANGAGES[langue];
    if (!n) return langue;
    return typeof n === 'string' ? n : tb(n[0]).replace('{nom}', n[1] || '');
  }

  function copierTexte(texte, bouton) {
    function reussi() {
      bouton.textContent = tb('copie');
      bouton.classList.add('ok');
      setTimeout(function () {
        bouton.textContent = tb('copier');
        bouton.classList.remove('ok');
      }, 1600);
    }
    function secours() {
      var zone = creer('textarea');
      zone.value = texte;
      zone.setAttribute('readonly', '');
      zone.style.position = 'fixed';
      zone.style.opacity = '0';
      document.body.appendChild(zone);
      zone.select();
      var ok;
      try {
        ok = document.execCommand('copy');
      } catch (e) {
        ok = false;
      }
      zone.remove();
      if (ok) reussi();
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(texte).then(reussi, secours);
    } else {
      secours();
    }
  }

  function preparerCode(contenu) {
    var hljs = window.hljs;
    if (hljs) hljs.configure({ ignoreUnescapedHTML: true });

    contenu.querySelectorAll('pre').forEach(function (pre) {
      // Déjà habillé, ou texte brut (sorties d'exécution, éditeur de code des quiz)
      if (pre.closest('figure.code, .editeur') || pre.classList.contains('brut')) return;

      var code = pre.querySelector('code');
      if (!code) {
        code = creer('code');
        while (pre.firstChild) code.appendChild(pre.firstChild);
        pre.appendChild(code);
      }

      var terminal = pre.classList.contains('terminal');
      var trouve = /(?:^|\s)lang(?:uage)?-([\w+#-]+)/.exec(code.className + ' ' + pre.className);
      var langue = trouve ? trouve[1].toLowerCase() : terminal ? 'shell' : 'plaintext';
      if (!trouve) code.classList.add('language-' + langue);

      if (code.children.length && langue !== 'pseudo') {
        console.warn('[charte] Balises HTML dans un bloc de code (' + langue + ') : penser à échapper < > & —', pre);
      }

      var figure = creer('figure', 'code' + (terminal ? ' terminal' : ''));
      var legende = creer('figcaption');
      var titre = creer('span', 'code-titre');
      var nomLangage = terminal ? 'Terminal' : nomDuLangage(langue);
      var fichier = pre.dataset.fichier;
      if (fichier) titre.appendChild(creer('span', 'code-fichier', fichier));
      if (!fichier || fichier.toLowerCase() !== nomLangage.toLowerCase()) {
        titre.appendChild(creer('span', 'code-langue', nomLangage));
      }

      var bouton = creer('button', 'bouton-copier', tb('copier'));
      relibeller.push(function () {
        if (!bouton.classList.contains('ok')) bouton.textContent = tb('copier');
      });
      bouton.type = 'button';
      bouton.addEventListener('click', function () {
        var texte = code.textContent.replace(/\n$/, '');
        if (terminal) {
          // Dans un terminal, on ne copie que les commandes (lignes « $ … »)
          var commandes = texte
            .split('\n')
            .filter(function (l) {
              return /^\s*[$#] /.test(l);
            })
            .map(function (l) {
              return l.replace(/^\s*[$#] /, '');
            });
          if (commandes.length) texte = commandes.join('\n');
        }
        copierTexte(texte, bouton);
      });

      legende.appendChild(titre);
      legende.appendChild(bouton);
      pre.parentNode.insertBefore(figure, pre);
      figure.appendChild(legende);
      figure.appendChild(pre);

      if (hljs && langue !== 'plaintext' && langue !== 'text' && langue !== 'pseudo' && hljs.getLanguage(langue)) {
        hljs.highlightElement(code);
      }
    });
  }

  /* Tableaux, liens -------------------------------------------------------- */

  function preparerTableaux(contenu) {
    contenu.querySelectorAll('table').forEach(function (table) {
      if (table.closest('.tableau')) return;
      var boite = creer('div', 'tableau');
      table.parentNode.insertBefore(boite, table);
      boite.appendChild(table);
    });
  }

  function preparerLiens(contenu) {
    contenu.querySelectorAll('a[href^="http"]').forEach(function (a) {
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }

  /* Maths ------------------------------------------------------------------ */

  function rendreMaths(zone) {
    if (typeof window.renderMathInElement !== 'function') return;
    window.renderMathInElement(zone, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
      ignoredClasses: ['sans-maths'],
      throwOnError: false,
      macros: {
        '\\N': '\\mathbb{N}',
        '\\Z': '\\mathbb{Z}',
        '\\Q': '\\mathbb{Q}',
        '\\R': '\\mathbb{R}',
        '\\C': '\\mathbb{C}',
        '\\F': '\\mathbb{F}',
        '\\xor': '\\oplus',
      },
    });
  }

  /* Durée de lecture, impression ------------------------------------------ */

  function dureeLecture(contenu) {
    var cible = document.querySelector('[data-duree-lecture]');
    if (!cible) return;
    var mots = (contenu.innerText || contenu.textContent).split(/\s+/).filter(Boolean).length;
    cible.textContent = '≈ ' + Math.max(1, Math.round(mots / 180)) + ' min';
  }

  function preparerImpression(contenu) {
    var ouverts = [];
    window.addEventListener('beforeprint', function () {
      ouverts = [];
      contenu.querySelectorAll('details:not([open])').forEach(function (d) {
        d.open = true;
        ouverts.push(d);
      });
    });
    window.addEventListener('afterprint', function () {
      ouverts.forEach(function (d) {
        d.open = false;
      });
    });
  }

  /* API pour les autres outils (quiz…) ------------------------------------- */

  // Un contenu construit après le chargement (par exemple par _outils/quiz/assets/quiz.js)
  // passe par les mêmes traitements que les pages de cours.
  window.Charte = {
    preparerCode: preparerCode,
    preparerTableaux: preparerTableaux,
    preparerLiens: preparerLiens,
    rendreMaths: rendreMaths,
  };

  /* Démarrage -------------------------------------------------------------- */

  document.addEventListener('DOMContentLoaded', function () {
    var contenu = document.querySelector('.cours');
    etape('barre', installerBarre);
    if (!contenu) return;

    var titres = [],
      sommaire = null;
    etape('durée de lecture', function () {
      dureeLecture(contenu);
    });
    etape('titres', function () {
      titres = preparerTitres(contenu);
    });
    etape('sommaire', function () {
      sommaire = construireSommaire(contenu, titres);
    });
    etape('code', function () {
      preparerCode(contenu);
    });
    etape('tableaux', function () {
      preparerTableaux(contenu);
    });
    etape('liens', function () {
      preparerLiens(contenu);
    });
    etape('maths', function () {
      rendreMaths(contenu.closest('.page') || contenu);
    });
    etape('défilement', function () {
      suivreDefilement(sommaire);
    });
    etape('impression', function () {
      preparerImpression(contenu);
    });
  });
})();
