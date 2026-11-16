# Données et confidentialité

## Ce qui reste sur le poste

Le travail (tentatives, TD, TP, suivi) et les paramètres restent sur le poste, dans le dossier des données et le dossier des paramètres. L’application n’envoie rien à un service à elle : il n’y a ni compte Universal Learn Academy, ni mesure d’audience.

## Ce qui sort du poste, et quand

| Échange | Destination | Contenu |
|---|---|---|
| Catalogue et cours | GitHub (releases du dépôt public) | Téléchargement seulement |
| Mises à jour | GitHub (releases du dépôt public) | Téléchargement seulement |
| Claude | Anthropic, par Claude Code | Les questions, réponses et extraits de cours nécessaires à l’aide, la correction ou la génération |
| Synchronisation | Le dépôt Git choisi | Les fichiers du périmètre de synchronisation |
| Proposer un cours | GitHub, par l’utilisateur | L’archive des pages générées, jointe à la main |

## Identifiants et clés

- **Compte Claude** : la connexion se fait dans Claude Code, sur le site d’Anthropic ; l’application ne voit jamais les identifiants.
- **Clé d’API** : chiffrée par le système (DPAPI sous Windows, trousseau sous Linux ; refusée sans trousseau), jamais renvoyée à l’interface. Elle n’est transmise qu’à Claude Code, au démarrage du serveur local.
- **GitHub** : aucun jeton n’est enregistré dans l’application. Tant que le dépôt public est privé, le jeton de la GitHub CLI du poste est lu le temps d’une requête, puis oublié.
- **Git** : les identifiants restent ceux de Git sur le poste.

## Données personnelles et publication

Ni l’installeur, ni le catalogue, ni le dépôt public ne contiennent de données personnelles. Des contrôles bloquants l’assurent :

1. seuls les outils autorisés sont copiés dans l’installeur, avec un manifeste d’empreintes ;
2. après l’empaquetage, tout le paquet est parcouru : un fichier personnel ou un fichier de cours fait échouer la construction ;
3. la publication du catalogue et du dépôt public contrôle chaque fichier (règles, empreintes des fichiers de TP, adresse électronique) ;
4. « Proposer ce cours » ne garde que les pages générées et refuse une archive qui contient une donnée personnelle ;
5. `npm run check` vérifie que des paquets, archives et propositions piégés sont bien refusés.

Les règles sont dans `_outils/ula/lib/regles.js`.
