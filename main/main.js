const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const childProcess = require('child_process');
const http = require('http');
const url = require('url');
const { generateScrollingVideo, saveProject, loadProject, batchProcess } = require('./videoGenerator');
const { generatePanZoomVideo } = require('./panZoomVideoGenerator');
const youtubeUploader = require('./youtubeUploader');

// Cancellation state
let currentVideoGeneration = {
  cancelled: false,
  webContents: null,
};

let currentPanZoomGeneration = {
  cancelled: false,
  webContents: null,
};

let currentEffectGeneration = {
  cancelled: false,
  webContents: null,
};

// OAuth callback server
let oauthCallbackServer = null;
let youtubeAuthWebContents = null;
let youtubeAuthProfileId = null;

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
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Completely remove the menu bar
  win.setMenu(null);

  // Helpful diagnostics if the renderer fails to load (common cause of "blank window" in packaged apps)
  win.webContents.on('did-fail-load', async (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    console.error('Renderer failed to load:', { errorCode, errorDescription, validatedURL });
    try {
      await win.loadURL(
        `data:text/html;charset=utf-8,` +
          encodeURIComponent(
            `<h2>App failed to load</h2>
             <p><b>${errorDescription}</b> (code: ${errorCode})</p>
             <p>URL: ${validatedURL}</p>
             <p>Open DevTools (Ctrl+Shift+I) to see logs.</p>`
          )
      );
    } catch (_) {
      // ignore
    }
  });

  // Dev: load Vite server. Prod: load the built file from client/dist.
  const devUrl = process.env.ELECTRON_START_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    // app.getAppPath() points to the app root (inside app.asar when packaged)
    const indexPath = path.join(app.getAppPath(), 'client', 'dist', 'index.html');
    win.loadFile(indexPath);
  }
}

function registerIpcHandlers() {
  // 🎙️ List system TTS voices (Windows SAPI via PowerShell; falls back to empty list on other OSes)
  ipcMain.handle('list-tts-voices', async () => {
    try {
      if (process.platform !== 'win32') {
        return [];
      }

      const script =
        "Add-Type -AssemblyName System.Speech; " +
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; " +
        "$voices = $s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo } | " +
        "Select-Object Name,Culture,Gender,Age; " +
        "$s.Dispose(); " +
        "$voices | ConvertTo-Json -Compress";

      const stdout = await new Promise((resolve, reject) => {
        childProcess.execFile(
          'powershell.exe',
          ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
          { windowsHide: true, maxBuffer: 5 * 1024 * 1024 },
          (err, out, _stderr) => {
            if (err) reject(err);
            else resolve(out);
          }
        );
      });

      const trimmed = String(stdout || '').trim();
      if (!trimmed) return [];
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      // Normalize for renderer
      return list
        .filter(Boolean)
        .map((v) => ({
          name: v.Name || v.name || '',
          culture: v.Culture || v.culture || '',
          gender: v.Gender || v.gender || '',
          age: v.Age || v.age || '',
        }))
        .filter((v) => v.name);
    } catch (e) {
      console.warn('Failed to list TTS voices:', e.message || e);
      return [];
    }
  });

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

  // 🎥 Select multiple video files
  ipcMain.handle('select-videos', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }],
    });
    if (result.canceled) return null;
    return result.filePaths;
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

  // 📁 Select image folder
  ipcMain.handle('select-image-folder', async () => {
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
    // Reset cancellation flag
    currentVideoGeneration.cancelled = false;
    currentVideoGeneration.webContents = event.sender;

    try {
      const progressCallback = (progress) => {
        if (currentVideoGeneration.cancelled) {
          throw new Error('Video generation cancelled');
        }
        event.sender.send('scrolling-video-progress', progress);
      };

      const shouldCancel = () => currentVideoGeneration.cancelled;

      const outputPath = await generateScrollingVideo(options, progressCallback, shouldCancel);
      if (!currentVideoGeneration.cancelled) {
        event.sender.send('scrolling-video-done', outputPath);
      }
    } catch (error) {
      if (!currentVideoGeneration.cancelled) {
        event.sender.send('scrolling-video-error', error.message);
      } else {
        event.sender.send('scrolling-video-cancelled');
      }
    } finally {
      // Reset state
      currentVideoGeneration.cancelled = false;
      currentVideoGeneration.webContents = null;
    }
  });

  // 🚫 Cancel scrolling text video generation
  ipcMain.on('cancel-scrolling-video', () => {
    currentVideoGeneration.cancelled = true;
    if (currentVideoGeneration.webContents) {
      currentVideoGeneration.webContents.send('scrolling-video-cancelled');
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

  // 🎬 Pan/Zoom Video Generator Handlers
  ipcMain.on('generate-panzoom-video', async (event, options) => {
    // Reset cancellation flag
    currentPanZoomGeneration.cancelled = false;
    currentPanZoomGeneration.webContents = event.sender;

    try {
      const progressCallback = (progress) => {
        if (currentPanZoomGeneration.cancelled) {
          throw new Error('Video generation cancelled');
        }
        event.sender.send('panzoom-video-progress', progress);
      };

      const shouldCancel = () => currentPanZoomGeneration.cancelled;

      const result = await generatePanZoomVideo(options, progressCallback, shouldCancel);
      if (!currentPanZoomGeneration.cancelled) {
        event.sender.send('panzoom-video-done', result);
      }
    } catch (error) {
      if (!currentPanZoomGeneration.cancelled) {
        event.sender.send('panzoom-video-error', error.message);
      } else {
        event.sender.send('panzoom-video-cancelled');
      }
    } finally {
      // Reset state
      currentPanZoomGeneration.cancelled = false;
      currentPanZoomGeneration.webContents = null;
    }
  });

  // 🚫 Cancel pan/zoom video generation
  ipcMain.on('cancel-panzoom-video', () => {
    currentPanZoomGeneration.cancelled = true;
    if (currentPanZoomGeneration.webContents) {
      currentPanZoomGeneration.webContents.send('panzoom-video-cancelled');
    }
  });

  // ✨ Effect Generator Handlers (reuses Pan/Zoom generator with transitions/effect presets)
  ipcMain.on('generate-effect-video', async (event, options) => {
    // Reset cancellation flag
    currentEffectGeneration.cancelled = false;
    currentEffectGeneration.webContents = event.sender;

    try {
      const progressCallback = (progress) => {
        if (currentEffectGeneration.cancelled) {
          throw new Error('Video generation cancelled');
        }
        event.sender.send('effect-video-progress', progress);
      };

      const shouldCancel = () => currentEffectGeneration.cancelled;

      const result = await generatePanZoomVideo(options, progressCallback, shouldCancel);
      if (!currentEffectGeneration.cancelled) {
        event.sender.send('effect-video-done', result);
      }
    } catch (error) {
      if (!currentEffectGeneration.cancelled) {
        event.sender.send('effect-video-error', error.message);
      } else {
        event.sender.send('effect-video-cancelled');
      }
    } finally {
      // Reset state
      currentEffectGeneration.cancelled = false;
      currentEffectGeneration.webContents = null;
    }
  });

  // 🚫 Cancel effect video generation
  ipcMain.on('cancel-effect-video', () => {
    currentEffectGeneration.cancelled = true;
    if (currentEffectGeneration.webContents) {
      currentEffectGeneration.webContents.send('effect-video-cancelled');
    }
  });

  // 📤 YouTube Upload Handlers
  ipcMain.handle('youtube-list-profiles', async () => {
    try {
      const profiles = await youtubeUploader.listProfiles();
      return { profiles };
    } catch (error) {
      throw new Error(`Failed to list profiles: ${error.message}`);
    }
  });

  ipcMain.handle('youtube-save-profile', async (event, { id, label, credentials }) => {
    try {
      const result = await youtubeUploader.saveProfile({ id, label, credentials });
      return { success: true, profileId: result.id };
    } catch (error) {
      throw new Error(`Failed to save profile: ${error.message}`);
    }
  });

  ipcMain.handle('youtube-delete-profile', async (event, profileId) => {
    try {
      await youtubeUploader.deleteProfile(profileId);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete profile: ${error.message}`);
    }
  });

  // Check if authenticated
  ipcMain.handle('youtube-check-auth', async (event, profileId) => {
    try {
      const isAuth = await youtubeUploader.isAuthenticated(profileId);
      return { authenticated: isAuth, profileId };
    } catch (error) {
      return { authenticated: false, profileId };
    }
  });

  // Start OAuth callback server on a non-privileged port
  function startOAuthCallbackServer(port = 8080) {
    return new Promise((resolve, reject) => {
      if (oauthCallbackServer) {
        // Server already running
        resolve(port);
        return;
      }

      oauthCallbackServer = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url, true);
        const code = parsedUrl.query.code;
        const error = parsedUrl.query.error;

        if (error) {
          const errorDescription = parsedUrl.query.error_description || error;
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head><title>Authorization Failed</title></head>
              <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h2 style="color: #d32f2f;">❌ Authorization Failed</h2>
                <p>${errorDescription}</p>
                <p>You can close this window and try again.</p>
              </body>
            </html>
          `);

          if (youtubeAuthWebContents && !youtubeAuthWebContents.isDestroyed()) {
            youtubeAuthWebContents.send('youtube-error', errorDescription);
          }
          stopOAuthCallbackServer();
          return;
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head><title>Authorization Successful</title></head>
              <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h2 style="color: #28a745;">✅ Authorization Successful!</h2>
                <p>You can close this window now.</p>
                <p>The app will continue automatically.</p>
              </body>
            </html>
          `);

          // Forward code to the internal auth-code channel used by youtubeUploader
          if (youtubeAuthWebContents && !youtubeAuthWebContents.isDestroyed()) {
            if (youtubeAuthProfileId) {
              ipcMain.emit(`youtube-auth-code-internal:${youtubeAuthProfileId}`, { sender: youtubeAuthWebContents }, code);
            } else {
              youtubeAuthWebContents.send('youtube-error', 'No profile selected for authentication.');
            }
          }
          
          // Stop server after a short delay
          setTimeout(() => {
            stopOAuthCallbackServer();
          }, 1000);
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head><title>Waiting for Authorization</title></head>
              <body style="font-family: Arial; text-align: center; padding: 50px;">
                <h2>Waiting for authorization...</h2>
                <p>Please complete the authorization in your browser.</p>
              </body>
            </html>
          `);
        }
      });

      // Try to listen on the specified port, or find an available port
      const server = oauthCallbackServer.listen(port, 'localhost', () => {
        resolve(server.address().port);
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // Try next port
          if (port < 8100) {
            stopOAuthCallbackServer();
            startOAuthCallbackServer(port + 1)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error('Could not find an available port for OAuth callback. Please use manual code entry.'));
          }
        } else {
          reject(err);
        }
      });
    });
  }

  function stopOAuthCallbackServer() {
    if (oauthCallbackServer) {
      oauthCallbackServer.close();
      oauthCallbackServer = null;
    }
  }

  // Authenticate with YouTube
  ipcMain.on('youtube-authenticate', async (event, profileId) => {
    try {
      youtubeAuthWebContents = event.sender;
      youtubeAuthProfileId = profileId;

      // If we already have a valid token, treat this as a successful auth and don't re-run the flow.
      // This prevents the UI from feeling like "Authenticate" does nothing when a token already exists.
      try {
        const alreadyAuthed = await youtubeUploader.isAuthenticated(profileId);
        if (alreadyAuthed) {
          event.sender.send('youtube-auth-success', { profileId });
          return;
        }
      } catch (_) {
        // continue with interactive auth
      }

      // Try to start the callback server
      try {
        await startOAuthCallbackServer();
        event.sender.send('youtube-callback-server-ready');
      } catch (serverError) {
        // If server can't start (e.g., port 80 in use), fall back to manual entry
        console.log('Callback server not available, using manual code entry:', serverError.message);
        event.sender.send('youtube-callback-server-failed', serverError.message);
      }

      await youtubeUploader.authorizeProfile(profileId, event, ipcMain);
      const channel = await youtubeUploader.fetchAndStoreChannelInfo(profileId);
      if (channel && event && event.sender) {
        event.sender.send('youtube-profile-updated', { profileId, channel });
      }
    } catch (error) {
      stopOAuthCallbackServer();
      if (error.message && !error.message.includes('youtube-auth-code')) {
        event.sender.send('youtube-error', error.message);
      }
    } finally {
      // Clear reference once flow is done/failed to avoid sending to stale webContents
      youtubeAuthWebContents = null;
      youtubeAuthProfileId = null;
    }
  });

  // Handle auth code from renderer paste (manual entry fallback)
  ipcMain.on('youtube-auth-code', (event, { profileId, code }) => {
    ipcMain.emit(`youtube-auth-code-internal:${profileId}`, event, code);
  });

  // Upload video to YouTube
  ipcMain.on('youtube-upload-video', async (event, { profileId, videoPath, metadata, uploadId }) => {
    try {
      const progressCallback = (progress) => {
        event.sender.send('youtube-upload-progress', { uploadId, profileId, ...progress });
      };

      const result = await youtubeUploader.uploadVideo(profileId, videoPath, metadata, progressCallback, ipcMain);
      event.sender.send('youtube-upload-success', { uploadId, profileId, ...result });
    } catch (error) {
      event.sender.send('youtube-upload-error', { uploadId, profileId, error: error.message });
    }
  });

  // Logout selected profile (revoke token)
  ipcMain.handle('youtube-logout-profile', async (event, profileId) => {
    try {
      await youtubeUploader.logoutProfile(profileId);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to logout: ${error.message}`);
    }
  });

  // Reset OAuth (delete saved token + credentials)
  ipcMain.handle('youtube-reset-auth', async () => {
    try {
      await youtubeUploader.resetAuth();
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to reset auth: ${error.message}`);
    }
  });

  // Open URL in browser (for OAuth)
  ipcMain.handle('youtube-open-url', async (event, url) => {
    await shell.openExternal(url);
    return { success: true };
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
  // Initialize YouTube profile storage in Electron userData
  youtubeUploader.init({ storageDir: path.join(app.getPath('userData'), 'youtube') });
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
    // Clean up OAuth callback server
    if (oauthCallbackServer) {
      oauthCallbackServer.close();
      oauthCallbackServer = null;
    }
    app.quit();
  }
});
