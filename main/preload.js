const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Image selection
  selectSingleImage: () => ipcRenderer.invoke('select-single-image'),
  selectMultipleImages: () => ipcRenderer.invoke('select-multiple-images'),

  // Video/Audio selection
  selectVideo: () => ipcRenderer.invoke('select-video'),
  selectAudio: () => ipcRenderer.invoke('select-audio'),
  selectSubtitle: () => ipcRenderer.invoke('select-subtitle'),

  // File operations
  selectOutputDirectory: () => ipcRenderer.invoke('select-output-directory'),
  saveProject: (config) => ipcRenderer.invoke('save-project', config),
  loadProject: () => ipcRenderer.invoke('load-project'),

  // Batch processing
  selectBatchFile: () => ipcRenderer.invoke('select-batch-file'),
  readBatchFile: (filePath) => ipcRenderer.invoke('read-batch-file', filePath),

  // Video generation
  generateScrollingVideo: (options) => ipcRenderer.send('generate-scrolling-video', options),
  cancelScrollingVideo: () => ipcRenderer.send('cancel-scrolling-video'),
  batchProcessVideos: (configs) => ipcRenderer.send('batch-process-videos', configs),

  // Preview
  generatePreviewFrame: (options, frameTime) => ipcRenderer.invoke('generate-preview-frame', options, frameTime),

  // Event listeners
  onScrollingVideoProgress: (callback) =>
    ipcRenderer.on('scrolling-video-progress', (_, progress) => callback(progress)),
  onScrollingVideoDone: (callback) =>
    ipcRenderer.on('scrolling-video-done', (_, path) => callback(path)),
  onScrollingVideoError: (callback) =>
    ipcRenderer.on('scrolling-video-error', (_, err) => callback(err)),
  onScrollingVideoCancelled: (callback) =>
    ipcRenderer.on('scrolling-video-cancelled', () => callback()),
  onBatchProcessDone: (callback) =>
    ipcRenderer.on('batch-process-done', (_, results) => callback(results)),

  // Cleanup listeners
  removeScrollingVideoListeners: () => {
    ipcRenderer.removeAllListeners('scrolling-video-progress');
    ipcRenderer.removeAllListeners('scrolling-video-done');
    ipcRenderer.removeAllListeners('scrolling-video-error');
    ipcRenderer.removeAllListeners('scrolling-video-cancelled');
    ipcRenderer.removeAllListeners('batch-process-done');
  },
});
