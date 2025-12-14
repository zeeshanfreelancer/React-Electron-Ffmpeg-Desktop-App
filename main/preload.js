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
  selectImageFolder: () => ipcRenderer.invoke('select-image-folder'),
  saveProject: (config) => ipcRenderer.invoke('save-project', config),
  loadProject: () => ipcRenderer.invoke('load-project'),

  // Batch processing
  selectBatchFile: () => ipcRenderer.invoke('select-batch-file'),
  readBatchFile: (filePath) => ipcRenderer.invoke('read-batch-file', filePath),

  // Video generation
  generateScrollingVideo: (options) => ipcRenderer.send('generate-scrolling-video', options),
  cancelScrollingVideo: () => ipcRenderer.send('cancel-scrolling-video'),
  batchProcessVideos: (configs) => ipcRenderer.send('batch-process-videos', configs),
  
  // Pan/Zoom Video generation
  generatePanZoomVideo: (options) => ipcRenderer.send('generate-panzoom-video', options),
  cancelPanZoomVideo: () => ipcRenderer.send('cancel-panzoom-video'),

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

  // Pan/Zoom Video event listeners
  onPanZoomVideoProgress: (callback) =>
    ipcRenderer.on('panzoom-video-progress', (_, progress) => callback(progress)),
  onPanZoomVideoDone: (callback) =>
    ipcRenderer.on('panzoom-video-done', (_, result) => callback(result)),
  onPanZoomVideoError: (callback) =>
    ipcRenderer.on('panzoom-video-error', (_, err) => callback(err)),
  onPanZoomVideoCancelled: (callback) =>
    ipcRenderer.on('panzoom-video-cancelled', () => callback()),

  // Cleanup listeners
  removeScrollingVideoListeners: () => {
    ipcRenderer.removeAllListeners('scrolling-video-progress');
    ipcRenderer.removeAllListeners('scrolling-video-done');
    ipcRenderer.removeAllListeners('scrolling-video-error');
    ipcRenderer.removeAllListeners('scrolling-video-cancelled');
    ipcRenderer.removeAllListeners('batch-process-done');
  },
  removePanZoomVideoListeners: () => {
    ipcRenderer.removeAllListeners('panzoom-video-progress');
    ipcRenderer.removeAllListeners('panzoom-video-done');
    ipcRenderer.removeAllListeners('panzoom-video-error');
    ipcRenderer.removeAllListeners('panzoom-video-cancelled');
  },

  // YouTube Upload
  youtubeListProfiles: () => ipcRenderer.invoke('youtube-list-profiles'),
  youtubeSaveProfile: (profile) => ipcRenderer.invoke('youtube-save-profile', profile),
  youtubeDeleteProfile: (profileId) => ipcRenderer.invoke('youtube-delete-profile', profileId),
  youtubeCheckAuth: (profileId) => ipcRenderer.invoke('youtube-check-auth', profileId),
  youtubeAuthenticate: (profileId) => ipcRenderer.send('youtube-authenticate', profileId),
  youtubeUploadVideo: (profileId, videoPath, metadata) =>
    ipcRenderer.send('youtube-upload-video', { profileId, videoPath, metadata }),
  youtubeLogoutProfile: (profileId) => ipcRenderer.invoke('youtube-logout-profile', profileId),
  youtubeResetAuth: () => ipcRenderer.invoke('youtube-reset-auth'),
  youtubeOpenUrl: (url) => ipcRenderer.invoke('youtube-open-url', url),
  youtubeSendAuthCode: (profileId, code) => ipcRenderer.send('youtube-auth-code', { profileId, code }),

  // YouTube event listeners
  onYoutubeAuthUrl: (callback) => ipcRenderer.on('youtube-auth-url', (_, payload) => callback(payload)),
  onYoutubeAuthSuccess: (callback) => ipcRenderer.on('youtube-auth-success', (_, payload) => callback(payload)),
  onYoutubeProfileUpdated: (callback) => ipcRenderer.on('youtube-profile-updated', (_, payload) => callback(payload)),
  onYoutubeUploadProgress: (callback) => ipcRenderer.on('youtube-upload-progress', (_, progress) => callback(progress)),
  onYoutubeUploadSuccess: (callback) => ipcRenderer.on('youtube-upload-success', (_, result) => callback(result)),
  onYoutubeUploadError: (callback) => ipcRenderer.on('youtube-upload-error', (_, error) => callback(error)),
  onYoutubeError: (callback) => ipcRenderer.on('youtube-error', (_, error) => callback(error)),

  // Cleanup YouTube listeners
  removeYoutubeListeners: () => {
    ipcRenderer.removeAllListeners('youtube-auth-url');
    ipcRenderer.removeAllListeners('youtube-auth-success');
    ipcRenderer.removeAllListeners('youtube-profile-updated');
    ipcRenderer.removeAllListeners('youtube-upload-progress');
    ipcRenderer.removeAllListeners('youtube-upload-success');
    ipcRenderer.removeAllListeners('youtube-upload-error');
    ipcRenderer.removeAllListeners('youtube-error');
  },
});
