'use strict';
/* Passerelle entre la barre de recherche (recherche.html) et le processus principal. */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('recherche', {
  chercher: (texte, avant) => ipcRenderer.send('recherche:chercher', texte, avant),
  fermer: () => ipcRenderer.send('recherche:fermer'),
  surOuverture: (rappel) => ipcRenderer.on('recherche:ouvrir', (e, textes) => rappel(textes)),
  surResultat: (rappel) => ipcRenderer.on('recherche:resultat', (e, position, total) => rappel(position, total)),
});
