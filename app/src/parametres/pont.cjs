// Pont sécurisé entre la page des paramètres et le processus principal.
const { contextBridge, ipcRenderer } = require("electron");

const appeler = (canal, ...args) => ipcRenderer.invoke(canal, ...args);
const ecouter = (canal) => (rappel) => {
  const f = (_e, valeur) => rappel(valeur);
  ipcRenderer.on(canal, f);
  return () => ipcRenderer.removeListener(canal, f);
};

contextBridge.exposeInMainWorld("studies", {
  info: () => appeler("app:info"),
  redemarrer: () => appeler("app:redemarrer"),
  ouvrirDossier: (quoi) => appeler("app:ouvrir-dossier", quoi),
  ouvrirReleases: () => appeler("app:ouvrir-releases"),

  reglages: () => appeler("reglages:lire"),
  modifier: (partiel) => appeler("reglages:modifier", partiel),
  ecrans: () => appeler("fenetre:ecrans"),
  bornesActuelles: () => appeler("fenetre:bornes"),

  donnees: {
    choisir: () => appeler("donnees:choisir"),
    defaut: () => appeler("donnees:defaut")
  },

  profils: {
    etat: () => appeler("profils:etat"),
    choisir: (nom) => appeler("profils:choisir", nom),
    creer: (nom) => appeler("profils:creer", nom),
    renommer: (ancien, nouveau) => appeler("profils:renommer", ancien, nouveau)
  },

  raccourcis: {
    statut: () => appeler("raccourcis:statut"),
    creer: (id, options) => appeler("raccourcis:creer", id, options),
    supprimer: (id) => appeler("raccourcis:supprimer", id),
    afficher: (id) => appeler("raccourcis:afficher", id),
    choisir: () => appeler("raccourcis:choisir"),
    oublier: (id) => appeler("raccourcis:oublier", id)
  },

  claude: {
    statut: () => appeler("claude:statut"),
    connecter: () => appeler("claude:connecter"),
    deconnecter: () => appeler("claude:deconnecter"),
    enregistrerCle: (valeur) => appeler("claude:cle", valeur),
    lien: (nom) => appeler("claude:lien", nom)
  },

  quiz: {
    etat: () => appeler("quiz:etat"),
    reglages: (r) => appeler("quiz:reglages", r),
    tester: (usage) => appeler("quiz:tester", usage)
  },

  maj: {
    verifier: () => appeler("maj:verifier"),
    statut: () => appeler("maj:statut"),
    installer: () => appeler("maj:installer"),
    surStatut: ecouter("maj:statut")
  },

  surSection: ecouter("parametres:section")
});
