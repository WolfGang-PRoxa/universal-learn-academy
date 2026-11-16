# Claude

Claude aide pendant les quiz, corrige les réponses rédigées, évalue les tentatives et génère de nouveaux quiz. Il passe par **Claude Code**, l’outil en ligne de commande d’Anthropic, qui doit être installé sur le poste. Sans lui, les cours et les quiz fonctionnent, mais sans l’aide de Claude.

## Deux façons de se connecter

Le choix se fait dans [Paramètres › Claude](parametres:claude).

| Mode | Fonctionnement | Pour qui |
|---|---|---|
| Un compte Claude, via Claude Code (par défaut) | L’application détecte Claude Code et affiche le compte connecté. **Se connecter…** ouvre un terminal où la connexion se fait sur le site d’Anthropic : l’application ne voit jamais les identifiants. | Avec un abonnement Claude |
| Une clé d’API Anthropic | La clé est vérifiée auprès d’Anthropic, puis chiffrée par le système et jamais réaffichée. L’usage est facturé à la clé. | Sans abonnement |

> **Note** Une application tierce n’a pas le droit de proposer la connexion avec un compte claude.ai ni de conserver des identifiants. C’est pourquoi la connexion se fait toujours dans Claude Code lui-même.

## Modèles et exécution du code

[Paramètres › Modèles](parametres:claude-modeles) règle, pour chaque usage (aide, correction, évaluation, génération de quiz), le modèle et l’effort à utiliser. **Tester** vérifie que le réglage répond. La même carte indique le chemin de Claude Code et les langages que les quiz peuvent exécuter.

## Si Claude ne répond pas

1. Vérifier dans [Paramètres › Claude](parametres:claude) que Claude Code est détecté et connecté (**Vérifier à nouveau**).
2. En mode compte, relancer **Se connecter…** si la session a expiré.
3. En mode clé, vérifier que la clé est toujours valide et créditée.

Voir aussi [Dépannage](page:depannage).
