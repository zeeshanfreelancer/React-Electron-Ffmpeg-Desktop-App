const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

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

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '/client/dist/index.html')}`;
  win.loadURL(startUrl);
}

app.whenReady().then(() => createWindow());

// 📁 Select images
ipcMain.handle('select-images', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg'] }],
  });
  if (result.canceled) return null;
  return result.filePaths;
});

// 🎵 Select audio
ipcMain.handle('select-audio', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav'] }],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// 🎬 Generate slideshow
ipcMain.on('generate-video', async (event, { images, audioPath }) => {
  const fs = require('fs');
  const os = require('os');

  // Create temp file list for ffmpeg
  const fileListPath = path.join(os.tmpdir(), 'images.txt');
  const listContent = images.map((img) => `file '${img.replace(/\\/g, '/')}'\nduration 3`).join('\n');
  fs.writeFileSync(fileListPath, listContent, 'utf-8');

  // Add last frame hold (prevents cutoff)
  fs.appendFileSync(fileListPath, `\nfile '${images[images.length - 1].replace(/\\/g, '/')}'\n`);

  const outputPath = path.join(app.getPath('desktop'), 'slideshow.mp4');

  const command = ffmpeg()
    .input(fileListPath)
    .inputOptions(['-f concat', '-safe 0'])
    .input(audioPath)
    .outputOptions([
      '-pix_fmt yuv420p',
      '-c:v libx264',
      '-shortest'
    ])
    .on('end', () => {
      event.sender.send('video-done', outputPath);
    })
    .on('error', (err) => {
      event.sender.send('video-error', err.message);
    })
    .save(outputPath);
});