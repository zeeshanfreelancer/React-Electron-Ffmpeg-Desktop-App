const { Canvas, loadImage } = require('skia-canvas');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { app } = require('electron');

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
    shakeMagnitude = 3,
    zoomMagnitude = 0.05,
    panMagnitude = 30,
  } = options;

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

  for (let i = 0; i < imageFiles.length; i += batchSize) {
    if (shouldCancel && shouldCancel()) {
      throw new Error('Video generation cancelled');
    }

    const batch = imageFiles.slice(i, i + batchSize);
    totalVideos++;
    const batchNum = Math.floor(i / batchSize) + 1;

    if (progressCallback) {
      progressCallback({
        type: 'batch',
        progress: (batchNum / totalBatches) * 100,
        message: `Creating Video ${totalVideos} with ${batch.length} images...`,
        current: batchNum,
        total: totalBatches,
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
      shakeMagnitude,
      zoomMagnitude,
      panMagnitude,
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
  progressCallback,
  shouldCancel
) {
  const tempDirPrefix = path.join(app.getPath('temp'), 'panzoom-video-');
  const tempDir = await fs.mkdtemp(tempDirPrefix);

  try {
    const totalFrames = Math.ceil(imageDuration * fps);
    let frameIndex = 0;
    const totalFramesToGenerate = imagePaths.length * totalFrames;

    // Process each image
    for (let imgIndex = 0; imgIndex < imagePaths.length; imgIndex++) {
      const imagePath = imagePaths[imgIndex];
      
      // Load image once per image (not per frame)
      const image = await loadImage(imagePath);
      const imgWidth = image.width;
      const imgHeight = image.height;

      // Calculate base scale
      const baseScaleX = videoWidth / imgWidth;
      const baseScaleY = videoHeight / imgHeight;
      const baseScale = Math.max(baseScaleX, baseScaleY);
      const maxZoom = 1 + zoomMagnitude;
      const scale = baseScale * maxZoom * 1.2;

      const scaledWidth = imgWidth * scale;
      const scaledHeight = imgHeight * scale;

      // Generate frames for this image
      const framePromises = [];
      const batchSize = 10; // Process frames in batches

      for (let frame = 0; frame < totalFrames; frame++) {
        if (shouldCancel && shouldCancel()) {
          throw new Error('Video generation cancelled');
        }

        const t = frame / fps;
        const currentFrameIndex = frameIndex;

        // Generate frame asynchronously
        const framePromise = (async () => {
          // Calculate effects
          const zoom = 1 + zoomMagnitude * Math.sin(2 * Math.PI * t / imageDuration);
          const panX = panMagnitude * Math.sin(2 * Math.PI * t / imageDuration);
          const panY = panMagnitude * Math.cos(2 * Math.PI * t / imageDuration);
          const shakeX = (Math.random() * 2 - 1) * shakeMagnitude;
          const shakeY = (Math.random() * 2 - 1) * shakeMagnitude;

          const currentScaledWidth = scaledWidth * zoom;
          const currentScaledHeight = scaledHeight * zoom;
          const centerX = currentScaledWidth / 2;
          const centerY = currentScaledHeight / 2;
          const offsetX = panX + shakeX;
          const offsetY = panY + shakeY;
          
          const x1 = Math.max(0, Math.min(centerX - videoWidth / 2 + offsetX, currentScaledWidth - videoWidth));
          const y1 = Math.max(0, Math.min(centerY - videoHeight / 2 + offsetY, currentScaledHeight - videoHeight));

          // Create canvas and draw
          const canvas = new Canvas(videoWidth, videoHeight);
          const ctx = canvas.getContext('2d');
          ctx.save();
          ctx.translate(-x1, -y1);
          ctx.drawImage(image, 0, 0, currentScaledWidth, currentScaledHeight);
          ctx.restore();

          // Save as JPEG (much faster than PNG)
          const frameFileName = `frame${String(currentFrameIndex).padStart(6, '0')}.jpg`;
          const framePath = path.join(tempDir, frameFileName);
          const buffer = canvas.toBufferSync('jpeg', { quality: 0.95 }); // High quality JPEG
          await fs.writeFile(framePath, buffer);
        })();

        framePromises.push(framePromise);
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

        // Process in batches to avoid memory issues
        if (framePromises.length >= batchSize || frame === totalFrames - 1) {
          await Promise.all(framePromises);
          framePromises.length = 0;
        }
      }
    }

    // Encode video from JPEG frames
    if (progressCallback) {
      progressCallback({
        type: 'encoding',
        progress: 85,
        message: `Encoding video from ${frameIndex} frames...`,
      });
    }

    await encodeVideo(tempDir, outputPath, fps, frameIndex);

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

