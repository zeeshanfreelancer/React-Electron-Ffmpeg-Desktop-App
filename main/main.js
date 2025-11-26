const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { generateScrollingVideo } = require('./videoGenerator');

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const startUrl =
    process.env.ELECTRON_START_URL ||
    `file://${path.join(__dirname, '/client/dist/index.html')}`;
  win.loadURL(startUrl);
}

function registerIpcHandlers() {
  // 📜 Select single image for scrolling text video
  ipcMain.handle('select-single-image', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  // 🎬 Generate scrolling text video
  ipcMain.on('generate-scrolling-video', async (event, options) => {
    try {
      const progressCallback = (progress) => {
        event.sender.send('scrolling-video-progress', progress);
      };

      const outputPath = await generateScrollingVideo(options, progressCallback);
      event.sender.send('scrolling-video-done', outputPath);
    } catch (error) {
      event.sender.send('scrolling-video-error', error.message);
    }
  });
}

// Handle uncaught exceptions to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Log the error but don't crash the app
  // The error will be sent to the renderer via IPC if it occurs during video generation
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log the error but don't crash the app
});

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
