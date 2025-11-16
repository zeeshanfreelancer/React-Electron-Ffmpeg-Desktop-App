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

  const startUrl =
    process.env.ELECTRON_START_URL ||
    `file://${path.join(__dirname, '/client/dist/index.html')}`;
  win.loadURL(startUrl);
}

app.whenReady().then(() => createWindow());

// 📸 Select single image
ipcMain.handle('select-images', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png'] }],
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

// 🎬 Generate video with single image and audio duration
ipcMain.on('generate-video', async (event, { images, audioPath }) => {
  if (!images || !images.length || !audioPath) {
    event.sender.send('video-error', 'Missing image or audio');
    return;
  }

  const imagePath = images[0];
  const outputPath = path.join(app.getPath('desktop'), 'slideshow.mp4');

  // Step 1: Get the audio duration
  ffmpeg.ffprobe(audioPath, (err, metadata) => {
    if (err) {
      event.sender.send('video-error', `Error reading audio: ${err.message}`);
      return;
    }

    const audioDuration = metadata.format.duration;
    if (!audioDuration || isNaN(audioDuration)) {
      event.sender.send('video-error', 'Unable to determine audio duration');
      return;
    }

    // Step 2: Create a video from one image and match it to the audio duration
    ffmpeg()
      .input(imagePath)
      .loop(audioDuration) // Show same image for entire duration
      .input(audioPath)
      .outputOptions([
        '-c:v libx264',
        '-tune stillimage',
        '-pix_fmt yuv420p',
        '-r 30', // ✅ set frame rate correctly here
        `-t ${audioDuration}`,
        '-shortest'
      ])
      .on('start', (cmd) => console.log('FFmpeg command:', cmd))
      .on('end', () => {
        event.sender.send('video-done', outputPath);
      })
      .on('error', (err) => {
        event.sender.send('video-error', `FFmpeg error: ${err.message}`);
      })
      .save(outputPath);
  });
});
