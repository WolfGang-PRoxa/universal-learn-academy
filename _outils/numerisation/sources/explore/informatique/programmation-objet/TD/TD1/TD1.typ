// TD 1 de POO : « Introduction à La Programmation Orienté Objet. Application à Ruby » (P. Jacoboni, E. Delozanne),
// recomposé d'après le scan du 1er octobre 2026. Une feuille recto verso en livret : chaque face porte deux pages A4
// réduites. Recto : les sujets 1 à 4. Verso : rappels de syntaxe et extraits de la documentation ri.
// Le texte est celui de l'original, fautes comprises (« Orienté Objet », « immuable », « ojets », « Docmentation »,
// « autorisée », « répétitons »…). Les réponses écrites à la main ne sont pas sur la feuille d'origine.
#import "/gabarits/poo.typ": *

#set document(title: "TD 1 – Introduction à la POO, application à Ruby", author: "P. Jacoboni, E. Delozanne", date: none,
  keywords: ("recomposé d'après un scan", "_outils/numerisation"))
#show: reglages.with(taille: 11.6pt)

// ----------------------------------------------------------------------------------------------- recto
#let recto-gauche = page-a4({
  grid(columns: (1fr, auto),
    text(weight: "bold", size: 12pt)[Université du Maine \ P. JACOBONI, E. DELOZANNE],
    pad(right: 30pt, top: -2pt, text(weight: "bold", size: 14pt)[L3- INFO]))
  v(-2pt)
  align(center, text(weight: "bold", size: 12.5pt)[
    #h(30pt)Introduction à La Programmation Orienté Objet. \
    Application à Ruby \
    TD n° 1])
  v(12pt)
  line(length: 100%, stroke: 0.9pt)
  v(2pt)
  [*Sujet 1 : Ruby : Les grands classiques…* Cela permet d'appréhender syntaxe et lexique sans se casser la tête à inventer des algorithmes. (Normalement !!) :]
  enum(
    [Calculer la factorielle d'un entier (version itérative et récursive)],
    [Élever un nombre à une puissance donnée (exposant entier)],
    [Tester si une chaîne est un palindrome],
    [Transformer une chaîne en écrivant les voyelles en majuscules et les autres caractères en minuscules],
    [Convertir une chaîne en entier],
    [Renverser une chaîne de caractères (par caractère/ par mot)
      #enum(numbering: "a.", indent: 0.8em,
        [Par caractère : "Ruby est très joli" → "iloj sèrt tse ybuR"],
        [Par Mot#h(29pt): "Ruby est très joli" → "joli très est Ruby"])],
    [Écrire une méthode #c[enleveStr(s2)] de la classe #c[String] permettant d'enlever toutes les occurrences de la chaîne #c[s2] dans la chaine receveuse.],
    [Écrire une méthode #c[majusMot] qui met en majuscule la première lettre de chaque mot et en minuscule le reste du mot. (Ceci quelle que soit la chaîne d'origine) \
      #h(46pt)Exemple : #c["bonjour les jeunes".majusMot()] ⟹ Bonjour Les Jeunes],
    [Écrire une méthode #c[lowerCamelCaseIt] qui transforme une chaine en mettant en majuscule la première lettre de chaque mot et en minuscule le reste du mot. (à l'exception du premier) \
      #h(46pt)Exemple : #c["bonjour les jeunes".lowerCamelCaseIt()] ⟹ bonjour Les Jeunes],
  )
  v(10pt)
  [*Sujet 2 : Le compte en Banque (Épisode 1)* \
  Implémenter en Ruby la classe #c[Compte] qui modélise un compte en banque. Les objets de cette classe]
  {
    // Ces trois points sont en Calibri dans l'original
    set text(font: calibri, size: 10.5pt)
    enum(
      [sont caractérisés par leur numéro, leur titulaire et leur solde],
      [sont capables de donner leur solde, de déposer une somme et de retirer une somme],
      [à la création d'un compte on doit fournir un numéro, un nom de titulaire et un solde de départ. Le numéro de compte et le nom du titulaire sont immuable.],
    )
  }
  v(10pt)
  [*Sujet 3 #h(2pt): Simulation d'afficheurs lumineux – Partie 1*]
  pad(left: 16pt)[
    Le but de cet exercice est de simuler en Ruby les afficheurs lumineux qui font circuler un texte en boucle. \
    *A) Le décaleur*
    #pad(left: 10pt)[
      Intéressons-nous d'abord au _décaleur_. C'est un objet qui stocke une suite de l #h(2pt) caractères avec #c[1 > 0]). #c[1] est constant et est appelé _largeur du décaleur_. Initialement, un décaleur contient l espaces. \
      Les quatre fonctionnalités d'un décaleur sont :
      #list(marker: [•], indent: 2em,
        [Fournir un accès à la largeur du décaleur,],
        [Remettre à Zéro : force tous les caractères à _espace,_],
        [Décaler d'une position vers la gauche sa suite de caractères : le caractère le plus à gauche est supprimé de la suite et est renvoyé par la méthode. Le nouveau caractère le plus à droite est fixé à la valeur du paramètre fourni.],
        [l'affichage d'un décaleur affiche le contenu de celui ci.])
      #v(8pt)
      #pad(left: 8pt)[*Définir* entièrement en Ruby la classe #c[Decaleur]. Écrire en Ruby le code de toutes les méthodes de la classe, sans oublier en particulier les méthodes de création/initialisation.]
    ]
  ]
})

#let recto-droite = page-a4(bordure: (left: -10pt, right: 556pt, top: 18pt, bottom: 818pt), marges: (left: 30pt, right: 40pt, top: 44pt, bottom: 30pt), {
  pad(left: 52pt, text(size: 11pt)[Exemple d'utilisation de la classe #c[Decaleur]])
  v(-1pt)
  pad(left: 150pt, table-decaleur(colonnes: (184pt, 120pt), taille: 11pt, rang: 19.5pt, entete: 11pt))
  v(14pt)
  [*Sujet 4 #h(2pt): Un TDA File circulaire en Ruby* \
  On souhaite réaliser le Type de Données Abstrait (TDA) #c[File] par #underline[chainage circulaire] en Ruby. \
  On rappelle qu'une file est une liste de type FIFO (First in First out) : Une file est une liste où les insertions s'effectuent à la fin et les suppressions au début. \
  Les opérations primitives autorisée sur une liste sont au nombre de 6 \
  #c[entrer] un élément dans la file, #c[sortir] un élément de la file, tester si la file est #c[vide], accéder au #c[premier] élément de la file, #c[afficher] le contenu de la file et #c[calculer] la taille de la file.]
  list(marker: text(size: 7pt)[■], indent: 1.4em,
    [Une file est représentée par une cellule d'en-tête dont le champ suivant pointe sur la dernière cellule de la file ; le champ suivant de cette dernière pointe sur la première.],
    [Exemple : représentation de la file 1,2,3,4.])
  v(6pt)
  pad(left: 40pt, figure-file(largeur: 360pt))
  v(10pt)
  list(marker: text(size: 7pt)[■], indent: 1.4em,
    [Avantage de cette réalisation pour les #c[File] :Toutes les opérations (sauf détruire sont en *o(1)*)])
  v(8pt)
  enum(numbering: "1)", indent: 0.4em,
    [Déterminer les objets nécessaires à la réalisation d'une file circulaire. Dessiner le diagramme de classe.],
    [Coder en Ruby la/les classes nécessaires],
    [Écrire un programme qui crée la file #c[(m,e,r,c,i, ,J,a,c,o)] et qui teste les différentes méthodes])
})

#feuille(recto-gauche, recto-droite)

// ----------------------------------------------------------------------------------------------- verso
#let code(corps) = block(width: 100%, stroke: 0.9pt, inset: (x: 3pt, y: 4pt), spacing: 4pt, text(font: courier, size: 10.5pt, corps))
#let note-main(corps) = text(font: "Segoe Print", size: 8.5pt, corps)
#let ret(corps) = text(weight: "bold")[ retourne #corps]

#let verso-gauche = page-a4({
  set par(leading: 0.5em)
  v(12pt)
  align(center, text(font: calibri, weight: "bold", size: 13pt)[Rappels/Compléments de syntaxe])
  v(2pt)
  table(columns: (104pt, 1fr), inset: 3pt, stroke: 0.9pt, align: left + top,
    table.header(align(center, strong[Opération]), align(center, strong[Exemples])),
    [méthodes pour afficher],
    [Le module #c[Kernel] est inclus dans la classe #c[Object], ses méthodes sont accessibles dans tous les ojets Ruby. On utilise la méthode #c[print] du module #c[Kernel] et les deux variables prédéfinies #c[\$,] et #c[\$\\] \
     La variable *\$,* contient le séparateur des différentes valeurs, alors que la variable *\$\\* contient le caractère séparateur de ligne.
     #table(columns: (190pt, 128pt), inset: 3pt, stroke: 1.2pt, align: left + top,
       text(font: courier, size: 10pt)[print "cat", [1,2,3], 99, "\\n" \ #note-main[\# On change le séparateur de champ] \ \$, = ", " #h(8pt)\# \ #note-main[\# On change le séparateur de ligne] \ \$\\ = "\\n" \ print "cat", [1,2,3], 99],
       text(font: courier, size: 10pt)[cat12399 #v(46pt) cat, 1, 2, 3, 99])],
    [reste de la division euclidienne : %], [#c[7 % 2]#ret[1] \ #c[6 % 2]#ret[0]],
    [tester si deux objets sont égaux : ==], [#c[2 == 3]#ret[false] \ #c[2 == #h(4pt)2.0]#ret[true]],
    [tester si un objet est égal à *nil*], [#c[2 == nil]#ret[false] \ #c[false == nil]#ret[false] \ #c[nil == nil]#ret[true]],
    [Alternative],
    [une expression #c[if] en Ruby est proche des instructions _if_ des autres langages
     #code[if artiste == "Fersen" then \ #h(12pt)prenom = "Thomas" \ elsif artiste == "Bénabar" then \ #h(12pt)prenom = "" \ else \ #h(12pt)prenom = "inconnu" \ end]
     #c[if] est une expression. Elle retourne une valeur que l'on peut utiliser.
     #code[prenom = if artiste == "Fersen" then \ #h(78pt)"Thomas" \ #h(66pt)elsif artiste == "Bénabar" then \ #h(78pt)"" \ #h(66pt)else \ #h(78pt)"inconnu" \ #h(66pt)end]
     Ruby possède aussi une forme négative du #c[if] : #c[unless]
     // Le « ^ » de la deuxième ligne est dans l'original
     #code[unless duree > 180 then \ #h(3pt)^ cout = .25 \ else \ #h(12pt)cout = .35 \ end]
     Ruby supporte l'expression conditionnelle du C.
     #code[cout = duree > 180 ? .35 : .25]],
    [Répétitions et Itérateurs],
    [Les possibilités de Ruby pour les répétitions sont « réparties » dans différentes classes à travers les « iterateurs ». #h(4pt)Il existe d'autres formes de répétitons (cf. doc) \ Exemples.
     #table(columns: (1fr, 136pt), inset: 3pt, stroke: 1.2pt, align: left + top,
       text(font: courier, size: 10pt)[3.times do \ #h(12pt)print "Ho! " \ end], text(font: courier, size: 10pt)[Ho! Ho! Ho!],
       text(font: courier, size: 10pt)[0.upto(9) do |x| \ #h(12pt)print x, " " \ end], text(font: courier, size: 10pt)[0 1 2 3 4 5 6 7 8 9],
       text(font: courier, size: 10pt)[0.step(12, 3) {|x| print x, " " }], text(font: courier, size: 10pt)[0 3 6 9 12])],
  )
})

// Extraits de ri : texte de la documentation de Ruby, en chasse fixe grasse ; les mots soulignés le sont dans ri
#let mono(corps) = text(font: "DejaVu Sans Mono", weight: "bold", size: 5.6pt, {
  show raw: set text(font: "DejaVu Sans Mono", weight: "bold", size: 5.6pt)
  show raw.where(block: true): set block(spacing: 0.6em)
  show raw.where(block: true): set par(leading: 0.42em)
  corps
})
#let s(corps) = underline(offset: 1pt, corps)
#let filet-ri = line(length: 100%, stroke: 0.7pt)
#let ri(titre, nom, signature, corps) = {
  set par(leading: 0.42em, spacing: 0.42em)
  table(columns: 1fr, inset: (x: 4pt, y: 2pt), stroke: 0.9pt,
    align(center, text(weight: "bold", size: 15pt, titre)),
    mono[= #nom \ \ (from ruby core)],
    mono(signature),
    mono(corps))
}

#let ri-split = ri([ri String.split(…)], [String.split], [
#raw("  str.split(pattern=nil, [limit])                -> an_array\n  str.split(pattern=nil, [limit]) {|sub| block } -> str", block: true)], [
Divides #s[str] into substrings based on a delimiter, returning an \
array of these substrings.

#v(5pt)
If #s[pattern] is a String, then its contents are used as the \
delimiter when splitting #s[str]. If #s[pattern] is a single \
space, #s[str] is split on whitespace, with leading and trailing \
whitespace and runs of contiguous whitespace characters ignored.

#v(5pt)
If #s[pattern] is a Regexp, #s[str] is divided where the \
pattern matches. Whenever the pattern matches a zero-length string, \
#s[str] is split into individual characters. If #s[pattern] \
contains groups, the respective matches will be returned in the array as \
well.

#v(5pt)
If #s[pattern] is nil, the value of \$; is used. If \$; is nil \
(which is the default), #s[str] is split on whitespace as if ' ' were \
specified.

#v(5pt)
If the #s[limit] parameter is omitted, trailing null fields are \
suppressed. If #s[limit] is a positive number, at most that number \
of split substrings will be returned (captured groups will be returned \
as well, but are not counted towards the limit). If #s[limit] is \
1, the entire string is returned as the only entry in an array. If \
negative, there is no limit to the number of fields returned, and \
trailing null fields are not suppressed.

#v(5pt)
When the input str is empty an empty Array is returned as the string is \
considered to have no fields to split.

#v(5pt)
#raw("  \" now's  the time \".split        #=> [\"now's\", \"the\", \"time\"]\n  \" now's  the time \".split(' ')   #=> [\"now's\", \"the\", \"time\"]\n  \" now's  the time\".split(/ /)    #=> [\"\", \"now's\", \"\", \"the\", \"time\"]\n  \"1, 2.34,56, 7\".split(%r{,\\s*}) #=> [\"1\", \"2.34\", \"56\", \"7\"]\n  \"hello\".split(//)                #=> [\"h\", \"e\", \"l\", \"l\", \"o\"]\n  \"hello\".split(//, 3)             #=> [\"h\", \"e\", \"llo\"]\n  \"hi mom\".split(%r{\\s*})          #=> [\"h\", \"i\", \"m\", \"o\", \"m\"]", block: true)

#v(5pt)
#raw("  \"mellow yellow\".split(\"ello\")   #=> [\"m\", \"w y\", \"w\"]\n  \"1,2,,3,4,,\".split(',')         #=> [\"1\", \"2\", \"\", \"3\", \"4\"]\n  \"1,2,,3,4,,\".split(',', 4)      #=> [\"1\", \"2\", \"\", \"3,4,,\"]\n  \"1,2,,3,4,,\".split(',', -4)     #=> [\"1\", \"2\", \"\", \"3\", \"4\", \"\", \"\"]", block: true)

#v(5pt)
#raw("  \"1:2:3\".split(/(:)()()/, 2)     #=> [\"1\", \":\", \"\", \"\", \"2:3\"]", block: true)
])

#let ri-gsub = ri([ri String.gsub(…)], [String.gsub], [
#raw("  str.gsub(pattern, replacement)       -> new_str\n  str.gsub(pattern, hash)              -> new_str\n  str.gsub(pattern) {|match| block }   -> new_str\n  str.gsub(pattern)                    -> enumerator", block: true)], [
Returns a copy of #s[str] with the #s[all] occurrences of \
#s[pattern] substituted for the second argument. The \
#s[pattern] is typically a Regexp; if given as a String, any regular \
expression metacharacters it contains will be interpreted literally, e.g. \
"\\\\\\d" will match a backlash followed by 'd', instead of a digit.

#v(5pt)
If #s[replacement] is a String it will be substituted for \
the matched text. It may contain back-references to the pattern's capture \
groups of the form \\\\\\d, where #s[d] is a group number, or \\\\\\k<n>, where #s[n] is \
a group name. If it is a double-quoted string, both back-references must be \
preceded by an additional backslash. However, within \
#s[replacement] the special match variables, such as \$&, \
will not refer to the current match.

#v(5pt)
If the second argument is a Hash, and the matched text is one of its keys, the \
corresponding value is the replacement string.

#v(5pt)
In the block form, the current match string is passed in as a parameter, and \
variables such as \$1, \$2, \$\`, \$&, and \$' will be set appropriately. The value \
returned by the block will be substituted for the match on each call.

#v(5pt)
The result inherits any tainting in the original string or any supplied \
replacement string.

#v(5pt)
When neither a block nor a second argument is supplied, an Enumerator is \
returned.

#v(5pt)
#raw("  \"hello\".gsub(/[aeiou]/, '*')                  #=> \"h*ll*\"\n  \"hello\".gsub(/([aeiou])/, '<\\1>')             #=> \"h<e>ll<o>\"\n  \"hello\".gsub(/./) {|s| s.ord.to_s + ' '}      #=> \"104 101 108 108 111 \"\n  \"hello\".gsub(/(?<foo>[aeiou])/, '{\\k<foo>}')  #=> \"h{e}ll{o}\"\n  'hello'.gsub(/[eo]/, 'e' => 3, 'o' => '*')    #=> \"h3ll*\"", block: true)
])

#let ri-scan = ri([ri String.scan(…)], [String.scan], [
#raw("  str.scan(pattern)                         -> array\n  str.scan(pattern) {|match, ...| block }   -> str", block: true)], [
Both forms iterate through #s[str], matching the pattern (which may be a \
Regexp or a String). For each match, a result is generated and either added to \
the result array or passed to the block. If the pattern contains no groups, \
each individual result consists of the matched string, \$&.  If the pattern \
contains groups, each individual result is itself an array containing one \
entry per group.

#v(5pt)
#raw("  a = \"cruel world\"\n  a.scan(/\\w+/)        #=> [\"cruel\", \"world\"]\n  a.scan(/.../)        #=> [\"cru\", \"el \", \"wor\"]\n  a.scan(/(...)/)      #=> [[\"cru\"], [\"el \"], [\"wor\"]]\n  a.scan(/(..)(..)/)   #=> [[\"cr\", \"ue\"], [\"l \", \"wo\"]]", block: true)
])

#let ri-tr = ri([ri String.tr(…)], [String.tr], [
#raw("  str.tr(from_str, to_str)   => new_str", block: true)], [
Returns a copy of str with the characters in from_str replaced by the \
corresponding characters in to_str.  If to_str is shorter than from_str, it is \
padded with its last character in order to maintain the correspondence.

#v(5pt)
#raw("  \"hello\".tr('el', 'ip')      #=> \"hippo\"\n  \"hello\".tr('aeiou', '*')    #=> \"h*ll*\"\n  \"hello\".tr('aeiou', 'AA*')  #=> \"hAll*\"", block: true)

#v(5pt)
Both strings may use the c1-c2 notation to denote ranges of characters, and \
from_str may start with a ^, which denotes all characters except those listed.

#v(5pt)
#raw("  \"hello\".tr('a-y', 'b-z')    #=> \"ifmmp\"\n  \"hello\".tr('^aeiou', '*')   #=> \"*e**o\"", block: true)
])

#let verso-droite = page-a4(bordure: (left: -10pt, right: 556pt, top: 18pt, bottom: 818pt), marges: (left: 6pt, right: 46pt, top: 44pt, bottom: 20pt), {
  v(36pt)
  align(center, text(font: calibri, weight: "bold", size: 16pt)[Extraits de Docmentation (ri)])
  v(-4pt)
  grid(columns: (1fr, 1fr), column-gutter: 0pt, ri-split, ri-gsub)
  v(8pt)
  grid(columns: (1fr, 1fr), column-gutter: 0pt, ri-scan, ri-tr)
})

#feuille(verso-gauche, verso-droite)
