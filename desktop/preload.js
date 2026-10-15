const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('leadforge', {
  setUrl: (url) => ipcRenderer.send('leadforge:set-url', url),
  platform: process.platform,
});
