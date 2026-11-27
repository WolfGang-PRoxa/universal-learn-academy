'use strict';
/* Passerelle entre le cadre de suivi des soumissions (_outils/ula/cadre-soumission.html,
   posé en bas à droite de la fenêtre des cours) et le processus principal. */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cadreSoumission', {
  taille: (hauteur) => ipcRenderer.send('cadre:taille', Number(hauteur) || 0),
  masquer: () => ipcRenderer.send('cadre:masquer'),
  ouvrir: (ancre) => ipcRenderer.send('cadre:ouvrir', String(ancre || '')),
});
