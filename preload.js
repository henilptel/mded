const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  listNotes: () => ipcRenderer.invoke('list-notes'),
  readNote: (noteId) => ipcRenderer.invoke('read-note', noteId),
  saveNote: (noteId, content) => ipcRenderer.invoke('save-note', noteId, content),
  createNote: () => ipcRenderer.invoke('create-note'),
  deleteNote: (noteId) => ipcRenderer.invoke('delete-note', noteId),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('set-always-on-top', flag)
});
