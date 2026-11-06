const { contextBridge, ipcRenderer } = require('electron');

/**
 * API exposta ao renderer (setup.html).
 * `contextIsolation: true` + `nodeIntegration: false` — o renderer não tem
 * acesso ao Node; só conversa com o main via estes canais.
 */
contextBridge.exposeInMainWorld('leadforge', {
  modeLocal: (config) => ipcRenderer.send('leadforge:mode-local', config),
  modeRemote: (url) => ipcRenderer.send('leadforge:mode-remote', url),
  saveConfig: (config) => ipcRenderer.send('leadforge:save-config', config),
  platform: process.platform,
});
