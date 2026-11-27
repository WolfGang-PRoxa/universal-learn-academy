# Claude, ChatGPT et Gemini

Claude aide pendant les quiz, corrige les réponses rédigées, évalue les tentatives et génère de nouveaux quiz. Il passe par **Claude Code**, l’outil en ligne de commande d’Anthropic, qui doit être installé sur le poste. Sans lui, les cours et les quiz fonctionnent, mais sans l’aide de Claude.

## Deux façons de se connecter

Le choix se fait dans [Paramètres › Claude](parametres:claude).

| Mode                                           | Fonctionnement                                                                                                                                                                                        | Pour qui                  |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Un compte Claude, via Claude Code (par défaut) | L’application détecte Claude Code et affiche le compte connecté. **Se connecter…** ouvre un terminal où la connexion se fait sur le site d’Anthropic : l’application ne voit jamais les identifiants. | Avec un abonnement Claude |
| Une clé d’API Anthropic                        | La clé est vérifiée auprès d’Anthropic, puis chiffrée par le système et jamais réaffichée. L’usage est facturé à la clé.                                                                              | Sans abonnement           |

> **Note** Une application tierce n’a pas le droit de proposer la connexion avec un compte claude.ai ni de conserver des identifiants. C’est pourquoi la connexion se fait toujours dans Claude Code lui-même.

## Modèles et exécution du code

[Paramètres › Modèles](parametres:claude-modeles) règle, pour chaque usage (aide, correction, évaluation, génération de quiz), le modèle et l’effort à utiliser. **Tester** vérifie que le réglage répond. La même carte indique le chemin de Claude Code et les langages que les quiz peuvent exécuter.

## ChatGPT ou Gemini à la place de Claude

[Paramètres › Assistant IA](parametres:assistant) choisit l’assistant des quiz : **Claude**, **ChatGPT** ou **Gemini**. Chacun passe par l’outil en ligne de commande officiel de son éditeur, qui doit être installé sur le poste (avec Node.js) :

| Assistant | Outil                                            | Connexion par compte                                                                                      | Clé d’API                     |
| --------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ----------------------------- |
| ChatGPT   | Codex CLI (`npm install -g @openai/codex`)       | **Se connecter…** ouvre un terminal sur `codex login` : connexion avec un abonnement ChatGPT, chez OpenAI | Clé OpenAI, facturée à la clé |
| Gemini    | Gemini CLI (`npm install -g @google/gemini-cli`) | **Se connecter…** ouvre Gemini CLI : choisir « Sign in with Google », puis fermer le terminal             | Clé de Google AI Studio       |

Les cartes [Connexion à ChatGPT](parametres:chatgpt) et [Connexion à Gemini](parametres:gemini) fonctionnent comme celle de Claude : état de l’outil et du compte, connexion, déconnexion, clé chiffrée par le système. Elles règlent aussi le modèle (le même pour tous les usages ; vide, celui du compte) et le chemin de l’outil. Avec ChatGPT, l’effort de chaque usage règle l’effort de raisonnement.

Dans les quiz et les TD, le nom de l’assistant (barre du haut, panneau de conversation, bouton de l’atelier) est un bouton : son petit menu permet de changer d’assistant sur-le-champ, ou d’ouvrir les réglages de l’un d’eux (roue dentée).

> **Note** Comme pour Claude, l’application ne recueille ni identifiant ni jeton : la connexion se fait dans l’outil, chez l’éditeur. Une clé enregistrée ou un changement de mode s’applique au redémarrage de l’application.

## IA préférées et relais automatique

Dès que deux IA au moins sont connectées, la carte [Paramètres › IA préférées](parametres:preferees) apparaît : un bloc par IA connectée, à ranger par ordre de préférence en les faisant glisser (ou avec les boutons ↑ et ↓). Avec une seule IA connectée, la carte reste cachée.

À chaque demande (aide, correction, évaluation, génération), l’application vérifie les IA dans cet ordre (outil trouvé, compte connecté) et fait appel à la première disponible. Si elle échoue avant d’avoir commencé à répondre (outil absent, compte déconnecté, quota atteint, réseau, aucune réponse en 90 secondes), la suivante prend le relais et un message l’indique. Dans une conversation, l’IA qui prend le relais reçoit les échanges précédents. La demande suivante repart toujours de la première de la liste : votre IA préférée reprend la main dès qu’elle répond de nouveau. Une génération de quiz qui a déjà commencé à écrire un fichier ne bascule pas : elle s’arrête, et on peut la relancer.

Choisir une IA dans le menu du nom de l’assistant la place en tête de la liste.

## Si l’assistant ne répond pas

1. Vérifier dans [Paramètres › Claude](parametres:claude) (ou la carte de ChatGPT ou de Gemini) que l’outil est détecté et connecté (**Vérifier à nouveau**).
2. En mode compte, relancer **Se connecter…** si la session a expiré.
3. En mode clé, vérifier que la clé est toujours valide et créditée.

Voir aussi [Dépannage](page:depannage).
