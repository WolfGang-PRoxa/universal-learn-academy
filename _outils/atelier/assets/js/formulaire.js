/* ==========================================================================
   Atelier · formulaire flottant (Atelier.formulaire)
   --------------------------------------------------------------------------
   Petite fenêtre d'édition posée près de l'élément double-cliqué : nom et
   attributs d'une classe, extrémités d'une association, étiquette d'un
   arc… Entrée (hors zone de texte) ou « OK » valide, Échap annule, un clic
   à côté valide.

   ouvrir(parent, {
     x, y                       position (coordonnées de la fenêtre)
     titre
     champs: [{ nom, libelle, type: texte | zone | choix | case, valeur,
               options: [[valeur, libellé]], aide, lignes, placeholder }]
     surValider(valeurs)        renvoie une chaîne pour refuser (message)
     surSupprimer()             ajoute un bouton « Supprimer »
     surAnnuler()               fermeture sans valider (Annuler, Échap)
     actions: [{ libelle, action(valeurs) }]   boutons supplémentaires
   })
   ========================================================================== */
(function (A) {
  'use strict';

  var N = A.noyau,
    el = N.el,
    tr = A.tr;
  var ouvert = null;

  function fermer(valider) {
    if (!ouvert) return;
    var o = ouvert;
    if (valider && !o.appliquer()) return;
    ouvert = null;
    document.removeEventListener('pointerdown', o.surClicDehors, true);
    window.removeEventListener('resize', o.recaler);
    o.boite.remove();
    if (!valider && o.options.surAnnuler) o.options.surAnnuler();
    if (o.options.surFermer) o.options.surFermer();
  }

  function ouvrir(parent, options) {
    fermer(true);
    if (ouvert) return null;
    var boite = el('div', 'atelier-formulaire');
    boite.setAttribute('role', 'dialog');
    boite.setAttribute('aria-label', tr(options.titre || 'Modifier', options.titre || 'Edit'));
    if (options.titre) boite.appendChild(el('p', 'atelier-formulaire-titre', options.titre));
    var champs = {};
    var erreur = el('p', 'atelier-formulaire-erreur');
    erreur.hidden = true;

    (options.champs || []).forEach(function (c, i) {
      var ligne = el('label', 'atelier-champ' + (c.type === 'case' ? ' case' : ''));
      var entree;
      if (c.type === 'zone') {
        entree = el('textarea');
        entree.rows = c.lignes || 4;
        entree.spellcheck = false;
        entree.value = c.valeur || '';
      } else if (c.type === 'choix') {
        entree = el('select');
        (c.options || []).forEach(function (o) {
          var opt = el('option', null, o[1]);
          opt.value = o[0];
          entree.appendChild(opt);
        });
        entree.value = c.valeur == null ? '' : c.valeur;
      } else if (c.type === 'case') {
        entree = el('input');
        entree.type = 'checkbox';
        entree.checked = Boolean(c.valeur);
      } else {
        entree = el('input');
        entree.type = 'text';
        entree.autocomplete = 'off';
        entree.spellcheck = false;
        entree.value = c.valeur == null ? '' : c.valeur;
      }
      if (c.placeholder) entree.placeholder = c.placeholder;
      entree.name = c.nom;
      if (c.type === 'case') {
        ligne.appendChild(entree);
        ligne.appendChild(el('span', null, c.libelle));
      } else {
        ligne.appendChild(el('span', 'atelier-champ-libelle', c.libelle));
        ligne.appendChild(entree);
      }
      if (c.aide) ligne.appendChild(el('span', 'atelier-champ-aide', c.aide));
      boite.appendChild(ligne);
      champs[c.nom] = entree;
      if (i === 0)
        setTimeout(function () {
          entree.focus();
          if (entree.select && c.type !== 'zone') entree.select();
        }, 20);
    });
    boite.appendChild(erreur);

    function valeurs() {
      var v = {};
      Object.keys(champs).forEach(function (k) {
        v[k] = champs[k].type === 'checkbox' ? champs[k].checked : champs[k].value;
      });
      return v;
    }
    function appliquer() {
      if (!options.surValider) return true;
      var r = options.surValider(valeurs());
      if (typeof r === 'string') {
        erreur.textContent = r;
        erreur.hidden = false;
        return false;
      }
      return true;
    }

    var barre = el('div', 'atelier-formulaire-actions');
    if (options.surSupprimer) {
      barre.appendChild(
        N.bouton(tr('Supprimer', 'Delete'), 'petit discret danger', function () {
          var o = ouvert;
          ouvert = null;
          document.removeEventListener('pointerdown', o.surClicDehors, true);
          window.removeEventListener('resize', o.recaler);
          boite.remove();
          options.surSupprimer();
        }),
      );
    }
    (options.actions || []).forEach(function (a) {
      barre.appendChild(
        N.bouton(a.libelle, 'petit discret', function () {
          a.action(valeurs());
        }),
      );
    });
    barre.appendChild(el('span', 'espace'));
    barre.appendChild(
      N.bouton(tr('Annuler', 'Cancel'), 'petit discret', function () {
        fermer(false);
      }),
    );
    barre.appendChild(
      N.bouton('OK', 'petit principal', function () {
        fermer(true);
      }),
    );
    boite.appendChild(barre);

    boite.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        fermer(false);
      } else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') {
        e.preventDefault();
        fermer(true);
      } else if (e.key === 'Enter' && e.target.tagName === 'TEXTAREA' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        fermer(true);
      }
    });

    parent.appendChild(boite);
    // Position : près du point demandé, sans sortir du parent (recalée si la fenêtre change de taille)
    var rp0 = parent.getBoundingClientRect();
    var dx = (options.x != null ? options.x : rp0.left + rp0.width / 2) - rp0.left;
    var dy = (options.y != null ? options.y : rp0.top + 40) - rp0.top;
    function recaler() {
      var rp = parent.getBoundingClientRect(),
        l = boite.offsetWidth,
        h = boite.offsetHeight;
      boite.style.left = Math.max(8, Math.min(dx, rp.width - l - 8)) + 'px';
      boite.style.top = Math.max(8, Math.min(dy, Math.max(8, rp.height - h - 8))) + 'px';
    }
    recaler();
    window.addEventListener('resize', recaler);

    function surClicDehors(e) {
      if (!boite.contains(e.target)) fermer(true);
    }
    ouvert = { boite: boite, options: options, appliquer: appliquer, surClicDehors: surClicDehors, recaler: recaler };
    setTimeout(function () {
      if (ouvert && ouvert.boite === boite) document.addEventListener('pointerdown', surClicDehors, true);
    }, 0);
    return boite;
  }

  A.formulaire = {
    ouvrir: ouvrir,
    fermer: fermer,
    estOuvert: function () {
      return Boolean(ouvert);
    },
  };
})(window.Atelier);
