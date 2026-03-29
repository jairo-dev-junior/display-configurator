const { contextBridge, ipcRenderer } = require('electron');

const api = {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  refresh: () => ipcRenderer.invoke('app:refresh'),
  setValues: (payload) => ipcRenderer.invoke('monitor:set-values', payload),
  setValue: (payload) => ipcRenderer.invoke('monitor:set-value', payload),
  createProfile: (payload) => ipcRenderer.invoke('profiles:create', payload),
  applyProfile: (payload) => ipcRenderer.invoke('profiles:apply', payload),
  importProfile: () => ipcRenderer.invoke('profiles:import'),
  exportProfile: (profileName) => ipcRenderer.invoke('profiles:export', { profileName })
};

contextBridge.exposeInMainWorld('monitorControl', api);
