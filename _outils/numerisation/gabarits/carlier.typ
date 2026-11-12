// Sujets de TD de codage de F. Carlier : A4, Times New Roman, deux cadres d'en-tête.
//
// Les mesures viennent des scans, ramenés à l'échelle où le texte occupe la largeur d'une page A4
// aux marges de 2,5 cm (corps de 10 pt, en-tête de 20 pt), et des énoncés de TP d'origine du même
// enseignant (L3/Codage/TP/*/enonce_*.pdf) pour ce qu'une photo ne dit pas : épaisseur des traits,
// police, interligne.

// Police de l'original (fournie par Windows). Sans elle, Typst le signale et prend sa police par défaut.
#let polices = "Times New Roman"

// Pas des lignes de Word en interligne simple, pour Times New Roman : 1,149 fois le corps
#let pas = 1.149em

// n lignes vides
#let vide(n: 1) = v(n * pas)

// Fin de ligne imposée, la ligne restant justifiée : on retrouve ainsi les coupures de l'original
#let fl = linebreak(justify: true)

// Soulignement des titres d'exercice
#let sl(corps) = underline(offset: 0.13em, stroke: 0.055em, evade: false, corps)

// Filet horizontal sur toute la largeur du texte
#let filet(epaisseur: 1pt) = line(length: 100%, stroke: epaisseur)

// Ligne de question : étiquette en retrait, texte à la tabulation
#let q(etiquette, retrait: 12pt, tabulation: 35.5pt, gras: true, corps) = {
  box(width: tabulation, {
    h(retrait)
    if gras { strong(etiquette) } else { etiquette }
  })
  corps
}

#let sujet(
  titre: "",                          // titre du PDF (métadonnée)
  auteur: "Florent Carlier",
  marge: 2.5cm,                       // marges gauche et droite
  haut: 36pt,                         // haut du premier cadre : celui des énoncés de TP d'origine
  bas: 1cm,
  taille: 10pt,                       // corps du texte
  gauche: [Licence 3 Informatique],   // premier cadre
  droite: "Module Codage...",         // une chaîne : trois points, et non des points de suspension
  retrait-gauche: 2.4pt,
  retrait-droite: 5.6pt,
  cadre-1: 25pt,                      // hauteur des cadres, et écart entre eux
  ecart: 8pt,
  cadre-2: 36pt,
  ligne: [],                          // second cadre : une ligne de texte, centrée en hauteur
  monte: 0pt,                         // décalage de cette ligne vers le haut
  corps,
) = {
  set document(title: titre, author: auteur, date: none, keywords: ("recomposé d'après un scan", "studies/_outils/numerisation"))
  set page(width: 595.3pt, height: 841.9pt, margin: (left: marge, right: marge, top: haut, bottom: bas))
  set text(font: polices, size: taille, lang: "fr", hyphenate: false, top-edge: 0.891em, bottom-edge: -0.216em)
  set par(justify: true, leading: 0.042em, spacing: 0.042em)
  // L'original mêle apostrophes droites et typographiques : on les écrit telles quelles
  set smartquote(enabled: false)
  // Les cadres ont la largeur exacte du texte, comme les filets
  rect(width: 100%, height: cadre-1, stroke: 0.6pt, inset: 0pt,
    pad(left: retrait-gauche, right: retrait-droite, top: (cadre-1 - 22.14pt) / 2 - 1.2pt,
      text(20pt, weight: "bold", style: "italic", { gauche; h(1fr); droite })))
  v(ecart - 0.042em)
  rect(width: 100%, height: cadre-2, stroke: 0.6pt, inset: 0pt,
    pad(left: 1.7pt, right: 1.7pt, top: (cadre-2 - 1.107em) / 2 - monte, ligne))
  corps
}
