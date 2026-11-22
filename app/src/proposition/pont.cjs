// Pont sécurisé entre la fenêtre de proposition de synchronisation et le processus principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('proposition', {
  infos: () => ipcRenderer.invoke('proposition:infos'),
  repondre: (choix) => ipcRenderer.invoke('proposition:repondre', choix),
  taille: (hauteur) => ipcRenderer.invoke('proposition:taille', hauteur),
});
