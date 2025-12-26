const path = require('path');
const fs = require('fs');
const http = require('http');
const childProcess = require('child_process');
const { app } = require('electron');

let xttsProc = null;
let xttsPort = 8045;
let xttsBaseUrl = null;
let xttsStarting = false;

function getXttsRootDir() {
  // In packaged builds, electron-builder extraResources land under process.resourcesPath
  if (app && app.isPackaged) {
    return path.join(process.resourcesPath, 'xtts');
  }
  // Dev: repo root/xtts
  return path.join(__dirname, '..', 'xtts');
}

function getPaths() {
  const root = getXttsRootDir();
  // Prefer a PyInstaller "onedir" bundle (avoids huge temp extraction + decompression failures)
  const oneDirExe = path.join(root, 'bin', 'xtts-server', 'xtts-server.exe');
  const oneFileExe = path.join(root, 'bin', 'xtts-server.exe');
  const pythonWrapper = path.join(root, 'server', 'xtts_server_wrapper.py');
  // Some builds of the "onedir" bundle can be incomplete (notably missing sklearn internals),
  // causing the process to crash immediately. Detect that case and fall back to the one-file exe.
  const oneDirSklearnCheckBuildDir = path.join(root, 'bin', 'xtts-server', '_internal', 'sklearn', '__check_build');
  const oneDirLooksHealthy = fs.existsSync(oneDirExe) && fs.existsSync(oneDirSklearnCheckBuildDir);
  
  // Determine which executable to use.
  // Prefer Python wrapper (most reliable) > onedir > onefile
  // Both bundled executables have issues: onedir missing sklearn internals, onefile extraction failures
  let exe = null;
  let usePythonWrapper = false;
  if (fs.existsSync(pythonWrapper)) {
    // Python wrapper is most reliable - prefer it when available
    exe = pythonWrapper;
    usePythonWrapper = true;
  } else if (oneDirLooksHealthy) {
    exe = oneDirExe;
  } else if (fs.existsSync(oneFileExe)) {
    exe = oneFileExe;
  }
  
  return {
    root,
    exe,
    usePythonWrapper,
    modelsDir: path.join(root, 'models'),
    voicesDir: path.join(root, 'voices'),
  };
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

async function ensureRunning({ preWarmModel = false } = {}) {
  console.log('[xttsManager] ensureRunning() called', { preWarmModel });
  if (xttsStarting && xttsBaseUrl) {
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
  if (xttsBaseUrl && (await isHealthy(xttsBaseUrl))) {
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
  const base = `http://127.0.0.1:${xttsPort}`;
  console.log('[xttsManager] Checking if server already running on:', base);
  if (await isHealthy(base)) {
    console.log('[xttsManager] Found existing healthy server');
    xttsBaseUrl = base;
    return { baseUrl: xttsBaseUrl, port: xttsPort };
  }

  console.log('[xttsManager] No existing server, spawning new one...');
  // Start server (try a few ports if needed)
  for (let p = xttsPort; p < xttsPort + 10; p++) {
    const candidate = `http://127.0.0.1:${p}`;
    console.log('[xttsManager] Trying port:', p);
    if (await isHealthy(candidate)) {
      console.log('[xttsManager] Found healthy server on port:', p);
      xttsPort = p;
      xttsBaseUrl = candidate;
      // Optionally pre-warm model if requested
      if (preWarmModel) {
        await preWarmXttsModel(xttsBaseUrl).catch((err) => {
          console.warn('[xttsManager] Pre-warm failed (non-fatal):', err.message);
        });
      }
      return { baseUrl: xttsBaseUrl, port: xttsPort };
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
      timeoutMs: 60000, // 1 minute max for pre-warm
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
    console.log('[xttsManager] Calling ensureRunning()...');
    const { baseUrl } = await ensureRunning();
    console.log('[xttsManager] Server running at:', baseUrl);
    console.log('[xttsManager] Fetching /voices...');
    const resp = await httpRequest({ method: 'GET', url: `${baseUrl}/voices` });
    console.log('[xttsManager] Response status:', resp.status);
    if (resp.status < 200 || resp.status >= 300) {
      throw new Error(`XTTS /voices failed (${resp.status})`);
    }
    const parsed = JSON.parse(resp.body.toString('utf-8') || '{}');
    const voices = Array.isArray(parsed.voices) ? parsed.voices : [];
    console.log('[xttsManager] Parsed voices:', voices);
    return voices;
  } catch (err) {
    console.error('[xttsManager] listVoices() error:', err);
    throw err;
  }
}

async function synthesizeWav({ text, language = 'en', voiceId = '', outPath, progressCallback }) {
  // Try once, and if we get a timeout or initialization error, restart server and retry
  const maxRetries = 2;
  let lastError = null;
  
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
    try {
      // If this is a retry after failure, force restart the server
      if (attempt > 0) {
        console.log('[xttsManager] Restarting XTTS server due to previous failure...');
        reportProgress(5, 'Restarting XTTS server...');
        stop();
        // Clear the base URL to force a fresh server start
        xttsBaseUrl = null;
        xttsPort = 8045;
        // Wait a bit for the old process to fully terminate
        await new Promise((r) => setTimeout(r, 1000));
      }
      
      // Stage 1: Ensure server is running (10-30% depending on if it needs to start)
      reportProgress(10, 'Connecting to XTTS server...');
      const { baseUrl } = await ensureRunning();
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
      
      // Track download progress if possible (estimate based on text length)
      const textLength = text.length;
      const estimatedCharsPerPercent = Math.max(1, Math.ceil(textLength / 55)); // Rough estimate: 40-50% for generation, 50-95% for streaming
      
      const resp = await httpRequest({
        method: 'POST',
        url: `${baseUrl}/tts`,
        headers: { 'content-type': 'application/json', 'content-length': String(body.length) },
        body,
        timeoutMs: 180000, // 3 minutes - model initialization can take a while
        onProgress: (bytesReceived, totalBytes) => {
          // Estimate progress: 40% (model load) + 60% (audio generation/download)
          if (totalBytes > 0) {
            const downloadProgress = (bytesReceived / totalBytes) * 60; // 60% of total is download
            const totalProgress = 40 + downloadProgress;
            reportProgress(totalProgress, `Generating audio... ${Math.round(downloadProgress)}%`);
          }
        },
      });
      
      if (resp.status < 200 || resp.status >= 300) {
        let detail = '';
        try {
          detail = JSON.parse(resp.body.toString('utf-8') || '{}').detail || '';
        } catch (_) {
          detail = resp.body.toString('utf-8');
        }
        const errorMsg = `XTTS /tts failed (${resp.status}) ${detail}`.trim();
        
        // If it's an initialization error or server error, restart and retry once
        if (resp.status === 500 && (detail.includes('Failed to initialize') || detail.includes('Could not import') || detail.includes('Could not load'))) {
          lastError = new Error(errorMsg);
          console.error('[xttsManager] Model initialization error, will restart server and retry...');
          continue;
        }
        
        throw new Error(errorMsg);
      }
      
      // Stage 4: Save audio file (95-100%)
      reportProgress(95, 'Saving audio file...');
      fs.writeFileSync(outPath, resp.body);
      reportProgress(100, 'Audio generation complete');
      return outPath;
    } catch (err) {
      // If it's a timeout and we haven't retried yet, restart and retry
      if ((err.message && err.message.includes('timeout')) || (err.message && err.message.includes('Request timeout'))) {
        if (attempt < maxRetries - 1) {
          lastError = err;
          console.error('[xttsManager] Request timeout, will restart server and retry...');
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
    try {
      xttsProc.kill();
    } catch (_) {
      // ignore
    }
    xttsProc = null;
    xttsBaseUrl = null;
  }
}

module.exports = {
  getPaths,
  ensureRunning,
  listVoices,
  synthesizeWav,
  stop,
};


