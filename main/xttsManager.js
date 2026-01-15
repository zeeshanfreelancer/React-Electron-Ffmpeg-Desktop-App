const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const childProcess = require('child_process');
const { app } = require('electron');

let xttsProc = null;
let xttsPort = 8045;
let xttsBaseUrl = null;
let xttsStarting = false;
let ensureRunningPromise = null;

// First model load can be slow on some machines; keep pre-warm non-blocking but give it time.
const XTTS_PREWARM_TIMEOUT_MS = 180000; // 3 minutes

function getXttsRootDir() {
  // In packaged builds, electron-builder extraResources land under process.resourcesPath
  if (app && app.isPackaged) {
    // process.resourcesPath points to the resources directory (where extraResources are placed)
    // In Electron, this is typically: <app>/resources/ (Windows) or <app>/Resources/ (macOS)
    const resourcesPath = process.resourcesPath || path.join(process.execPath, '..', 'resources');
    const xttsPath = path.join(resourcesPath, 'xtts');
    console.log('[xttsManager] Packaged build - XTTS root:', xttsPath);
    console.log('[xttsManager] app.isPackaged:', app.isPackaged);
    console.log('[xttsManager] process.resourcesPath:', process.resourcesPath);
    console.log('[xttsManager] process.execPath:', process.execPath);

    // Check if we're running from an unpacked build (dist\win-unpacked)
    // In this case, we need to use the original dev XTTS path from the project root
    // because packaged XTTS executables might not work due to missing Python environment
    const isUnpackedBuild = process.execPath.includes('win-unpacked') ||
                           (process.execPath.includes('dist') && process.execPath.includes('unpacked'));

    if (isUnpackedBuild) {
      console.log('[xttsManager] Detected unpacked build, calculating original dev XTTS path');
      // execPath is: .../dist/win-unpacked/Slideshow Generator.exe
      // We need to go up 2 levels to get to project root: ../../xtts
      const execDir = path.dirname(process.execPath); // .../dist/win-unpacked
      
      // Navigate up from win-unpacked to dist, then to project root
      let projectRoot = execDir;
      if (execDir.endsWith('win-unpacked')) {
        projectRoot = path.join(execDir, '..'); // .../dist
        projectRoot = path.join(projectRoot, '..'); // project root
      } else if (execDir.includes('dist')) {
        projectRoot = path.join(execDir, '..'); // project root
      }
      
      const devPath = path.join(projectRoot, 'xtts');
      console.log('[xttsManager] Calculated dev XTTS path from unpacked build:', devPath);
      console.log('[xttsManager] Exec dir:', execDir);
      console.log('[xttsManager] Project root:', projectRoot);
      console.log('[xttsManager] Path exists:', require('fs').existsSync(devPath));
      
      // Verify the path exists, otherwise fall back to resources
      if (require('fs').existsSync(devPath)) {
        console.log('[xttsManager] Using original dev XTTS path for unpacked build');
        return devPath;
      } else {
        console.warn('[xttsManager] Dev XTTS path does not exist:', devPath);
        console.warn('[xttsManager] Falling back to resources path:', xttsPath);
        // Fall through to try resources path
      }
    }

    // Double-check if this is actually a packaged build by verifying the path exists
    if (require('fs').existsSync(xttsPath)) {
      console.log('[xttsManager] Packaged XTTS path exists, using it');
      return xttsPath;
    } else {
      console.warn('[xttsManager] Packaged XTTS path does not exist, falling back to dev path');
    }
  }

  // Dev: repo root/xtts (or fallback for packaged builds with missing XTTS)
  const devPath = path.join(__dirname, '..', 'xtts');
  console.log('[xttsManager] Using dev XTTS root:', devPath);
  console.log('[xttsManager] app.isPackaged:', app ? app.isPackaged : 'app not available');
  return devPath;
}

function getPaths() {
  const root = getXttsRootDir();
  console.log('[xttsManager] getPaths() - root:', root);
  console.log('[xttsManager] getPaths() - root exists:', fs.existsSync(root));
  
  // Prefer a PyInstaller "onedir" bundle (avoids huge temp extraction + decompression failures)
  const oneDirExe = path.join(root, 'bin', 'xtts-server', 'xtts-server.exe');
  const oneFileExe = path.join(root, 'bin', 'xtts-server.exe');
  const pythonWrapper = path.join(root, 'server', 'xtts_server_wrapper.py');
  
  console.log('[xttsManager] Checking executables:');
  console.log('[xttsManager]   - oneDirExe:', oneDirExe, 'exists:', fs.existsSync(oneDirExe));
  console.log('[xttsManager]   - oneFileExe:', oneFileExe, 'exists:', fs.existsSync(oneFileExe));
  console.log('[xttsManager]   - pythonWrapper:', pythonWrapper, 'exists:', fs.existsSync(pythonWrapper));
  
  // Some builds of the "onedir" bundle can be incomplete (notably missing sklearn internals),
  // causing the process to crash immediately. Detect that case and fall back to the one-file exe.
  const oneDirSklearnCheckBuildDir = path.join(root, 'bin', 'xtts-server', '_internal', 'sklearn', '__check_build');
  const oneDirLooksHealthy = fs.existsSync(oneDirExe) && fs.existsSync(oneDirSklearnCheckBuildDir);
  console.log('[xttsManager]   - oneDirLooksHealthy:', oneDirLooksHealthy);
  
  // Determine which executable to use.
  // Prefer Python wrapper (most reliable) > onedir > onefile
  // Both bundled executables have issues: onedir missing sklearn internals, onefile extraction failures
  let exe = null;
  let usePythonWrapper = false;
  if (fs.existsSync(pythonWrapper)) {
    // Python wrapper is most reliable - prefer it when available
    exe = pythonWrapper;
    usePythonWrapper = true;
    console.log('[xttsManager] Using Python wrapper');
  } else if (oneDirLooksHealthy) {
    exe = oneDirExe;
    console.log('[xttsManager] Using onedir executable');
  } else if (fs.existsSync(oneFileExe)) {
    exe = oneFileExe;
    console.log('[xttsManager] Using onefile executable');
  } else {
    console.error('[xttsManager] No XTTS executable found!');
  }
  
  const modelsDir = path.join(root, 'models');
  const voicesDir = path.join(root, 'voices');
  
  console.log('[xttsManager] Final paths:');
  console.log('[xttsManager]   - exe:', exe);
  console.log('[xttsManager]   - modelsDir:', modelsDir, 'exists:', fs.existsSync(modelsDir));
  console.log('[xttsManager]   - voicesDir:', voicesDir, 'exists:', fs.existsSync(voicesDir));
  
  return {
    root,
    exe,
    usePythonWrapper,
    modelsDir,
    voicesDir,
  };
}

// Check if a TCP port is available
function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => {
      resolve(false);
    });
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

function listVoicesFromDir(voicesDir) {
  try {
    if (!voicesDir || !fs.existsSync(voicesDir)) return [];
    const entries = fs.readdirSync(voicesDir, { withFileTypes: true });
    const audioExtensions = new Set(['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac']);
    const extPriority = { '.wav': 0, '.flac': 1, '.ogg': 2, '.mp3': 3, '.m4a': 4, '.aac': 5 };

    const files = entries
      .filter((d) => d && d.isFile && d.isFile())
      .map((d) => d.name)
      .filter(Boolean)
      .map((name) => ({ name, ext: path.extname(name).toLowerCase(), stem: path.parse(name).name }))
      .filter((f) => audioExtensions.has(f.ext));

    // Sort by stem then by extension preference (prefer wav)
    files.sort((a, b) => {
      const s = a.stem.localeCompare(b.stem, undefined, { sensitivity: 'base' });
      if (s !== 0) return s;
      return (extPriority[a.ext] ?? 99) - (extPriority[b.ext] ?? 99);
    });

    // Prefer one file per stem (best extension)
    const chosen = new Map();
    for (const f of files) {
      if (!chosen.has(f.stem)) {
        chosen.set(f.stem, f);
      } else if (f.ext === '.wav') {
        chosen.set(f.stem, f);
      }
    }

    return Array.from(chosen.values()).map((f) => ({
      id: f.stem,
      label: f.stem,
      filename: f.name,
    }));
  } catch (_) {
    return [];
  }
}

function httpRequest({ method, url, headers, body, timeoutMs = 8000, onProgress }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        method,
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + (u.search || ''),
        headers: headers || {},
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        const contentLength = parseInt(res.headers['content-length'] || '0', 10);
        let receivedBytes = 0;
        
        res.on('data', (d) => {
          chunks.push(d);
          receivedBytes += d.length;
          // Call progress callback if provided
          if (onProgress && contentLength > 0) {
            onProgress(receivedBytes, contentLength);
          }
        });
        
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers || {},
            body: Buffer.concat(chunks),
          });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Request timeout'));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function isHealthy(baseUrl) {
  try {
    const resp = await httpRequest({ method: 'GET', url: `${baseUrl}/health`, timeoutMs: 1500 });
    return resp.status >= 200 && resp.status < 300;
  } catch (_) {
    return false;
  }
}

async function waitForHealth(baseUrl, { timeoutMs = 20000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await isHealthy(baseUrl);
    if (ok) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function spawnXttsServer({ port }) {
  const { exe, usePythonWrapper, modelsDir, voicesDir } = getPaths();
  console.log('[xttsManager] spawnXttsServer paths:', { exe, usePythonWrapper, modelsDir, voicesDir });

  if (!fs.existsSync(exe)) {
    console.error('[xttsManager] XTTS exe not found at:', exe);
    console.error('[xttsManager] Available files in directory:', fs.existsSync(path.dirname(exe)) ? fs.readdirSync(path.dirname(exe)) : 'directory does not exist');
    throw new Error(`XTTS server executable not found: ${exe}`);
  }
  console.log('[xttsManager] XTTS exe exists ✓');
  
  if (!fs.existsSync(modelsDir)) {
    console.error('[xttsManager] Models dir not found at:', modelsDir);
    throw new Error(`XTTS models directory not found: ${modelsDir}`);
  }
  console.log('[xttsManager] Models dir exists ✓');
  
  if (!fs.existsSync(voicesDir)) {
    console.warn('[xttsManager] Voices dir not found (optional):', voicesDir);
    // voices are optional; server will return empty list
  } else {
    console.log('[xttsManager] Voices dir exists ✓');
  }

  const args = [
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--models-dir',
    modelsDir,
    '--voices-dir',
    voicesDir,
  ];

  console.log('[xttsManager] Spawning with args:', args);
  // Force PyInstaller one-file temp extraction (if used) into a controlled location
  // to prevent filling up Windows Temp and to make cleanup predictable.
  let tempDir = undefined;
  try {
    tempDir = path.join(app.getPath('userData'), 'xtts-tmp');
    fs.mkdirSync(tempDir, { recursive: true });
    console.log('[xttsManager] Using temp dir for PyInstaller extraction:', tempDir);
    
    // Clean up old extraction directories on startup (PyInstaller onefile creates _MEI* folders, Python creates tmp* dirs)
    // These can accumulate if the server crashes or is killed abruptly
    try {
      const entries = fs.readdirSync(tempDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirName = entry.name;
          // Clean up both PyInstaller _MEI* dirs and other temp dirs
          if (dirName.startsWith('_MEI') || dirName.startsWith('tmp') || dirName.length >= 8) {
            const oldDir = path.join(tempDir, dirName);
            try {
              // Check if directory is old enough to clean up (older than 5 minutes)
              const stats = fs.statSync(oldDir);
              const ageMs = Date.now() - stats.mtimeMs;
              const maxAgeMs = 5 * 60 * 1000; // 5 minutes

              if (ageMs > maxAgeMs) {
                fs.rmSync(oldDir, { recursive: true, force: true });
                console.log('[xttsManager] Cleaned up old temp dir on startup:', oldDir, '(age:', Math.round(ageMs/1000), 'seconds)');
              } else {
                console.log('[xttsManager] Keeping recent temp dir on startup:', oldDir, '(age:', Math.round(ageMs/1000), 'seconds)');
              }
            } catch (e) {
              console.warn('[xttsManager] Failed to clean up old temp dir on startup:', oldDir, e.message);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[xttsManager] Failed to scan temp dir for cleanup on startup:', e.message);
    }
  } catch (_) {
    tempDir = undefined;
  }

  // If using Python wrapper, spawn python with the wrapper script as first arg
  const spawnCmd = usePythonWrapper ? 'python' : exe;
  const spawnArgs = usePythonWrapper ? [exe, ...args] : args;

  xttsProc = childProcess.spawn(spawnCmd, spawnArgs, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'], // capture stdout and stderr
    env: {
      ...process.env,
      ...(tempDir ? { TEMP: tempDir, TMP: tempDir } : {}),
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8',
    },
  });

  // Log server output
  if (xttsProc.stdout) {
    xttsProc.stdout.on('data', (data) => {
      console.log('[XTTS Server stdout]:', data.toString().trim());
    });
  }
  
  let stderrBuffer = '';
  if (xttsProc.stderr) {
    xttsProc.stderr.on('data', (data) => {
      const text = data.toString();
      stderrBuffer += text;
      console.error('[XTTS Server stderr]:', text.trim());
      
      // Check for port binding errors
      if (text.includes('error while attempting to bind') || 
          text.includes('EADDRINUSE') || 
          text.includes('only one usage of each socket address')) {
        console.warn('[xttsManager] Port binding failed, server will exit. Will try next port.');
      }
    });
  }

  xttsProc.on('exit', (code, signal) => {
    console.log('[xttsManager] Server process exited. Code:', code, 'Signal:', signal);
    // If exit code is 1 and we see port binding error, this is expected - we'll try next port
    if (code === 1 && (stderrBuffer.includes('error while attempting to bind') || 
                       stderrBuffer.includes('EADDRINUSE'))) {
      console.log('[xttsManager] Port was in use, this is expected. Will try next port.');
    }
    xttsProc = null;
    xttsBaseUrl = null;
    xttsStarting = false;
  });
  
  xttsProc.on('error', (err) => {
    console.error('[xttsManager] Server process error:', err);
  });
  
  console.log('[xttsManager] Server process spawned, PID:', xttsProc.pid);
}

async function waitForHealthOrExit(baseUrl, proc, { timeoutMs = 60000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // If process died, bail early.
    if (!proc || proc.exitCode !== null) {
      return false;
    }
    // eslint-disable-next-line no-await-in-loop
    const ok = await isHealthy(baseUrl);
    if (ok) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

async function ensureRunning({ preWarmModel = false, forceNew = false } = {}) {
  console.log('[xttsManager] ensureRunning() called', { preWarmModel, forceNew });

  // If forceNew is true, kill any existing server first and wait for it to fully terminate
  if (forceNew) {
    console.log('[xttsManager] forceNew=true, stopping existing server...');
    const oldProc = xttsProc;
    stop();
    xttsBaseUrl = null;
    xttsPort = 8045;
    
    // Wait for the process to actually exit
    if (oldProc) {
      const maxWait = 5000; // 5 seconds max
      const start = Date.now();
      while (oldProc.exitCode === null && Date.now() - start < maxWait) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 100));
      }
      if (oldProc.exitCode === null) {
        console.warn('[xttsManager] Process did not exit within timeout, forcing kill...');
        try {
          oldProc.kill('SIGKILL');
        } catch (_) {
          // ignore
        }
      }
    }
    
    // Wait for the port to be free (health check should fail)
    const base = `http://127.0.0.1:${xttsPort}`;
    const maxPortWait = 3000; // 3 seconds max
    const portStart = Date.now();
    while (Date.now() - portStart < maxPortWait) {
      // eslint-disable-next-line no-await-in-loop
      const healthy = await isHealthy(base);
      if (!healthy) {
        console.log('[xttsManager] Port is now free');
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200));
    }
    
    // If port is still in use, try next port
    if (await isHealthy(base)) {
      console.log('[xttsManager] Port still in use after cleanup, will try next port');
      xttsPort = 8046; // Start on next port
    }
  }

  // Prevent concurrent startups (multiple callers at the same time).
  // This is important because the renderer can request voices twice in dev (React StrictMode),
  // while main may also be pre-warming.
  if (ensureRunningPromise) {
    console.log('[xttsManager] ensureRunning already in progress, awaiting existing promise...');
    const r = await ensureRunningPromise;
    // If caller asked for pre-warm but the in-flight call didn't request it, do it now.
    if (preWarmModel && r && r.baseUrl) {
      await preWarmXttsModel(r.baseUrl).catch((err) => {
        console.warn('[xttsManager] Pre-warm failed (non-fatal):', err.message);
      });
    }
    return r;
  }

  ensureRunningPromise = (async () => {
  if (xttsStarting && xttsBaseUrl && !forceNew) {
    console.log('[xttsManager] Already starting, waiting for health:', xttsBaseUrl);
    const ok = await waitForHealthOrExit(xttsBaseUrl, xttsProc, { timeoutMs: 60000 });
    if (ok) {
      // Optionally pre-warm model by making a small test request
      if (preWarmModel) {
        await preWarmXttsModel(xttsBaseUrl).catch((err) => {
          console.warn('[xttsManager] Pre-warm failed (non-fatal):', err.message);
        });
      }
      return { baseUrl: xttsBaseUrl, port: xttsPort };
    }
  }
  // If we already have a base URL and it's healthy, verify it's actually working
  // Skip this check if forceNew is true (we already killed the server above)
  if (!forceNew && xttsBaseUrl && (await isHealthy(xttsBaseUrl))) {
    // Quick check: try to get health status to see if server is responsive
    try {
      const healthResp = await httpRequest({ method: 'GET', url: `${xttsBaseUrl}/health`, timeoutMs: 2000 });
      if (healthResp.status >= 200 && healthResp.status < 300) {
        console.log('[xttsManager] Reusing existing server:', xttsBaseUrl);
        return { baseUrl: xttsBaseUrl, port: xttsPort };
      }
    } catch (err) {
      console.warn('[xttsManager] Existing server health check failed, will restart:', err.message);
      // Server seems broken, stop it and start fresh
      stop();
      xttsBaseUrl = null;
      xttsPort = 8045;
    }
  }

  // Try to attach to an already-running service on the known port first.
  // Skip this check if forceNew is true (we want a fresh server)
  const base = `http://127.0.0.1:${xttsPort}`;
  if (!forceNew) {
    console.log('[xttsManager] Checking if server already running on:', base);
    if (await isHealthy(base)) {
      console.log('[xttsManager] Found existing healthy server');
      xttsBaseUrl = base;
      xttsStarting = false;
      return { baseUrl: xttsBaseUrl, port: xttsPort };
    }
  }

  console.log('[xttsManager] No existing server, spawning new one...');
  // Start server (try a few ports if needed)
  for (let p = xttsPort; p < xttsPort + 10; p++) {
    const candidate = `http://127.0.0.1:${p}`;
    console.log('[xttsManager] Trying port:', p);
    // If forceNew is true, skip checking for existing healthy servers (we want a fresh one)
    if (!forceNew && await isHealthy(candidate)) {
      console.log('[xttsManager] Found healthy server on port:', p);
      xttsPort = p;
      xttsBaseUrl = candidate;
      xttsStarting = false;
      // Optionally pre-warm model if requested
      if (preWarmModel) {
        await preWarmXttsModel(xttsBaseUrl).catch((err) => {
          console.warn('[xttsManager] Pre-warm failed (non-fatal):', err.message);
        });
      }
      return { baseUrl: xttsBaseUrl, port: xttsPort };
    }

    // If port is not free (e.g., TIME_WAIT from previous process), skip it
    if (!(await isPortFree(p))) {
      console.log('[xttsManager] Port not free, skipping:', p);
      continue;
    }

    try {
      console.log('[xttsManager] Spawning server on port:', p);
      // Don't leak multiple background servers if a previous attempt is still starting.
      if (xttsProc) {
        try {
          console.log('[xttsManager] Stopping previous XTTS process before spawning a new one...');
          xttsProc.kill();
        } catch (_) {
          // ignore
        }
        xttsProc = null;
        xttsBaseUrl = null;
      }
      spawnXttsServer({ port: p });
    } catch (e) {
      console.error('[xttsManager] Failed to spawn server:', e);
      // If we cannot spawn, propagate immediately (missing exe/models)
      throw e;
    }

    console.log('[xttsManager] Waiting for server to become healthy...');
    xttsStarting = true;
    xttsBaseUrl = candidate;
    xttsPort = p;
    
    // Wait a short time to detect immediate port binding failures
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // Check if process already exited (port binding failure)
    if (xttsProc && (xttsProc.exitCode !== null || xttsProc.killed)) {
      const exitCode = xttsProc.exitCode;
      console.log('[xttsManager] Server exited immediately (exit code:', exitCode, '), likely port conflict. Trying next port...');
      xttsProc = null;
      xttsBaseUrl = null;
      xttsStarting = false;
      continue; // Try next port
    }
    
    // eslint-disable-next-line no-await-in-loop
    const ok = await waitForHealthOrExit(candidate, xttsProc, { timeoutMs: 60000 });
    if (ok) {
      console.log('[xttsManager] Server became healthy on port:', p);
      xttsStarting = false;
      // Optionally pre-warm model if requested
      if (preWarmModel) {
        await preWarmXttsModel(xttsBaseUrl).catch((err) => {
          console.warn('[xttsManager] Pre-warm failed (non-fatal):', err.message);
        });
      }
      return { baseUrl: xttsBaseUrl, port: xttsPort };
    }
    console.log('[xttsManager] Server did not become healthy on port:', p);
    // Clean up failed process
    if (xttsProc) {
      try {
        if (!xttsProc.killed) {
          xttsProc.kill();
        }
      } catch (_) {
        // ignore
      }
      xttsProc = null;
    }
    xttsBaseUrl = null;
    xttsStarting = false;
  }

  console.error('[xttsManager] Failed to start XTTS server after trying all ports');
  throw new Error('Failed to start XTTS server (no available port / server did not become healthy).');
  })();

  try {
    return await ensureRunningPromise;
  } finally {
    ensureRunningPromise = null;
  }
}

// Pre-warm the XTTS model by making a small test request
// This loads the model into memory so subsequent requests are faster
async function preWarmXttsModel(baseUrl) {
  console.log('[xttsManager] Pre-warming XTTS model...');
  try {
    const body = Buffer.from(
      JSON.stringify({
        text: 'test',
        language: 'en',
        voiceId: '',
      }),
      'utf-8'
    );
    // Use shorter timeout for pre-warm - if it takes too long, skip it
    const resp = await httpRequest({
      method: 'POST',
      url: `${baseUrl}/tts`,
      headers: { 'content-type': 'application/json', 'content-length': String(body.length) },
      body,
      timeoutMs: XTTS_PREWARM_TIMEOUT_MS,
    });
    if (resp.status >= 200 && resp.status < 300) {
      console.log('[xttsManager] Model pre-warmed successfully');
    }
  } catch (err) {
    console.warn('[xttsManager] Pre-warm request failed:', err.message);
    throw err;
  }
}

async function listVoices() {
  console.log('[xttsManager] listVoices() called');
  try {
    // List voices locally (fast, avoids timeouts while the Python server is busy warming up).
    const { voicesDir } = getPaths();
    const voices = listVoicesFromDir(voicesDir);
    console.log('[xttsManager] Local voices:', voices);

    // Best-effort: start the server in the background so it is ready when generating audio.
    ensureRunning().catch((err) => {
      console.warn('[xttsManager] ensureRunning() (background) failed:', err.message || err);
    });

    return voices;
  } catch (err) {
    console.error('[xttsManager] listVoices() error:', err);
    throw err;
  }
}

async function synthesizeWav({ text, language = 'en', voiceId = '', outPath, progressCallback }) {
  console.log('[xttsManager] synthesizeWav() called:', { textLength: text?.length || 0, language, voiceId, outPath });
  
  // Try once, and if we get a timeout or initialization error, restart server and retry
  const maxRetries = 2;
  let lastError = null;
  let restartNextAttempt = false;
  
  const reportProgress = (progress, message) => {
    if (progressCallback) {
      progressCallback({
        type: 'audio',
        progress: Math.max(0, Math.min(100, progress)),
        message: message,
      });
    }
  };
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let simulatedProgressInterval = null;
    try {
      // Stage 1: Ensure server is running (10-30% depending on if it needs to start)
      // If we need to restart due to a previous model initialization error, use forceNew
      const shouldForceNew = attempt > 0 && restartNextAttempt;
      if (shouldForceNew) {
        console.log('[xttsManager] Restarting XTTS server due to previous failure...');
        reportProgress(5, 'Restarting XTTS server...');
        restartNextAttempt = false; // Reset after capturing the value
      }
      reportProgress(10, 'Connecting to XTTS server...');
      const { baseUrl } = await ensureRunning({ forceNew: shouldForceNew });
      reportProgress(30, 'XTTS server ready');
      
      // Stage 2: Prepare request (30-35%)
      reportProgress(35, 'Preparing audio generation request...');
      const body = Buffer.from(
        JSON.stringify({
          text,
          language,
          voiceId: voiceId || '',
        }),
        'utf-8'
      );
      
      // Stage 3: Send request and wait for response (35-95%)
      // Model loading (first time) takes most of the time
      reportProgress(40, 'Generating audio (this may take 1-2 minutes on first run)...');
      
      // Smooth progress UX:
      // XTTS often streams audio with chunked transfer encoding (no Content-Length),
      // so we can't compute a reliable percent from bytes. To avoid the UI looking "stuck",
      // simulate a gentle progress ramp from 40% -> 94% while we wait for the response.
      const safeTextLen = (text && typeof text === 'string') ? text.length : 0;
      const startMs = Date.now();
      // Heuristic: ~35ms per char, clamped (covers short and long texts).
      const estimatedMs = Math.min(240000, Math.max(15000, safeTextLen * 35));
      simulatedProgressInterval = setInterval(() => {
        const elapsed = Date.now() - startMs;
        const t = Math.max(0, Math.min(1, elapsed / estimatedMs));
        const p = 40 + t * 54; // 40..94
        reportProgress(Math.min(94, Math.round(p)), 'Generating audio...');
      }, 500);

      // First /tts can fail transiently while the model is warming up (timeout or 500).
      // Retry ONCE against the same server before deciding to restart it.
      let inlineRetryDone = false;
      let resp = null;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          resp = await httpRequest({
            method: 'POST',
            url: `${baseUrl}/tts`,
            headers: { 'content-type': 'application/json', 'content-length': String(body.length) },
            body,
            timeoutMs: 180000, // model initialization can take a while
            onProgress: (bytesReceived, totalBytes) => {
              if (totalBytes > 0) {
                const downloadProgress = (bytesReceived / totalBytes) * 60;
                const totalProgress = 40 + downloadProgress;
                reportProgress(totalProgress, `Generating audio... ${Math.round(downloadProgress)}%`);
              }
            },
          });
        } catch (e) {
          const msg = e && e.message ? String(e.message) : String(e);
          const isTimeout = msg.includes('timeout') || msg.includes('Request timeout');
          if (!inlineRetryDone && isTimeout) {
            inlineRetryDone = true;
            reportProgress(45, 'XTTS is warming up... retrying (same server)...');
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          throw e;
        }

        if (resp && resp.status === 500 && !inlineRetryDone) {
          inlineRetryDone = true;
          reportProgress(45, 'XTTS is warming up... retrying (same server)...');
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        break;
      }

      if (simulatedProgressInterval) {
        clearInterval(simulatedProgressInterval);
        simulatedProgressInterval = null;
      }
      
      if (resp.status < 200 || resp.status >= 300) {
        let detail = '';
        try {
          detail = JSON.parse(resp.body.toString('utf-8') || '{}').detail || '';
        } catch (_) {
          detail = resp.body.toString('utf-8');
        }
        const errorMsg = `XTTS /tts failed (${resp.status}) ${detail}`.trim();
        
        // Initialization/import/model errors: a restart can help.
        if (
          resp.status === 500 &&
          (detail.includes('Failed to initialize') || detail.includes('Could not import') || detail.includes('Could not load'))
        ) {
          lastError = new Error(errorMsg);
          console.error('[xttsManager] Model initialization error, will restart server and retry...');
          restartNextAttempt = true;
          continue;
        }
        
        throw new Error(errorMsg);
      }
      
      // Stage 4: Save audio file (95-100%)
      reportProgress(95, 'Saving audio file...');
      const audioData = resp.body;
      if (!audioData || audioData.length === 0) {
        throw new Error('XTTS returned empty audio data');
      }
      console.log('[xttsManager] Saving audio file:', outPath, 'size:', audioData.length, 'bytes');
      
      // Ensure directory exists
      const outDir = path.dirname(outPath);
      if (!fs.existsSync(outDir)) {
        console.log('[xttsManager] Creating directory for audio file:', outDir);
        fs.mkdirSync(outDir, { recursive: true });
      }
      
      // Write file
      fs.writeFileSync(outPath, audioData);
      
      // Verify file was written
      if (!fs.existsSync(outPath)) {
        throw new Error(`Failed to write audio file: ${outPath}`);
      }
      
      const savedSize = fs.statSync(outPath).size;
      console.log('[xttsManager] Audio file saved successfully, size:', savedSize, 'bytes');
      
      if (savedSize === 0) {
        throw new Error('Audio file was created but is empty');
      }
      
      reportProgress(100, 'Audio generation complete');
      return outPath;
    } catch (err) {
      if (simulatedProgressInterval) {
        clearInterval(simulatedProgressInterval);
        simulatedProgressInterval = null;
      }
      // If it's a timeout, retry (restart only if we later detect an init/import issue)
      if ((err.message && err.message.includes('timeout')) || (err.message && err.message.includes('Request timeout'))) {
        if (attempt < maxRetries - 1) {
          lastError = err;
          console.error('[xttsManager] Request timeout, retrying...');
          continue;
        }
      }
      // Re-throw if it's not a retryable error or we've exhausted retries
      throw err;
    }
  }
  
  // If we exhausted retries, throw the last error
  throw lastError || new Error('XTTS /tts failed after retries');
}

function stop() {
  if (xttsProc) {
    console.log('[xttsManager] Stopping XTTS server process, PID:', xttsProc.pid);
    try {
      xttsProc.kill();
    } catch (e) {
      console.warn('[xttsManager] Error killing XTTS process:', e.message);
    }
    xttsProc = null;
    xttsBaseUrl = null;
  }
  
  // Clean up PyInstaller extraction temp dirs after server stops
  if (app) {
    try {
      const tempDir = path.join(app.getPath('userData'), 'xtts-tmp');
      if (fs.existsSync(tempDir)) {
        const entries = fs.readdirSync(tempDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const dirName = entry.name;
            // Clean up both PyInstaller _MEI* dirs and other temp dirs (tmp* patterns)
            if (dirName.startsWith('_MEI') || dirName.startsWith('tmp') || dirName.length >= 8) {
              const oldDir = path.join(tempDir, dirName);
              try {
                // Check if directory is old enough to clean up (older than 5 minutes)
                const stats = fs.statSync(oldDir);
                const ageMs = Date.now() - stats.mtimeMs;
                const maxAgeMs = 5 * 60 * 1000; // 5 minutes

                if (ageMs > maxAgeMs) {
                  fs.rmSync(oldDir, { recursive: true, force: true });
                  console.log('[xttsManager] Cleaned up old temp dir after stop:', oldDir, '(age:', Math.round(ageMs/1000), 'seconds)');
                } else {
                  console.log('[xttsManager] Keeping recent temp dir:', oldDir, '(age:', Math.round(ageMs/1000), 'seconds)');
                }
              } catch (e) {
                console.warn('[xttsManager] Failed to clean up temp dir:', oldDir, e.message);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[xttsManager] Failed to cleanup temp dirs on stop:', e.message);
    }
  }
}

// Manual cleanup function for testing/debugging
function cleanupTempDirs() {
  if (!app) return;
  try {
    const tempDir = path.join(app.getPath('userData'), 'xtts-tmp');
    if (fs.existsSync(tempDir)) {
      const entries = fs.readdirSync(tempDir, { withFileTypes: true });
      let cleanedCount = 0;
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirName = entry.name;
          if (dirName.startsWith('_MEI') || dirName.startsWith('tmp') || dirName.length >= 8) {
            const oldDir = path.join(tempDir, dirName);
            try {
              fs.rmSync(oldDir, { recursive: true, force: true });
              cleanedCount++;
              console.log('[xttsManager] Manually cleaned up temp dir:', oldDir);
            } catch (e) {
              console.warn('[xttsManager] Failed to clean up temp dir:', oldDir, e.message);
            }
          }
        }
      }
      console.log(`[xttsManager] Cleanup complete: removed ${cleanedCount} temp directories`);
    }
  } catch (e) {
    console.warn('[xttsManager] Failed to cleanup temp dirs:', e.message);
  }
}

module.exports = {
  getPaths,
  ensureRunning,
  listVoices,
  synthesizeWav,
  stop,
  cleanupTempDirs,
};