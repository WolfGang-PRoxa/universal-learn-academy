// TD 2 de POO : « TD n°2 : Introduction à la POO », recomposé d'après le scan du 1er octobre 2026 (2 pages A4).
// Page 1 : les sujets 3 et 4 du TD 1, repris. Page 2 : la classe Compte avec un seuil, le crible d'Ératosthène.
// Le texte est celui de l'original, fautes comprises (« autorisées », « faire sortir un élément dans la file »,
// « Erathostène », « classique du système »…). La première ligne d'en-tête est coupée par le bord de la photo :
// on la lit « Introduction à la Programmation Orientée Objet », comme le titre du TD 1.
#import "/gabarits/poo.typ": *

#set document(title: "TD 2 – Introduction à la POO", author: "P. Jacoboni, E. Delozanne", date: none,
  keywords: ("recomposé d'après un scan", "studies/_outils/numerisation"))
#set page(width: 595.3pt, height: 841.9pt, margin: (left: 22pt, right: 24pt, top: 28pt, bottom: 24pt))
#show: reglages.with(taille: 12pt)
#set par(leading: 0.5em, spacing: 0.5em)
#set list(spacing: 0.5em)
#set enum(spacing: 0.5em)

#let titre(corps) = align(center, text(font: calibri, weight: "bold", size: 15pt, corps))
#let case = box(width: 7pt, height: 7pt, stroke: 0.6pt, baseline: -0.5pt)

// ----------------------------------------------------------------------------------------------- page 1
#titre[Introduction à la Programmation Orientée Objet]
#v(-2pt)
#text(size: 1.1em, titre[Application à Ruby])
#v(14pt)
#titre[TD n°2 : Introduction à la POO]
#v(4pt)
#line(length: 100%, stroke: 0.9pt)
#v(-2pt)
*TD1-Sujet 3 #h(2pt): Simulation d'afficheurs lumineux – Partie 1*
#pad(left: 22pt)[
  Le but de cet exercice est de simuler en Ruby les afficheurs lumineux qui font circuler un texte en boucle. \
  *A) Le décaleur*
]
#pad(left: 30pt)[
  Intéressons-nous d'abord au _décaleur_. C'est un objet qui stocke une suite de l #h(2pt) caractères avec #c[1 > 0]). #c[1] est constant et est appelé _largeur du décaleur_. Initialement, un décaleur contient l espaces.
]
#grid(columns: (1fr, 140pt), column-gutter: 10pt,
  pad(left: 30pt)[
    Les quatre fonctionnalités d'un décaleur sont :
    #set par(justify: true)
    #list(marker: case, indent: 12pt, body-indent: 8pt,
      [Fournir un accès à la largeur du décaleur,],
      [Remettre à Zéro : force tous les caractères à _espace_,],
      [Décaler d'une position vers la gauche sa suite de caractères : le caractère le plus à gauche est supprimé de la suite et est renvoyé par la méthode. Le nouveau caractère le plus à droite est fixé à la valeur du paramètre fourni.],
      [l'affichage d'un décaleur affiche le contenu de celui ci.])
    #pad(left: 6pt)[*Définir* entièrement en Ruby la classe #c[Decaleur]. Écrire en Ruby le code de toutes les méthodes de la classe, sans oublier en particulier les méthodes de création/initialisation.]
  ],
  pad(top: -4pt, {
    align(center, text(size: 4.5pt, weight: "bold")[Exemple d'utilisation de la classe #text(font: courier)[Decaleur]])
    v(-3pt)
    table-decaleur(colonnes: (84pt, 56pt), taille: 5.2pt, rang: 8.4pt, entete: 4.8pt)
  }))
#v(44pt)
*TD1-Sujet 4 #h(2pt): Un TDA File circulaire en Ruby* \
On souhaite réaliser le Type de Données Abstrait (TDA) #c[File] par #underline[chainage circulaire] en Ruby. \
On rappelle qu'une file est une liste de type FIFO (First in First out) : Une file est une liste où les insertions s'effectuent à la fin et les suppressions au début. \
Les opérations primitives autorisées sur une liste sont au nombre de 5 \
faire #c[entrer] un élément dans la file, faire #c[sortir] un élément dans la file, tester si la file est #c[vide], accéder au #c[premier] élément de la file, #c[afficher] le contenu de la file
#list(marker: text(size: 6pt)[■], indent: 30pt, body-indent: 12pt,
  [une file est représentée par une cellule d'en-tête dont le champ suivant pointe sur la dernière cellule de la file ; le champ suivant de cette dernière pointe sur la première.],
  [Exemple : représentation de la file 1,2,3,4.])
#v(8pt)
#pad(left: 30pt, figure-file(largeur: 400pt))
#v(14pt)
#list(marker: text(size: 6pt)[■], indent: 30pt, body-indent: 12pt,
  [Avantage de cette réalisation pour les #c[File] :Toutes les opérations (sauf détruire sont en *o(1)*)])
#v(10pt)
#enum(numbering: "1)", start: 8, indent: 30pt,
  [Déterminer les objets nécessaires à la réalisation d'une file circulaire],
  [Coder en Ruby la/les classes nécessaires])
Ecrire un programme de test, qui crée la file #c[(m,e,r,c,i, ,J,a,c,o)] et l’affiche.

// ----------------------------------------------------------------------------------------------- page 2
#pagebreak()
#v(10pt)
#pad(left: 16pt)[
  La Classe #c[Compte] du cours n°1 d'introduction à Ruby un peu moins rudimentaire #h(3pt)avec un seuil de retrait et des fonctions d'accès générées par le "Coding Assistant". \
  Les objets de cette classe
]
#{
  // Les points de la liste sont en Calibri dans l'original
  set text(font: calibri, size: 12pt)
  enum(indent: 32pt, body-indent: 9pt,
    [sont caractérisés par leur #c[numéro], leur #c[titulaire] et leur #c[solde]],
    [sont capables de donner leur solde, de déposer une somme et de retirer une somme si le seuil de retrait n'est pas atteint.
      #enum(numbering: "a.", indent: 12pt, body-indent: 10pt,
        [Par défaut le seuil est fixé à 0.],
        [La notion de seuil sera implémentée en définissant une méthode privée qui renvoie la valeur du seuil autorisée. (On aurait aussi pu utiliser une variable d'instance).])],
    [Pour créer un objet de cette classe on envoie le message ouvrir à la classe #c[Compte] avec pour arguments le numéro, le titulaire et le solde du compte que l'on veut créer. Il n'est pas possible de modifier les informations du compte (titulaire et numéro). Le solde ne peut être modifié que par les opérations de retrait et de dépôt prévues à l'interface.],
    [Faire le nécessaire pour pouvoir afficher un #c[Compte] avec les instructions classique du système (#c[puts], #c[print], etc.)],
  )
}
#v(26pt)
*Sujet 2 : Le crible d’Érathostène* \
#text(font: calibri)[Donner une réalisation en Ruby du crible d'Erathostène, un algorithme qui permet de trouver l'ensemble des nombres premiers inférieurs ou égaux à n, n étant donné.] \
*Principe :* \
Un générateur envoie des nombres de 2 à n de façon incrémentale. Une série de filtres sont placés de façon à récupérer les valeurs envoyées par les filtres précédents. Lorsqu'un nombre x est récupéré par un filtre i , si x est divisible par i, alors x n'est pas premier. Sinon x passe sur le filtre suivant. Si x n'a rencontré aucun diviseur à la sortie de la chaîne des filtres, on construit au bout de la chaîne un filtre de valeur x.
#v(4pt)
#{
  let fleche(x, y, l) = {
    place(top + left, dx: x, dy: y, line(length: l - 9pt, stroke: 1.1pt))
    place(top + left, dx: x + l - 10pt, dy: y - 3.5pt, polygon(fill: black, (0pt, 0pt), (10pt, 3.5pt), (0pt, 7pt)))
  }
  let filtre(x, n) = place(top + left, dx: x, dy: 23pt, rect(width: 26pt, height: 26pt, stroke: 1pt,
    align(center + horizon, text(font: "Arial", size: 11pt, n))))
  pad(left: 158pt, box(width: 260pt, height: 54pt, {
    place(top + left, dx: 0pt, dy: 0pt, text(size: 8.5pt)[générateur])
    place(top + left, dx: 115pt, dy: 0pt, text(size: 8.5pt)[filtres])
    place(top + left, dx: 0pt, dy: 18pt, rect(width: 46pt, height: 36pt, radius: 15pt, stroke: 1.2pt))
    fleche(48pt, 36pt, 22pt)
    filtre(72pt, [2])
    fleche(98pt, 36pt, 22pt)
    filtre(121pt, [3])
    fleche(147pt, 36pt, 22pt)
    filtre(171pt, [5])
    fleche(203pt, 36pt, 24pt)
    place(top + left, dx: 232pt, dy: 28pt, text(size: 11pt, weight: "bold")[…])
  }))
}
#v(14pt)
#enum(numbering: "a)", indent: 22pt, body-indent: 8pt,
  [Donner une description en français des classes nécessaires à la réalisation de ce programme.],
  [Écrire en Ruby la définition des classes correspondantes],
  [Écrire en Ruby un programme de test demandant un nombre à l'utilisateur et affichant tous les nombres premiers inférieurs à ce nombre])
