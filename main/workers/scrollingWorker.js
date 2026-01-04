// Scrolling/Advanced generator worker
// - Runs in a separate Node process (keeps Electron main/renderer responsive)
// - Streams JPEG frames directly into FFmpeg via image2pipe (no frame files on disk)
//
// Parent process protocol (process.send messages):
// - { type: 'start', options, paths: { tempRoot, defaultOutputDir } }
// - { type: 'cancel' }
//
// Worker -> parent:
// - { type: 'progress', payload }
// - { type: 'done', outputPath }
// - { type: 'error', error }
// - { type: 'xtts-synthesize', requestId, payload: { text, language, voiceId, outPath } }
// - { type: 'xtts-result', requestId, ok, error } (parent sends)
//
const { Canvas, loadImage } = require('skia-canvas');
const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');
const os = require('os');
const childProcess = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const gTTS = require('gtts');

let cancelled = false;
let currentFfmpeg = null;
let currentTempDirPath = null;

function safeSendToParent(message) {
  try {
    if (process && typeof process.send === 'function') {
      process.send(message);
      return true;
    }
  } catch (_) {
    // Ignore ERR_IPC_CHANNEL_CLOSED / "Channel closed"
  }
  return false;
}

function sendProgress(payload) {
  safeSendToParent({ type: 'progress', payload });
}

function getRecommendedFfmpegThreads() {
  // This runs in a separate worker process, so we can use most/all cores
  // without freezing the Electron renderer.
  const cores = os.cpus().length || 1;
  return Math.max(1, cores);
}

function safeNumber(x, fallback) {
  const n = typeof x === 'number' ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function createGradient(ctx, x1, y1, x2, y2, colors) {
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  if (Array.isArray(colors) && colors.length > 0) {
    colors.forEach((color, index) => {
      gradient.addColorStop(index / Math.max(1, colors.length - 1), color);
    });
  }
  return gradient;
}

function applyTextShadow(ctx, shadow) {
  if (!shadow || !shadow.enabled) return;
  ctx.shadowColor = shadow.color || 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = shadow.blur || 10;
  ctx.shadowOffsetX = shadow.offsetX || 0;
  ctx.shadowOffsetY = shadow.offsetY || 2;
}

function drawTextWithEffects(ctx, text, x, y, options) {
  const {
    color,
    fontSize,
    fontFamily,
    bold = false,
    italic = false,
    underline = false,
    outline = null,
    shadow = null,
    gradient = null,
  } = options;

  let fontStyle = '';
  if (italic) fontStyle += 'italic ';
  if (bold) fontStyle += 'bold ';
  ctx.font = `${fontStyle}${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';

  if (gradient && gradient.enabled && gradient.colors && gradient.colors.length > 0) {
    const grad = createGradient(ctx, x - 200, y, x + 200, y, gradient.colors);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = color;
  }

  applyTextShadow(ctx, shadow);

  if (outline && outline.enabled) {
    ctx.strokeStyle = outline.color || '#000000';
    ctx.lineWidth = outline.width || 2;
    ctx.strokeText(text, x, y);
  }

  ctx.fillText(text, x, y);

  if (underline) {
    const metrics = ctx.measureText(text);
    ctx.beginPath();
    ctx.moveTo(x - metrics.width / 2, y + fontSize + 2);
    ctx.lineTo(x + metrics.width / 2, y + fontSize + 2);
    ctx.strokeStyle =
      gradient && gradient.enabled ? gradient.colors[gradient.colors.length - 1] || color : color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (shadow && shadow.enabled) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
}

function applyAnimation(frameNum, totalFrames, animationType, baseY) {
  if (!animationType || animationType === 'none') return { y: baseY, opacity: 1, scale: 1 };

  let y = baseY;
  let opacity = 1;
  let scale = 1;

  const progress = totalFrames > 0 ? frameNum / totalFrames : 0;

  switch (animationType) {
    case 'fade-in':
      opacity = Math.min(1, frameNum / (totalFrames * 0.2));
      break;
    case 'fade-out':
      opacity = Math.max(0, 1 - (frameNum - totalFrames * 0.8) / (totalFrames * 0.2));
      break;
    case 'fade-both':
      if (progress < 0.2) opacity = progress * 5;
      else if (progress > 0.8) opacity = (1 - progress) * 5;
      break;
    case 'zoom-in':
      scale = 0.5 + progress * 0.5;
      break;
    case 'zoom-out':
      scale = 1.5 - progress * 0.5;
      break;
    case 'pulse':
      scale = 1 + Math.sin(progress * Math.PI * 4) * 0.1;
      break;
    case 'bounce':
      y = baseY + Math.sin(progress * Math.PI * 2) * 10;
      break;
  }

  return { y, opacity, scale };
}

function calculateScrollPosition(frameNum, scrollPerFrame, videoWidth, videoHeight, scrollDirection) {
  const currentOffset = frameNum * scrollPerFrame;
  switch (scrollDirection) {
    case 'horizontal':
      return { x: videoWidth - currentOffset, y: videoHeight / 2 };
    case 'diagonal': {
      const d = currentOffset * 0.707;
      return { x: d, y: videoHeight - d };
    }
    case 'fixed':
      return { x: videoWidth / 2, y: videoHeight / 2 };
    case 'vertical':
    default:
      return { x: videoWidth / 2, y: videoHeight - currentOffset };
  }
}

function applyImageFilters(ctx, filter) {
  if (!filter || filter === 'none') return;
  switch (filter) {
    case 'sepia':
      ctx.filter = 'sepia(100%)';
      break;
    case 'grayscale':
    case 'black-white':
      ctx.filter = 'grayscale(100%)';
      break;
    case 'vintage':
      ctx.filter = 'sepia(50%) contrast(1.2) brightness(0.9)';
      break;
    case 'bright':
      ctx.filter = 'brightness(1.2) contrast(1.1)';
      break;
    case 'dark':
      ctx.filter = 'brightness(0.8) contrast(1.1)';
      break;
  }
}

function applyColorAdjustments(ctx, adjustments) {
  if (!adjustments) return;
  let filterString = '';
  if (adjustments.brightness !== undefined && adjustments.brightness !== 1) {
    filterString += `brightness(${adjustments.brightness}) `;
  }
  if (adjustments.contrast !== undefined && adjustments.contrast !== 1) {
    filterString += `contrast(${adjustments.contrast}) `;
  }
  if (adjustments.saturation !== undefined && adjustments.saturation !== 1) {
    filterString += `saturate(${adjustments.saturation}) `;
  }
  if (adjustments.hue !== undefined && adjustments.hue !== 0) {
    filterString += `hue-rotate(${adjustments.hue}deg) `;
  }
  ctx.filter = filterString.trim() || 'none';
}

async function drawSubtitles(ctx, frameNum, fps, subtitleOptions, width, height) {
  const currentTime = frameNum / fps;
  const subtitles = subtitleOptions.items || [];
  for (const subtitle of subtitles) {
    if (currentTime >= subtitle.start && currentTime <= subtitle.end) {
      const style = subtitle.style || {};
      ctx.font = `${style.fontSize || 24}px ${style.fontFamily || 'Arial'}`;
      ctx.fillStyle = style.color || '#ffffff';
      ctx.strokeStyle = style.strokeColor || '#000000';
      ctx.lineWidth = style.strokeWidth || 2;
      ctx.textAlign = style.align || 'center';
      ctx.textBaseline = 'bottom';
      const x = style.x !== undefined ? style.x : width / 2;
      const y = style.y !== undefined ? style.y : height - 50;
      if ((style.strokeWidth || 0) > 0) ctx.strokeText(subtitle.text, x, y);
      ctx.fillText(subtitle.text, x, y);
    }
  }
}

async function generateSystemNarrationAudioWindows(text, voiceName, outPath, progressCallback) {
  const report = (p, message) => progressCallback && progressCallback({ type: 'audio', progress: p, message });
  report(10, 'Initializing system TTS...');
  const safeText = String(text || '');
  const safeVoice = voiceName ? String(voiceName) : '';
  const scriptParts = [
    "Add-Type -AssemblyName System.Speech;",
    "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer;",
    safeVoice ? `$s.SelectVoice('${safeVoice.replace(/'/g, "''")}');` : '',
    `$s.SetOutputToWaveFile('${outPath.replace(/'/g, "''")}');`,
    `$s.Speak('${safeText.replace(/'/g, "''")}');`,
    '$s.Dispose();',
  ].filter(Boolean);
  const script = scriptParts.join(' ');
  report(30, 'Generating audio with system voice...');
  await new Promise((resolve, reject) => {
    const startTime = Date.now();
    const estimatedDuration = Math.max(2000, safeText.length * 50);
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(90, 30 + (elapsed / estimatedDuration) * 60);
      report(Math.round(progress), 'Generating audio with system voice...');
    }, 200);
    childProcess.execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true, maxBuffer: 5 * 1024 * 1024 },
      (err, _stdout, stderr) => {
        clearInterval(interval);
        if (err) reject(new Error(stderr || err.message));
        else resolve();
      }
    );
  });
  report(100, 'Audio generation complete');
  return outPath;
}

async function generateGoogleNarrationMp3(text, language, outPath, progressCallback) {
  const report = (p, message) => progressCallback && progressCallback({ type: 'audio', progress: p, message });
  report(10, 'Connecting to Google TTS service...');
  await new Promise((resolve, reject) => {
    const tts = new gTTS(text, language);
    tts.save(outPath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  report(100, 'Audio generation complete');
  return outPath;
}

function createFfmpegEncodeProcess({ fps, format, qualityPreset, bitrateKbps, outputPath, totalFrames }) {
  const safeFormat = String(format || 'mp4').toLowerCase();
  const isWebm = safeFormat === 'webm';
  const isMov = safeFormat === 'mov';
  const threadCount = getRecommendedFfmpegThreads();

  const bitrateNum =
    typeof bitrateKbps === 'number' && Number.isFinite(bitrateKbps) && bitrateKbps > 0 ? bitrateKbps : null;

  const x264CrfMap = { low: 30, medium: 26, high: 22, ultra: 18 };
  const x264PresetMap = { low: 'ultrafast', medium: 'veryfast', high: 'fast', ultra: 'medium' };
  const vp9CrfMap = { low: 45, medium: 35, high: 30, ultra: 24 };
  const vp9CpuUsedMap = { low: 8, medium: 6, high: 4, ultra: 2 };
  const qp = String(qualityPreset || 'high').toLowerCase();

  const args = [
    '-y',
    // Input: JPEG frames over stdin
    '-f',
    'image2pipe',
    '-vcodec',
    'mjpeg',
    '-framerate',
    String(fps),
    '-i',
    'pipe:0',
  ];

  if (isWebm) {
    args.push('-c:v', 'libvpx-vp9', '-pix_fmt', 'yuv420p');
    args.push('-threads', String(threadCount));
    const cpuUsed = vp9CpuUsedMap[qp] ?? vp9CpuUsedMap.high;
    const deadline = cpuUsed >= 6 ? 'realtime' : 'good';
    args.push('-cpu-used', String(cpuUsed));
    args.push('-deadline', deadline);
    if (bitrateNum) {
      args.push('-b:v', `${bitrateNum}k`);
    } else {
      args.push('-b:v', '0');
      args.push('-crf', String(vp9CrfMap[qp] ?? vp9CrfMap.high));
    }
  } else {
    args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p');
    args.push('-preset', x264PresetMap[qp] ?? x264PresetMap.high);
    args.push('-threads', String(threadCount));
    if (!isMov) {
      args.push('-movflags', '+faststart');
    } else {
      // mov also benefits from faststart but doesn't strictly require it
      args.push('-movflags', '+faststart');
    }
    if (bitrateNum) args.push('-b:v', `${bitrateNum}k`);
    else args.push('-crf', String(x264CrfMap[qp] ?? x264CrfMap.high));
  }

  // Keep a stable output fps
  args.push('-r', String(fps));
  args.push(outputPath);

  const proc = childProcess.spawn(ffmpegPath, args, { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });

  // Encoding progress (best-effort via time=)
  const durationSec = totalFrames && fps ? Number(totalFrames) / Number(fps) : null;
  let stderrBuf = '';
  proc.stderr.on('data', (d) => {
    const s = d.toString();
    stderrBuf += s;
    const m = s.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (m && durationSec && durationSec > 0) {
      const t = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
      const pct = Math.max(0, Math.min(100, (t / durationSec) * 100));
      sendProgress({ type: 'encoding', progress: Math.round(pct), message: 'Encoding video...' });
    }
  });

  proc.on('exit', (code) => {
    if (code !== 0 && !cancelled) {
      const msg = stderrBuf.trim() || `FFmpeg exited with code ${code}`;
      // surface error via worker handler
      // eslint-disable-next-line no-console
      console.error('[scrollingWorker] ffmpeg encode failed:', msg);
    }
  });

  return proc;
}

async function writeToStdinWithBackpressure(proc, buffer) {
  if (!proc || !proc.stdin) throw new Error('FFmpeg process stdin not available');
  if (cancelled) throw new Error('Video generation cancelled');
  const ok = proc.stdin.write(buffer);
  if (!ok) {
    await new Promise((resolve) => proc.stdin.once('drain', resolve));
  }
}

async function mixAllAudioSpawn({
  videoPath,
  exportFormat,
  durationSec,
  narrationPath,
  bgMusicPath,
  bgMusic,
  bgVoicePath,
  bgVoice,
  outputPath,
}) {
  sendProgress({ type: 'audio-mix', message: 'Mixing audio with video...' });

  const safeFormat = String(exportFormat || 'mp4').toLowerCase();
  const isWebm = safeFormat === 'webm';

  const inputs = ['-y', '-i', videoPath];
  let inputIndex = 1;

  const filters = [];
  const mixLabels = [];

  if (narrationPath) {
    inputs.push('-i', narrationPath);
    filters.push(`[${inputIndex}:a]apad[a1]`);
    mixLabels.push('a1');
    inputIndex += 1;
  }

  const addBg = (filePath, settings, outLabel) => {
    if (!filePath) return;
    inputs.push('-i', filePath);
    let chain = `[${inputIndex}:a]`;
    const parts = [];
    const vol = settings && typeof settings.volume === 'number' ? settings.volume : 1;
    if (vol !== 1) parts.push(`volume=${vol}`);
    const fadeIn = settings && typeof settings.fadeIn === 'number' ? settings.fadeIn : 0;
    const fadeOut = settings && typeof settings.fadeOut === 'number' ? settings.fadeOut : 0;
    if (fadeIn > 0) parts.push(`afade=t=in:st=0:d=${fadeIn}`);
    if (fadeOut > 0 && durationSec && durationSec > 0) {
      const st = Math.max(0, durationSec - fadeOut);
      parts.push(`afade=t=out:st=${st}:d=${fadeOut}`);
    }
    if (parts.length > 0) chain += parts.join(',');
    chain += `[${outLabel}]`;
    filters.push(chain);
    mixLabels.push(outLabel);
    inputIndex += 1;
  };

  addBg(bgMusicPath, bgMusic, 'm2');
  addBg(bgVoicePath, bgVoice, 'v3');

  let audioMapLabel = null;
  if (mixLabels.length === 1) {
    audioMapLabel = mixLabels[0];
  } else if (mixLabels.length > 1) {
    const inStr = mixLabels.map((l) => `[${l}]`).join('');
    filters.push(`${inStr}amix=inputs=${mixLabels.length}:duration=longest:dropout_transition=2[aout]`);
    audioMapLabel = 'aout';
  }

  const args = [
    ...inputs,
    ...(filters.length > 0 ? ['-filter_complex', filters.join(';')] : []),
    '-map',
    '0:v:0',
  ];

  if (audioMapLabel) {
    args.push('-map', `[${audioMapLabel}]`);
    if (isWebm) {
      args.push('-c:v', 'copy', '-c:a', 'libopus', '-b:a', '128k', '-shortest');
    } else {
      args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest');
    }
  } else {
    // no audio, just copy video
    args.push('-c:v', 'copy');
  }

  args.push(outputPath);

  const proc = childProcess.spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let stderr = '';
  proc.stderr.on('data', (d) => (stderr += d.toString()));
  await new Promise((resolve, reject) => {
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `FFmpeg audio mix failed (code ${code})`));
    });
  });

  sendProgress({ type: 'audio-mix', message: 'Audio mix complete.' });
  return outputPath;
}

async function generateInWorker(options, paths) {
  const {
    imagePath,
    imagePaths = null,
    videoPath = null, // (not implemented in streaming path; kept for compatibility)
    text,
    texts = null,
    width,
    height,
    scrollSpeed,
    scrollDirection = 'vertical',
    textColor,
    fontSize,
    fontFamily,
    fps = 30,
    slides = null,
    exportFormat = 'mp4',
    outputDirectory = null,
    qualityPreset = 'high',
    bitrate = null,
    exportGif = false, // not implemented in streaming mode (yet)
    exportImageSequence = false, // not implemented in streaming mode (yet)
    exportThumbnail = false, // not implemented in streaming mode (yet)
  } = options || {};

  const outDir = outputDirectory || (paths && paths.defaultOutputDir) || '';
  if (!outDir) throw new Error('No output directory available');

  const tempRoot = (paths && paths.tempRoot) || path.join(process.cwd(), 'video-temp');
  await fs.mkdir(tempRoot, { recursive: true });

  const tempDir = await fs.mkdtemp(path.join(tempRoot, 'scrolling-video-'));
  currentTempDirPath = tempDir;
  const timestamp = Date.now();
  const baseFileName = `scrolling-video-${timestamp}`;

  // Slides
  const slideConfigs = slides && slides.length > 0 ? slides : [
    {
      imagePath: imagePath || (imagePaths && imagePaths[0]) || null,
      imagePaths: imagePaths || null,
      videoPath: videoPath,
      text: text || '',
      texts: texts || null,
      duration: options.duration || null,
      transition: options.transition || 'none',
    },
  ];

  // Narration
  const narrationOptions = options.narration || {};
  const shouldGenerateNarration =
    Boolean(narrationOptions.enabled) &&
    Boolean(narrationOptions.text && narrationOptions.text.trim().length > 0);
  const narrationLanguage = narrationOptions.language || 'en';
  const narrationProvider = (narrationOptions.provider || 'google').toLowerCase(); // google | system | xtts
  const narrationVoice = narrationOptions.voiceName || narrationOptions.voice || null;

  // Background Music + Voice (extra audio layer)
  const bgMusicOptions = options.backgroundMusic || {};
  const hasBgMusic = Boolean(bgMusicOptions.enabled && bgMusicOptions.path);
  const bgVoiceOptions = options.backgroundVoice || {};
  const hasBgVoice = Boolean(bgVoiceOptions.enabled && bgVoiceOptions.path);

  // Visual styling options
  const textEffects = options.textEffects || {};
  const textAnimation = options.textAnimation || { type: 'none' };
  const imageFilter = options.imageFilter || 'none';
  const colorAdjustments = options.colorAdjustments || {};

  // Create measure canvas for frame estimation
  const measureCanvas = new Canvas(width, height);
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = `${fontSize}px ${fontFamily}`;
  const maxWidth = width - 100;
  const lineHeight = fontSize * 1.5;

  let totalFramesAllSlides = 0;
  for (const slide of slideConfigs) {
    const slideTexts = slide.texts || (slide.text ? [{ text: slide.text, ...options }] : []);
    let maxTextHeight = 0;
    for (const textBlock of slideTexts) {
      const textContent = (textBlock && textBlock.text) ? String(textBlock.text) : '';
      const words = textContent.split(' ');
      let currentLine = '';
      let linesCount = 0;
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = measureCtx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          linesCount += 1;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) linesCount += 1;
      maxTextHeight = Math.max(maxTextHeight, linesCount * lineHeight);
    }
    const scrollPerFrame = scrollSpeed / fps;
    const totalScrollDistance = height + maxTextHeight;
    const totalFrames = Math.ceil(totalScrollDistance / scrollPerFrame);
    const slideDuration = slide.duration || totalFrames / fps;
    const slideFrames = Math.ceil(slideDuration * fps);
    totalFramesAllSlides += slideFrames;
  }

  if (cancelled) throw new Error('Video generation cancelled');

  // Start audio generation in parallel
  const narrationWavPath = path.join(tempDir, `narration-${timestamp}.wav`);
  const narrationMp3Path = path.join(tempDir, `narration-${timestamp}.mp3`);
  let narrationAudioPath = null;

  const audioPromise = shouldGenerateNarration
    ? (async () => {
        if (narrationProvider === 'xtts') {
          // Ask parent to synthesize into narrationWavPath
          const requestId = `xtts-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          await new Promise((resolve, reject) => {
            const onMsg = (m) => {
              if (!m || m.type !== 'xtts-result' || m.requestId !== requestId) return;
              process.off('message', onMsg);
              if (m.ok) resolve();
              else reject(new Error(m.error || 'XTTS synthesis failed'));
            };
            process.on('message', onMsg);
            const ok = safeSendToParent({
              type: 'xtts-synthesize',
              requestId,
              payload: {
                text: narrationOptions.text.trim(),
                language: narrationLanguage,
                voiceId: narrationVoice || '',
                outPath: narrationWavPath,
              },
            });
            if (!ok) {
              process.off('message', onMsg);
              reject(new Error('Channel closed'));
            }
          });
          narrationAudioPath = narrationWavPath;
          return narrationAudioPath;
        }
        if (narrationProvider === 'system') {
          if (process.platform === 'win32') {
            await generateSystemNarrationAudioWindows(
              narrationOptions.text.trim(),
              narrationVoice || '',
              narrationWavPath,
              sendProgress
            );
            narrationAudioPath = narrationWavPath;
            return narrationAudioPath;
          }
          // fall back to google
        }
        await generateGoogleNarrationMp3(narrationOptions.text.trim(), narrationLanguage, narrationMp3Path, sendProgress);
        narrationAudioPath = narrationMp3Path;
        return narrationAudioPath;
      })().catch((err) => {
        // Non-fatal: continue without narration
        // eslint-disable-next-line no-console
        console.error('[scrollingWorker] narration failed:', err.message || err);
        return null;
      })
    : Promise.resolve(null);

  // Encode video while rendering frames (streamed)
  const videoTmpPath = path.join(tempDir, `${baseFileName}-video.${String(exportFormat).toLowerCase()}`);
  sendProgress({ type: 'encoding', progress: 0, message: `Encoding video... (quality: ${qualityPreset || 'high'})` });
  const ff = createFfmpegEncodeProcess({
    fps,
    format: exportFormat,
    qualityPreset,
    bitrateKbps: bitrate,
    outputPath: videoTmpPath,
    totalFrames: totalFramesAllSlides,
  });
  currentFfmpeg = ff;

  let globalFrame = 0;
  const progressEvery = Math.max(1, Math.floor(fps));

  for (let slideIndex = 0; slideIndex < slideConfigs.length; slideIndex++) {
    if (cancelled) throw new Error('Video generation cancelled');
    const slide = slideConfigs[slideIndex];

    // Background image(s)
    const slideImagePath = slide.imagePath || (slide.imagePaths && slide.imagePaths[0]);
    let bgImage = null;
    if (slideImagePath) {
      bgImage = await loadImage(slideImagePath);
    }

    const slideTexts = slide.texts || (slide.text ? [{ text: slide.text, ...options }] : []);

    // Cache multi-images if present
    const imageCache = new Map();
    if (slide.imagePaths && slide.imagePaths.length > 1) {
      for (const p of slide.imagePaths) {
        try {
          const img = await loadImage(p);
          imageCache.set(p, img);
        } catch (_) {
          // ignore bad file
        }
      }
    }

    // Build wrapped text lines
    const ctxMeasure = measureCtx;
    const allTextLines = [];
    for (const textBlock of slideTexts) {
      const textContent = textBlock.text || '';
      const words = String(textContent).split(' ');
      const lines = [];
      let currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctxMeasure.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      allTextLines.push({ lines, options: textBlock });
    }

    const maxTextHeight = Math.max(...allTextLines.map((b) => b.lines.length * lineHeight), 0);
    const scrollPerFrame = scrollSpeed / fps;
    const totalScrollDistance = height + maxTextHeight;
    const totalFrames = Math.ceil(totalScrollDistance / scrollPerFrame);
    const slideDuration = slide.duration || totalFrames / fps;
    const slideFrames = Math.ceil(slideDuration * fps);

    const frameCanvas = new Canvas(width, height);
    const frameCtx = frameCanvas.getContext('2d');

    for (let frameNum = 0; frameNum < slideFrames; frameNum++) {
      if (cancelled) throw new Error('Video generation cancelled');

      // Yield occasionally so IPC/cancel messages are handled without slowing rendering too much.
      if (frameNum % 8 === 0) {
        await new Promise((r) => setImmediate(r));
      }

      // Reset state
      frameCtx.filter = 'none';
      frameCtx.globalAlpha = 1;
      frameCtx.setTransform(1, 0, 0, 1, 0, 0);

      // Choose background image for multi-image slides
      let currentBgImage = bgImage;
      if (slide.imagePaths && slide.imagePaths.length > 1) {
        const imageIndex =
          Math.floor((frameNum / slideFrames) * slide.imagePaths.length) % slide.imagePaths.length;
        const ip = slide.imagePaths[imageIndex];
        currentBgImage = imageCache.get(ip) || bgImage;
      }

      frameCtx.clearRect(0, 0, width, height);

      // Draw background
      if (currentBgImage) {
        applyColorAdjustments(frameCtx, colorAdjustments);
        applyImageFilters(frameCtx, imageFilter);

        const crop = options.backgroundCrop || {};
        const rotation = options.backgroundRotation || 0;
        if (rotation !== 0) {
          frameCtx.save();
          frameCtx.translate(width / 2, height / 2);
          frameCtx.rotate((rotation * Math.PI) / 180);
          frameCtx.translate(-width / 2, -height / 2);
        }

        if (crop.enabled && (crop.x !== undefined || crop.y !== undefined || crop.width || crop.height)) {
          const sx = crop.x || 0;
          const sy = crop.y || 0;
          const sw = crop.width || currentBgImage.width;
          const sh = crop.height || currentBgImage.height;
          frameCtx.drawImage(currentBgImage, sx, sy, sw, sh, 0, 0, width, height);
        } else {
          const scale = Math.max(width / currentBgImage.width, height / currentBgImage.height);
          const scaledWidth = currentBgImage.width * scale;
          const scaledHeight = currentBgImage.height * scale;
          const x = (width - scaledWidth) / 2;
          const y = (height - scaledHeight) / 2;
          frameCtx.drawImage(currentBgImage, x, y, scaledWidth, scaledHeight);
        }

        if (rotation !== 0) frameCtx.restore();
        frameCtx.filter = 'none';
      } else if (options.backgroundGradient && options.backgroundGradient.enabled) {
        const grad = options.backgroundGradient;
        const gradient = createGradient(
          frameCtx,
          grad.x1 !== undefined ? grad.x1 : 0,
          grad.y1 !== undefined ? grad.y1 : 0,
          grad.x2 !== undefined ? grad.x2 : width,
          grad.y2 !== undefined ? grad.y2 : height,
          grad.colors && grad.colors.length > 0 ? grad.colors : ['#000000', '#ffffff']
        );
        frameCtx.fillStyle = gradient;
        frameCtx.fillRect(0, 0, width, height);
      } else {
        frameCtx.fillStyle = '#000000';
        frameCtx.fillRect(0, 0, width, height);
      }

      if (options.overlayOpacity !== undefined && options.overlayOpacity > 0) {
        frameCtx.fillStyle = `rgba(0, 0, 0, ${options.overlayOpacity})`;
        frameCtx.fillRect(0, 0, width, height);
      }

      // Text blocks
      for (const textBlock of allTextLines) {
        const blockOptions = textBlock.options || {};
        const blockTextEffects = blockOptions.textEffects || textEffects;
        const blockAnimation = blockOptions.textAnimation || textAnimation;

        const scrollPos = calculateScrollPosition(
          frameNum,
          scrollPerFrame,
          width,
          height,
          blockOptions.scrollDirection || scrollDirection
        );

        const anim = applyAnimation(frameNum, slideFrames, blockAnimation.type, scrollPos.y);

        const textColorToUse = blockOptions.textColor || textColor;
        const fontSizeToUse = blockOptions.fontSize || fontSize;
        const fontFamilyToUse = blockOptions.fontFamily || fontFamily;

        for (let i = 0; i < textBlock.lines.length; i++) {
          const lineY = anim.y + i * lineHeight;
          if (lineY > -lineHeight && lineY < height) {
            frameCtx.save();
            if (anim.opacity !== 1) frameCtx.globalAlpha = anim.opacity;
            if (anim.scale !== 1) {
              frameCtx.translate(scrollPos.x, lineY);
              frameCtx.scale(anim.scale, anim.scale);
              frameCtx.translate(-scrollPos.x, -lineY);
            }
            drawTextWithEffects(frameCtx, textBlock.lines[i], scrollPos.x, lineY, {
              color: textColorToUse,
              fontSize: fontSizeToUse,
              fontFamily: fontFamilyToUse,
              bold: blockTextEffects.bold || false,
              italic: blockTextEffects.italic || false,
              underline: blockTextEffects.underline || false,
              outline: blockTextEffects.outline || null,
              shadow: blockTextEffects.shadow || null,
              gradient: blockTextEffects.gradient || null,
            });
            frameCtx.restore();
          }
        }
      }

      if (options.subtitles && options.subtitles.enabled) {
        await drawSubtitles(frameCtx, globalFrame, fps, options.subtitles, width, height);
      }

      // Encode frame as JPEG and pipe to ffmpeg
      const buffer = frameCanvas.toBufferSync('jpeg', { quality: 0.95 });
      await writeToStdinWithBackpressure(ff, buffer);

      globalFrame += 1;

      // Progress ~1/s
      const shouldReport =
        globalFrame === 1 ||
        globalFrame === totalFramesAllSlides ||
        globalFrame % progressEvery === 0;
      if (shouldReport) {
        const pct = Math.round((globalFrame / totalFramesAllSlides) * 100);
        sendProgress({
          type: 'frame',
          current: globalFrame,
          total: totalFramesAllSlides,
          progress: Math.max(0, Math.min(100, pct)),
          message: `Rendering frames... ${globalFrame}/${totalFramesAllSlides} (slide ${slideIndex + 1}/${slideConfigs.length})`,
        });
      }
    }
  }

  // Finish encoding
  if (ff && ff.stdin) ff.stdin.end();
  await new Promise((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (cancelled) return reject(new Error('Video generation cancelled'));
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg encode failed (code ${code})`));
    });
  });
  sendProgress({ type: 'encoding', progress: 100, message: 'Encoding complete.' });

  // Wait for audio
  const audioPath = shouldGenerateNarration ? await audioPromise : null;

  // Mix audio (optional)
  const durationSec = totalFramesAllSlides / fps;
  let finalTempPath = videoTmpPath;
  if ((shouldGenerateNarration && audioPath) || hasBgMusic || hasBgVoice) {
    const withAudioPath = path.join(tempDir, `${baseFileName}-with-audio.${String(exportFormat).toLowerCase()}`);
    await mixAllAudioSpawn({
      videoPath: videoTmpPath,
      exportFormat,
      durationSec,
      narrationPath: audioPath,
      bgMusicPath: hasBgMusic ? bgMusicOptions.path : null,
      bgMusic: bgMusicOptions,
      bgVoicePath: hasBgVoice ? bgVoiceOptions.path : null,
      bgVoice: bgVoiceOptions,
      outputPath: withAudioPath,
    });
    finalTempPath = withAudioPath;
  }

  // Copy to final output
  const finalOutPath = path.join(outDir, `${baseFileName}.${String(exportFormat).toLowerCase()}`);
  await fs.copyFile(finalTempPath, finalOutPath);

  // Cleanup (handled by caller finally as well)
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (_) {}
  currentTempDirPath = null;

  // Some advanced exports (GIF/thumbnail/sequence) are not implemented in streaming mode yet.
  if (exportGif || exportImageSequence || exportThumbnail) {
    sendProgress({
      type: 'info',
      message:
        'Note: GIF / image sequence / thumbnail exports are currently not generated in streaming mode.',
    });
  }

  return finalOutPath;
}

async function handleStart(options, paths) {
  cancelled = false;
  try {
    const out = await generateInWorker(options, paths);
    safeSendToParent({ type: 'done', outputPath: out });
  } catch (err) {
    if (cancelled) {
      safeSendToParent({ type: 'error', error: 'Video generation cancelled' });
      return;
    }
    safeSendToParent({ type: 'error', error: err && err.message ? err.message : String(err) });
  } finally {
    currentFfmpeg = null;
    // Always try to clean temp dir on exit/cancel/error.
    const p = currentTempDirPath;
    currentTempDirPath = null;
    if (p) {
      try {
        await fs.rm(p, { recursive: true, force: true });
      } catch (_) {
        // ignore
      }
    }
  }
}

function handleCancel() {
  cancelled = true;
  try {
    if (currentFfmpeg) {
      try {
        currentFfmpeg.kill('SIGKILL');
      } catch (_) {
        // ignore
      }
    }
    // Best-effort: cleanup with retries (Windows can hold file locks briefly after killing ffmpeg).
    const p = currentTempDirPath;
    if (p) {
      const start = Date.now();
      const tryCleanup = async () => {
        // Keep trying for ~30s, then give up (main process also runs a sweep).
        while (Date.now() - start < 30000) {
          try {
            await fs.rm(p, { recursive: true, force: true });
            break;
          } catch (_) {
            // wait a bit and retry
            await new Promise((r) => setTimeout(r, 750));
          }
        }
      };
      tryCleanup().catch(() => {});
    }
  } catch (_) {
    // ignore
  }
}

process.on('message', (msg) => {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'start') {
    handleStart(msg.options, msg.paths);
  } else if (msg.type === 'cancel') {
    handleCancel();
  } else if (msg.type === 'xtts-result') {
    // handled by awaiting promise listener in audio flow
  }
});

process.on('SIGINT', handleCancel);
process.on('SIGTERM', handleCancel);


