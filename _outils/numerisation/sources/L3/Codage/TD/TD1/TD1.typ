// TD 1 de codage : « Codage Physique – Mesure de l'Information » (F. Carlier), recomposé d'après le scan du 1er octobre 2026.
// Page 1 : l'énoncé. Page 2 : la feuille des chronogrammes, vierge. Les réponses écrites à la main sur le scan
// ne font pas partie de l'original : elles sont saisies dans le TD interactif.
#import "/gabarits/carlier.typ": *

#show: sujet.with(
  titre: "TD 1 – Codage Physique – Mesure de l’Information",
  taille: 11pt,
  gauche: [Licence 3],
  cadre-1: 26.5pt,
  ecart: 6.7pt,
  cadre-2: 44.8pt,
  ligne: text(12pt)[#box(width: 280.8pt)[Enseignant *: Florent Carlier*]Durée *: 1 heure*],
  monte: 1.5pt,
)

#v(-1.4pt)
#align(center, text(20pt, weight: "bold")[Codage Physique – Mesure de l’Information.])
#v(2.6pt)
#filet()
#v(9.7pt)
*#sl[Exercice 1 : Support Physique.]*
#v(10.9pt)
Pour que la transmission soit optimale, il est nécessaire que le signal soit codé de façon à faciliter sa #fl
transmission sur le support physique. Nous allons utiliser des codage sur trois niveaux. Voici la #fl
séquence à transmettre :
#v(13.1pt)
#align(center)[*1 0 0 1 0 1 0 0 0 0 0 0 1 1 0 0 0 0 1 1 1 0 0*]
#vide()
#q(gras: false, retrait: 12.5pt, tabulation: 69.5pt)[Q-1 :][Réaliser le codage en utilisant le code bipolaire simple.]

#q(gras: false, retrait: 12.5pt, tabulation: 69.5pt)[Q-2 :][Rappeler l’algorithme de HDBn.]

#q(gras: false, retrait: 12.5pt, tabulation: 69.5pt)[Q-3 :][Réaliser le codage en utilisant le code HDB2. Dernier Viol négatif. 1#super[Er] « 1 » positif.]
#v(14.3pt)
*#sl[Exercice 2 : Mesure de l’information]*
#v(11.5pt)
On considère un jeu de 32 cartes et une main de 4 cartes. Soient les événements :
#v(14.4pt)
E1 = {La main ne contient aucune carte inférieure au valet},

E2 = {La main ne contient pas de figure},

E3 = {La main contient quatre cartes identiques (de même nom)},

E4 = {La main contient les quatre as}.
#vide()
#h(13.5pt)Q-1 : Calculer la self-information (entropie) associée à chacun de ces événements.

#h(13.5pt)Q-2 : Evaluer approximativement le nombre d'éléments binaires nécessaires pour spécifier

#h(40.5pt)quatre cartes et le comparer à l'entropie de la variable aléatoire correspondant à une main.

// ---------------------------------------------------------------------------------------------------
// Page 2 : feuille des chronogrammes (A4 en paysage). Positions mesurées sur le scan, en points
// depuis le coin haut gauche de la feuille.
#let feuille-chronogrammes(bits) = {
  let x0 = 103pt          // axe vertical
  let colonne = 26.15pt
  let y0 = 209.5pt        // premier trait horizontal
  let rang = 12.09pt
  let n = bits.len()
  let fin = x0 + n * colonne
  let haut = y0 - rang
  let bas = y0 + 20 * rang
  let fin-trait = 0.5pt
  set text(font: "Arial", size: 9.5pt, top-edge: "cap-height", bottom-edge: "baseline")
  // Bits à coder : un par colonne, un peu à gauche du milieu, au pas de 26,36 pt
  for (i, b) in bits.enumerate() {
    place(top + left, dx: 112.7pt + i * 26.36pt - 10pt, dy: 177.7pt, box(width: 20pt, align(center, b)))
  }
  // Traits horizontaux : vingt, dont les deux axes en gras ; la grille reste ouverte à droite
  for k in range(20) {
    let axe = k == 3 or k == 12
    place(top + left, dx: x0, dy: y0 + k * rang,
      line(length: fin - x0, stroke: if axe { 2pt } else { fin-trait }))
  }
  // Traits verticaux : ils dépassent d'un rang en haut et en bas
  place(top + left, dx: x0, dy: haut, line(angle: 90deg, length: bas - haut, stroke: 3pt))
  for i in range(1, n) {
    place(top + left, dx: x0 + i * colonne, dy: haut, line(angle: 90deg, length: bas - haut, stroke: fin-trait))
  }
  // Étiquettes des lignes
  place(top + left, dx: 45pt, dy: 245.1pt - 6.8pt, [C Bipolaire])
  place(top + left, dx: 45.8pt, dy: 328.6pt - 6.8pt, [V-])
  place(top + left, dx: 46.5pt, dy: 352.4pt - 6.8pt, [HDB2])
}

#page(width: 841.9pt, height: 595.3pt, margin: 0pt,
  feuille-chronogrammes("10010100000011000011100".clusters()))
