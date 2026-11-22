// Pont sécurisé entre la fenêtre de choix de la langue et le processus principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('choixLangue', {
  infos: () => ipcRenderer.invoke('langue:infos'),
  choisir: (code) => ipcRenderer.invoke('langue:choisir', code),
  taille: (hauteur) => ipcRenderer.invoke('langue:taille', hauteur),
});
