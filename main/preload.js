const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectSingleImage: () => ipcRenderer.invoke('select-single-image'),
  generateScrollingVideo: (options) => ipcRenderer.send('generate-scrolling-video', options),
  onScrollingVideoProgress: (callback) =>
    ipcRenderer.on('scrolling-video-progress', (_, progress) => callback(progress)),
  onScrollingVideoDone: (callback) =>
    ipcRenderer.on('scrolling-video-done', (_, path) => callback(path)),
  onScrollingVideoError: (callback) =>
    ipcRenderer.on('scrolling-video-error', (_, err) => callback(err)),
  removeScrollingVideoListeners: () => {
    ipcRenderer.removeAllListeners('scrolling-video-progress');
    ipcRenderer.removeAllListeners('scrolling-video-done');
    ipcRenderer.removeAllListeners('scrolling-video-error');
  },
});