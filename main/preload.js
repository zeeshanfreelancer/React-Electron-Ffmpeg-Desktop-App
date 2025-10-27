const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectImages: () => ipcRenderer.invoke('select-images'),
  selectAudio: () => ipcRenderer.invoke('select-audio'),
  generateVideo: (data) => ipcRenderer.send('generate-video', data),
  onVideoDone: (callback) => ipcRenderer.on('video-done', (_, path) => callback(path)),
  onVideoError: (callback) => ipcRenderer.on('video-error', (_, err) => callback(err)),
});