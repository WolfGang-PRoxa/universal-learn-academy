/* ==========================================================================
   Atelier · outils d'analyse des syntaxes texte (Atelier.syntaxe)
   --------------------------------------------------------------------------
   Chaque éditeur a une syntaxe texte courte (voir _outils/atelier/README.md). Ce
   module découpe un texte en lignes numérotées, retire les commentaires
   (« -- » en début de ligne, « // » après une espace), mesure
   l'indentation et découpe une liste en respectant guillemets et
   parenthèses. Sans DOM : chargé aussi dans Node.
   ========================================================================== */
(function (A) {
  'use strict';

  // Retire un commentaire, hors guillemets : « -- » en début de ligne (comme en SQL),
  // « // » n'importe où après une espace. (« -- » au milieu d'une ligne est
  // l'association des diagrammes de classes.)
  function sansCommentaire(ligne) {
    if (/^\s*--/.test(ligne)) return '';
    var dans = false;
    for (var i = 0; i < ligne.length; i++) {
      var c = ligne[i];
      if (c === '"') dans = !dans;
      if (dans) continue;
      if (c === '/' && ligne[i + 1] === '/' && (i === 0 || /\s/.test(ligne[i - 1]))) return ligne.slice(0, i);
    }
    return ligne;
  }

  // Texte -> [{ num, indent, texte }] sans les lignes vides ni les commentaires
  function lignes(texte) {
    var res = [];
    String(texte == null ? '' : texte)
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .forEach(function (brut, i) {
        var t = sansCommentaire(brut.replace(/\t/g, '    '));
        if (!t.trim()) return;
        res.push({ num: i + 1, indent: t.match(/^ */)[0].length, texte: t.trim() });
      });
    return res;
  }

  // Découpe « a, b(c, d), "e, f" » en ["a", "b(c, d)", "\"e, f\""]
  function decouper(texte, separateur) {
    var parts = [],
      prof = 0,
      dans = false,
      cour = '';
    for (var i = 0; i < texte.length; i++) {
      var c = texte[i];
      if (c === '"') dans = !dans;
      if (!dans) {
        if (c === '(' || c === '[' || c === '{') prof++;
        else if (c === ')' || c === ']' || c === '}') prof--;
        else if (c === separateur && prof === 0) {
          parts.push(cour.trim());
          cour = '';
          continue;
        }
      }
      cour += c;
    }
    if (cour.trim() || parts.length) parts.push(cour.trim());
    return parts;
  }

  // Position d'un caractère hors parenthèses et guillemets, ou -1
  function indexHors(texte, caractere) {
    var prof = 0,
      dans = false;
    for (var i = 0; i < texte.length; i++) {
      var c = texte[i];
      if (c === '"') dans = !dans;
      if (dans) continue;
      if (c === '(' || c === '[' || c === '{') prof++;
      else if (c === ')' || c === ']' || c === '}') prof--;
      else if (c === caractere && prof === 0) return i;
    }
    return -1;
  }

  // Les parenthèses sont-elles équilibrées ? (pour joindre une relation écrite sur plusieurs lignes)
  function equilibre(texte) {
    var prof = 0,
      dans = false;
    for (var i = 0; i < texte.length; i++) {
      var c = texte[i];
      if (c === '"') dans = !dans;
      if (dans) continue;
      if (c === '(') prof++;
      else if (c === ')') prof--;
    }
    return prof <= 0;
  }

  // Retire des guillemets englobants
  function sansGuillemets(t) {
    t = String(t == null ? '' : t).trim();
    return /^".*"$/.test(t) ? t.slice(1, -1) : t;
  }

  // Un nom d'élément valide : lettres (accents compris), chiffres, _ et quelques signes
  var NOM = /^[A-Za-zÀ-ÖØ-öø-ÿ_][A-Za-zÀ-ÖØ-öø-ÿ0-9_·'-]*$/;
  function nomValide(t) {
    return NOM.test(t);
  }

  function erreur(num, texte) {
    return { ligne: num, message: texte };
  }

  A.syntaxe = {
    lignes: lignes,
    decouper: decouper,
    indexHors: indexHors,
    equilibre: equilibre,
    sansGuillemets: sansGuillemets,
    nomValide: nomValide,
    erreur: erreur,
    sansCommentaire: sansCommentaire,
  };
})(window.Atelier);
