/* ==========================================================================
   Quiz · rendu Markdown des réponses de Claude (QuizApp.markdown)
   Sous-ensemble volontairement réduit : titres, paragraphes, listes, citations,
   blocs de code, code en ligne, gras, italique, liens. Tout le texte est
   échappé avant transformation : aucune balise venue de la réponse n'est
   interprétée. Les formules \( … \) et \[ … \] sont laissées intactes, pour
   KaTeX. Les liens ne sont gardés que s'ils sont relatifs ou en https.
   ========================================================================== */
(function (A) {
  'use strict';

  var echapper = function (t) {
    return A.outils.echapper(t);
  };

  function lienSur(url) {
    url = url.trim();
    if (/^(https?:)?\/\//i.test(url)) return /^https:\/\//i.test(url) ? url : null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return null; // javascript:, data:…
    return url;
  }

  // Éléments en ligne : code et formules mis de côté, puis gras, italique, liens
  function enLigne(texte) {
    var reserve = [];
    var M = String.fromCharCode(1); // marqueur des morceaux mis de côté
    function garder(h) {
      reserve.push(h);
      return M + (reserve.length - 1) + M;
    }
    var t = texte;
    t = t.replace(/`([^`\n]+)`/g, function (m, c) {
      return garder('<code>' + echapper(c) + '</code>');
    });
    t = t.replace(/\\\((.+?)\\\)|\\\[(.+?)\\\]/g, function (m) {
      return garder(echapper(m));
    });
    t = echapper(t);
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, libelle, url) {
      var u = lienSur(url.replace(/&amp;/g, '&'));
      return u ? garder('<a href="' + echapper(u) + '">' + libelle + '</a>') : libelle;
    });
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
    t = t.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
    return t.replace(new RegExp(M + '(\\d+)' + M, 'g'), function (m, i) {
      return reserve[Number(i)];
    });
  }

  function markdown(source) {
    var lignes = String(source || '').split('\n');
    var sortie = [],
      para = [],
      liste = null,
      i = 0;

    function finirPara() {
      if (para.length) sortie.push('<p>' + enLigne(para.join(' ')) + '</p>');
      para = [];
    }
    function finirListe() {
      if (liste)
        sortie.push(
          '<' +
            liste.type +
            '>' +
            liste.items
              .map(function (x) {
                return '<li>' + enLigne(x) + '</li>';
              })
              .join('') +
            '</' +
            liste.type +
            '>',
        );
      liste = null;
    }

    while (i < lignes.length) {
      var l = lignes[i];
      var bloc = l.match(/^\s*```\s*([\w+-]*)\s*$/);
      if (bloc) {
        finirPara();
        finirListe();
        var code = [];
        i++;
        while (i < lignes.length && !/^\s*```\s*$/.test(lignes[i])) code.push(lignes[i++]);
        i++;
        var langue = bloc[1] ? bloc[1].toLowerCase() : 'plaintext';
        sortie.push(
          '<pre><code class="language-' + echapper(langue) + '">' + echapper(code.join('\n')) + '</code></pre>',
        );
        continue;
      }
      if (/^\s*\\\[\s*$/.test(l)) {
        // formule en bloc sur plusieurs lignes
        finirPara();
        finirListe();
        var f = [l];
        i++;
        while (i < lignes.length && !/\\\]\s*$/.test(lignes[i])) f.push(lignes[i++]);
        if (i < lignes.length) f.push(lignes[i++]);
        sortie.push('<p>' + echapper(f.join('\n')) + '</p>');
        continue;
      }
      var titre = l.match(/^(#{1,6})\s+(.*)$/);
      if (titre) {
        finirPara();
        finirListe();
        // # à ### : h3 (sous le h2 de la page ou de la carte) ; #### : h4 ; au-delà : h5
        var niveau = titre[1].length <= 3 ? 3 : Math.min(5, titre[1].length);
        sortie.push('<h' + niveau + '>' + enLigne(titre[2]) + '</h' + niveau + '>');
        i++;
        continue;
      }
      if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(l)) {
        finirPara();
        finirListe();
        sortie.push('<hr>');
        i++;
        continue;
      }
      var puce = l.match(/^\s*[-*+]\s+(.*)$/),
        num = l.match(/^\s*\d+[.)]\s+(.*)$/);
      if (puce || num) {
        finirPara();
        var type = puce ? 'ul' : 'ol';
        if (liste && liste.type !== type) finirListe();
        if (!liste) liste = { type: type, items: [] };
        liste.items.push((puce || num)[1]);
        i++;
        continue;
      }
      if (liste && /^\s{2,}\S/.test(l)) {
        liste.items[liste.items.length - 1] += ' ' + l.trim();
        i++;
        continue;
      }
      var cite = l.match(/^\s*>\s?(.*)$/);
      if (cite) {
        finirPara();
        finirListe();
        var c = [cite[1]];
        i++;
        while (i < lignes.length && /^\s*>/.test(lignes[i])) c.push(lignes[i++].replace(/^\s*>\s?/, ''));
        sortie.push('<blockquote><p>' + enLigne(c.join(' ')) + '</p></blockquote>');
        continue;
      }
      if (!l.trim()) {
        finirPara();
        finirListe();
        i++;
        continue;
      }
      finirListe();
      para.push(l.trim());
      i++;
    }
    finirPara();
    finirListe();
    return sortie.join('\n');
  }

  A.markdown = markdown;
})(window.QuizApp);
