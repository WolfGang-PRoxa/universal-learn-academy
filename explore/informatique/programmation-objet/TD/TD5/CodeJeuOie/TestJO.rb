# ==============================================================================
# Fichier : TestJO.rb
# Script de test et d'exécution du Jeu de l'Oie.
# Initialise une partie type, affiche le plateau et lance la simulation.
# ==============================================================================
load "Jeu.rb"

# Création de l'instance du jeu
jeu=Jeu.new()

# Affichage de la composition du plateau
puts jeu

# Lancement de la partie
jeu.lanceToi

# ==============================================================================
# Exemple d'exécution attendue (tel que spécifié dans l'énoncé) :
# ==============================================================================
=begin
Le joueur Rouge a fait : 3
joueur Rouge a la case Case Avancer de 3
joueur Rouge a la case Case Neutre

Le joueur Vert a fait : 3
joueur Vert a la case Case Avancer de 3
joueur Vert a la case Case Neutre

Le joueur Bleu a fait : 3
joueur Bleu a la case Case Avancer de 3
joueur Bleu a la case Case Neutre

Le joueur Rouge a fait : 4
joueur Rouge a la case Case Neutre

Le joueur Vert a fait : 4
joueur Vert a la case Case Neutre

Le joueur Bleu a fait : 6

Le joueur Rouge a fait : 2
joueur Rouge a la case Case arrivée

 !!!!! Le joueur Rouge a gagne !!!!!
=end
