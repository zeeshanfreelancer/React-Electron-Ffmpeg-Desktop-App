const { Canvas, loadImage } = require('skia-canvas');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const gTTS = require('gtts');
const { app } = require('electron');

ffmpeg.setFfmpegPath(ffmpegPath);

// Helper: Parse color hex/rgb/rgba to rgba values
function parseColor(color) {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  // Basic rgba() parsing
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (match) {
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3]),
      a: match[4] ? parseFloat(match[4]) : 1,
    };
  }
  return { r: 255, g: 255, b: 255, a: 1 };
}

// Helper: Apply color filter to image data
function applyColorFilter(imageData, filter) {
  if (!filter || filter === 'none') return imageData;
  // Note: Actual imageData manipulation would require getting pixel data
  // For now, we'll apply filters during canvas drawing
  return imageData;
}

// Helper: Create gradient
function createGradient(ctx, x1, y1, x2, y2, colors) {
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  if (Array.isArray(colors)) {
    colors.forEach((color, index) => {
      gradient.addColorStop(index / (colors.length - 1), color);
    });
  }
  return gradient;
}

// Helper: Apply text shadow
function applyTextShadow(ctx, shadow) {
  if (!shadow || !shadow.enabled) return;
  ctx.shadowColor = shadow.color || 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = shadow.blur || 10;
  ctx.shadowOffsetX = shadow.offsetX || 0;
  ctx.shadowOffsetY = shadow.offsetY || 2;
}

// Helper: Draw text with effects
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

  // Build font string
  let fontStyle = '';
  if (italic) fontStyle += 'italic ';
  if (bold) fontStyle += 'bold ';
  ctx.font = `${fontStyle}${fontSize}px ${fontFamily}`;
  
  // Set text alignment to center for horizontal centering
  ctx.textAlign = 'center';
  // Keep default textBaseline ('alphabetic') for compatibility with underline calculation

  // Apply gradient or solid color
  if (gradient && gradient.enabled && gradient.colors && gradient.colors.length > 0) {
    const grad = createGradient(ctx, x - 200, y, x + 200, y, gradient.colors);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = color;
  }

  // Apply shadow
  applyTextShadow(ctx, shadow);

  // Draw outline if enabled
  if (outline && outline.enabled) {
    ctx.strokeStyle = outline.color || '#000000';
    ctx.lineWidth = outline.width || 2;
    ctx.strokeText(text, x, y);
  }

  // Draw fill
  ctx.fillText(text, x, y);

  // Draw underline
  if (underline) {
    const metrics = ctx.measureText(text);
    ctx.beginPath();
    ctx.moveTo(x - metrics.width / 2, y + fontSize + 2);
    ctx.lineTo(x + metrics.width / 2, y + fontSize + 2);
    ctx.strokeStyle = gradient && gradient.enabled ? (gradient.colors[gradient.colors.length - 1] || color) : color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Reset shadow
  if (shadow && shadow.enabled) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
}

// Helper: Apply animation effects to text
function applyAnimation(frameNum, totalFrames, animationType, baseY) {
  if (!animationType || animationType === 'none') return { y: baseY, opacity: 1, scale: 1 };

  let y = baseY;
  let opacity = 1;
  let scale = 1;

  const progress = frameNum / totalFrames;

  switch (animationType) {
    case 'fade-in':
      opacity = Math.min(1, frameNum / (totalFrames * 0.2)); // Fade in first 20%
      break;
    case 'fade-out':
      opacity = Math.max(0, 1 - (frameNum - totalFrames * 0.8) / (totalFrames * 0.2)); // Fade out last 20%
      break;
    case 'fade-both':
      if (progress < 0.2) opacity = progress * 5;
      else if (progress > 0.8) opacity = (1 - progress) * 5;
      break;
    case 'zoom-in':
      scale = 0.5 + (progress * 0.5);
      break;
    case 'zoom-out':
      scale = 1.5 - (progress * 0.5);
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

// Helper: Calculate scroll position based on direction
function calculateScrollPosition(frameNum, scrollPerFrame, textHeight, videoWidth, videoHeight, scrollDirection) {
  const currentOffset = frameNum * scrollPerFrame;

  switch (scrollDirection) {
    case 'horizontal':
      return { x: videoWidth - currentOffset, y: videoHeight / 2, angle: 0 };
    case 'diagonal':
      const diagonalOffset = currentOffset * 0.707; // cos(45°)
      return { x: diagonalOffset, y: videoHeight - diagonalOffset, angle: 0 };
    case 'fixed':
      return { x: videoWidth / 2, y: videoHeight / 2, angle: 0 };
    case 'vertical': // default
    default:
      return { x: videoWidth / 2, y: videoHeight - currentOffset, angle: 0 };
  }
}

// Helper: Apply image filters
function applyImageFilters(ctx, width, height, filter) {
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

// Helper: Adjust image color
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

// Main function: Generate scrolling video with all features
async function generateScrollingVideo(options, progressCallback, shouldCancel) {
  const {
    imagePath,
    imagePaths = null, // Multi-image support
    videoPath = null, // Video background support
    text,
    texts = null, // Multiple text blocks
    width,
    height,
    scrollSpeed,
    scrollDirection = 'vertical', // vertical, horizontal, diagonal, fixed
    textColor,
    fontSize,
    fontFamily,
    fps = 30,
    slides = null, // Multi-slide support
    exportFormat = 'mp4', // mp4, mov, webm
    outputDirectory = null, // Custom output directory
    qualityPreset = 'high', // low, medium, high, ultra
    bitrate = null, // Custom bitrate
    exportGif = false,
    exportImageSequence = false,
    exportThumbnail = false,
  } = options;

  // Create unique temp directory for frames and assets
  const tempDirPrefix = path.join(app.getPath('temp'), 'scrolling-video-');
  const tempDir = await fs.mkdtemp(tempDirPrefix);

  try {
    // Handle multi-slide or single slide
    const slideConfigs = slides && slides.length > 0 ? slides : [{
      imagePath: imagePath || (imagePaths && imagePaths[0]) || null,
      imagePaths: imagePaths || null,
      videoPath: videoPath,
      text: text || '',
      texts: texts || null,
      duration: options.duration || null,
      transition: options.transition || 'none',
    }];

    // Process narration/audio
    const narrationOptions = options.narration || {};
    const shouldGenerateNarration =
      Boolean(narrationOptions.enabled) &&
      Boolean(narrationOptions.text && narrationOptions.text.trim().length > 0);
    const narrationLanguage = narrationOptions.language || 'en';
    let narrationAudioPath = null;

    // Background music
    const bgMusicOptions = options.backgroundMusic || {};
    const hasBgMusic = Boolean(bgMusicOptions.enabled && bgMusicOptions.path);

    if (shouldGenerateNarration) {
      narrationAudioPath = await generateNarrationAudio(
        narrationOptions.text.trim(),
        narrationLanguage,
        tempDir,
        progressCallback
      );
    }

    let bgMusicPath = null;
    if (hasBgMusic) {
      bgMusicPath = bgMusicOptions.path;
    }

    // Text styling options
    const textEffects = options.textEffects || {};
    const textAnimation = options.textAnimation || { type: 'none' };
    const imageFilter = options.imageFilter || 'none';
    const colorAdjustments = options.colorAdjustments || {};

    // Create canvas
    const canvas = new Canvas(width, height);
    const ctx = canvas.getContext('2d');

    // IMPORTANT:
    // Frame rendering is very CPU-heavy (canvas draw + toBufferSync). The previous implementation tried to
    // "parallelize" frames via Promise.all, but because most work happens synchronously before the first await,
    // it blocks the event loop and can make the Electron UI feel frozen (no scrolling / unresponsive window).
    // We intentionally render frames sequentially and yield to the event loop frequently to keep the app responsive.

    // Process all slides
    let allFrames = [];
    let frameOffset = 0;

    // Pre-compute an estimated total frame count for smoother progress reporting
    // (purely based on text metrics + duration overrides; does not load images).
    let totalGlobalFrames = 0;
    try {
      const measureCanvas = new Canvas(width, height);
      const measureCtx = measureCanvas.getContext('2d');
      measureCtx.font = `${fontSize}px ${fontFamily}`;
      const maxWidth = width - 100;
      const lineHeight = fontSize * 1.5;

      for (const slide of slideConfigs) {
        const slideTexts =
          slide.texts ||
          (slide.text ? [{ text: slide.text, ...options }] : []);

        // Word wrap (approx) to estimate height
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

        const totalScrollDistance = height + maxTextHeight;
        const scrollPerFrame = scrollSpeed / fps;
        const totalFrames = Math.ceil(totalScrollDistance / scrollPerFrame);
        const slideDuration = slide.duration || (totalFrames / fps);
        const slideFrames = Math.ceil(slideDuration * fps);
        totalGlobalFrames += slideFrames;
      }
    } catch (_) {
      // If estimation fails, fall back to "unknown total" behavior (we'll still send progress updates).
      totalGlobalFrames = 0;
    }

    for (let slideIndex = 0; slideIndex < slideConfigs.length; slideIndex++) {
      // Check for cancellation before processing each slide
      if (shouldCancel && shouldCancel()) {
        throw new Error('Video generation cancelled');
      }

      const slide = slideConfigs[slideIndex];
      const slideImagePath = slide.imagePath || (slide.imagePaths && slide.imagePaths[0]);
      const slideTexts = slide.texts || (slide.text ? [{ text: slide.text, ...options }] : []);

      // Load background image(s) or video frame
      let bgImage = null;
      if (slideImagePath) {
        bgImage = await loadImage(slideImagePath);
      } else if (slide.imagePaths && slide.imagePaths.length > 0) {
        // Multi-image slideshow background
        bgImage = await loadImage(slide.imagePaths[0]);
      }

      // Reuse a single canvas per slide to avoid per-frame allocations (big speed win).
      // This is safe because we render frames sequentially.
      const frameCanvas = new Canvas(width, height);
      const frameCtx = frameCanvas.getContext('2d');

      // Calculate text dimensions for this slide
      ctx.font = `${fontSize}px ${fontFamily}`;
      const maxWidth = width - 100;
      const lineHeight = fontSize * 1.5;

      // Process all text blocks for this slide
      const allTextLines = [];
      for (const textBlock of slideTexts) {
        const textContent = textBlock.text || '';
        const words = textContent.split(' ');
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

        allTextLines.push({
          lines,
          x: textBlock.x !== undefined ? textBlock.x : width / 2,
          y: textBlock.y !== undefined ? textBlock.y : null,
          options: textBlock,
        });
      }

      // Calculate total text height
      const maxTextHeight = Math.max(...allTextLines.map(block => block.lines.length * lineHeight), 0);
      const totalScrollDistance = height + maxTextHeight;
      const scrollPerFrame = scrollSpeed / fps;
      const totalFrames = Math.ceil(totalScrollDistance / scrollPerFrame);

      // Handle slide duration override
      const slideDuration = slide.duration || (totalFrames / fps);
      const slideFrames = Math.ceil(slideDuration * fps);

      // Pre-load and cache all images for multi-image backgrounds
      const imageCache = new Map();
      if (slide.imagePaths && slide.imagePaths.length > 1) {
        for (const imagePath of slide.imagePaths) {
          if (!imageCache.has(imagePath)) {
            try {
              const img = await loadImage(imagePath);
              imageCache.set(imagePath, img);
            } catch (e) {
              console.warn(`Failed to pre-load image ${imagePath}:`, e);
            }
          }
        }
      }

      // Generate frames for this slide with parallel processing
      // Helper function to generate a single frame
      const generateSingleFrame = async (frameNum, globalFrameNum) => {
        // Yield periodically so the Electron window remains responsive, without paying the cost every frame.
        // (Rendering uses synchronous canvas operations.)
        if (frameNum % 5 === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }

        // Check cancellation before doing heavy work
        if (shouldCancel && shouldCancel()) {
          throw new Error('Video generation cancelled');
        }

        // Reset filters
        frameCtx.filter = 'none';
        frameCtx.globalAlpha = 1;
        frameCtx.setTransform(1, 0, 0, 1, 0, 0);

        // Handle multi-image background rotation (use cached images)
        let currentBgImage = bgImage;
        if (slide.imagePaths && slide.imagePaths.length > 1) {
          const imageIndex = Math.floor((frameNum / slideFrames) * slide.imagePaths.length) % slide.imagePaths.length;
          const imagePath = slide.imagePaths[imageIndex];
          currentBgImage = imageCache.get(imagePath) || bgImage;
        }

        // Clear previous frame
        frameCtx.clearRect(0, 0, width, height);

        // Draw background
        if (currentBgImage) {
          // Apply color adjustments
          applyColorAdjustments(frameCtx, colorAdjustments);

          // Apply image filter
          applyImageFilters(frameCtx, width, height, imageFilter);

          // Handle background crop/rotation
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
            // Scale to fit
            const scale = Math.max(width / currentBgImage.width, height / currentBgImage.height);
            const scaledWidth = currentBgImage.width * scale;
            const scaledHeight = currentBgImage.height * scale;
            const x = (width - scaledWidth) / 2;
            const y = (height - scaledHeight) / 2;
            frameCtx.drawImage(currentBgImage, x, y, scaledWidth, scaledHeight);
          }

          if (rotation !== 0) {
            frameCtx.restore();
          }

          frameCtx.filter = 'none';
        } else if (options.backgroundGradient && options.backgroundGradient.enabled) {
          // Draw gradient background
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
          // Default black background if no image or gradient
          frameCtx.fillStyle = '#000000';
          frameCtx.fillRect(0, 0, width, height);
        }

        // Add overlay for text readability
        if (options.overlayOpacity !== undefined && options.overlayOpacity > 0) {
          frameCtx.fillStyle = `rgba(0, 0, 0, ${options.overlayOpacity})`;
          frameCtx.fillRect(0, 0, width, height);
        }

        // Draw text blocks
        for (const textBlock of allTextLines) {
          const blockOptions = textBlock.options || {};
          const blockTextEffects = blockOptions.textEffects || textEffects;
          const blockAnimation = blockOptions.textAnimation || textAnimation;

          // Calculate scroll position
          const scrollPos = calculateScrollPosition(
            frameNum,
            scrollPerFrame,
            maxTextHeight,
            width,
            height,
            blockOptions.scrollDirection || scrollDirection
          );

          // Apply animation
          const anim = applyAnimation(frameNum, slideFrames, blockAnimation.type, scrollPos.y);

          // Draw each line of text
          for (let i = 0; i < textBlock.lines.length; i++) {
            const lineY = anim.y + (i * lineHeight);
            if (lineY > -lineHeight && lineY < height) {
              frameCtx.save();

              // Apply opacity from animation
              if (anim.opacity !== 1) {
                frameCtx.globalAlpha = anim.opacity;
              }

              // Apply scale from animation
              if (anim.scale !== 1) {
                frameCtx.translate(scrollPos.x, lineY);
                frameCtx.scale(anim.scale, anim.scale);
                frameCtx.translate(-scrollPos.x, -lineY);
              }

              // Draw text with effects
              const textColorToUse = blockOptions.textColor || textColor;
              const fontSizeToUse = blockOptions.fontSize || fontSize;
              const fontFamilyToUse = blockOptions.fontFamily || fontFamily;

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

        // Draw subtitles if enabled
        if (options.subtitles && options.subtitles.enabled) {
          await drawSubtitles(frameCtx, frameNum, fps, options.subtitles, width, height);
        }

        // Capture buffer and save frame
        // JPEG is much faster (smaller frames, faster disk IO). Quality 0.95 keeps text crisp.
        const buffer = frameCanvas.toBufferSync('jpeg', { quality: 0.95 });
        const frameFileName = `frame${String(globalFrameNum).padStart(6, '0')}.jpg`;
        const frameFilePath = path.join(tempDir, frameFileName);
        
        // Write frame to disk
        await fs.writeFile(frameFilePath, buffer);
        
        return { frameNum, globalFrameNum };
      };

      // Generate frames sequentially (responsive, predictable memory usage)
      for (let frameNum = 0; frameNum < slideFrames; frameNum++) {
        const globalFrameNum = frameOffset + frameNum;
        await generateSingleFrame(frameNum, globalFrameNum);

        // Report progress periodically (~1 update per second) to avoid spamming IPC/UI rerenders.
        const progressEvery = Math.max(1, Math.floor(fps));
        const shouldReport =
          frameNum === 0 ||
          frameNum === slideFrames - 1 ||
          (frameNum + 1) % progressEvery === 0;

        if (progressCallback && shouldReport) {
          const currentDone = frameOffset + frameNum + 1;
          const totalForProgress = totalGlobalFrames || (frameOffset + slideFrames);
          const progressPct = (currentDone / totalForProgress) * 100;

          progressCallback({
            type: 'frame',
            current: currentDone,
            total: totalForProgress,
            progress: Math.max(0, Math.min(100, Math.round(progressPct))),
            message: `Rendering frames... ${currentDone}/${totalForProgress} (slide ${slideIndex + 1}/${slideConfigs.length})`,
          });
        }
      }

      frameOffset += slideFrames;

      // Apply transition to next slide (if not last)
      if (slideIndex < slideConfigs.length - 1 && slide.transition && slide.transition !== 'none') {
        const transitionFrames = Math.ceil((slide.transition.duration || 0.5) * fps);
        // Transition frames would be generated here
        // For now, we'll skip transition frames
      }
    }

    // Check for cancellation before encoding
    if (shouldCancel && shouldCancel()) {
      throw new Error('Video generation cancelled');
    }

    // Determine output path
    const timestamp = Date.now();
    const outputDir = outputDirectory || app.getPath('desktop');
    const baseFileName = `scrolling-video-${timestamp}`;

    // Generate video
    const safeExportFormat = (exportFormat || 'mp4').toLowerCase();
    const videoOutputPath = path.join(tempDir, `${baseFileName}-video.${safeExportFormat}`);
    const totalFramesRendered = frameOffset; // exact total frames generated across all slides
    await encodeVideo(
      tempDir,
      videoOutputPath,
      fps,
      exportFormat,
      qualityPreset,
      bitrate,
      progressCallback,
      'jpg',
      totalFramesRendered
    );

    // Mix audio if needed
    let finalVideoPath = videoOutputPath;
    if (shouldGenerateNarration || hasBgMusic) {
      finalVideoPath = path.join(tempDir, `${baseFileName}-with-audio.${safeExportFormat}`);
      await mixAllAudio(
        videoOutputPath,
        narrationAudioPath,
        bgMusicPath,
        bgMusicOptions.volume || 0.5,
        bgMusicOptions.fadeIn || 0,
        bgMusicOptions.fadeOut || 0,
        finalVideoPath,
        progressCallback,
        safeExportFormat
      );
      await fs.unlink(videoOutputPath).catch(() => {});
    }

    // Move to final location
    const finalOutputPath = path.join(outputDir, `${baseFileName}.${safeExportFormat}`);
    await fs.copyFile(finalVideoPath, finalOutputPath);

    // Generate additional exports
    if (exportGif) {
      await generateGif(tempDir, finalOutputPath.replace(`.${exportFormat}`, '.gif'), fps, progressCallback);
    }

    if (exportImageSequence) {
      const sequenceDir = path.join(outputDir, `${baseFileName}-frames`);
      await fs.mkdir(sequenceDir, { recursive: true });
      // Copy frames (frames are already in tempDir)
      // Implementation would copy frames here
    }

    if (exportThumbnail) {
      await generateThumbnail(finalVideoPath, path.join(outputDir, `${baseFileName}-thumbnail.jpg`), progressCallback);
    }

    // Clean up temp directory
    await cleanupTempDirectory(tempDir);

    return finalOutputPath;
  } catch (error) {
    await cleanupTempDirectory(tempDir);
    throw error;
  }
}

// Helper: Draw subtitles
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

      if (style.strokeWidth > 0) {
        ctx.strokeText(subtitle.text, x, y);
      }
      ctx.fillText(subtitle.text, x, y);
    }
  }
}

// Helper: Encode video
function timemarkToSeconds(timemark) {
  // timemark format commonly "HH:MM:SS.xx"
  if (!timemark || typeof timemark !== 'string') return null;
  const parts = timemark.trim().split(':');
  if (parts.length !== 3) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  const s = Number(parts[2]);
  if ([h, m, s].some((n) => !Number.isFinite(n))) return null;
  return h * 3600 + m * 60 + s;
}

async function encodeVideo(
  tempDir,
  outputPath,
  fps,
  format,
  qualityPreset,
  bitrate,
  progressCallback,
  frameExt = 'jpg',
  totalFrames = null
) {
  return new Promise((resolve, reject) => {
    if (progressCallback) {
      progressCallback({
        type: 'encoding',
        progress: 0,
        message: `Encoding video... (quality: ${qualityPreset || 'high'})`,
      });
    }

    const safeFormat = (format || 'mp4').toLowerCase();
    const command = ffmpeg()
      .input(path.join(tempDir, `frame%06d.${frameExt}`))
      .inputFPS(fps);

    // Set codec based on format
    const isWebm = safeFormat === 'webm';
    const isMov = safeFormat === 'mov';
    if (isWebm) {
      command.outputOptions(['-c:v libvpx-vp9', '-pix_fmt yuv420p']);
    } else if (isMov) {
      command.outputOptions(['-c:v libx264', '-pix_fmt yuv420p']);
    } else {
      command.outputOptions(['-c:v libx264', '-pix_fmt yuv420p']);
    }

    // Normalize bitrate: treat 0/NaN/undefined as unset
    const bitrateNum =
      typeof bitrate === 'number' && Number.isFinite(bitrate) && bitrate > 0 ? bitrate : null;

    // Make presets meaningfully different.
    // x264: CRF lower = higher quality; preset slower = higher compression.
    // vp9: CRF lower = higher quality; cpu-used lower = higher quality (slower).
    const x264CrfMap = { low: 30, medium: 26, high: 22, ultra: 18 };
    const x264PresetMap = { low: 'ultrafast', medium: 'veryfast', high: 'fast', ultra: 'medium' };
    const vp9CrfMap = { low: 45, medium: 35, high: 30, ultra: 24 };
    const vp9CpuUsedMap = { low: 8, medium: 6, high: 4, ultra: 2 };

    const qp = (qualityPreset || 'high').toLowerCase();

    // Use multiple threads for faster encoding (use all available CPU cores)
    const threadCount = os.cpus().length;
    
    if (isWebm) {
      // VP9 speed/quality knobs
      const crf = bitrateNum ? null : (vp9CrfMap[qp] ?? vp9CrfMap.high);
      const cpuUsed = vp9CpuUsedMap[qp] ?? vp9CpuUsedMap.high;
      const deadline = cpuUsed >= 6 ? 'realtime' : 'good';

      const opts = [
        `-threads ${threadCount}`,
        `-cpu-used ${cpuUsed}`,
        `-deadline ${deadline}`,
      ];
      if (bitrateNum) {
        opts.push(`-b:v ${bitrateNum}k`);
      } else {
        // Recommended pattern for constrained quality VP9: b:v 0 + crf
        opts.push('-b:v 0');
        opts.push(`-crf ${crf}`);
      }
      command.outputOptions(opts);
    } else {
      const crf = bitrateNum ? null : (x264CrfMap[qp] ?? x264CrfMap.high);
      const preset = x264PresetMap[qp] ?? x264PresetMap.high;
      const opts = [
        `-preset ${preset}`,
        `-threads ${threadCount}`,
        '-movflags +faststart', // Enable fast start for web playback
      ];
      if (bitrateNum) {
        opts.push(`-b:v ${bitrateNum}k`);
      } else {
        opts.push(`-crf ${crf}`);
      }
      command.outputOptions(opts);
    }

    command
      .output(outputPath)
      .on('start', (cmd) => {
        console.log('FFmpeg command:', cmd);
      })
      .on('progress', (progress) => {
        if (!progressCallback) return;

        // fluent-ffmpeg often does NOT provide progress.percent for image sequences.
        // Compute percent from timemark if possible (duration is known from totalFrames/fps).
        let pct = null;
        if (progress && typeof progress.percent === 'number' && Number.isFinite(progress.percent)) {
          pct = progress.percent;
        } else if (progress && progress.timemark && totalFrames && fps) {
          const durationSec = Number(totalFrames) / Number(fps);
          const tSec = timemarkToSeconds(progress.timemark);
          if (Number.isFinite(durationSec) && durationSec > 0 && tSec != null) {
            pct = (tSec / durationSec) * 100;
          }
        }

        if (pct != null) {
          const clamped = Math.max(0, Math.min(100, pct));
          progressCallback({
            type: 'encoding',
            progress: Math.round(clamped),
            message: 'Encoding video...',
          });
        } else {
          // Still emit a message so the UI stays informative even without a numeric percent.
          progressCallback({
            type: 'encoding',
            message: 'Encoding video...',
          });
        }
      })
      .on('end', () => {
        if (progressCallback) {
          progressCallback({
            type: 'encoding',
            progress: 100,
            message: 'Encoding complete.',
          });
        }
        resolve(outputPath);
      })
      .on('error', (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .run();
  });
}

// Helper: Get video duration in seconds
function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const duration = metadata.format.duration || 0;
        resolve(duration);
      }
    });
  });
}

// Helper: Mix all audio sources
async function mixAllAudio(
  videoPath,
  narrationPath,
  bgMusicPath,
  bgMusicVolume,
  bgMusicFadeIn,
  bgMusicFadeOut,
  outputPath,
  progressCallback,
  exportFormat = 'mp4'
) {
  if (progressCallback) {
    progressCallback({
      type: 'audio-mix',
      message: 'Mixing audio with video...',
    });
  }

  // Get video duration for fade out timing
  let videoDuration = 0;
  if (bgMusicFadeOut > 0) {
    try {
      videoDuration = await getVideoDuration(videoPath);
    } catch (err) {
      console.warn('Could not get video duration for fade out:', err.message);
    }
  }

  return new Promise((resolve, reject) => {
    const command = ffmpeg().input(videoPath);
    let audioFilters = [];
    let audioMapLabel = '';

    // Handle narration
    if (narrationPath) {
      command.input(narrationPath);
      audioFilters.push('[1:a]apad[a1]');
    }

    // Handle background music
    if (bgMusicPath) {
      const inputIndex = narrationPath ? 2 : 1;
      command.input(bgMusicPath);
      
      // Build music filter chain
      let musicFilter = `[${inputIndex}:a]`;
      const filterParts = [];
      
      // Apply volume if needed
      if (bgMusicVolume !== 1) {
        filterParts.push(`volume=${bgMusicVolume}`);
      }
      
      // Apply fade in
      if (bgMusicFadeIn > 0) {
        filterParts.push(`afade=t=in:st=0:d=${bgMusicFadeIn}`);
      }
      
      // Apply fade out
      if (bgMusicFadeOut > 0 && videoDuration > 0) {
        const fadeOutStart = Math.max(0, videoDuration - bgMusicFadeOut);
        filterParts.push(`afade=t=out:st=${fadeOutStart}:d=${bgMusicFadeOut}`);
      }
      
      // Combine all filter parts
      if (filterParts.length > 0) {
        musicFilter += filterParts.join(',');
      }
      
      musicFilter += '[m2]';
      audioFilters.push(musicFilter);

      // Mix narration and music if both exist
      if (narrationPath) {
        audioFilters.push('[a1][m2]amix=inputs=2:duration=first:dropout_transition=2[aout]');
        audioMapLabel = 'aout';
      } else {
        audioMapLabel = 'm2';
      }
    } else if (narrationPath) {
      audioMapLabel = 'a1';
    }

    const safeFormat = (exportFormat || 'mp4').toLowerCase();
    const isWebm = safeFormat === 'webm';
    const outputOptions = ['-map', '0:v:0'];
    if (audioMapLabel) {
      outputOptions.push('-map', `[${audioMapLabel}]`);
    }
    if (isWebm) {
      // WebM typically uses Opus.
      outputOptions.push('-c:v', 'copy', '-c:a', 'libopus', '-b:a', '128k', '-shortest');
    } else {
      outputOptions.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest');
    }

    command
      .complexFilter(audioFilters.length > 0 ? audioFilters : [])
      .outputOptions(outputOptions)
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

// Helper: Generate GIF
async function generateGif(tempDir, outputPath, fps, progressCallback, frameExt = 'jpg') {
  if (progressCallback) {
    progressCallback({
      type: 'gif',
      message: 'Generating GIF...',
    });
  }

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(path.join(tempDir, `frame%06d.${frameExt}`))
      .inputFPS(fps)
      .outputOptions([
        '-vf',
        'fps=10,scale=640:-1:flags=lanczos,palettegen=reserve_transparent=0',
      ])
      .output(path.join(tempDir, 'palette.png'))
      .on('end', () => {
        ffmpeg()
          .input(path.join(tempDir, `frame%06d.${frameExt}`))
          .input(path.join(tempDir, 'palette.png'))
          .inputFPS(fps)
          .complexFilter([
            '[0:v]fps=10,scale=640:-1:flags=lanczos[v]',
            '[v][1:v]paletteuse',
          ])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      })
      .on('error', (err) => reject(err))
      .run();
  });
}

// Helper: Generate thumbnail
async function generateThumbnail(videoPath, outputPath, progressCallback) {
  if (progressCallback) {
    progressCallback({
      type: 'thumbnail',
      message: 'Generating thumbnail...',
    });
  }

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ['00:00:01'],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: '640x360',
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

// Clean up temporary directory
async function cleanupTempDirectory(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    console.log('Cleaned up temporary directory:', dirPath);
  } catch (error) {
    console.error('Error cleaning up temp directory:', error);
  }
}

// Check if an error is a retryable network error
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
      errorMessage.includes(retryableError) || errorCode.includes(retryableError)
  );
}

// Generate narration audio using Google TTS with retry logic
async function generateNarrationAudio(text, language, tempDir, progressCallback) {
  if (progressCallback) {
    progressCallback({
      type: 'audio',
      message: 'Generating narration audio...',
    });
  }

  const audioPath = path.join(tempDir, `narration-${Date.now()}.mp3`);
  const maxRetries = 3;
  const retryDelay = 2000;
  const requestTimeout = 30000;

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await new Promise((resolve, reject) => {
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
      if (isRetryableNetworkError(error) && attempt < maxRetries) {
        if (progressCallback) {
          progressCallback({
            type: 'audio',
            message: `Network error. Retrying (${attempt}/${maxRetries})...`,
          });
        }
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        continue;
      } else {
        const errorMessage = lastError.message || 'Unknown error';
        throw new Error(
          `Failed to generate narration audio after ${attempt} attempt(s): ${errorMessage}. ` +
          `This may be due to network connectivity issues or Google TTS service unavailability. ` +
          `Please check your internet connection and try again.`
        );
      }
    }
  }

  throw lastError || new Error('Failed to generate narration audio');
}

// Export project configuration (for save/resume)
async function saveProject(config, projectPath) {
  await fs.writeFile(projectPath, JSON.stringify(config, null, 2));
}

// Load project configuration
async function loadProject(projectPath) {
  const content = await fs.readFile(projectPath, 'utf-8');
  return JSON.parse(content);
}

// Batch process videos
async function batchProcess(configs, progressCallback) {
  const results = [];
  for (let i = 0; i < configs.length; i++) {
    if (progressCallback) {
      progressCallback({
        type: 'batch',
        current: i + 1,
        total: configs.length,
        progress: Math.round(((i + 1) / configs.length) * 100),
        message: `Processing video ${i + 1} of ${configs.length}...`,
      });
    }
    try {
      const result = await generateScrollingVideo(configs[i], progressCallback);
      results.push({ success: true, path: result, config: configs[i] });
    } catch (error) {
      results.push({ success: false, error: error.message, config: configs[i] });
    }
  }
  return results;
}

module.exports = {
  generateScrollingVideo,
  saveProject,
  loadProject,
  batchProcess,
};
