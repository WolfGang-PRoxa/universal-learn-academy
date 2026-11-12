// TD 3 de codage : « Code Pseudo Aléatoire / Code Cyclique » (F. Carlier, 2018), recomposé d'après le scan du 1er octobre 2026.
// Le texte est celui de l'original, fautes et espaces comprises ; chaque ligne de l'original fait une ligne ici.
#import "/gabarits/carlier.typ": *

#show: sujet.with(
  titre: "TD 3 – Code Pseudo Aléatoire / Code Cyclique",
  gauche: "MODULE Codage...",
  droite: [Licence 3 INFO],
  ligne: [#box(width: 353pt)[Enseignant *: Florent Carlier*]Durée *: 2 heures*],
  monte: 0.9pt,
)

// La matrice de l'exercice 4 est une image dans l'original : chiffres sans empattement, entre crochets
#let matrice-g = {
  set text(font: "Arial", size: 8pt, top-edge: "cap-height", bottom-edge: "baseline")
  let trait = 0.7pt
  let chiffres = grid(
    columns: 4, column-gutter: 4.2pt, row-gutter: 3.3pt,
    [1], [1], [0], [0],
    [0], [1], [1], [0],
    [0], [0], [1], [1],
  )
  box(baseline: 11pt, {
    text(style: "italic")[G=]
    h(1.5pt)
    box(baseline: 11pt, stroke: (left: trait, right: trait), inset: (x: 2.6pt, y: 1.6pt), {
      place(top + left, dx: -2.6pt, dy: -1.6pt, line(length: 2.4pt, stroke: trait))
      place(bottom + left, dx: -2.6pt, dy: 1.6pt, line(length: 2.4pt, stroke: trait))
      place(top + right, dx: 2.6pt, dy: -1.6pt, line(length: 2.4pt, stroke: trait))
      place(bottom + right, dx: 2.6pt, dy: 1.6pt, line(length: 2.4pt, stroke: trait))
      chiffres
    })
  })
}

#v(9.6pt)
#align(center)[*Code Pseudo Aléatoire / Code Cyclique.#text(4.5pt)[2018]*]
#v(12.6pt)
#filet()
#v(14pt)
*Objectifs :* Première approche de manipulations de Codes Correcteur d’erreurs utilisés dans le domaine de la #fl
télécommunications.
#v(10.3pt)
#filet()
#v(14.5pt)
*Exercice 1) – Code de Gold.*
#vide()
#h(34.4pt)*Q-1 :* Si le nombre d’étages est de n = 5, combien de séquence à longueur maximal peut on générer ?
#vide()
#h(34.4pt)*Q-2 :* La table donne les étages [5, 2] [5, 4, 2, 1] [5, 4, 3, 2], explicitez la forme polynomial de chacun ?

#h(119.4pt)Donner les séquences des deux premières.
#vide()
#h(34.4pt)*Q-3 :* Faites le schéma du codeur de Gold et donner la séquences ainsi obtenu.
#vide()
*Exercice 2) – Code~ JPL.*
#vide()
#h(13.5pt)*Q-1 :* Une séquence LM est généré avec [2, 1] et [3, 1] et [5, 2]

#h(70.7pt)Donner les deux séquences possibles et la longueur possible des séquences.
#vide()
#h(13.5pt)*Q-2 :* À l’aide des séquences généré, donnez la séquence et le schéma d’un codeur JPL.

#h(34.6pt)Quelle est sa longueur ?
#vide()
*Exercice 3) – Division polynomial.*
#vide()
#h(13.9pt)*Q :* On divise le polynôme x#super[7] + x#super[5] + 1 par le polynôme générateur x#super[3] + 1.

#h(70.7pt)Quel est le reste obtenu ?
#vide()
*Exercice 4) –Définition des codes cycliques.*
#vide()
#h(13.9pt)*Q :*#h(10.1pt)Déterminez si le code engendré par la matrice~ est cyclique?
#v(3.5pt)
#h(145.5pt)#matrice-g
#v(15pt)
*Exercice 5) - La notation polynomiale.*
#vide()
#h(12pt)*Q :*#h(10pt)Soit le mot #emph[a] = [10101].

#h(42.3pt)Une permutation circulaire de 3 positions vers la gauche donne : #emph[a'''] = [01101].

#h(42.3pt)*#emph[Retrouvez le même résultat par les polynômes associés.]*
#vide()
*Exercice 6) – Encodage avec code cyclique.*
#vide()
#h(12pt)*Q :*#h(9.4pt)Un code utilise le polynôme générateur x#super[2] + x + 1.

#h(34pt)Quel est l'encodage du message 11011 ?
#vide(n: 2)
*Exercice 7) - Codeur Série.*
#vide()
#h(12pt)*Q :*
#v(2pt)
#h(13.9pt)Le polynôme #emph[g]\(#emph[x]) = #emph[x]#super[8]+#emph[x]#super[7]+#emph[x]#super[6]+#emph[x]#super[4]+1 peut-il engendrer un code cyclique de longueur #emph[n]=15 ?

#h(36.3pt)Si oui, dessinez un (bon) codeur série pour ce code. Si non, expliquez pourquoi.
