const { Canvas, loadImage } = require('skia-canvas');
const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const gTTS = require('gtts');
const { app } = require('electron');

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Generate a scrolling text video from an image and text
 * @param {Object} options - Configuration options
 * @param {string} options.imagePath - Path to background image
 * @param {string} options.text - Text content to scroll
 * @param {number} options.width - Video width in pixels
 * @param {number} options.height - Video height in pixels
 * @param {number} options.scrollSpeed - Scroll speed in pixels per second
 * @param {string} options.textColor - Text color (CSS format)
 * @param {number} options.fontSize - Font size in pixels
 * @param {string} options.fontFamily - Font family name
 * @param {number} options.fps - Frames per second (default: 30)
 * @param {Function} progressCallback - Progress callback function
 * @returns {Promise<string>} Path to the generated video
 */
async function generateScrollingVideo(options, progressCallback) {
  const {
    imagePath,
    text,
    width,
    height,
    scrollSpeed,
    textColor,
    fontSize,
    fontFamily,
    fps = 30,
  } = options;

  // Create unique temp directory for frames and assets
  const tempDirPrefix = path.join(app.getPath('temp'), 'scrolling-video-');
  const tempDir = await fs.mkdtemp(tempDirPrefix);

  try {
    const narrationOptions = options.narration || {};
    const shouldGenerateNarration =
      Boolean(narrationOptions.enabled) &&
      Boolean(narrationOptions.text && narrationOptions.text.trim().length > 0);
    const narrationLanguage = narrationOptions.language || 'en';
    let narrationAudioPath = null;

    if (shouldGenerateNarration) {
      narrationAudioPath = await generateNarrationAudio(
        narrationOptions.text.trim(),
        narrationLanguage,
        tempDir,
        progressCallback
      );
    }

    // Load the background image
    const bgImage = await loadImage(imagePath);
    
    // Create canvas
    const canvas = new Canvas(width, height);
    const ctx = canvas.getContext('2d');

    // Set font
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Calculate text dimensions with word wrapping
    const maxWidth = width - 100; // 50px padding on each side
    const lineHeight = fontSize * 1.5;
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    // Calculate total text height
    const textHeight = lines.length * lineHeight;
    
    // Calculate total scroll distance
    // Text should scroll from bottom of screen to top (completely off screen)
    const totalScrollDistance = height + textHeight;
    
    // Calculate scroll distance per frame
    const scrollPerFrame = scrollSpeed / fps;
    
    // Calculate total number of frames
    const totalFrames = Math.ceil(totalScrollDistance / scrollPerFrame);

    // Generate frames
    for (let frameNum = 0; frameNum < totalFrames; frameNum++) {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw background image (scaled to fit)
      const scale = Math.max(width / bgImage.width, height / bgImage.height);
      const scaledWidth = bgImage.width * scale;
      const scaledHeight = bgImage.height * scale;
      const x = (width - scaledWidth) / 2;
      const y = (height - scaledHeight) / 2;
      ctx.drawImage(bgImage, x, y, scaledWidth, scaledHeight);

      // Add semi-transparent overlay for better text readability
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, width, height);

      // Calculate current text position
      // Start from bottom of screen and move upward
      const currentOffset = frameNum * scrollPerFrame;
      const textStartY = height - currentOffset;

      // Draw text lines
      ctx.fillStyle = textColor;
      ctx.font = `${fontSize}px ${fontFamily}`;
      
      for (let i = 0; i < lines.length; i++) {
        const lineY = textStartY + (i * lineHeight);
        
        // Only draw lines that are visible on screen
        if (lineY > -lineHeight && lineY < height) {
          ctx.fillText(lines[i], width / 2, lineY);
        }
      }

      // Save frame as PNG
      const frameFileName = `frame${String(frameNum).padStart(6, '0')}.png`;
      const frameFilePath = path.join(tempDir, frameFileName);
      const buffer = canvas.toBufferSync('png');
      await fs.writeFile(frameFilePath, buffer);

      // Report progress
      if (progressCallback) {
        const progress = ((frameNum + 1) / totalFrames) * 100;
        progressCallback({
          type: 'frame',
          current: frameNum + 1,
          total: totalFrames,
          progress: Math.round(progress),
        });
      }
    }

    // Generate video using ffmpeg
    const timestamp = Date.now();
    const finalOutputPath = path.join(app.getPath('desktop'), `scrolling-video-${timestamp}.mp4`);
    const videoOutputPath = shouldGenerateNarration
      ? path.join(tempDir, `scrolling-video-${timestamp}-video.mp4`)
      : finalOutputPath;

    await new Promise((resolve, reject) => {
      if (progressCallback) {
        progressCallback({
          type: 'encoding',
          progress: 0,
          message: 'Encoding video...',
        });
      }

      ffmpeg()
        .input(path.join(tempDir, 'frame%06d.png'))
        .inputFPS(fps)
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-preset fast',
          '-crf 18',
        ])
        .output(videoOutputPath)
        .on('start', (cmd) => {
          console.log('FFmpeg command:', cmd);
        })
        .on('progress', (progress) => {
          if (progressCallback && progress.percent) {
            progressCallback({
              type: 'encoding',
              progress: Math.round(progress.percent),
              message: 'Encoding video...',
            });
          }
        })
        .on('end', () => {
          resolve(videoOutputPath);
        })
        .on('error', (err) => {
          reject(new Error(`FFmpeg error: ${err.message}`));
        })
        .run();
    });

    if (shouldGenerateNarration && narrationAudioPath) {
      await mixAudioWithVideo(videoOutputPath, narrationAudioPath, finalOutputPath, progressCallback);
      try {
        await fs.unlink(videoOutputPath);
      } catch (unlinkError) {
        console.warn('Could not remove temp video file:', unlinkError.message);
      }
    }

    // Clean up temp directory
    await cleanupTempDirectory(tempDir);

    return finalOutputPath;
  } catch (error) {
    // Clean up temp directory on error
    await cleanupTempDirectory(tempDir);
    throw error;
  }
}

/**
 * Clean up temporary directory
 * @param {string} dirPath - Directory path to clean
 */
async function cleanupTempDirectory(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    console.log('Cleaned up temporary directory:', dirPath);
  } catch (error) {
    console.error('Error cleaning up temp directory:', error);
  }
}

/**
 * Check if an error is a retryable network error
 * @param {Error} error - The error to check
 * @returns {boolean} - True if the error is retryable
 */
function isRetryableNetworkError(error) {
  if (!error) return false;
  
  const errorMessage = error.message || '';
  const errorCode = error.code || '';
  
  const retryableErrors = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'socket hang up',
    'timeout',
    'network',
    'ECONNABORTED',
  ];
  
  return retryableErrors.some(
    retryableError =>
      errorMessage.includes(retryableError) ||
      errorCode.includes(retryableError)
  );
}

/**
 * Generate narration audio using Google TTS with retry logic
 * @param {string} text - narration script
 * @param {string} language - language/voice code
 * @param {string} tempDir - temp directory to store audio
 * @param {Function} progressCallback - progress notifier
 * @returns {Promise<string>} - path to the generated audio file
 */
async function generateNarrationAudio(text, language, tempDir, progressCallback) {
  if (progressCallback) {
    progressCallback({
      type: 'audio',
      message: 'Generating narration audio...',
    });
  }

  const audioPath = path.join(tempDir, `narration-${Date.now()}.mp3`);
  const maxRetries = 3;
  const retryDelay = 2000; // 2 seconds
  const requestTimeout = 30000; // 30 seconds

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        // Set a timeout for the request
        const timeout = setTimeout(() => {
          reject(new Error('Request timeout: Google TTS service did not respond in time'));
        }, requestTimeout);

        const tts = new gTTS(text, language);
        tts.save(audioPath, (err) => {
          clearTimeout(timeout);
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // Success - verify file was created
      try {
        await fs.access(audioPath);
      } catch (accessError) {
        throw new Error('Audio file was not created successfully');
      }

      if (progressCallback) {
        progressCallback({
          type: 'audio',
          message: 'Narration audio generated successfully.',
        });
      }
      return audioPath;

    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (isRetryableNetworkError(error) && attempt < maxRetries) {
        if (progressCallback) {
          progressCallback({
            type: 'audio',
            message: `Network error. Retrying (${attempt}/${maxRetries})...`,
          });
        }
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        continue;
      } else {
        // Final attempt failed or non-retryable error
        const errorMessage = lastError.message || 'Unknown error';
        throw new Error(
          `Failed to generate narration audio after ${attempt} attempt(s): ${errorMessage}. ` +
          `This may be due to network connectivity issues or Google TTS service unavailability. ` +
          `Please check your internet connection and try again.`
        );
      }
    }
  }

  // This should never be reached, but TypeScript/ESLint might complain
  throw lastError || new Error('Failed to generate narration audio');
}

/**
 * Combine narration audio with generated video
 * @param {string} videoPath - silent video path
 * @param {string} audioPath - narration audio path
 * @param {string} outputPath - final output path with audio
 * @param {Function} progressCallback - progress notifier
 */
async function mixAudioWithVideo(videoPath, audioPath, outputPath, progressCallback) {
  if (progressCallback) {
    progressCallback({
      type: 'audio-mix',
      message: 'Mixing narration audio with video...',
    });
  }

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .input(audioPath)
      .complexFilter('[1:a]apad[aout]')
      .outputOptions([
        '-map 0:v:0',
        '-map [aout]',
        '-c:v copy',
        '-c:a aac',
        '-b:a 192k',
        '-shortest',
      ])
      .output(outputPath)
      .on('end', () => {
        if (progressCallback) {
          progressCallback({
            type: 'audio-mix',
            message: 'Audio mix complete.',
          });
        }
        resolve();
      })
      .on('error', (err) => {
        reject(new Error(`FFmpeg audio mix error: ${err.message}`));
      })
      .run();
  });
}

module.exports = {
  generateScrollingVideo,
};

