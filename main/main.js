const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { generateScrollingVideo, saveProject, loadProject, batchProcess } = require('./videoGenerator');

// Helper: Parse subtitle file (SRT or VTT)
function parseSubtitleFile(content, format) {
  const subtitles = [];
  
  if (format === '.srt') {
    // Parse SRT format
    const blocks = content.split(/\n\s*\n/).filter(block => block.trim());
    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 3) continue;
      
      const timecode = lines[1];
      const timeMatch = timecode.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
      if (!timeMatch) continue;
      
      const startTime = parseFloat(timeMatch[1]) * 3600 + 
                       parseFloat(timeMatch[2]) * 60 + 
                       parseFloat(timeMatch[3]) + 
                       parseFloat(timeMatch[4]) / 1000;
      const endTime = parseFloat(timeMatch[5]) * 3600 + 
                     parseFloat(timeMatch[6]) * 60 + 
                     parseFloat(timeMatch[7]) + 
                     parseFloat(timeMatch[8]) / 1000;
      
      const text = lines.slice(2).join(' ').replace(/<[^>]+>/g, ''); // Remove HTML tags
      
      subtitles.push({
        start: startTime,
        end: endTime,
        text: text,
        style: {
          fontSize: 24,
          fontFamily: 'Arial',
          color: '#ffffff',
          strokeColor: '#000000',
          strokeWidth: 2,
          align: 'center',
        },
      });
    }
  } else if (format === '.vtt') {
    // Parse VTT format
    const lines = content.split('\n');
    let currentTime = null;
    let currentText = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('-->')) {
        const timeMatch = line.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
        if (timeMatch) {
          const startTime = parseFloat(timeMatch[1]) * 3600 + 
                           parseFloat(timeMatch[2]) * 60 + 
                           parseFloat(timeMatch[3]) + 
                           parseFloat(timeMatch[4]) / 1000;
          const endTime = parseFloat(timeMatch[5]) * 3600 + 
                         parseFloat(timeMatch[6]) * 60 + 
                         parseFloat(timeMatch[7]) + 
                         parseFloat(timeMatch[8]) / 1000;
          
          currentTime = { start: startTime, end: endTime };
          currentText = [];
        }
      } else if (line && currentTime && !line.startsWith('WEBVTT') && !line.startsWith('NOTE')) {
        currentText.push(line.replace(/<[^>]+>/g, ''));
      } else if (!line && currentTime && currentText.length > 0) {
        subtitles.push({
          start: currentTime.start,
          end: currentTime.end,
          text: currentText.join(' '),
          style: {
            fontSize: 24,
            fontFamily: 'Arial',
            color: '#ffffff',
            strokeColor: '#000000',
            strokeWidth: 2,
            align: 'center',
          },
        });
        currentTime = null;
        currentText = [];
      }
    }
    
    // Handle last subtitle if file doesn't end with blank line
    if (currentTime && currentText.length > 0) {
      subtitles.push({
        start: currentTime.start,
        end: currentTime.end,
        text: currentText.join(' '),
        style: {
          fontSize: 24,
          fontFamily: 'Arial',
          color: '#ffffff',
          strokeColor: '#000000',
          strokeWidth: 2,
          align: 'center',
        },
      });
    }
  }
  
  return {
    enabled: true,
    items: subtitles,
  };
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
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
  // 📜 Select single image
  ipcMain.handle('select-single-image', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'gif'] }],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  // 📸 Select multiple images
  ipcMain.handle('select-multiple-images', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'gif'] }],
    });
    if (result.canceled) return null;
    return result.filePaths;
  });

  // 🎥 Select video file
  ipcMain.handle('select-video', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  // 🎵 Select audio file
  ipcMain.handle('select-audio', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac'] }],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  // 📝 Select subtitle file (SRT/VTT)
  ipcMain.handle('select-subtitle', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Subtitles', extensions: ['srt', 'vtt'] }],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  // 📁 Select output directory
  ipcMain.handle('select-output-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  // 💾 Save project
  ipcMain.handle('save-project', async (event, config) => {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'Project Files', extensions: ['json'] }],
      defaultPath: 'project.json',
    });
    if (result.canceled) return null;
    try {
      await saveProject(config, result.filePath);
      return result.filePath;
    } catch (error) {
      throw new Error(`Failed to save project: ${error.message}`);
    }
  });

  // 📂 Load project
  ipcMain.handle('load-project', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Project Files', extensions: ['json'] }],
    });
    if (result.canceled) return null;
    try {
      const config = await loadProject(result.filePaths[0]);
      return config;
    } catch (error) {
      throw new Error(`Failed to load project: ${error.message}`);
    }
  });

  // 📊 Batch process from CSV/JSON
  ipcMain.handle('select-batch-file', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Batch Files', extensions: ['csv', 'json'] }],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  // 📄 Read batch file
  ipcMain.handle('read-batch-file', async (event, filePath) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.json') {
        return JSON.parse(content);
      } else if (ext === '.csv') {
        // Simple CSV parsing
        const lines = content.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        const configs = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const config = {};
          headers.forEach((header, index) => {
            config[header] = values[index];
          });
          configs.push(config);
        }
        return configs;
      } else if (ext === '.srt' || ext === '.vtt') {
        // Parse subtitle file
        return parseSubtitleFile(content, ext);
      }
      throw new Error('Unsupported file format');
    } catch (error) {
      throw new Error(`Failed to read batch file: ${error.message}`);
    }
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

  // 📦 Batch process videos
  ipcMain.on('batch-process-videos', async (event, configs) => {
    try {
      const progressCallback = (progress) => {
        event.sender.send('scrolling-video-progress', progress);
      };

      const results = await batchProcess(configs, progressCallback);
      event.sender.send('batch-process-done', results);
    } catch (error) {
      event.sender.send('scrolling-video-error', error.message);
    }
  });

  // 👁️ Generate preview frame
  ipcMain.handle('generate-preview-frame', async (event, options, frameTime) => {
    try {
      // This would generate a single preview frame
      // For now, return a placeholder
      return { success: true, message: 'Preview generation not yet implemented' };
    } catch (error) {
      throw new Error(`Failed to generate preview: ${error.message}`);
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
