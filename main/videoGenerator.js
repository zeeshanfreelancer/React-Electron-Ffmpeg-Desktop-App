const { Canvas, loadImage } = require('skia-canvas');
const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
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

  // Create temp directory for frames
  const tempDir = path.join(app.getPath('temp'), 'scrolling-video-frames');
  await fs.mkdir(tempDir, { recursive: true });

  try {
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
    const outputPath = path.join(app.getPath('desktop'), `scrolling-video-${Date.now()}.mp4`);

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
        .output(outputPath)
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
          resolve(outputPath);
        })
        .on('error', (err) => {
          reject(new Error(`FFmpeg error: ${err.message}`));
        })
        .run();
    });

    // Clean up temp directory
    await cleanupTempDirectory(tempDir);

    return outputPath;
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
    const files = await fs.readdir(dirPath);
    await Promise.all(files.map(file => fs.unlink(path.join(dirPath, file))));
    await fs.rmdir(dirPath);
    console.log('Cleaned up temporary directory:', dirPath);
  } catch (error) {
    console.error('Error cleaning up temp directory:', error);
  }
}

module.exports = {
  generateScrollingVideo,
};

