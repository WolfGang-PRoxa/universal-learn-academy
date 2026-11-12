// TD de POO (P. Jacoboni, E. Delozanne, Le Mans Université) : Times New Roman, code en Courier New,
// quelques passages en Calibri (copiés d'autres documents par l'enseignant).
//
// Le TD 1 est imprimé en livret : deux pages A4 réduites (×0,707) côte à côte sur une feuille A4 paysage.
// On compose donc chaque page à sa taille A4 d'origine (`page-a4`), puis `feuille` les réduit et les place.
// Le TD 2 est en A4 portrait, à marges étroites.

#let times = "Times New Roman"
#let calibri = "Calibri"
#let courier = "Courier New"

// Code dans le texte
#let c(corps) = text(font: courier, size: 0.92em, corps)

// Bloc de code encadré (Courier New, une ligne par ligne de l'original)
#let encadre(corps, largeur: 100%, taille: 9.5pt) = block(width: largeur, stroke: 0.8pt, inset: (x: 3pt, y: 3pt), spacing: 3pt,
  text(font: courier, size: taille, corps))

#let reglages(taille: 11pt, corps) = {
  set text(font: times, size: taille, lang: "fr", hyphenate: false)
  set par(justify: false, leading: 0.5em, spacing: 0.5em)
  set smartquote(enabled: false)
  set list(indent: 1.2em, body-indent: 0.6em, spacing: 0.5em)
  set enum(indent: 1.6em, body-indent: 0.7em, spacing: 0.5em)
  corps
}

// Une page A4 du livret, avec la bordure de page de l'original
#let page-a4(marges: (left: 46pt, right: 40pt, top: 44pt, bottom: 30pt), bordure: (left: 40pt, right: 556pt, top: 18pt, bottom: 818pt), corps) = box(
  width: 595.3pt, height: 841.9pt, clip: true, {
    place(top + left, dx: bordure.left, dy: bordure.top,
      rect(width: bordure.right - bordure.left, height: bordure.bottom - bordure.top, stroke: 0.9pt))
    pad(..marges, corps)
  })

// Feuille A4 paysage : deux pages A4 réduites côte à côte
#let feuille(gauche, droite, reduction: 70.7%) = page(width: 841.9pt, height: 595.3pt, margin: 0pt, {
  place(top + left, dx: 0pt, dy: 0pt, scale(reduction, origin: top + left, reflow: true, gauche))
  place(top + left, dx: 420.95pt, dy: 0pt, scale(reduction, origin: top + left, reflow: true, droite))
})

// Figure de la file circulaire 1, 2, 3, 4 (identique dans les TD 1 et 2) ; échelle : largeur en points
#let figure-file(largeur: 420pt) = {
  let k = largeur / 420pt
  let trait = 1.6pt * k
  let gris = luma(140)
  let cellule(x, y, n) = {
    place(top + left, dx: x * k * 1pt, dy: y * k * 1pt, rect(width: 44pt * k, height: 22pt * k, fill: gris, stroke: 0.9pt * k))
    place(top + left, dx: (x + 22) * k * 1pt, dy: y * k * 1pt, line(angle: 90deg, length: 22pt * k, stroke: 0.9pt * k))
    if n != none { place(top + left, dx: x * k * 1pt, dy: y * k * 1pt, box(width: 22pt * k, height: 22pt * k, align(center + horizon, text(font: "Arial", size: 13pt * k, n)))) }
  }
  let fleche(x0, y0, x1, y1) = {
    place(top + left, line(start: (x0 * k * 1pt, y0 * k * 1pt), end: (x1 * k * 1pt, y1 * k * 1pt), stroke: trait))
  }
  let pointe(x, y, sens) = {
    let l = 8 * k
    let h = 4.5 * k
    let pts = if sens == "droite" { ((x - l, y - h), (x, y), (x - l, y + h)) }
      else if sens == "bas" { ((x - h, y - l), (x, y), (x + h, y - l)) }
      else { ((x - h, y + l), (x, y), (x + h, y + l)) }
    place(top + left, polygon(fill: black, ..pts.map(((a, b)) => (a * 1pt, b * 1pt))))
  }
  box(width: largeur, height: 150pt * k, {
    place(top + left, dx: 0pt, dy: 18pt * k, rect(width: 70pt * k, height: 32pt * k, stroke: 0.8pt * k,
      align(center + horizon, text(font: times, size: 18pt * k, underline(stroke: (paint: luma(90), thickness: 0.5pt * k, dash: "loosely-dotted"), [mafile])))))
    place(top + left, dx: 76pt * k, dy: 29pt * k, polygon(fill: black, (0pt, 2pt * k), (22pt * k, 2pt * k), (22pt * k, 0pt), (32pt * k, 5pt * k), (22pt * k, 10pt * k), (22pt * k, 8pt * k), (0pt, 8pt * k)))
    place(top + left, dx: 186pt * k, dy: 0pt, text(font: "Arial", weight: "bold", size: 10pt * k, [entête]))
    cellule(186, 22, none)
    fleche(219, 33, 382, 33)
    fleche(382, 33, 382, 95)
    pointe(382 * k, 96 * k, "bas")
    for (x, n) in ((60, [1]), (186, [2]), (276, [3]), (360, [4])) { cellule(x, 98, n) }
    fleche(93, 109, 184, 109); pointe(185 * k, 109 * k, "droite")
    fleche(219, 109, 274, 109); pointe(275 * k, 109 * k, "droite")
    fleche(309, 109, 358, 109); pointe(359 * k, 109 * k, "droite")
    fleche(393, 109, 393, 140); fleche(393, 140, 71, 140); fleche(71, 140, 71, 122); pointe(71 * k, 121 * k, "haut")
  })
}

// Exemple d'utilisation du décaleur (table de l'original)
#let lignes-decaleur = (
  ("d=Decaleur.creer(5)", ""), ("puts d", "<<----->>"), ("d.decale('a')", ""), ("puts d", "<<----a>>"),
  ("d.decale('b')", ""), ("puts d", "<<---ab>>"), ("d.decale('c')", ""), ("puts d", "<<--abc>>"),
  ("d.decale('d')", ""), ("puts d", "<<-abcd>>"), ("d.decale('e')", ""), ("puts d", "<<abcde>>"),
  ("d.decale('f')", ""), ("puts d", "<<bcdef>>"), ("puts d.getLargeur", "5"),
)
#let table-decaleur(colonnes: (130pt, 86pt), taille: 9pt, rang: 13pt, entete: 9pt) = table(
  columns: colonnes, rows: rang, inset: (x: 2pt, y: 0pt), align: left + horizon, stroke: 0.7pt,
  table.header(align(center, text(font: "Arial", weight: "bold", size: entete)[Test]), align(center, text(font: "Arial", weight: "bold", size: entete)[Affichage])),
  ..lignes-decaleur.map(((t, a)) => (text(font: courier, size: taille, t), text(font: courier, size: taille, a))).flatten(),
)
