/* ==========================================================================
   Atelier · éditeur « code » : programme écrit librement (logique)
   --------------------------------------------------------------------------
   Pour les TD de programmation faits sur papier (Ruby en POO, C, Python…) :
   le texte est le code. Pas de comparaison automatique : la solution
   s'affiche, et Claude corrige à la demande. Contrôles de forme, sans rien
   dévoiler : parenthèses, crochets et accolades équilibrés ; en Ruby, autant
   de « end » que de blocs ouverts (def, class, if, while, do…).
   Options : langage (ruby par défaut : coloration, contrôles, exécution
   quand le serveur local sait lancer ce langage), lignes (hauteur).
   ========================================================================== */
(function (A) {
  'use strict';

  var N = A.noyau,
    msg = N.message,
    tr = A.tr;
  var LANGAGES = {
    ruby: 'Ruby',
    c: 'C',
    python: 'Python',
    javascript: 'JavaScript',
    java: 'Java',
    sql: 'SQL',
    bash: 'Bash',
  };

  // Le code sans ses chaînes ni ses commentaires (remplacés par des espaces), ligne par ligne
  function nettoyer(code, langage) {
    var diese = langage === 'ruby' || langage === 'python' || langage === 'bash';
    var bloc = false; // commentaire Ruby =begin … =end
    return String(code || '')
      .split('\n')
      .map(function (l) {
        if (langage === 'ruby' || !langage) {
          if (bloc) {
            if (/^=end\b/.test(l)) bloc = false;
            return '';
          }
          if (/^=begin\b/.test(l)) {
            bloc = true;
            return '';
          }
        }
        var res = '',
          dans = null;
        for (var i = 0; i < l.length; i++) {
          var c = l[i];
          if (dans) {
            if (c === '\\') {
              i++;
              res += '  ';
              continue;
            }
            if (c === dans) dans = null;
            res += ' ';
            continue;
          }
          if (c === '"' || c === "'") {
            dans = c;
            res += ' ';
            continue;
          }
          // Hors d'une chaîne, « # » (ou « // ») commence un commentaire
          if (diese ? c === '#' : c === '/' && l[i + 1] === '/') break;
          res += c;
        }
        return res;
      });
  }

  // Blocs Ruby ouverts sur une ligne : mot-clé en tête d'instruction (pas en modificateur), ou « do »
  // « private def seuil » : def précédé d'un modificateur de visibilité ouvre aussi un bloc
  var OUVRANTS =
    /^(?:(?:private|protected|public|module_function)\s+)?(def|class|module|if|unless|while|until|case|begin|for)\b/;
  function blocsRuby(lignes) {
    var ouverts = 0,
      fermes = 0;
    lignes.forEach(function (l) {
      var t = l.trim();
      if (!t) return;
      // Une instruction peut suivre un « ; » ou une affectation (prenom = if …)
      t.split(';').forEach(function (instr) {
        var s = instr.trim().replace(/^[\w@$.[\]]+\s*[+\-*/|&]?=\s*(?=(if|unless|case|begin|while)\b)/, '');
        if (
          OUVRANTS.test(s) &&
          !/^(?:(?:private|protected|public|module_function)\s+)?def\s+[\w.?!]+(\(.*\))?\s*=/.test(s)
        )
          ouverts++;
        if (/\bdo\b(\s*\|[^|]*\|)?\s*$/.test(s)) ouverts++;
        fermes += (s.match(/(^|[^.\w])end\b/g) || []).length;
      });
    });
    return { ouverts: ouverts, fermes: fermes };
  }

  function controler(m, options) {
    var o = options || {},
      langage = o.langage || 'ruby';
    var code = String((m && m.code) || '');
    if (!code.trim()) return [msg('info', tr("Le code est vide pour l'instant.", 'The code is empty for now.'))];
    var res = [],
      lignes = nettoyer(code, langage),
      tout = lignes.join('\n');
    [
      ['(', ')', 'parenthèse', 'parenthesis', 'parentheses'],
      ['[', ']', 'crochet', 'bracket', 'brackets'],
      ['{', '}', 'accolade', 'brace', 'braces'],
    ].forEach(function (p) {
      var d = tout.split(p[0]).length - tout.split(p[1]).length;
      if (d > 0)
        res.push(
          msg(
            'attention',
            tr(
              'Il manque ' + N.pluriel(d, p[2] + ' fermante', p[2] + 's fermantes') + ' « ' + p[1] + ' ».',
              'Missing ' + N.pluriel(d, 'closing ' + p[3], 'closing ' + p[4]) + ' “' + p[1] + '”.',
            ),
          ),
        );
      if (d < 0)
        res.push(
          msg(
            'attention',
            tr(
              'Il y a ' + N.pluriel(-d, p[2] + ' fermante', p[2] + 's fermantes') + ' « ' + p[1] + ' » en trop.',
              N.pluriel(-d, 'closing ' + p[3], 'closing ' + p[4]) + ' “' + p[1] + '” too many.',
            ),
          ),
        );
    });
    if (langage === 'ruby') {
      var b = blocsRuby(lignes);
      if (b.ouverts > b.fermes)
        res.push(
          msg(
            'attention',
            tr(
              'Il manque ' +
                N.pluriel(b.ouverts - b.fermes, '« end »', '« end »') +
                ' : ' +
                b.ouverts +
                ' blocs ouverts (def, class, if, while, do…), ' +
                b.fermes +
                ' fermés.',
              'Missing ' +
                N.pluriel(b.ouverts - b.fermes, '“end”', '“end”') +
                ': ' +
                b.ouverts +
                ' blocks opened (def, class, if, while, do…), ' +
                b.fermes +
                ' closed.',
            ),
          ),
        );
      if (b.fermes > b.ouverts)
        res.push(
          msg(
            'attention',
            tr(
              'Il y a ' +
                N.pluriel(b.fermes - b.ouverts, '« end »', '« end »') +
                ' en trop : ' +
                b.ouverts +
                ' blocs ouverts, ' +
                b.fermes +
                ' « end ».',
              N.pluriel(b.fermes - b.ouverts, '“end”', '“end”') +
                ' too many: ' +
                b.ouverts +
                ' blocks opened, ' +
                b.fermes +
                ' “end”.',
            ),
          ),
        );
      if (/^\s*Class\s/m.test(lignes.join('\n')))
        res.push(
          msg(
            'attention',
            tr(
              "« Class » s'écrit en minuscules : le mot-clé est « class ».",
              '“Class” is written in lower case: the keyword is “class”.',
            ),
          ),
        );
    }
    if (/[‘’“”]/.test(code))
      res.push(
        msg(
          'attention',
          tr(
            'Le code contient des guillemets typographiques (‘ ’ “ ”) : les remplacer par \' ou ".',
            'The code contains curly quotes (‘ ’ “ ”): replace them with \' or ".',
          ),
        ),
      );
    return res;
  }

  A.editeurs.code = {
    nom: 'code',
    // Options reconnues (champ « options » d'un atelier), vérifiées par outils/verifier.js
    options: {
      langage: 'langage du code : ruby (défaut), c, python, javascript, java, sql, bash',
      lignes: "hauteur de l'éditeur, en lignes",
    },
    libelle: 'Code',
    description: 'Programme écrit librement (Ruby, C, Python…), sans comparaison automatique.',
    get aide() {
      return tr(
        "<p>Écrire le code. <kbd>Tab</kbd> indente, <kbd>Maj</kbd> + <kbd>Tab</kbd> désindente. Quand le serveur local sait exécuter le langage (C, Python, JavaScript), <kbd>Ctrl</kbd> + <kbd>Entrée</kbd> l'exécute.</p>",
        '<p>Write the code. <kbd>Tab</kbd> indents, <kbd>Shift</kbd> + <kbd>Tab</kbd> unindents. When the local server can run the language (C, Python, JavaScript), <kbd>Ctrl</kbd> + <kbd>Enter</kbd> runs it.</p>',
      );
    },
    sansDessin: true,
    LANGAGES: LANGAGES,
    vide: function () {
      return { code: '' };
    },
    lire: function (texte) {
      return { modele: { code: String(texte == null ? '' : texte) }, erreurs: [] };
    },
    ecrire: function (m) {
      return m && m.code ? m.code : '';
    },
    controler: controler,
    comparer: function () {
      return null;
    },
    blocsRuby: function (code) {
      return blocsRuby(nettoyer(code, 'ruby'));
    },
    estVide: function (m) {
      return !m || !String(m.code || '').trim();
    },
  };
})(window.Atelier);
