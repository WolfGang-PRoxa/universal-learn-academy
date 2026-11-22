/* ==========================================================================
   Atelier · démarrage (dernier module chargé)
   --------------------------------------------------------------------------
   Signale que l'atelier est chargé (Atelier.charge : le démarrage du quiz
   l'attend pour ajouter le type « atelier »), attend la détection du
   serveur local par l'outil de quiz (QuizApp.pret), charge le travail
   enregistré, puis crée un espace de travail par bloc de la page :

     <div class="atelier" id="td1-ex2-mr" data-editeur="relationnel">
       <script type="application/json">{ "depart": …, "solution": … }</script>
     </div>

   Les jeux de données SQL partagés par la page sont dans
     <script type="application/json" id="atelier-jeux">{ "nom": { "titre", "description", "script" } }</script>
   ========================================================================== */
(function (A) {
  'use strict';

  var N = A.noyau;
  A._charge();
  A.espaces = [];

  function lireJson(script, quoi) {
    if (!script) return {};
    try {
      return JSON.parse(script.textContent);
    } catch (e) {
      console.error('[atelier] JSON illisible (' + quoi + ') :', e.message);
      return null;
    }
  }

  function texte(noeud) {
    if (!noeud) return '';
    var q = window.QuizApp;
    return q && q.outils ? q.outils.texteDe(noeud.innerHTML) : noeud.textContent.trim();
  }

  // Énoncé de l'exercice : le bloc exercice qui précède l'atelier (précédé de l'énoncé général
  // de la section quand la question a son propre bloc), sinon le texte de la section
  function enonceDe(bloc) {
    var n = bloc.previousElementSibling;
    while (n) {
      if (n.classList && n.classList.contains('exercice')) {
        var sec = bloc.closest('section'),
          premier = sec && sec.querySelector('.bloc.exercice');
        return premier && premier !== n && premier.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING
          ? texte(premier) + '\n\n' + texte(n)
          : texte(n);
      }
      if (/^H[1-4]$/.test(n.tagName)) break;
      n = n.previousElementSibling;
    }
    var parent = bloc.closest('.bloc.exercice');
    if (parent) return texte(parent);
    var section = bloc.closest('section');
    if (!section) return '';
    var morceaux = [];
    Array.prototype.forEach.call(section.children, function (c) {
      if (c === bloc || c.classList.contains('atelier') || c.tagName === 'DETAILS') return;
      if (c.compareDocumentPosition(bloc) & Node.DOCUMENT_POSITION_FOLLOWING) morceaux.push(texte(c));
    });
    return morceaux.join('\n').slice(-4000);
  }

  function sectionDe(bloc) {
    var n = bloc,
      titre = '';
    while (n && !titre) {
      var p = n.previousElementSibling;
      // Titre sans l'ancre « # » ajoutée par la charte ni la référence aux diapos
      while (p && !titre) {
        if (/^H[23]$/.test(p.tagName))
          titre = p.textContent
            .replace(/\s*#\s*$/, '')
            .replace(/\s*(diapos?|p\.)\s[\d–-]+.*$/, '')
            .trim();
        p = p.previousElementSibling;
      }
      n = n.parentElement;
      if (n && n.tagName === 'MAIN') break;
    }
    return titre;
  }

  function infosPage() {
    var surtitre = document.querySelector('.entete .surtitre');
    var fil = Array.prototype.map
      .call(document.querySelectorAll('.barre .fil > span, .barre .fil > a'), function (x) {
        return x.textContent.trim();
      })
      .filter(Boolean);
    var h1 = document.querySelector('h1');
    return {
      titre: h1 ? h1.textContent.trim() : document.title,
      niveau: fil[0] || '',
      matiere: fil[1] || (surtitre ? surtitre.textContent.trim() : ''),
    };
  }

  function instancier(bloc, commun) {
    if (bloc.dataset.atelierPret) return;
    bloc.dataset.atelierPret = '1';
    var script = bloc.querySelector(':scope > script[type="application/json"]');
    var config = lireJson(script, bloc.id || 'atelier');
    if (!config) {
      bloc.appendChild(
        N.el(
          'p',
          'atelier-alerte',
          A.tr(
            "Cet atelier ne peut pas s'afficher : ses données JSON sont illisibles.",
            'This workshop cannot be shown: its JSON data cannot be read.',
          ),
        ),
      );
      return;
    }
    config.editeur = config.editeur || bloc.dataset.editeur;
    config.id = config.id || bloc.id || bloc.dataset.id;
    config.mode = config.mode || bloc.dataset.mode;
    if (!config.id) console.warn('[atelier] bloc sans identifiant : son travail ne pourra pas être enregistré.', bloc);
    var esp = new A.Espace(bloc, config, {
      page: commun.page,
      jeux: commun.jeux,
      sauvegarde: config.id ? commun.sauvegarde : null,
      etat: config.id ? commun.sauvegarde.lire(config.id) : null,
      titrePage: commun.infos.titre,
      matiere: commun.infos.matiere,
      niveau: commun.infos.niveau,
      enonce: function () {
        return config.enonce ? config.enonce : enonceDe(bloc);
      },
      section: function () {
        return sectionDe(bloc);
      },
    });
    A.espaces.push(esp);
  }

  function demarrer() {
    var blocs = document.querySelectorAll('div.atelier[data-editeur]');
    if (!blocs.length) return;
    var q = window.QuizApp;
    var page = q && q.connexion ? q.connexion.page() : location.pathname;
    var ids = {};
    Array.prototype.forEach.call(blocs, function (b) {
      if (b.id && ids[b.id]) console.error('[atelier] identifiant en double : « ' + b.id + ' »');
      ids[b.id] = true;
    });
    var commun = {
      page: page,
      jeux: lireJson(document.getElementById('atelier-jeux'), 'atelier-jeux') || {},
      sauvegarde: new A.Sauvegarde(page),
      infos: infosPage(),
    };
    commun.sauvegarde.charger().then(function () {
      Array.prototype.forEach.call(blocs, function (b) {
        try {
          instancier(b, commun);
        } catch (e) {
          console.error('[atelier]', e);
          b.appendChild(
            N.el(
              'p',
              'atelier-alerte',
              A.tr("Erreur à l'affichage de cet atelier : ", 'Error while showing this workshop: ') + e.message,
            ),
          );
        }
      });
    });
  }

  function attendreQuiz() {
    var q = window.QuizApp;
    return q && q.pret ? q.pret : Promise.resolve();
  }

  function lancer() {
    attendreQuiz().then(demarrer);
  }
  // Langue de l'application changée : les espaces des TD refont leurs textes (ceux des quiz
  // sont recréés avec la question par l'outil de quiz)
  document.addEventListener('ula:langue', function () {
    A.espaces.forEach(function (esp) {
      try {
        esp.reconstruire();
      } catch (e) {
        console.error('[atelier]', e);
      }
    });
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lancer);
  else lancer();
})(window.Atelier);
