const { Canvas, loadImage } = require('skia-canvas');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { app } = require('electron');

// Import ffprobe for getting video duration
ffmpeg.setFfprobePath(ffmpegPath.replace('ffmpeg', 'ffprobe'));

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Generate pan/zoom/shake video from images
 * Similar to the Python MoviePy implementation
 */
async function generatePanZoomVideo(options, progressCallback, shouldCancel) {
  const {
    imageFolder,
    outputFolder,
    videoWidth = 720,
    videoHeight = 1280,
    fps = 24,
    imageDuration = 3.2,
    batchSize = 5,
    maxVideos = 0, // 0 means create all possible videos
    shakeMagnitude = 3,
    zoomMagnitude = 0.05,
    panMagnitude = 30,
    backgroundMusic = null,
    transition = null, // { type, duration }
    effectPreset = 'custom', // custom, none, smooth, cinematic, shake, zoom, pan
  } = options;

  // Resolve effect preset -> magnitudes (Effect Generator tab uses this)
  const presetMap = {
    none: { shakeMagnitude: 0, zoomMagnitude: 0, panMagnitude: 0 },
    smooth: { shakeMagnitude: 1, zoomMagnitude: 0.03, panMagnitude: 15 },
    cinematic: { shakeMagnitude: 0.5, zoomMagnitude: 0.05, panMagnitude: 20 },
    shake: { shakeMagnitude: 5, zoomMagnitude: 0.02, panMagnitude: 10 },
    zoom: { shakeMagnitude: 0, zoomMagnitude: 0.08, panMagnitude: 0 },
    pan: { shakeMagnitude: 0, zoomMagnitude: 0.02, panMagnitude: 40 },
  };

  const resolvedMagnitudes = presetMap[effectPreset] || null;
  const resolvedShake = resolvedMagnitudes ? resolvedMagnitudes.shakeMagnitude : shakeMagnitude;
  const resolvedZoom = resolvedMagnitudes ? resolvedMagnitudes.zoomMagnitude : zoomMagnitude;
  const resolvedPan = resolvedMagnitudes ? resolvedMagnitudes.panMagnitude : panMagnitude;

  const resolvedTransition = transition && typeof transition === 'object' ? transition : { type: 'none', duration: 0 };

  // Validate inputs
  if (!imageFolder || !outputFolder) {
    throw new Error('Image folder and output folder are required');
  }

  // Ensure output folder exists
  await fs.mkdir(outputFolder, { recursive: true });

  // Get all images from folder
  const files = await fs.readdir(imageFolder);
  const imageFiles = files
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    .map(f => path.join(imageFolder, f));

  if (imageFiles.length === 0) {
    throw new Error('No images found in the selected folder');
  }

  // Shuffle images randomly
  shuffleArray(imageFiles);

  // Process in batches
  let totalVideos = 0;
  const totalBatches = Math.ceil(imageFiles.length / batchSize);
  
  // Limit the number of videos if maxVideos is set
  const videosToCreate = maxVideos > 0 ? Math.min(maxVideos, totalBatches) : totalBatches;

  for (let i = 0; i < imageFiles.length && totalVideos < videosToCreate; i += batchSize) {
    if (shouldCancel && shouldCancel()) {
      throw new Error('Video generation cancelled');
    }

    const batch = imageFiles.slice(i, i + batchSize);
    totalVideos++;
    const batchNum = totalVideos;

    if (progressCallback) {
      progressCallback({
        type: 'batch',
        progress: (batchNum / videosToCreate) * 100,
        message: `Creating Video ${totalVideos} of ${videosToCreate} with ${batch.length} images...`,
        current: batchNum,
        total: videosToCreate,
      });
    }

    const outputPath = path.join(outputFolder, `Video_${totalVideos}.mp4`);
    await createVideoFromImages(
      batch,
      outputPath,
      videoWidth,
      videoHeight,
      fps,
      imageDuration,
      resolvedShake,
      resolvedZoom,
      resolvedPan,
      resolvedTransition,
      backgroundMusic,
      progressCallback,
      shouldCancel
    );
  }

  return {
    success: true,
    totalVideos,
    outputFolder,
  };
}

/**
 * Create a video from a batch of images with pan/zoom/shake effects
 * Optimized version: uses JPEG frames instead of PNG for faster I/O
 */
async function createVideoFromImages(
  imagePaths,
  outputPath,
  videoWidth,
  videoHeight,
  fps,
  imageDuration,
  shakeMagnitude,
  zoomMagnitude,
  panMagnitude,
  transition,
  backgroundMusic,
  progressCallback,
  shouldCancel
) {
  const tempDirPrefix = path.join(app.getPath('temp'), 'panzoom-video-');
  const tempDir = await fs.mkdtemp(tempDirPrefix);

  try {
    const totalFrames = Math.ceil(imageDuration * fps);
    let frameIndex = 0;
    
    // Transition config (applied between images within a video)
    const transitionType = transition && transition.type ? String(transition.type) : 'none';
    const transitionDuration = transition && typeof transition.duration === 'number' ? transition.duration : parseFloat(transition?.duration || 0);
    const transitionFramesRaw = Math.ceil((Number.isFinite(transitionDuration) ? transitionDuration : 0) * fps);
    const transitionFrames =
      transitionType === 'none'
        ? 0
        : Math.max(0, Math.min(transitionFramesRaw, Math.max(0, totalFrames - 1)));

    // For overlap transitions (crossfade/slide/wipe) we skip the first transitionFrames of every image after the first
    const totalFramesToGenerate =
      imagePaths.length * totalFrames - (imagePaths.length > 1 ? (imagePaths.length - 1) * transitionFrames : 0);

    const seededRandom01 = (seed) => {
      // Deterministic 0..1 pseudo-random from a numeric seed
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    const easeInOutCubic = (x) =>
      x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

    const drawImageWithEffects = (ctx, image, t, seedBase, extraTransform) => {
      const imgWidth = image.width;
      const imgHeight = image.height;

      // Calculate base scale to fit image to video dimensions
      const baseScaleX = videoWidth / imgWidth;
      const baseScaleY = videoHeight / imgHeight;
      const baseScale = Math.max(baseScaleX, baseScaleY);

      // Add padding to allow pan and zoom
      const panPadding = Math.max((panMagnitude * 2) / Math.min(videoWidth, videoHeight), 0.05);
      const scale = baseScale * (1 + panPadding * 0.3 + zoomMagnitude * 0.2);

      const scaledWidth = imgWidth * scale;
      const scaledHeight = imgHeight * scale;

      // Compute effects
      const zoom = 1 + zoomMagnitude * Math.sin((2 * Math.PI * t) / imageDuration);
      const panX = panMagnitude * Math.sin((2 * Math.PI * t) / imageDuration);
      const panY = panMagnitude * Math.cos((2 * Math.PI * t) / imageDuration);

      // Deterministic shake per-frame
      const shakeX = (seededRandom01(seedBase + t * 1000 + 1) * 2 - 1) * shakeMagnitude;
      const shakeY = (seededRandom01(seedBase + t * 1000 + 2) * 2 - 1) * shakeMagnitude;

      const currentScaledWidth = scaledWidth * zoom;
      const currentScaledHeight = scaledHeight * zoom;

      // Center and crop
      const centerX = currentScaledWidth / 2;
      const centerY = currentScaledHeight / 2;
      const cropX = centerX - videoWidth / 2 + panX + shakeX;
      const cropY = centerY - videoHeight / 2 + panY + shakeY;
      const x1 = Math.max(0, Math.min(cropX, currentScaledWidth - videoWidth));
      const y1 = Math.max(0, Math.min(cropY, currentScaledHeight - videoHeight));

      ctx.save();
      if (extraTransform && (extraTransform.dx || extraTransform.dy)) {
        ctx.translate(extraTransform.dx || 0, extraTransform.dy || 0);
      }
      ctx.translate(-x1, -y1);
      ctx.drawImage(image, 0, 0, currentScaledWidth, currentScaledHeight);
      ctx.restore();
    };

    // Process each image
    for (let imgIndex = 0; imgIndex < imagePaths.length; imgIndex++) {
      const imagePath = imagePaths[imgIndex];
      
      // Load image once per image (not per frame)
      const image = await loadImage(imagePath);
      const nextImage = (transitionFrames > 0 && imgIndex < imagePaths.length - 1)
        ? await loadImage(imagePaths[imgIndex + 1])
        : null;

      // Generate frames sequentially with frequent yields to keep the Electron UI responsive.
      // The previous "batch Promise.all" approach still executed most work synchronously before the first await,
      // which can make the app feel frozen on lower-core machines.
      const frameStart = imgIndex === 0 ? 0 : transitionFrames;
      for (let frame = frameStart; frame < totalFrames; frame++) {
        if (shouldCancel && shouldCancel()) {
          throw new Error('Video generation cancelled');
        }

        // Yield before heavy sync operations (canvas draw + toBufferSync)
        await new Promise((resolve) => setImmediate(resolve));

        const t = frame / fps;
        const currentFrameIndex = frameIndex;
        const isInTransition =
          transitionFrames > 0 &&
          imgIndex < imagePaths.length - 1 &&
          frame >= (totalFrames - transitionFrames);
        const rawProgress = isInTransition ? (frame - (totalFrames - transitionFrames)) / transitionFrames : 0;
        const p = isInTransition ? easeInOutCubic(Math.min(1, Math.max(0, rawProgress))) : 0;

          const canvas = new Canvas(videoWidth, videoHeight);
          const ctx = canvas.getContext('2d');

          // Black background
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, videoWidth, videoHeight);

          if (!isInTransition || transitionType === 'none' || !nextImage) {
            drawImageWithEffects(ctx, image, t, imgIndex * 100000 + frame, null);
          } else {
            // Draw current image
            if (transitionType === 'crossfade') {
              ctx.save();
              ctx.globalAlpha = 1 - p;
              drawImageWithEffects(ctx, image, t, imgIndex * 100000 + frame, null);
              ctx.restore();

              ctx.save();
              ctx.globalAlpha = p;
              const t2 = (frame - (totalFrames - transitionFrames)) / fps;
              drawImageWithEffects(ctx, nextImage, t2, (imgIndex + 1) * 100000 + frame, null);
              ctx.restore();
            } else if (transitionType === 'slide-left' || transitionType === 'slide-right') {
              drawImageWithEffects(ctx, image, t, imgIndex * 100000 + frame, null);
              const t2 = (frame - (totalFrames - transitionFrames)) / fps;
              const dx = (transitionType === 'slide-left' ? 1 : -1) * (1 - p) * videoWidth;
              drawImageWithEffects(ctx, nextImage, t2, (imgIndex + 1) * 100000 + frame, { dx, dy: 0 });
            } else if (transitionType.startsWith('wipe-')) {
              drawImageWithEffects(ctx, image, t, imgIndex * 100000 + frame, null);
              const t2 = (frame - (totalFrames - transitionFrames)) / fps;

              ctx.save();
              if (transitionType === 'wipe-left') {
                ctx.beginPath();
                ctx.rect(0, 0, p * videoWidth, videoHeight);
                ctx.clip();
              } else if (transitionType === 'wipe-right') {
                const w = p * videoWidth;
                ctx.beginPath();
                ctx.rect(videoWidth - w, 0, w, videoHeight);
                ctx.clip();
              } else if (transitionType === 'wipe-up') {
                const h = p * videoHeight;
                ctx.beginPath();
                ctx.rect(0, videoHeight - h, videoWidth, h);
                ctx.clip();
              } else if (transitionType === 'wipe-down') {
                const h = p * videoHeight;
                ctx.beginPath();
                ctx.rect(0, 0, videoWidth, h);
                ctx.clip();
              }
              drawImageWithEffects(ctx, nextImage, t2, (imgIndex + 1) * 100000 + frame, null);
              ctx.restore();
            } else {
              // Unknown transition type => fallback to crossfade
              ctx.save();
              ctx.globalAlpha = 1 - p;
              drawImageWithEffects(ctx, image, t, imgIndex * 100000 + frame, null);
              ctx.restore();
              ctx.save();
              ctx.globalAlpha = p;
              const t2 = (frame - (totalFrames - transitionFrames)) / fps;
              drawImageWithEffects(ctx, nextImage, t2, (imgIndex + 1) * 100000 + frame, null);
              ctx.restore();
            }
          }

          // Save as JPEG (much faster than PNG)
          const frameFileName = `frame${String(currentFrameIndex).padStart(6, '0')}.jpg`;
          const framePath = path.join(tempDir, frameFileName);
          const buffer = canvas.toBufferSync('jpeg', { quality: 0.95 }); // High quality JPEG
          await fs.writeFile(framePath, buffer);

        frameIndex++;

        // Update progress periodically
        if (progressCallback && frameIndex % Math.ceil(fps) === 0) {
          const progress = (frameIndex / totalFramesToGenerate) * 80;
          progressCallback({
            type: 'frame',
            progress: progress,
            message: `Processing image ${imgIndex + 1}/${imagePaths.length}, frame ${frame + 1}/${totalFrames}`,
            current: frameIndex,
            total: totalFramesToGenerate,
          });
        }
      }
    }

    // Encode video from JPEG frames (without audio first)
    if (progressCallback) {
      progressCallback({
        type: 'encoding',
        progress: 85,
        message: `Encoding video from ${frameIndex} frames...`,
      });
    }

    const videoWithoutAudio = path.join(tempDir, 'video-no-audio.mp4');
    await encodeVideo(tempDir, videoWithoutAudio, fps, frameIndex);

    // Mix audio if background music is provided
    let finalVideoPath = videoWithoutAudio;
    if (backgroundMusic && backgroundMusic.path) {
      if (progressCallback) {
        progressCallback({
          type: 'audio-mix',
          progress: 95,
          message: 'Mixing audio with video...',
        });
      }

      finalVideoPath = outputPath;
      await mixAudioWithVideo(
        videoWithoutAudio,
        backgroundMusic.path,
        backgroundMusic.volume || 0.5,
        backgroundMusic.fadeIn || 0,
        backgroundMusic.fadeOut || 0,
        finalVideoPath,
        progressCallback
      );
      
      // Clean up temporary video file
      await fs.unlink(videoWithoutAudio).catch(() => {});
    } else {
      // No audio, just move the video to final location
      await fs.copyFile(videoWithoutAudio, outputPath);
      await fs.unlink(videoWithoutAudio).catch(() => {});
    }

    // Verify video file was created
    try {
      const stats = await fs.stat(outputPath);
      if (stats.size === 0) {
        throw new Error('Video file was created but is empty');
      }
      console.log(`Video created successfully: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    } catch (statError) {
      throw new Error(`Video file was not created: ${statError.message}`);
    }

    // Cleanup temp directory
    await cleanupTempDir(tempDir);

    if (progressCallback) {
      progressCallback({
        type: 'done',
        progress: 100,
        message: `Video created: ${path.basename(outputPath)}`,
      });
    }
  } catch (error) {
    // Cleanup on error
    try {
      await cleanupTempDir(tempDir);
    } catch (cleanupError) {
      console.error('Error cleaning up temp directory:', cleanupError);
    }
    throw error;
  }
}

/**
 * Create a video segment from a single image with pan/zoom/shake effects using FFmpeg filters
 * Uses zoompan filter for efficient processing (similar to MoviePy)
 */
async function createImageSegment(
  imagePath,
  outputPath,
  videoWidth,
  videoHeight,
  fps,
  duration,
  shakeMagnitude,
  zoomMagnitude,
  panMagnitude,
  shouldCancel
) {
  return new Promise((resolve, reject) => {
    const totalFrames = Math.ceil(duration * fps);
    
    // Calculate scale factor - image needs to be larger to allow zoom and pan
    const maxZoom = 1 + zoomMagnitude;
    const scaleFactor = maxZoom * 1.3; // Extra room for pan movement

    // Shake seed for pseudo-randomness
    const shakeSeed = Math.floor(Math.random() * 1000);

    // FFmpeg zoompan filter - test with minimal complexity first
    // Using basic expressions that FFmpeg can parse reliably
    const zoomExpr = `1+${zoomMagnitude}*sin(2*PI*n/${totalFrames})`;
    
    // Simplified pan/shake - combine into single expressions
    const panShakeX = `${panMagnitude}*sin(2*PI*n/${totalFrames})+${shakeMagnitude}*sin(2*PI*(${shakeSeed}+n)/${totalFrames})`;
    const panShakeY = `${panMagnitude}*cos(2*PI*n/${totalFrames})+${shakeMagnitude}*cos(2*PI*(${shakeSeed}+n)/${totalFrames})`;
    
    // x, y positions - simplified calculation
    // Center position: iw/2 - (output_width/2)/zoom_factor + offset
    // Using: iw/2 - output_width/(2*zoom) + offset
    const halfOutputW = videoWidth / 2;
    const halfOutputH = videoHeight / 2;
    const xExpr = `iw/2-${halfOutputW}/${zoomExpr}+${panShakeX}`;
    const yExpr = `ih/2-${halfOutputH}/${zoomExpr}+${panShakeY}`;

    // Build zoompan filter
    const zoompanFilter = `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=${totalFrames}:s=${videoWidth}x${videoHeight}`;

    const command = ffmpeg()
      .input(imagePath)
      .inputOptions([
        '-loop', '1',
        '-framerate', fps.toString(),
        '-t', duration.toString(),
      ])
      .videoFilters([
        `scale=iw*${scaleFactor}:ih*${scaleFactor}:flags=lanczos`, // Scale up first
        zoompanFilter, // Apply zoom, pan, and crop
      ])
      .outputOptions([
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-preset fast',
        `-threads ${os.cpus().length}`,
        '-r', fps.toString(),
        '-crf 23',
        '-y', // Overwrite output file
      ])
      .output(outputPath)
      .on('start', (cmd) => {
        console.log(`Creating segment: ${path.basename(imagePath)}`);
      })
      .on('error', (err, stdout, stderr) => {
        console.error(`FFmpeg error for segment ${imagePath}:`, err.message);
        if (stderr) {
          console.error('FFmpeg stderr:', stderr);
        }
        reject(new Error(`Failed to create segment: ${err.message}`));
      })
      .on('end', () => {
        resolve();
      });

    command.run();
  });
}

/**
 * Concatenate video segments using FFmpeg concat demuxer
 */
async function concatenateSegments(concatFile, outputPath, fps) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg()
      .input(concatFile)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions([
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-preset fast',
        `-threads ${os.cpus().length}`,
        '-movflags +faststart',
        '-crf 23',
        '-r', fps.toString(),
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('Concatenating segments:', commandLine);
      })
      .on('progress', (progress) => {
        if (progress.percent !== undefined && !isNaN(progress.percent)) {
          const clampedPercent = Math.min(100, Math.max(0, progress.percent));
          console.log(`Concatenation progress: ${clampedPercent.toFixed(2)}%`);
        }
      })
      .on('end', () => {
        console.log('Video concatenation completed');
        resolve();
      })
      .on('error', (err, stdout, stderr) => {
        console.error('FFmpeg concatenation error:', err.message);
        if (stderr) console.error('Stderr:', stderr);
        reject(new Error(`Failed to concatenate segments: ${err.message}`));
      });

    command.run();
  });
}

/**
 * Encode frames into video using FFmpeg
 */
async function encodeVideo(tempDir, outputPath, fps, totalFrames) {
  return new Promise((resolve, reject) => {
    // Use start_number to tell FFmpeg frames start from 000000
    // Changed to .jpg extension for JPEG frames
    const command = ffmpeg()
      .input(path.join(tempDir, 'frame%06d.jpg'))
      .inputOptions([
        '-start_number', '0', // Tell FFmpeg frames start from frame000000.jpg
        '-framerate', fps.toString(),
      ])
      .outputOptions([
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-preset fast',
        `-threads ${os.cpus().length}`,
        '-movflags +faststart',
        '-crf 23',
        '-r', fps.toString(), // Output frame rate
        '-vsync', 'cfr', // Constant frame rate
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
        console.log(`Encoding ${totalFrames} frames at ${fps} fps`);
      })
      .on('progress', (progress) => {
        if (progress.percent !== undefined && !isNaN(progress.percent)) {
          const clampedPercent = Math.min(100, Math.max(0, progress.percent));
          console.log(`Encoding progress: ${clampedPercent.toFixed(2)}%`);
        }
      })
      .on('end', () => {
        console.log('Video encoding completed successfully');
        resolve();
      })
      .on('error', (err, stdout, stderr) => {
        console.error('FFmpeg error:', err.message);
        if (stderr) {
          console.error('FFmpeg stderr:', stderr);
        }
        if (stdout) {
          console.error('FFmpeg stdout:', stdout);
        }
        reject(new Error(`FFmpeg encoding error: ${err.message}`));
      });

    command.run();
  });
}

/**
 * Mix audio with video using FFmpeg
 */
async function mixAudioWithVideo(
  videoPath,
  audioPath,
  volume,
  fadeIn,
  fadeOut,
  outputPath,
  progressCallback
) {
  return new Promise((resolve, reject) => {
    // Get video duration for fade out timing
    const getVideoDuration = () => {
      return new Promise((resolveDuration, rejectDuration) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
          if (err) {
            rejectDuration(err);
          } else {
            resolveDuration(metadata.format.duration || 0);
          }
        });
      });
    };

    getVideoDuration().then((videoDuration) => {
      const command = ffmpeg()
        .input(videoPath)
        .input(audioPath);

      let audioFilters = [];
      let musicFilter = '[1:a]';

      // Apply volume if needed
      if (volume !== 1) {
        musicFilter += `volume=${volume}`;
      }

      // Apply fade in
      if (fadeIn > 0) {
        if (musicFilter !== '[1:a]') musicFilter += ',';
        musicFilter += `afade=t=in:st=0:d=${fadeIn}`;
      }

      // Apply fade out
      if (fadeOut > 0 && videoDuration > 0) {
        const fadeOutStart = Math.max(0, videoDuration - fadeOut);
        if (musicFilter !== '[1:a]' && !musicFilter.includes('afade')) musicFilter += ',';
        musicFilter += `afade=t=out:st=${fadeOutStart}:d=${fadeOut}`;
      }

      musicFilter += '[aout]';
      audioFilters.push(musicFilter);

      command
        .complexFilter(audioFilters)
        .outputOptions([
          '-map', '0:v:0',
          '-map', '[aout]',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-shortest',
          '-y',
        ])
        .output(outputPath)
        .on('end', () => {
          resolve();
        })
        .on('error', (err) => {
          reject(new Error(`FFmpeg audio mix error: ${err.message}`));
        })
        .run();
    }).catch((err) => {
      // If duration detection fails, proceed without fade out
      const command = ffmpeg()
        .input(videoPath)
        .input(audioPath);

      let audioFilters = [];
      let musicFilter = '[1:a]';

      if (volume !== 1) {
        musicFilter += `volume=${volume}`;
      }

      if (fadeIn > 0) {
        if (musicFilter !== '[1:a]') musicFilter += ',';
        musicFilter += `afade=t=in:st=0:d=${fadeIn}`;
      }

      musicFilter += '[aout]';
      audioFilters.push(musicFilter);

      command
        .complexFilter(audioFilters)
        .outputOptions([
          '-map', '0:v:0',
          '-map', '[aout]',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-shortest',
          '-y',
        ])
        .output(outputPath)
        .on('end', () => {
          resolve();
        })
        .on('error', (err) => {
          reject(new Error(`FFmpeg audio mix error: ${err.message}`));
        })
        .run();
    });
  });
}

/**
 * Clean up temporary directory
 */
async function cleanupTempDir(tempDir) {
  try {
    const files = await fs.readdir(tempDir);
    await Promise.all(files.map(file => fs.unlink(path.join(tempDir, file))));
    await fs.rmdir(tempDir);
  } catch (error) {
    console.error('Error cleaning up temp directory:', error);
  }
}

/**
 * Shuffle array randomly (Fisher-Yates algorithm)
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

module.exports = {
  generatePanZoomVideo,
};

