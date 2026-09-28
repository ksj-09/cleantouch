const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cleanTouch', {
  listSources: () => ipcRenderer.invoke('sources:list'),
  selectSource: id => ipcRenderer.invoke('source:select', id),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setMode: mode => ipcRenderer.invoke('settings:set-mode', mode),
  setApiUrl: url => ipcRenderer.invoke('settings:set-api', url),
  setKey: key => ipcRenderer.invoke('settings:set-key', key),
  removeKey: () => ipcRenderer.invoke('settings:remove-key'),
  health: () => ipcRenderer.invoke('api:health'),
  scan: image => ipcRenderer.invoke('api:scan', image),
  openLink: url => ipcRenderer.invoke('links:open', url),
  prepareVisualSearch: image => ipcRenderer.invoke('visual:prepare', image),
});
