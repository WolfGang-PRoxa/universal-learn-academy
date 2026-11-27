/* ==========================================================================
   Charte des cours — comportements communs (aucune dépendance obligatoire)
   --------------------------------------------------------------------------
   À charger dans <head> SANS defer : le thème est appliqué avant le premier
   rendu (pas de flash), le reste attend que le DOM soit prêt.

   Ce que fait ce script, pour que les pages restent simples à écrire :
   - thème clair/sombre (bouton dans la barre, choix mémorisé), bascule en cercle ;
   - icône maison vers l'accueil général (cible du premier lien du fil) ;
   - précédent et suivant, dans l'application de bureau seulement ;
   - bouton GitHub (appui long : menu), lien vers le projet en pied de page,
     bouton Quitter dans l'application installée ;
   - infobulles à la charte à la place des title (délai réglable dans l'application) ;
   - ascenseur de la page posé par-dessus le contenu, à la place de la barre du système ;
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
  var CLE_SOMMAIRE = 'charte-sommaire-replie';
  var CLE_VOLET = 'charte-volet-replie';
  // Barre de défilement du système masquée dès le premier rendu (installerAscenseur)
  racine.classList.add('avec-ascenseur');

  // Sommaire (et volet latéral) repliés sur grand écran : appliqué dès le chargement,
  // sans clignement
  try {
    if (localStorage.getItem(CLE_SOMMAIRE) === '1') racine.classList.add('sommaire-replie');
    if (localStorage.getItem(CLE_VOLET) === '1') racine.classList.add('volet-replie');
  } catch (e) {
    /* stockage indisponible */
  }

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
      parametresTitre: 'Paramètres : application, assistant IA, mises à jour (Ctrl+,)',
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
      masquerSommaire: 'Masquer le sommaire',
      afficherVolet: 'Afficher le volet latéral',
      masquerVolet: 'Masquer le volet latéral',
      copier: 'Copier',
      copie: 'Copié',
      texte: 'Texte',
      pseudoCode: 'Pseudo-code',
      assembleur: 'Assembleur {nom}',
      github: 'GitHub',
      githubTitre: 'Voir le projet sur GitHub',
      githubAstuce: 'Appui long : favori, partage, issue',
      ghFavori: 'Mettre en favori',
      ghPartager: 'Partager le projet',
      ghIssue: 'Soumettre une issue',
      ghFavoriAstuce: 'Dépôt ouvert : l’étoile « Star » se trouve en haut à droite de la page.',
      ghCopie: 'Lien du projet copié dans le presse-papiers.',
      ghCopieEchec: 'Copie impossible. Adresse du projet : {url}',
      piedGithub: 'Universal Learn Academy sur GitHub',
      quitter: 'Quitter',
      quitterTitre:
        'Quitter Universal Learn Academy : l’application se ferme complètement, elle ne reste pas en arrière-plan',
    },
    en: {
      themeClair: 'Switch to light theme',
      themeSombre: 'Switch to dark theme',
      soutienTitre: 'Support Universal Learn Academy: buy me a coffee (Buy Me a Coffee)',
      soutienAria: 'Buy me a coffee on Buy Me a Coffee',
      soutien: 'Buy me a coffee',
      parametresTitre: 'Settings: application, AI assistant, updates (Ctrl+,)',
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
      masquerSommaire: 'Hide the contents',
      afficherVolet: 'Show the side panel',
      masquerVolet: 'Hide the side panel',
      copier: 'Copy',
      copie: 'Copied',
      texte: 'Text',
      pseudoCode: 'Pseudocode',
      assembleur: '{nom} assembly',
      github: 'GitHub',
      githubTitre: 'See the project on GitHub',
      githubAstuce: 'Long press: star, share, issue',
      ghFavori: 'Star the project',
      ghPartager: 'Share the project',
      ghIssue: 'Submit an issue',
      ghFavoriAstuce: 'Repository opened: the “Star” button is at the top right of the page.',
      ghCopie: 'Project link copied to the clipboard.',
      ghCopieEchec: 'Copy not possible. Project address: {url}',
      piedGithub: 'Universal Learn Academy on GitHub',
      quitter: 'Quit',
      quitterTitre: 'Quit Universal Learn Academy: the app closes completely, it does not stay in the background',
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
    installerGithub(barre);
    installerAccueil(barre);
    installerAide(barre);
    installerParametres(barre);
    barre.appendChild(bouton);
    installerQuitter(barre);
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

    // Grand écran : colonne repliable, état mémorisé. Petit écran : tiroir.
    var voile = creer('div', 'voile');
    document.body.appendChild(voile);
    var barre = document.querySelector('.barre');
    var bouton = null;
    var etroit = window.matchMedia ? matchMedia('(max-width: 64rem)') : { matches: false };
    function visible() {
      return etroit.matches
        ? document.body.classList.contains('sommaire-ouvert')
        : !racine.classList.contains('sommaire-replie');
    }
    function majBouton() {
      if (!bouton) return;
      var v = visible();
      var libelle = tb(v ? 'masquerSommaire' : 'afficherSommaire');
      bouton.setAttribute('aria-label', libelle);
      bouton.title = libelle;
      bouton.setAttribute('aria-expanded', String(v));
    }
    if (barre) {
      bouton = creer('button', 'bouton-icone bouton-sommaire');
      bouton.type = 'button';
      majBouton();
      relibeller.push(majBouton);
      bouton.setAttribute('aria-controls', 'sommaire');
      barre.insertBefore(bouton, barre.firstChild);
    }
    function basculer(ouvrir) {
      document.body.classList.toggle('sommaire-ouvert', ouvrir);
      majBouton();
    }
    function replier(replie) {
      racine.classList.toggle('sommaire-replie', replie);
      try {
        if (replie) localStorage.setItem(CLE_SOMMAIRE, '1');
        else localStorage.removeItem(CLE_SOMMAIRE);
      } catch (e) {
        /* stockage indisponible */
      }
      majBouton();
    }
    if (bouton)
      bouton.addEventListener('click', function () {
        if (etroit.matches) basculer(!document.body.classList.contains('sommaire-ouvert'));
        else {
          racine.classList.add('volets-animes');
          replier(!racine.classList.contains('sommaire-replie'));
        }
      });
    if (etroit.addEventListener) etroit.addEventListener('change', majBouton);
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

  /* Volet latéral repliable (sans sommaire) -------------------------------- */

  // Colonne de gauche d'une page sans sommaire : en-tête d'un quiz (.quiz > .entete)
  // ou volet d'une page (.page > .volet-lateral, comme les profils de l'accueil). Sur
  // grand écran, un bouton de la barre la replie ; l'état est mémorisé pour toutes les
  // pages. Les règles de mise en page (classe « volet-replie ») sont dans la feuille de
  // chaque page. Sur petit écran, le volet passe au-dessus du contenu et le bouton se cache.
  function voletLateral() {
    var barre = document.querySelector('.barre');
    if (!barre || document.querySelector('.bouton-sommaire')) return;
    var volet = document.querySelector('.page > .quiz > .entete, .page > .volet-lateral');
    if (!volet) return;
    if (!volet.id) volet.id = 'volet-lateral';
    var bouton = creer('button', 'bouton-icone bouton-sommaire bouton-volet');
    bouton.type = 'button';
    bouton.setAttribute('aria-controls', volet.id);
    function maj() {
      var v = !racine.classList.contains('volet-replie');
      var libelle = tb(v ? 'masquerVolet' : 'afficherVolet');
      bouton.setAttribute('aria-label', libelle);
      bouton.title = libelle;
      bouton.setAttribute('aria-expanded', String(v));
    }
    maj();
    relibeller.push(maj);
    bouton.addEventListener('click', function () {
      racine.classList.add('volets-animes'); // animation au clic seulement (cours.css, section 12)
      var replie = racine.classList.toggle('volet-replie');
      try {
        if (replie) localStorage.setItem(CLE_VOLET, '1');
        else localStorage.removeItem(CLE_VOLET);
      } catch (e) {
        /* stockage indisponible */
      }
      maj();
    });
    barre.insertBefore(bouton, barre.firstChild);
  }
  window.charteVoletLateral = voletLateral;

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

  /* Appui long (2.11.0) -------------------------------------------------------
     Mécanisme générique, repris d'Interactive Music Player (githubMenu.js) pour
     servir à d'autres boutons : un appui maintenu 450 ms sans bouger de plus de
     8 px déclenche surAppui ; le clic qui suit est alors avalé (le lien ne s'ouvre
     pas), et le menu contextuel est refusé pendant l'appui (au doigt, il arriverait
     pile sur le geste). Options : { duree, marge, surAppui(e), avantClic(e) : false
     pour avaler un clic ordinaire, bloquerMenu() : true pour refuser le menu
     contextuel hors appui }. Aussi pour les autres scripts : window.ulaAppuiLong. */
  function appuiLong(cible, options) {
    var o = options || {};
    var duree = o.duree || 450;
    var marge = o.marge || 8;
    var minuterie = null;
    var origine = null;
    var declenche = false;
    function annuler() {
      if (minuterie) clearTimeout(minuterie);
      minuterie = null;
      origine = null;
    }
    cible.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      declenche = false;
      origine = { x: e.clientX, y: e.clientY };
      minuterie = setTimeout(function () {
        minuterie = null;
        declenche = true;
        if (o.surAppui) o.surAppui(e);
      }, duree);
    });
    cible.addEventListener('pointermove', function (e) {
      if (!origine) return;
      if (Math.hypot(e.clientX - origine.x, e.clientY - origine.y) > marge) annuler();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
      cible.addEventListener(type, annuler);
    });
    cible.addEventListener('contextmenu', function (e) {
      if (origine || (o.bloquerMenu && o.bloquerMenu())) e.preventDefault();
    });
    // En capture : passe avant tout autre écouteur de clic de la cible
    cible.addEventListener(
      'click',
      function (e) {
        if (declenche || (o.avantClic && o.avantClic(e) === false)) {
          declenche = false;
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true,
    );
    return { annuler: annuler };
  }
  window.ulaAppuiLong = appuiLong;

  /* Annonce brève (copie du lien, astuce) : bulle en bas de la fenêtre ---------- */
  var annonce = null;
  var minuterieAnnonce = null;
  function annoncer(texte) {
    if (!annonce) {
      annonce = creer('div', 'ula-annonce');
      annonce.setAttribute('role', 'status');
      document.body.appendChild(annonce);
    }
    annonce.textContent = texte;
    annonce.classList.add('visible');
    clearTimeout(minuterieAnnonce);
    minuterieAnnonce = setTimeout(function () {
      annonce.classList.remove('visible');
    }, 4200);
  }

  /* Bouton GitHub (2.11.0) ---------------------------------------------------------
     Le même que celui d'Interactive Music Player : le chat du logo en trois tracés
     (queue, pattes, tête), la queue ondule et la tête s'incline au survol ; un appui
     long déplie un menu (favori, partage, issue). Le lien s'ouvre dans le navigateur
     du système (_outils/app/fenetres.js, target _blank). Dans un navigateur, un
     nouvel onglet. */
  var DEPOT = 'https://github.com/WolfGang-PRoxa/universal-learn-academy';
  var SVG = 'http://www.w3.org/2000/svg';

  function svgIcone(traces) {
    var s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    traces.forEach(function (t) {
      var e = document.createElementNS(SVG, t[0]);
      Object.keys(t[1]).forEach(function (k) {
        e.setAttribute(k, t[1][k]);
      });
      s.appendChild(e);
    });
    return s;
  }

  // Le logo d'un seul tracé, coupé aux sommets qu'il traversait déjà : la queue (de
  // 9,19 à 2,16), les pattes et les épaules (immobiles), la tête d'une épaule à
  // l'autre, seule à tourner, autour de la nuque. Rendu au repos inchangé.
  var CHAT = [
    ['path', { class: 'gh-queue', d: 'M9 19c-5 1.5-5-2.5-7-3' }],
    ['path', { class: 'gh-pattes', d: 'M16 22v-3.87a3.37 3.37 0 0 0-.94-2.61M9.94 15.55A3.37 3.37 0 0 0 9 18.13V22' }],
    [
      'path',
      {
        class: 'gh-tete',
        d: 'M15.06 15.52c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7',
      },
    ],
  ];

  function installerGithub(barre) {
    var ancre = creer('span', 'gh-ancre');
    var a = creer('a', 'bouton-icone bouton-github');
    a.href = DEPOT;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.draggable = false;
    a.setAttribute('aria-haspopup', 'menu');
    a.setAttribute('aria-expanded', 'false');
    a.appendChild(svgIcone(CHAT));

    var menu = creer('div', 'ula-pop gh-menu');
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    function entree(balise, icone) {
      var e = creer(balise, 'gh-menu-entree');
      e.setAttribute('role', 'menuitem');
      if (balise === 'a') {
        e.target = '_blank';
        e.rel = 'noopener noreferrer';
      } else e.type = 'button';
      e.appendChild(svgIcone(icone));
      e.appendChild(creer('span'));
      menu.appendChild(e);
      return e;
    }
    var favori = entree('a', [
      [
        'polygon',
        { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' },
      ],
    ]);
    favori.href = DEPOT;
    var partager = entree('button', [
      ['circle', { cx: '18', cy: '5', r: '3' }],
      ['circle', { cx: '6', cy: '12', r: '3' }],
      ['circle', { cx: '18', cy: '19', r: '3' }],
      ['line', { x1: '8.59', y1: '13.51', x2: '15.42', y2: '17.49' }],
      ['line', { x1: '15.41', y1: '6.51', x2: '8.59', y2: '10.49' }],
    ]);
    // Le cercle et son point : l'icône d'une issue ouverte, chez GitHub même
    var issue = entree('a', [
      ['circle', { cx: '12', cy: '12', r: '9' }],
      ['circle', { cx: '12', cy: '12', r: '2.2', fill: 'currentColor', stroke: 'none' }],
    ]);
    issue.href = DEPOT + '/issues/new';
    var entrees = [favori, partager, issue];

    function libelle() {
      a.title = tb('githubTitre');
      a.dataset.infobulleAstuce = tb('githubAstuce');
      a.setAttribute('aria-label', tb('github'));
      favori.lastChild.textContent = tb('ghFavori');
      partager.lastChild.textContent = tb('ghPartager');
      issue.lastChild.textContent = tb('ghIssue');
    }
    libelle();
    relibeller.push(libelle);

    function ouvrir() {
      if (!menu.hidden) return;
      menu.classList.remove('se-ferme');
      menu.hidden = false;
      a.setAttribute('aria-expanded', 'true');
      var bulle = document.getElementById('ula-infobulle');
      if (bulle) bulle.classList.remove('visible');
      try {
        entrees[0].focus({ preventScroll: true });
      } catch (e) {
        entrees[0].focus();
      }
    }
    function fermer() {
      if (menu.hidden || menu.classList.contains('se-ferme')) return;
      menu.classList.add('se-ferme');
      var fait = function () {
        menu.removeEventListener('animationend', fait);
        menu.classList.remove('se-ferme');
        menu.hidden = true;
        a.setAttribute('aria-expanded', 'false');
      };
      menu.addEventListener('animationend', fait);
      setTimeout(fait, 400);
    }

    appuiLong(a, {
      surAppui: ouvrir,
      // Menu ouvert : un clic sur le bouton le referme, sans ouvrir le lien
      avantClic: function () {
        if (menu.hidden) return true;
        fermer();
        return false;
      },
      bloquerMenu: function () {
        return !menu.hidden;
      },
    });

    function copier(url) {
      var fini = function (ok) {
        annoncer(ok ? tb('ghCopie') : tb('ghCopieEchec').replace('{url}', url));
      };
      if (navigator.clipboard && navigator.clipboard.writeText)
        navigator.clipboard.writeText(url).then(
          function () {
            fini(true);
          },
          function () {
            fini(false);
          },
        );
      else fini(false);
    }
    favori.addEventListener('click', function () {
      annoncer(tb('ghFavoriAstuce'));
      fermer();
    });
    partager.addEventListener('click', function () {
      fermer();
      if (typeof navigator.share === 'function') {
        var p = navigator.share({ title: 'Universal Learn Academy', url: DEPOT });
        if (p && typeof p.catch === 'function')
          p.catch(function (err) {
            if (err && err.name === 'AbortError') return;
            copier(DEPOT);
          });
        return;
      }
      copier(DEPOT);
    });
    issue.addEventListener('click', fermer);

    document.addEventListener('pointerdown', function (e) {
      if (menu.hidden || menu.contains(e.target) || a.contains(e.target)) return;
      fermer();
    });
    document.addEventListener('keydown', function (e) {
      if (menu.hidden) return;
      if (e.key === 'Escape') {
        fermer();
        a.focus();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        var de = entrees.indexOf(document.activeElement);
        var pas = e.key === 'ArrowDown' ? 1 : -1;
        var vers = de === -1 ? (pas === 1 ? 0 : entrees.length - 1) : (de + pas + entrees.length) % entrees.length;
        entrees[vers].focus();
      }
    });

    animerChat(a);
    ancre.appendChild(a);
    ancre.appendChild(menu);
    barre.appendChild(ancre);
  }

  // Queue qui ondule et tête qui s'incline au survol (headerButtonAnimations.js
  // d'Interactive Music Player). La queue est rééchantillonnée à pas réguliers le
  // long de sa courbe ; une onde court le long de sa normale, nulle à la base et
  // pleine au bout, puis le tracé est refermé en Catmull-Rom. La tête attend un
  // moment, s'incline (léger dépassement), tient, puis revient.
  function animerChat(bouton) {
    var queue = bouton.querySelector('.gh-queue');
    var tete = bouton.querySelector('.gh-tete');
    if (!queue || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var REPOS = 'M9 19c-5 1.5-5-2.5-7-3';
    var P = [
      { x: 9, y: 19 },
      { x: 4, y: 20.5 },
      { x: 4, y: 16.5 },
      { x: 2, y: 16 },
    ];
    var AMPLITUDE = 1.6;
    var ONDES = 0.85;
    var PERIODE = 3.0;
    var POINTS = 14;
    function bezier(u) {
      var v = 1 - u;
      var a = v * v * v;
      var b = 3 * v * v * u;
      var c = 3 * v * u * u;
      var d = u * u * u;
      return {
        x: a * P[0].x + b * P[1].x + c * P[2].x + d * P[3].x,
        y: a * P[0].y + b * P[1].y + c * P[2].y + d * P[3].y,
      };
    }
    var repos = (function () {
      var N = 240;
      var dense = [];
      var cumul = [0];
      for (var i = 0; i <= N; i++) {
        dense.push(bezier(i / N));
        if (i > 0) cumul.push(cumul[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y));
      }
      var total = cumul[N] || 1;
      var sortie = [];
      var j = 0;
      for (var k = 0; k < POINTS; k++) {
        var s = k / (POINTS - 1);
        var cible = s * total;
        while (j < N - 1 && cumul[j + 1] < cible) j++;
        var f = Math.min(1, (cible - cumul[j]) / (cumul[j + 1] - cumul[j] || 1));
        sortie.push({
          x: dense[j].x + (dense[j + 1].x - dense[j].x) * f,
          y: dense[j].y + (dense[j + 1].y - dense[j].y) * f,
          s: s,
          nx: 0,
          ny: 0,
        });
      }
      for (var m = 0; m < sortie.length; m++) {
        var avant = sortie[Math.max(0, m - 1)];
        var apres = sortie[Math.min(sortie.length - 1, m + 1)];
        var tx = apres.x - avant.x;
        var ty = apres.y - avant.y;
        var l = Math.hypot(tx, ty) || 1;
        sortie[m].nx = -ty / l;
        sortie[m].ny = tx / l;
      }
      return sortie;
    })();
    var r2 = function (v) {
      return Math.round(v * 100) / 100;
    };
    function trace(pts) {
      var n = pts.length;
      var d = 'M' + r2(pts[0].x) + ' ' + r2(pts[0].y);
      for (var i = 0; i < n - 1; i++) {
        var p0 = pts[Math.max(0, i - 1)];
        var p1 = pts[i];
        var p2 = pts[i + 1];
        var p3 = pts[Math.min(n - 1, i + 2)];
        d +=
          'C' +
          r2(p1.x + (p2.x - p0.x) / 6) +
          ' ' +
          r2(p1.y + (p2.y - p0.y) / 6) +
          ',' +
          r2(p2.x - (p3.x - p1.x) / 6) +
          ' ' +
          r2(p2.y - (p3.y - p1.y) / 6) +
          ',' +
          r2(p2.x) +
          ' ' +
          r2(p2.y);
      }
      return d;
    }
    function onde(phase, amplitude) {
      return trace(
        repos.map(function (p) {
          var decalage = amplitude * Math.pow(p.s, 1.7) * Math.sin(2 * Math.PI * (ONDES * p.s - phase));
          return { x: p.x + p.nx * decalage, y: p.y + p.ny * decalage };
        }),
      );
    }

    // Tête : attente, inclinaison, tenue, retour
    var PIVOT = '12.5 15.54';
    var hasard = function (a, b) {
      return a + Math.random() * (b - a);
    };
    var versAvant = function (t) {
      var c = 1.35;
      var u = t - 1;
      return 1 + (c + 1) * u * u * u + c * u * u;
    };
    var sinus = function (t) {
      return 0.5 - 0.5 * Math.cos(Math.PI * t);
    };
    var survol = false;
    var phase = 0;
    var ampleur = 0;
    var anim = null;
    var dernier = 0;
    var etape = 'attente';
    var ecoule = 0;
    var duree = hasard(2.4, 6.5);
    var de = 0;
    var vers = 0;
    var angle = 0;
    function pasTete(dt) {
      if (!tete) return;
      if (!survol && etape !== 'retour' && angle !== 0) {
        de = angle;
        vers = 0;
        etape = 'retour';
        ecoule = 0;
        duree = 0.6;
      }
      ecoule += dt;
      var t = duree > 0 ? Math.min(1, ecoule / duree) : 1;
      if (etape === 'incline') angle = de + (vers - de) * versAvant(t);
      else if (etape === 'retour') angle = de + (vers - de) * sinus(t);
      tete.setAttribute('transform', 'rotate(' + Math.round(angle * 1000) / 1000 + ' ' + PIVOT + ')');
      if (t < 1) return;
      ecoule = 0;
      if (etape === 'attente') {
        if (!survol) return;
        de = angle;
        vers = hasard(5, 9);
        etape = 'incline';
        duree = 0.34;
      } else if (etape === 'incline') {
        etape = 'tenue';
        duree = hasard(0.55, 1.5);
      } else if (etape === 'tenue') {
        de = angle;
        vers = 0;
        etape = 'retour';
        duree = 0.6;
      } else {
        angle = 0;
        etape = 'attente';
        duree = hasard(2.4, 6.5);
      }
    }
    function pas(maintenant) {
      var dt = Math.min(0.05, (maintenant - dernier) / 1000) || 0.016;
      dernier = maintenant;
      phase = (phase + dt / PERIODE) % 1;
      ampleur += ((survol ? 1 : 0) - ampleur) * Math.min(1, (survol ? 2.2 : 1.1) * dt);
      pasTete(dt);
      if (!survol && ampleur < 0.012 && Math.abs(angle) < 0.05) {
        queue.setAttribute('d', REPOS);
        if (tete) tete.removeAttribute('transform');
        ampleur = 0;
        angle = 0;
        etape = 'attente';
        ecoule = 0;
        duree = hasard(2.4, 6.5);
        anim = null;
        return;
      }
      queue.setAttribute('d', onde(phase, AMPLITUDE * ampleur));
      anim = requestAnimationFrame(pas);
    }
    bouton.addEventListener('mouseenter', function () {
      survol = true;
      if (!anim) {
        dernier = performance.now();
        anim = requestAnimationFrame(pas);
      }
    });
    bouton.addEventListener('mouseleave', function () {
      survol = false;
    });
  }

  // Lien vers le projet en bas de chaque page (pied .pied, créé s'il manque)
  function installerPied() {
    var pieds = document.querySelectorAll('.pied');
    var pied = pieds[pieds.length - 1];
    var ajoute = !pied;
    if (ajoute) {
      pied = creer('footer', 'pied pied-projet');
      document.body.appendChild(pied);
    }
    var a = creer('a', 'pied-github');
    a.href = DEPOT;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.appendChild(svgIcone(CHAT));
    var texte = creer('span');
    a.appendChild(texte);
    function libelle() {
      texte.textContent = tb('piedGithub');
    }
    libelle();
    relibeller.push(libelle);
    if (!ajoute) pied.appendChild(document.createTextNode(' · '));
    pied.appendChild(a);
  }

  /* Quitter (application installée, 2.11.0) : ferme vraiment l'application, sans la
     garder en arrière-plan (/_app/quitter, _outils/app/fenetres.js) */
  function installerQuitter(barre) {
    if (!/\bStudiesApp\//.test(navigator.userAgent)) return;
    var a = creer('a', 'bouton-icone bouton-quitter');
    a.href = '/_app/quitter';
    function libelle() {
      a.title = tb('quitterTitre');
      a.setAttribute('aria-label', tb('quitter'));
    }
    libelle();
    relibeller.push(libelle);
    barre.appendChild(a);
  }

  /* Infobulles (2.11.0) ---------------------------------------------------------
     Les attributs title deviennent data-infobulle, montrés dans une bulle à la charte
     (#ula-infobulle) près du pointeur, ou sous l'élément au clavier. Délai réglé dans
     les paramètres de l'application (0 à 2,5 s, 0 par défaut) : annoncé dans l'agent
     utilisateur (« ULA-infobulle/<ms> »), puis par window.ulaInfobulles(ms) quand il
     change. data-infobulle-astuce ajoute une seconde ligne. */
  var delaiInfobulle = Number((navigator.userAgent.match(/\bULA-infobulle\/(\d+)/) || [])[1] || 0);
  window.ulaInfobulles = function (ms) {
    var n = Number(ms);
    if (isFinite(n) && n >= 0) delaiInfobulle = Math.min(2500, n);
  };
  function installerInfobulles() {
    var bulle = creer('div');
    bulle.id = 'ula-infobulle';
    bulle.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bulle);
    var cible = null;
    var minuterie = null;
    var souris = { x: 0, y: 0 };

    function convertir(e) {
      var t = e.getAttribute('title');
      if (t == null) return;
      e.removeAttribute('title');
      if (!t) return;
      e.dataset.infobulle = t;
      if (!e.hasAttribute('aria-label') && (e.tagName === 'IFRAME' || !e.textContent.trim()))
        e.setAttribute('aria-label', t);
    }
    function parcourir(n) {
      if (n.nodeType !== 1) return;
      if (n.hasAttribute('title')) convertir(n);
      n.querySelectorAll('[title]').forEach(convertir);
    }
    parcourir(document.body);
    new MutationObserver(function (liste) {
      liste.forEach(function (m) {
        if (m.type === 'attributes') convertir(m.target);
        else m.addedNodes.forEach(parcourir);
      });
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] });

    function placer(x, y, sous) {
      var l = bulle.offsetWidth;
      var h = bulle.offsetHeight;
      var gauche = x + 12;
      var haut = y + (sous ? 8 : 16);
      if (gauche + l > innerWidth - 8) gauche = Math.max(8, innerWidth - l - 8);
      if (haut + h > innerHeight - 8) haut = Math.max(8, y - h - 12);
      bulle.style.left = gauche + 'px';
      bulle.style.top = haut + 'px';
    }
    function montrer(e, clavier) {
      var texte = e.dataset.infobulle;
      // Pas de bulle sur un bouton dont le menu est ouvert
      if (!texte || !e.isConnected || e.getAttribute('aria-expanded') === 'true') return;
      bulle.replaceChildren(document.createTextNode(texte));
      if (e.dataset.infobulleAstuce) bulle.appendChild(creer('span', 'astuce', e.dataset.infobulleAstuce));
      if (clavier) {
        var r = e.getBoundingClientRect();
        placer(r.left - 12, r.bottom, true);
      } else placer(souris.x, souris.y);
      bulle.classList.add('visible');
    }
    function cacher() {
      clearTimeout(minuterie);
      minuterie = null;
      cible = null;
      bulle.classList.remove('visible');
    }
    function programmer(e, clavier) {
      clearTimeout(minuterie);
      cible = e;
      if (delaiInfobulle > 0)
        minuterie = setTimeout(function () {
          montrer(e, clavier);
        }, delaiInfobulle);
      else montrer(e, clavier);
    }
    // Après un appui, la bulle ne revient qu'une fois le pointeur sorti de l'élément
    var appuye = null;
    document.addEventListener(
      'mousedown',
      function (ev) {
        appuye = (ev.target.closest && ev.target.closest('[data-infobulle]')) || null;
      },
      true,
    );
    document.addEventListener('mouseover', function (ev) {
      var e = ev.target.closest && ev.target.closest('[data-infobulle]');
      if (e === cible || (e && e === appuye)) return;
      appuye = null;
      cacher();
      if (e) {
        souris = { x: ev.clientX, y: ev.clientY };
        programmer(e, false);
      }
    });
    document.addEventListener('mousemove', function (ev) {
      souris = { x: ev.clientX, y: ev.clientY };
      if (cible && bulle.classList.contains('visible')) placer(souris.x, souris.y);
    });
    document.addEventListener('mouseout', function (ev) {
      if (cible && !ev.relatedTarget) cacher();
    });
    document.addEventListener('focusin', function (ev) {
      var e = ev.target;
      if (e.dataset && e.dataset.infobulle && e.matches(':focus-visible')) programmer(e, true);
    });
    document.addEventListener('focusout', cacher);
    ['mousedown', 'wheel', 'keydown', 'scroll'].forEach(function (type) {
      document.addEventListener(type, cacher, { passive: true, capture: true });
    });
  }

  /* Barre de défilement de la page (2.11.0) -----------------------------------
     La barre du système prend une colonne sur toute la hauteur de la fenêtre ; elle
     est masquée (cours.css) et remplacée par un ascenseur posé par-dessus la page,
     sous la barre du haut : discret au repos, il se montre au défilement et au
     survol, se saisit et se déplace ; un clic sur le rail saute à cet endroit.
     Molette, clavier et doigt font ce qu'ils faisaient. Les panneaux qui défilent
     seuls (sommaire, blocs de code) gardent une barre fine à la charte. */
  function installerAscenseur() {
    var page = document.scrollingElement || document.documentElement;
    var rail = creer('div', 'ula-ascenseur');
    rail.setAttribute('aria-hidden', 'true');
    var curseur = creer('div', 'ula-ascenseur-curseur');
    rail.appendChild(curseur);
    document.body.appendChild(rail);
    var minuterie = null;
    var saisie = null;
    var image = null;

    function mesurer() {
      image = null;
      var vue = page.clientHeight;
      var total = page.scrollHeight;
      rail.hidden = false; // un rail caché mesure 0 : on le mesure visible
      var hauteurRail = rail.clientHeight;
      var utile = total > vue + 1 && hauteurRail > 40;
      rail.hidden = !utile;
      if (!utile) return;
      var h = Math.max(36, Math.round((hauteurRail * vue) / total));
      var course = hauteurRail - h;
      var y = Math.round((course * page.scrollTop) / (total - vue)) || 0;
      curseur.style.height = h + 'px';
      curseur.style.transform = 'translateY(' + Math.min(course, Math.max(0, y)) + 'px)';
    }
    function planifier() {
      if (image == null) image = requestAnimationFrame(mesurer);
    }
    function reveiller() {
      rail.classList.add('actif');
      clearTimeout(minuterie);
      minuterie = setTimeout(function () {
        if (!saisie) rail.classList.remove('actif');
      }, 1200);
    }
    // Position du pointeur sur le rail → position dans la page
    // Instantané en glissant (la page défile en douceur sinon : cours.css), doux au clic
    function aller(clientY, decalage, doux) {
      var r = rail.getBoundingClientRect();
      var h = curseur.offsetHeight;
      var course = r.height - h || 1;
      var p = (clientY - r.top - decalage) / course;
      window.scrollTo({
        top: Math.max(0, Math.min(1, p)) * (page.scrollHeight - page.clientHeight),
        behavior: doux ? 'smooth' : 'instant',
      });
    }
    curseur.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      saisie = e.clientY - curseur.getBoundingClientRect().top;
      curseur.setPointerCapture(e.pointerId);
      rail.classList.add('saisi');
      racine.classList.add('defilement-saisi');
    });
    curseur.addEventListener('pointermove', function (e) {
      if (saisie == null) return;
      aller(e.clientY, saisie);
    });
    function lacher() {
      if (saisie == null) return;
      saisie = null;
      rail.classList.remove('saisi');
      racine.classList.remove('defilement-saisi');
      reveiller();
    }
    curseur.addEventListener('pointerup', lacher);
    curseur.addEventListener('pointercancel', lacher);
    rail.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.target !== rail) return;
      e.preventDefault();
      aller(e.clientY, curseur.offsetHeight / 2, true);
    });
    rail.addEventListener('pointerenter', reveiller);
    rail.addEventListener('pointermove', reveiller);
    window.addEventListener(
      'scroll',
      function () {
        planifier();
        reveiller();
      },
      { passive: true },
    );
    window.addEventListener('resize', planifier);
    if (window.ResizeObserver) new ResizeObserver(planifier).observe(document.body);
    mesurer();
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
    etape('infobulles', installerInfobulles);
    etape('pied', installerPied);
    etape('ascenseur', installerAscenseur);
    if (!contenu) return etape('volet latéral', voletLateral);

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
    etape('volet latéral', function () {
      if (!sommaire) voletLateral();
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
