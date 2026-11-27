/* ==========================================================================
   Quiz · panneau de conversation avec Claude (QuizApp.claude)
   --------------------------------------------------------------------------
   Panneau latéral ouvert depuis une question (« Demander à Claude »), depuis
   les résultats (question libre, questions sur le bilan) ou depuis l'accueil.
   Chaque conversation appartient à la tentative : elle est archivée avec elle
   et reprend là où elle s'était arrêtée (même session Claude Code).

   ouvrir({
     titre, sousTitre,
     conversation   objet { session, messages: [{ role, texte, date, modele }] }
                    modifié sur place (il vit dans la session du quiz)
     contexte()     contexte envoyé à Claude avec chaque message
     suggestions    [{ libelle, message, remplir }] : boutons au-dessus du champ
     surMaj()       appelé après chaque échange (sauvegarde de la progression)
     route          route du serveur (défaut « claude/aide » ; l'atelier : « atelier/aide »)
     texteHorsLigne(message)  demande copiée pour claude.ai sans serveur (facultatif)
   })

   Sans serveur local, « Envoyer » copie la demande complète (contexte compris)
   et ouvre claude.ai dans un nouvel onglet.
   ========================================================================== */
(function (A) {
  'use strict';

  var O = A.outils,
    el = O.el,
    T = A.t;
  var P = null; // éléments du panneau
  var courant = null; // options de la conversation ouverte
  var enCours = null; // appel en cours { annuler }

  function construire() {
    P = {};
    P.voile = el('div', 'claude-voile');
    P.voile.addEventListener('click', fermer);
    P.racine = el('aside', 'claude-panneau');
    // Libellés fixes du panneau, refaits quand la langue change
    function libeller() {
      P.racine.setAttribute('aria-label', T('claude.panneau'));
      fermerB.setAttribute('aria-label', T('claude.fermer'));
      fermerB.title = T('claude.fermerTitre');
      P.champ.placeholder = T('claude.champ');
      P.champ.setAttribute('aria-label', T('claude.champAria'));
      P.envoyer.setAttribute('aria-label', T('claude.envoyer'));
      P.nouvelle.textContent = T('claude.nouvelle');
      majInfos();
    }
    P.racine.setAttribute('role', 'complementary');

    var tete = el('div', 'claude-tete');
    var titres = el('div', 'claude-titres');
    P.titre = el('p', 'claude-titre');
    P.sousTitre = el('p', 'claude-sous-titre');
    titres.appendChild(P.titre);
    titres.appendChild(P.sousTitre);
    tete.insertAdjacentHTML('beforeend', '<span class="claude-logo">' + O.icone('claude') + '</span>');
    tete.appendChild(titres);
    var fermerB = O.bouton('', 'bouton-icone-seul', fermer, 'fermer');
    tete.appendChild(fermerB);
    P.racine.appendChild(tete);

    P.infos = el('div', 'claude-infos');
    P.racine.appendChild(P.infos);

    P.fil = el('div', 'claude-fil');
    P.fil.setAttribute('aria-live', 'polite');
    P.racine.appendChild(P.fil);

    var bas = el('div', 'claude-bas');
    P.suggestions = el('div', 'claude-suggestions');
    bas.appendChild(P.suggestions);
    var saisie = el('div', 'claude-saisie');
    P.champ = el('textarea', 'claude-champ');
    P.champ.rows = 2;
    P.champ.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        envoyer(P.champ.value);
      }
    });
    P.champ.addEventListener('input', function () {
      P.champ.style.height = 'auto';
      P.champ.style.height = Math.min(P.champ.scrollHeight, 220) + 'px';
    });
    P.envoyer = O.bouton(
      '',
      'principal bouton-envoyer',
      function () {
        envoyer(P.champ.value);
      },
      'envoyer',
    );
    saisie.appendChild(P.champ);
    saisie.appendChild(P.envoyer);
    bas.appendChild(saisie);
    var pied = el('div', 'claude-pied');
    P.nouvelle = O.bouton(T('claude.nouvelle'), 'discret petit', nouvelleConversation);
    pied.appendChild(P.nouvelle);
    P.mode = el('span', 'claude-mode');
    pied.appendChild(P.mode);
    bas.appendChild(pied);
    P.racine.appendChild(bas);

    document.body.appendChild(P.voile);
    document.body.appendChild(P.racine);
    document.addEventListener('keydown', function (e) {
      if (
        e.key === 'Escape' &&
        document.body.classList.contains('claude-ouvert') &&
        !document.querySelector('dialog[open]')
      )
        fermer();
    });
    A.connexion.surChangement(majInfos);
    libeller();
    document.addEventListener('ula:langue', libeller);
  }

  /* Affichage ------------------------------------------------------------------ */

  // Libellé de l'assistant : bouton qui ouvre son menu (le choisir, ou le configurer)
  function boutonIa() {
    var b = el('button', 'claude-puce bouton-ia');
    b.type = 'button';
    b.textContent = A.connexion.assistant().nom;
    b.title = T('ia.menuTitre');
    b.setAttribute('aria-haspopup', 'menu');
    b.addEventListener('click', function () {
      A.dialogues.menuIa(b);
    });
    return b;
  }

  function majInfos() {
    if (!P) return;
    P.infos.innerHTML = '';
    var C = A.connexion;
    if (C.enLigne) P.infos.appendChild(boutonIa());
    if (C.claudeDisponible()) {
      var u = C.etat.reglages.usages.aide;
      var f = C.assistant().fournisseur;
      // Claude : modèle et effort de l'usage « aide » ; ChatGPT : modèle de Codex et effort
      // de l'usage ; Gemini : son modèle seul
      var modele = f === 'claude' ? u.modele : (C.etat.reglages[f] || {}).modele;
      var effort = f === 'gemini' ? '' : u.effort;
      P.infos.appendChild(
        el(
          'span',
          'claude-puce',
          T(effort ? 'claude.modeleEffort' : 'claude.modele', {
            modele: modele || T(f === 'claude' ? 'resultats.parDefaut' : 'ia.modeleCompte'),
            effort: effort,
          }),
        ),
      );
      var q = f === 'claude' && C.etat.quota && C.etat.quota.unifiedWindows;
      if (q && q.five_hour) {
        var pct = Math.round(q.five_hour.utilization * 100);
        var puce = el('span', 'claude-puce' + (pct >= 90 ? ' alerte' : ''), T('claude.quota', { pourcent: pct }));
        puce.title =
          T('claude.quotaTitre') +
          (q.seven_day ? T('claude.quotaSemaine', { pourcent: Math.round(q.seven_day.utilization * 100) }) : '');
        P.infos.appendChild(puce);
      }
      P.mode.textContent = T('claude.mode');
      P.envoyer.title = T('claude.envoyer');
    } else {
      P.infos.appendChild(
        el('span', 'claude-puce alerte', C.enLigne ? T('claude.introuvable') : T('claude.horsLigne')),
      );
      P.mode.textContent = C.enLigne ? '' : T('claude.lancer');
      P.envoyer.title = T('claude.copierEtOuvrir');
    }
  }

  function bulle(message) {
    var b = el(
      'div',
      'claude-message ' + (message.role === 'etudiant' ? 'etudiant' : message.role === 'note' ? 'note' : 'claude'),
    );
    var corps = el('div', 'claude-corps');
    if (message.role === 'claude') {
      corps.innerHTML = A.markdown(message.texte);
      O.enrichir(corps);
    } else {
      corps.textContent = message.texte;
    }
    b.appendChild(corps);
    if (message.role === 'claude' && message.texte) {
      var outils = el('div', 'claude-outils-message');
      var c = O.bouton(
        T('claude.copier'),
        'discret petit',
        function () {
          O.copier(message.texte).then(function () {
            O.notifier(T('claude.copiee'));
          });
        },
        'copier',
      );
      outils.appendChild(c);
      if (message.modele) outils.appendChild(el('span', 'claude-modele', message.modele.replace(/^claude-/, '')));
      b.appendChild(outils);
    }
    return b;
  }

  function afficherFil() {
    P.fil.innerHTML = '';
    var msgs = courant.conversation.messages;
    if (!msgs.length) {
      var vide = el('div', 'claude-vide');
      vide.appendChild(el('p', null, courant.accueil || T('claude.accueil')));
      P.fil.appendChild(vide);
    }
    msgs.forEach(function (m) {
      P.fil.appendChild(bulle(m));
    });
    defiler();
  }

  function afficherSuggestions() {
    P.suggestions.innerHTML = '';
    var liste = typeof courant.suggestions === 'function' ? courant.suggestions() : courant.suggestions || [];
    liste.forEach(function (s) {
      var b = el('button', 'claude-suggestion', s.libelle);
      b.type = 'button';
      b.addEventListener('click', function () {
        if (s.remplir) {
          P.champ.value = s.message;
          P.champ.focus();
          P.champ.setSelectionRange(s.message.length, s.message.length);
        } else envoyer(s.message);
      });
      P.suggestions.appendChild(b);
    });
  }

  function defiler() {
    P.fil.scrollTop = P.fil.scrollHeight;
  }

  function occupe(oui) {
    P.envoyer.disabled = oui;
    P.nouvelle.disabled = oui;
    P.racine.classList.toggle('occupe', oui);
    P.suggestions.querySelectorAll('button').forEach(function (b) {
      b.disabled = oui;
    });
  }

  /* Envoi -------------------------------------------------------------------------- */

  function texteHorsLigne(texte) {
    if (courant.texteHorsLigne) return courant.texteHorsLigne(texte);
    var c = courant.contexte ? courant.contexte() : {};
    var t = T('claude.demande') + '\n\n';
    if (c.quiz)
      t +=
        T('resultats.demandeQuiz') +
        c.quiz.titre +
        ' (' +
        [c.quiz.matiere, c.quiz.niveau].filter(Boolean).join(', ') +
        ')\n';
    var q = c.question;
    if (q) {
      t += '\nQuestion ' + q.numero + ' (' + q.type + (q.theme ? ', ' + q.theme : '') + ') :\n' + q.enonce + '\n';
      if (q.details) t += '\n' + q.details + '\n';
      t += '\n' + T('resultats.texteReponse') + (q.reponse || T('claude.aucunePourLInstant')) + '\n';
      if (q.corrigee) {
        t += T('resultats.texteAttendue') + (q.solution || '') + '\n';
        if (q.explication) t += T('claude.explication') + q.explication + '\n';
      } else {
        t += T('claude.pasCorrigee') + '\n';
      }
    }
    if (c.tentative) t += '\n' + c.tentative + '\n';
    return t + '\n' + T('claude.maDemande') + texte;
  }

  function envoyer(texte) {
    texte = String(texte || '').trim();
    if (!texte || enCours || !courant) return;
    var conv = courant.conversation;
    P.champ.value = '';
    P.champ.style.height = '';

    if (!A.connexion.claudeDisponible()) {
      conv.messages.push({ role: 'etudiant', texte: texte, date: new Date().toISOString() });
      var demande = texteHorsLigne(texte);
      O.copier(demande)
        .then(function () {
          conv.messages.push({ role: 'note', texte: T('claude.demandeCopiee'), date: new Date().toISOString() });
          window.open('https://claude.ai/new', '_blank', 'noopener');
        })
        .catch(function () {
          conv.messages.push({
            role: 'note',
            texte: T('claude.copieImpossible') + '\n\n' + demande,
            date: new Date().toISOString(),
          });
        })
        .finally(function () {
          afficherFil();
          if (courant.surMaj) courant.surMaj();
        });
      return;
    }

    var ctx = courant.contexte ? courant.contexte() : {};
    var etatQuestion = ctx.question ? JSON.stringify([ctx.question.corrigee, ctx.question.reponse]) : '';
    conv.messages.push({ role: 'etudiant', texte: texte, date: new Date().toISOString() });
    afficherFil();
    var enAttente = { role: 'claude', texte: '' };
    var b = bulle(enAttente);
    b.classList.add('en-cours');
    var etat = el('p', 'claude-etat', T('claude.reflechit'));
    b.appendChild(etat);
    P.fil.appendChild(b);
    defiler();
    occupe(true);

    var texteRecu = '',
      peinture = null,
      modele = null;
    function peindre() {
      peinture = null;
      var corps = b.querySelector('.claude-corps');
      corps.innerHTML = A.markdown(texteRecu);
      defiler();
    }
    var appel = A.connexion.flux(
      courant.route || 'claude/aide',
      {
        page: A.connexion.page(),
        message: texte,
        contexte: ctx,
        session: conv.session || null,
        reprendre: Boolean(conv.session),
        majContexte: Boolean(conv.session) && conv.etatQuestion !== etatQuestion,
      },
      function (type, d) {
        if (type === 'debut') modele = d.modele;
        else if (type === 'texte') {
          texteRecu += d.texte;
          etat.textContent = T('claude.ecrit');
          if (!peinture) peinture = requestAnimationFrame(peindre);
        } else if (type === 'outil') {
          etat.textContent = T('resultats.consulte', { quoi: d.detail ? d.detail.split('/').pop() : d.nom });
        }
      },
    );
    enCours = appel;
    appel.promesse
      .then(function (fin) {
        conv.session = fin.session;
        conv.etatQuestion = etatQuestion;
        conv.messages.push({
          role: 'claude',
          texte: fin.texte || texteRecu,
          date: new Date().toISOString(),
          modele: fin.modele || modele,
        });
      })
      .catch(function (e) {
        if (e.name === 'AbortError') return;
        conv.messages.push({
          role: 'note',
          texte: T('claude.erreur', { message: e.message }),
          date: new Date().toISOString(),
        });
      })
      .finally(function () {
        enCours = null;
        occupe(false);
        if (courant && courant.conversation === conv) afficherFil();
        if (courant && courant.surMaj) courant.surMaj();
        if (A.connexion.enLigne) A.connexion.rafraichir().catch(function () {});
        P.champ.focus();
      });
  }

  function nouvelleConversation() {
    if (!courant || enCours) return;
    var conv = courant.conversation;
    if (conv.messages.length && !window.confirm(T('claude.effacer'))) return;
    conv.messages.length = 0;
    conv.session = null;
    conv.etatQuestion = null;
    afficherFil();
    if (courant.surMaj) courant.surMaj();
  }

  /* Ouverture, fermeture -------------------------------------------------------------- */

  function ouvrir(options) {
    if (!P) construire();
    if (enCours && courant && courant.conversation !== options.conversation) {
      enCours.annuler();
      enCours = null;
      occupe(false);
    }
    courant = options;
    if (!options.conversation.messages) options.conversation.messages = [];
    P.titre.textContent = options.titre || A.connexion.assistant().nom;
    P.sousTitre.textContent = options.sousTitre || '';
    majInfos();
    afficherFil();
    afficherSuggestions();
    document.body.classList.add('claude-ouvert');
    setTimeout(function () {
      P.champ.focus();
    }, 50);
    if (options.messageInitial) envoyer(options.messageInitial);
  }

  function fermer() {
    document.body.classList.remove('claude-ouvert');
  }

  function estOuvert() {
    return document.body.classList.contains('claude-ouvert');
  }

  // Met à jour les suggestions (par exemple après la correction de la question)
  function rafraichir() {
    if (P && courant) {
      afficherSuggestions();
      majInfos();
    }
  }

  A.claude = {
    ouvrir: ouvrir,
    fermer: fermer,
    estOuvert: estOuvert,
    rafraichir: rafraichir,
    courant: function () {
      return courant;
    },
  };
})(window.QuizApp);
