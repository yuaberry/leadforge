const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('leadforge', {
  modeLocal: () => ipcRenderer.send('leadforge:mode-local'),
  modeRemote: (url) => ipcRenderer.send('leadforge:mode-remote', url),
  platform: process.platform,
});
