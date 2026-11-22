/* ==========================================================================
   Atelier · vue « texte » : rédaction libre (interface)
   ========================================================================== */
(function (A) {
  'use strict';

  var N = A.noyau,
    tr = A.tr;

  function creer(conteneur, ctx) {
    var m = null;
    var zone = N.el('textarea', 'atelier-redaction');
    zone.rows = (ctx.options && ctx.options.lignes) || 8;
    zone.placeholder = ctx.lectureSeule
      ? ''
      : (ctx.options && ctx.options.placeholder) || tr('Rédiger la réponse…', 'Write the answer…');
    zone.readOnly = Boolean(ctx.lectureSeule);
    zone.setAttribute('aria-label', tr('Réponse rédigée', 'Written answer'));
    zone.addEventListener('input', function () {
      m.texte = zone.value;
      ctx.modifie(m, false);
    });
    zone.addEventListener('change', function () {
      ctx.modifie(m, true);
    });
    conteneur.appendChild(zone);
    return {
      afficher: function (modele) {
        m = modele;
        if (zone.value !== (m.texte || '')) zone.value = m.texte || '';
      },
      surligner: function () {},
      effacerSurlignage: function () {},
      focus: function () {
        zone.focus();
      },
    };
  }

  function statique(modele) {
    var d = N.el('div', 'atelier-redaction-statique');
    String(modele.texte || '')
      .split(/\n{2,}/)
      .forEach(function (p) {
        var x = N.el('p');
        p.split('\n').forEach(function (l, i) {
          if (i) x.appendChild(document.createElement('br'));
          x.appendChild(document.createTextNode(l));
        });
        d.appendChild(x);
      });
    return d;
  }

  A.vues.texte = { creer: creer, statique: statique };
})(window.Atelier);
