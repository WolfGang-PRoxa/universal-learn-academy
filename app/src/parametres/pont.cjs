// Pont sécurisé entre la page des paramètres et le processus principal.
const { contextBridge, ipcRenderer } = require('electron');

const appeler = (canal, ...args) => ipcRenderer.invoke(canal, ...args);
const ecouter = (canal) => (rappel) => {
  const f = (_e, valeur) => rappel(valeur);
  ipcRenderer.on(canal, f);
  return () => ipcRenderer.removeListener(canal, f);
};

contextBridge.exposeInMainWorld('studies', {
  info: () => appeler('app:info'),
  redemarrer: () => appeler('app:redemarrer'),
  ouvrirDossier: (quoi) => appeler('app:ouvrir-dossier', quoi),
  ouvrirReleases: () => appeler('app:ouvrir-releases'),

  reglages: () => appeler('reglages:lire'),
  modifier: (partiel) => appeler('reglages:modifier', partiel),
  ecrans: () => appeler('fenetre:ecrans'),
  bornesActuelles: () => appeler('fenetre:bornes'),

  donnees: {
    choisir: () => appeler('donnees:choisir'),
    defaut: () => appeler('donnees:defaut'),
    deplacer: () => appeler('donnees:deplacer'),
  },

  profils: {
    etat: () => appeler('profils:etat'),
    choisir: (nom) => appeler('profils:choisir', nom),
    creer: (nom, cursus, telecharger) => appeler('profils:creer', nom, cursus, telecharger),
    cursus: () => appeler('profils:cursus'),
    renommer: (ancien, nouveau) => appeler('profils:renommer', ancien, nouveau),
  },

  raccourcis: {
    statut: () => appeler('raccourcis:statut'),
    creer: (id, options) => appeler('raccourcis:creer', id, options),
    supprimer: (id) => appeler('raccourcis:supprimer', id),
    afficher: (id) => appeler('raccourcis:afficher', id),
    choisir: () => appeler('raccourcis:choisir'),
    oublier: (id) => appeler('raccourcis:oublier', id),
  },

  claude: {
    statut: () => appeler('claude:statut'),
    connecter: () => appeler('claude:connecter'),
    deconnecter: () => appeler('claude:deconnecter'),
    enregistrerCle: (valeur) => appeler('claude:cle', valeur),
    lien: (nom) => appeler('claude:lien', nom),
  },

  // ChatGPT (« codex ») et Gemini (« gemini »)
  ia: {
    statut: (f) => appeler('ia:statut', f),
    connecter: (f) => appeler('ia:connecter', f),
    deconnecter: (f) => appeler('ia:deconnecter', f),
    enregistrerCle: (f, valeur) => appeler('ia:cle', f, valeur),
    lien: (f, nom) => appeler('ia:lien', f, nom),
  },

  quiz: {
    etat: () => appeler('quiz:etat'),
    reglages: (r) => appeler('quiz:reglages', r),
    tester: (usage) => appeler('quiz:tester', usage),
    ia: () => appeler('quiz:ia'),
  },

  // Soumissions reçues : jeton d'administration du service de soumission
  admin: {
    statut: () => appeler('admin:statut'),
    enregistrerJeton: (valeur) => appeler('admin:jeton', valeur),
    ouvrir: () => appeler('admin:ouvrir'),
    intervalle: (minutes) => appeler('admin:intervalle', minutes),
    verifier: () => appeler('admin:verifier'),
  },

  maj: {
    verifier: () => appeler('maj:verifier'),
    statut: () => appeler('maj:statut'),
    installer: () => appeler('maj:installer'),
    surStatut: ecouter('maj:statut'),
  },

  synchro: {
    statut: () => appeler('synchro:statut'),
    maintenant: () => appeler('synchro:maintenant'),
    auto: (valeur) => appeler('synchro:auto', valeur),
    surStatut: ecouter('synchro:statut'),
  },

  // Langue de l'interface (src/i18n) : dictionnaire de la langue en usage, choix
  i18n: {
    textes: () => appeler('i18n:textes'),
    definir: (code) => appeler('i18n:definir', code),
    surChangement: ecouter('i18n:changee'),
  },

  // Documentation et paramétrage guidé (src/doc, src/guide)
  aide: {
    documentation: (page) => appeler('aide:documentation', page),
    guide: () => appeler('aide:guide'),
    parametres: (section) => appeler('aide:parametres', section),
    fermer: () => appeler('aide:fermer'),
  },

  // Pages de la documentation (documentation.js)
  doc: {
    sommaire: () => appeler('doc:sommaire'),
    page: (id) => appeler('doc:page', id),
    chercher: (texte) => appeler('doc:chercher', texte),
    lien: (url) => appeler('doc:lien', url),
    surAller: ecouter('doc:aller'),
  },

  surSection: ecouter('parametres:section'),
});
