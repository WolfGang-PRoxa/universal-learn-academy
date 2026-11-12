// TD 2 de codage : « Code Correcteurs d'Erreurs » (F. Carlier), recomposé d'après le scan du 1er octobre 2026.
// Le texte est celui de l'original, fautes et apostrophes comprises ; les fins de ligne sont les siennes.
#import "/gabarits/carlier.typ": *

#show: sujet.with(
  titre: "TD 2 – Code Correcteurs d’Erreurs",
  ligne: [#box(width: 353pt)[Responsable *: Florent Carlier*]*Durée : 2 heures*],
  monte: 0.9pt,
)

#v(9.4pt)
#align(center)[*Code Correcteurs d’Erreurs*]
#v(11.9pt)
#filet()
#v(11.6pt)
*Objectifs :* Première approche de manipulations de Codes Correcteur d’erreurs utilisés dans le domaine de la #fl
télécommunications.
#v(12.3pt)
#filet()
#v(13.9pt)
*#sl[Exercice 1)] – #sl[Code de Hadamard]*
#vide()
#q[Q-1 :][Donner la matrice de Hadamard de longueur 8.]

#q[Q-2 :][Un utilisateur 1 (U1) utilise la séquence 2 et émet la séquence~ 1 0 1.]

#h(35.5pt)Un utilisateur 2 (U2) utilise la séquence 4~ et émet la séquence 0 1 1.

#h(35.5pt)Donner le codage de chaque séquence ?
#vide()
#q(retrait: 8pt)[Q-3 :][Les utilisateurs émettent en même temps, Donner la valeur de la séquence du signal.]

#h(35.5pt)\(Opération d’étalement).
#vide()
*#sl[Exercice 2)] – #sl[Génération Code Correcteur d’Erreur]*
#v(pas - 1.6pt)
Un code associe à deux éléments binaires d’information des mots constitués de cinq éléments binaires suivant la #fl
correspondance :
#v(9.5pt)
// Le tableau de l'original n'a ni bord droit ni bord bas
#pad(left: 101.4pt, table(
  columns: (100.3pt, 100.3pt),
  rows: (25.7pt, 16.75pt, 16.75pt, 16.75pt, 16.75pt),
  align: center + horizon,
  inset: 0pt,
  stroke: (x, y) => (
    top: if y == 0 { 1.4pt } else { 0.9pt },
    left: 0.9pt,
  ),
  [éléments binaires \ d'information], [mots code],
  [00], [00000],
  [01], [01101],
  [10], [10111],
  [11], [11010],
))
#v(26.3pt)
#q(retrait: 12pt)[Q-1:][Le code est linéaire systématique. Expliquez l'implication de ce type de code.]
#vide()
#q(retrait: 12pt)[Q-2 :][Expliciter le code sous forme d'un système.]
#vide()
#q(retrait: 12pt)[Q-3 :][Donner l’expression de la matrice génératrice et de la matrice de contrôle.]
#vide()
#q(retrait: 12pt)[Q-4 :][Préciser le pouvoir correcteur de ce code en tenant compte de la question précédente.]
#vide()
#q(retrait: 12pt)[Q-5 :][Construire une table de décodage indiquant les configurations d’erreurs effectivement corrigées.]
#v(pas + 0.7pt)
#par(hanging-indent: 21pt, first-line-indent: 14pt)[*Q-6 :* On suppose que les éléments binaire code sont transmis sur un canal binaire symétrique de probabilité #fl
d’erreur inférieur à 0,04. Donner la probabilité d'erreur de notre code.]
#v(pas + 6.3pt)
*#sl[Exercice 3)] – #sl[Extension d’un code correcteur]*
#vide()
La longueur du message de la source est 3. On envisage d’utiliser un code correcteur d’erreurs linéaire parfait de #fl
distance minimum 3 sur un canal binaire symétrique.
#vide()
#par(hanging-indent: 21.5pt)[*Q-1 :* Quel doit être l’ordre minimum e d’extension de la source pour que la construction d’un tel code soit #fl
possible ?]
#vide()
#par(hanging-indent: 21.5pt)[*Q-2 :* En utilisant le code trouvé en Q-1, calculer la probabilité pour q’un mot de d’extension d’ordre soit #fl
correctement transmis.]
