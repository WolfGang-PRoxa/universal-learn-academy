// TD 4 de codage : « Notions et Principes du Temps-réel » (F. Carlier), recomposé d'après le scan du 1er octobre 2026.
// Page 1 : l'énoncé et sa figure. Page 2 : la feuille des graphes d'activités, vierge.
// Le texte est celui de l'original (« ou » sans accent, « uS » pour µs dans la figure, apostrophes droites).
#import "/gabarits/carlier.typ": *

#show: sujet.with(
  titre: "TD 4 – Notions et Principes du Temps-réel",
  taille: 12pt,
  cadre-1: 26.5pt,
  ecart: 6.7pt,
  cadre-2: 44.8pt,
  ligne: [#box(width: 281.8pt)[Enseignant *: Florent Carlier*]Durée *: 2 heures*],
  monte: 1.5pt,
)

// Question : étiquette en retrait, lignes suivantes alignées sur le texte
#let question(retrait: 37.5pt, suite: 63.6pt, corps) = par(
  first-line-indent: (amount: retrait, all: true), hanging-indent: suite, corps)

// --- Figure de l'exercice 2 -------------------------------------------------------------------------
// Dans l'original, les textes de la figure ont des lettres un peu étroites et serrées (dessin importé).
// Noms des boîtes, des interruptions et de la variable en gras ; cycles en maigre.
#let etroit(origine: center + horizon, facteur: 90%, corps) = scale(x: facteur, origin: origine, corps)
#let arial(taille, corps, gras: true, suivi: 0pt) = text(font: "Arial", weight: if gras { "bold" } else { "regular" },
  size: taille, tracking: suivi, top-edge: "cap-height", bottom-edge: "baseline", corps)
#let trait = 0.7pt
// Trame à points clairsemés des trois boîtes
#let trame = tiling(size: (13pt, 11pt), {
  for (x, y) in ((1.2pt, 1.6pt), (5.3pt, 7.4pt), (9.6pt, 3.1pt), (7.1pt, 0.4pt), (2.4pt, 9.3pt), (11.6pt, 8.2pt), (4.2pt, 4.1pt)) {
    place(dx: x, dy: y, circle(radius: 0.22pt, fill: luma(135)))
  }
})
// Texte posé par sa ligne de base, à partir de son bord gauche
#let pose(x, y, taille, corps, facteur: 90%, gras: true, suivi: 0pt) = place(top + left, dx: x, dy: y - 0.716 * taille,
  etroit(origine: left + horizon, facteur: facteur, arial(taille, corps, gras: gras, suivi: suivi)))
// Pointes de flèche pleines : vers le bas, vers la gauche, vers la droite (x, y : la pointe)
#let pointe-bas(x, y, long: 6.6pt, larg: 4.2pt) = place(top + left, dx: x - larg / 2, dy: y - long,
  polygon(fill: black, (0pt, 0pt), (larg, 0pt), (larg / 2, long)))
#let pointe-gauche(x, y, long: 4pt, haut: 3.2pt) = place(top + left, dx: x, dy: y - haut / 2,
  polygon(fill: black, (0pt, haut / 2), (long, 0pt), (long, haut)))
#let pointe-droite(x, y, long: 4pt, haut: 3.2pt) = place(top + left, dx: x - long, dy: y - haut / 2,
  polygon(fill: black, (0pt, 0pt), (long, haut / 2), (0pt, haut)))

#let figure-taches = {
  let haut = 66.9pt           // haut des boîtes, depuis le haut du bloc
  let h = 41.2pt
  let l = 63.8pt
  let milieu = haut + h / 2
  let boites = (("Fond", 92.1pt, 10.5pt, -0.6pt), ("T1", 214.4pt, 11pt, 0pt), ("T2", 304.2pt, 11pt, 0pt))
  for (nom, x, taille, suivi) in boites {
    place(top + left, dx: x, dy: haut, rect(width: l, height: h, stroke: trait, fill: trame, inset: 0pt,
      align(center + horizon, etroit(facteur: if nom == "Fond" { 90% } else { 95% }, arial(taille, nom, suivi: suivi)))))
  }
  // Interruptions : une flèche qui descend sur la boîte, une pointe à mi-hauteur, l'étiquette à sa droite
  for (nom, x, depart, etiquette) in (("IT1", 246.3pt, 16.1pt, 254pt), ("IT2", 336.1pt, 13.9pt, 342.8pt)) {
    place(top + left, dx: x, dy: depart, line(angle: 90deg, length: haut - depart, stroke: trait))
    pointe-bas(x, depart + 31.1pt, long: 7pt, larg: 4.4pt)
    pointe-bas(x, haut, long: 6.4pt)
    pose(etiquette, depart + 31.6pt, 10.5pt, nom, suivi: -0.55pt)
  }
  // Variable partagée V, entre Fond et T1
  place(top + left, dx: 155.9pt, dy: milieu, line(length: 58.5pt, stroke: trait))
  place(top + left, dx: 185.1pt, dy: milieu - 9.6pt, line(angle: 90deg, length: 20.2pt, stroke: trait))
  place(top + left, dx: 180.95pt, dy: milieu - 9.6pt, line(length: 8.3pt, stroke: trait))
  place(top + left, dx: 180.95pt, dy: milieu + 10.6pt, line(length: 8.3pt, stroke: trait))
  pointe-gauche(155.9pt, milieu)
  pointe-droite(184.2pt, milieu, long: 3.6pt, haut: 3pt)
  pointe-gauche(186pt, milieu, long: 3.6pt, haut: 3pt)
  pointe-droite(214.4pt, milieu, long: 4.4pt)
  place(top + left, dx: 185.6pt - 20pt, dy: milieu - 12.6pt - 0.716 * 11pt,
    box(width: 40pt, align(center, etroit(facteur: 85%, arial(11pt, [V])))))
  pose(193.4pt, milieu - 3pt, 7.6pt, [2cm], facteur: 85%, gras: false, suivi: -0.4pt)
  // Cycles, sous les boîtes
  let base = haut + h + 18.9pt
  let pas-ligne = 10.9pt
  for (x, lignes) in (
    (93.1pt, ((0pt, [Cycle :]), (7.5pt, [OpFond (300uS)]), (7.5pt, [accesV (200uS)]))),
    (213.2pt, ((0pt, [Op1 (50uS)]), (0pt, [Cycle IT1:]), (8.4pt, [Op10 (100uS)]), (8.4pt, [accesV (200uS)]))),
    (304.1pt, ((0pt, [Op2 (50uS)]), (0pt, [Cycle IT2:]), (7.7pt, [Op20 (200uS)]))),
  ) {
    for (i, (retrait, t)) in lignes.enumerate() {
      pose(x + retrait, base + i * pas-ligne, 11pt, t, gras: false, suivi: -0.45pt)
    }
  }
}

#v(9.8pt)
#align(center, text(20pt, weight: "bold")[Notions et Principes du Temps-réel.])
#v(15.1pt)
#filet()
#v(11.9pt)
*#sl[Exercice 1 : Principes.]*
#vide()
#question[Q1 : Dans une application multi-tâches mono-processeur, peut on utiliser une attente #fl
active, (Préciser, Justifier).]
#vide()
#question[Q2 : Dans une application Temps-réel, quelle(s) condition(s) est (sont) nécessaire(s) #fl
pour que le résultat d'un calcul soit considéré comme juste et valable ?]
#vide()
#question[Q3 : Indiquer les différences entre les états Bloqué et Prêt pour une tâche dans une #fl
application gérée par un exécutif Temps-réel ?]
#vide()
#question[Q4 : Expliquer le principe d'implantation de l'exclusion mutuelle.]
#vide(n: 2)
*#sl[Exercice 2 : Implantation de l'exclusion mutuelle.]*
#vide()
// Ce paragraphe déborde du cadre à droite dans l'original
#pad(left: 2.3pt, right: -11pt)[On considère la structure fonctionnelle suivante ou IT1 et IT2 sont implantées par des #fl
sémaphores et V est une variable partagée qui doit être protégée par exclusion mutuelle. On #fl
suppose que les tâches T1 (1ms) et T2 (500µs) sont de priorité respective 6 (+ prioritaire) et 4.]
#block(height: 178.8pt, width: 100%, spacing: 0.042em, figure-taches)
#pad(right: -3.8pt, {
  question(retrait: 40.2pt, suite: 67.6pt)[Q1 : Définir le taux d'occupation Tx de cette application. Peut-on faire une application #fl
  mono-processeur?]
  vide()
  question(retrait: 40.2pt, suite: 67.6pt)[Q2 : Implantation de l'exclusion mutuelle à l'aide de sémaphore (mutex). \
  Compléter le graphe d'activités. \
  Donner le code C des trois tâches sur un exécutif Temps-réel XEC86.]
  vide()
  question(retrait: 40.2pt, suite: 67.6pt)[Q3 : Implantation de l'exclusion mutuelle par modification de la priorité. \
  Compléter le graphe d'activités. \
  Donner le code C des trois tâches sur un exécutif Temps-réel XEC86.]
})

// ---------------------------------------------------------------------------------------------------
// Page 2 : feuille des graphes d'activités (A4 en paysage). Positions mesurées sur le scan, en points
// depuis le coin haut gauche de la feuille. Une colonne vaut 100 µs ; les repères IT1 et IT2 sont
// posés là où ils sont sur l'original, le dernier IT1 un peu après le second IT2, une ligne plus bas.
#let etiquette(x, y, corps, centre: false) = {
  let t = arial(8.1pt, corps, gras: false)
  if centre {
    place(top + left, dx: x - 30pt, dy: y - 0.716 * 8.1pt, box(width: 60pt, align(center, etroit(t))))
  } else {
    place(top + left, dx: x, dy: y - 0.716 * 8.1pt, etroit(origine: left + horizon, t))
  }
}
#let graphe(nom, haut, lignes, dessus: (:), it: 23.6pt, it-bas: 36.7pt) = {
  let x0 = 143.6pt
  let colonne = 21pt
  let rang = 42pt
  let bas = haut + 4 * rang
  let fin = 0.6pt
  for i in range(31) {
    place(top + left, dx: x0 + i * colonne, dy: haut, line(angle: 90deg, length: 4 * rang, stroke: fin))
  }
  for k in range(5) {
    place(top + left, dx: x0, dy: haut + k * rang, line(length: 30 * colonne, stroke: fin))
  }
  etiquette(83.4pt, haut - dessus.nom, nom)
  etiquette(x0 - 0.4pt, haut - dessus.zero, [0uS])
  etiquette(x0 + 24.6pt, haut - dessus.cent, [100uS])
  etiquette(x0 + 10 * colonne + 0.6pt, haut - dessus.mille, [1000uS], centre: true)
  // Chaque tâche est nommée à hauteur du trait qui lui sert de ligne de base
  for (k, (x, t, dy)) in lignes.enumerate() {
    etiquette(x, haut + (k + 1) * rang + 2.9pt + dy, t)
  }
  for (x, t, y) in ((248.2pt, [IT1], it), (311.2pt, [IT2], it), (352.2pt, [IT1], it), (520.6pt, [IT2], it), (529.7pt, [IT1], it-bas)) {
    etiquette(x, bas + y, t, centre: true)
  }
}

#page(width: 841.9pt, height: 595.3pt, margin: 0pt, {
  graphe([Q2], 73.3pt,
    ((122.2pt, [T1], 0pt), (122.2pt, [T2], 0pt), (122.7pt, [F], 0pt), (112.8pt, [Mutex], -1.4pt)),
    dessus: (nom: 4.5pt, zero: 6.8pt, cent: 18.6pt, mille: 8.1pt))
  graphe([Q3], 354pt,
    ((122.2pt, [T1], 0pt), (122.2pt, [T2], 0pt), (123.1pt, [F], 0pt)),
    dessus: (nom: 11.3pt, zero: 10pt, cent: 22.2pt, mille: 10.4pt),
    it: 17.2pt, it-bas: 30.3pt)
})
