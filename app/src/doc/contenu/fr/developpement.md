# Développement

## Prérequis

Node.js 22 ou plus récent. Pour construire l’AppImage depuis Windows : WSL avec Node.

## Commandes

Depuis le dossier `app/` :

| Commande | Effet |
|---|---|
| `npm install` | Dépendances |
| `npm start` | Lance l’application avec les outils du dépôt |
| `npm run check` | Vérifications : syntaxe, langues, documentation, règles de contenu, paquets et archives piégés, profils, synchronisation, raccourcis |
| `npm run dist` | Construit l’installeur Windows et l’AppImage dans `dist/`, sans les publier |
| `npm run catalogue` | Construit le catalogue dans `app/.catalogue` (`-- --publier` pour l’envoyer) |
| `npm run public` | Aperçu du dépôt public (`-- --pousser` pour le mettre à jour) |
| `npm run release` | Construit et publie une version (voir plus bas) |

## Variables d’environnement

| Variable | Effet |
|---|---|
| `ULA_USER_DATA=<dossier>` | Autre dossier de paramètres, pour les essais (la langue est alors redemandée) |
| `ULA_CATALOGUE=<dossier>` | Lit un catalogue local, par exemple `app/.catalogue` |
| `ULA_SYNCHRO_INTERVALLE_MS=<ms>` | Raccourcit l’intervalle de synchronisation |

## Ajouter une langue

1. Copier `app/src/i18n/en.js` en `<code>.js`, traduire chaque valeur sans toucher aux clés ni aux variables `{…}`, et l’ajouter à `LANGUES` et `DICTIONNAIRES` dans `app/src/i18n/index.js`.
2. Ajouter la langue dans `_outils/app/textes.js`, dans `TEXTES_BARRE` de `_outils/charte/assets/cours.js` et dans `_outils/ula/assets/textes.js`.
3. Traduire les pages dans `app/src/doc/contenu/<code>/` et ajouter les titres de groupes dans `sommaire.json`.
4. Lancer `npm run check` : il signale toute clé manquante, toute variable différente et toute page absente.

## Ajouter une page à la documentation

1. Écrire `app/src/doc/contenu/fr/<id>.md` et `en/<id>.md`. Le premier titre `#` est le titre de la page.
2. Ajouter `<id>` dans un groupe de `sommaire.json`.

Le Markdown reconnu : titres, paragraphes, listes (imbriquées par indentation), listes numérotées, tableaux, blocs de code, encadrés (`> **Note**`, `> **Astuce**`, `> **Attention**`), filets, gras, italique, code et liens.

## Publier une version

1. Augmenter `version` dans `app/package.json`, committer et pousser sur `main`, puis mettre à jour le dépôt public (`npm run public -- --pousser`).
2. Depuis le PC Windows, avec la GitHub CLI connectée et WSL : `npm ci`, puis `npm run release`.

Le script refuse de publier hors de `main`, avec des modifications locales ou une version déjà publiée. Il construit l’installeur et l’AppImage, crée la release en brouillon, y envoie les fichiers, la publie, puis vérifie chaque fichier. Les cours, eux, se publient indépendamment par `npm run catalogue -- --publier`.
