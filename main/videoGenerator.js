const { Canvas, loadImage } = require('skia-canvas');
const fs = require('fs').promises;
const path = require('path');
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
function calculateScrollPosition(frameNum, scrollPerFrame, textHeight, videoHeight, scrollDirection) {
  const currentOffset = frameNum * scrollPerFrame;

  switch (scrollDirection) {
    case 'horizontal':
      return { x: videoHeight - currentOffset, y: videoHeight / 2, angle: 0 };
    case 'diagonal':
      const diagonalOffset = currentOffset * 0.707; // cos(45°)
      return { x: diagonalOffset, y: videoHeight - diagonalOffset, angle: 0 };
    case 'fixed':
      return { x: videoHeight / 2, y: videoHeight / 2, angle: 0 };
    case 'vertical': // default
    default:
      return { x: videoHeight / 2, y: videoHeight - currentOffset, angle: 0 };
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
async function generateScrollingVideo(options, progressCallback) {
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

    // Process all slides
    let allFrames = [];
    let frameOffset = 0;

    for (let slideIndex = 0; slideIndex < slideConfigs.length; slideIndex++) {
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

      // Generate frames for this slide
      for (let frameNum = 0; frameNum < slideFrames; frameNum++) {
        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Reset filters
        ctx.filter = 'none';

        // Handle multi-image background rotation
        let currentBgImage = bgImage;
        if (slide.imagePaths && slide.imagePaths.length > 1) {
          const imageIndex = Math.floor((frameNum / slideFrames) * slide.imagePaths.length) % slide.imagePaths.length;
          try {
            currentBgImage = await loadImage(slide.imagePaths[imageIndex]);
          } catch (e) {
            console.warn(`Failed to load image ${slide.imagePaths[imageIndex]}:`, e);
          }
        }

        // Draw background
        if (currentBgImage) {
          // Apply color adjustments
          applyColorAdjustments(ctx, colorAdjustments);

          // Apply image filter
          applyImageFilters(ctx, width, height, imageFilter);

          // Handle background crop/rotation
          const crop = options.backgroundCrop || {};
          const rotation = options.backgroundRotation || 0;

          if (rotation !== 0) {
            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            ctx.translate(-width / 2, -height / 2);
          }

          if (crop.enabled && (crop.x !== undefined || crop.y !== undefined || crop.width || crop.height)) {
            const sx = crop.x || 0;
            const sy = crop.y || 0;
            const sw = crop.width || currentBgImage.width;
            const sh = crop.height || currentBgImage.height;
            ctx.drawImage(currentBgImage, sx, sy, sw, sh, 0, 0, width, height);
          } else {
            // Scale to fit
            const scale = Math.max(width / currentBgImage.width, height / currentBgImage.height);
            const scaledWidth = currentBgImage.width * scale;
            const scaledHeight = currentBgImage.height * scale;
            const x = (width - scaledWidth) / 2;
            const y = (height - scaledHeight) / 2;
            ctx.drawImage(currentBgImage, x, y, scaledWidth, scaledHeight);
          }

          if (rotation !== 0) {
            ctx.restore();
          }

          ctx.filter = 'none';
        } else if (options.backgroundGradient && options.backgroundGradient.enabled) {
          // Draw gradient background
          const grad = options.backgroundGradient;
          const gradient = createGradient(
            ctx,
            grad.x1 !== undefined ? grad.x1 : 0,
            grad.y1 !== undefined ? grad.y1 : 0,
            grad.x2 !== undefined ? grad.x2 : width,
            grad.y2 !== undefined ? grad.y2 : height,
            grad.colors && grad.colors.length > 0 ? grad.colors : ['#000000', '#ffffff']
          );
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, width, height);
        } else {
          // Default black background if no image or gradient
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);
        }

        // Add overlay for text readability
        if (options.overlayOpacity !== undefined && options.overlayOpacity > 0) {
          ctx.fillStyle = `rgba(0, 0, 0, ${options.overlayOpacity})`;
          ctx.fillRect(0, 0, width, height);
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
            height,
            blockOptions.scrollDirection || scrollDirection
          );

          // Apply animation
          const anim = applyAnimation(frameNum, slideFrames, blockAnimation.type, scrollPos.y);

          // Draw each line of text
          for (let i = 0; i < textBlock.lines.length; i++) {
            const lineY = anim.y + (i * lineHeight);
            if (lineY > -lineHeight && lineY < height) {
              ctx.save();

              // Apply opacity from animation
              if (anim.opacity !== 1) {
                ctx.globalAlpha = anim.opacity;
              }

              // Apply scale from animation
              if (anim.scale !== 1) {
                ctx.translate(scrollPos.x, lineY);
                ctx.scale(anim.scale, anim.scale);
                ctx.translate(-scrollPos.x, -lineY);
              }

              // Draw text with effects
              const textColorToUse = blockOptions.textColor || textColor;
              const fontSizeToUse = blockOptions.fontSize || fontSize;
              const fontFamilyToUse = blockOptions.fontFamily || fontFamily;

              drawTextWithEffects(ctx, textBlock.lines[i], scrollPos.x, lineY, {
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

              ctx.restore();
            }
          }
        }

        // Draw subtitles if enabled
        if (options.subtitles && options.subtitles.enabled) {
          await drawSubtitles(ctx, frameNum, fps, options.subtitles, width, height);
        }

        // Save frame
        const globalFrameNum = frameOffset + frameNum;
        const frameFileName = `frame${String(globalFrameNum).padStart(6, '0')}.png`;
        const frameFilePath = path.join(tempDir, frameFileName);
        const buffer = canvas.toBufferSync('png');
        await fs.writeFile(frameFilePath, buffer);

        // Report progress
        if (progressCallback) {
          const totalGlobalFrames = slideConfigs.reduce((sum, s) => {
            const sFrames = Math.ceil((s.duration || (totalFrames / fps)) * fps);
            return sum + sFrames;
          }, 0);
          const progress = ((globalFrameNum + 1) / totalGlobalFrames) * 100;
          progressCallback({
            type: 'frame',
            current: globalFrameNum + 1,
            total: totalGlobalFrames,
            progress: Math.round(progress),
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

    // Determine output path
    const timestamp = Date.now();
    const outputDir = outputDirectory || app.getPath('desktop');
    const baseFileName = `scrolling-video-${timestamp}`;

    // Generate video
    const videoOutputPath = path.join(tempDir, `${baseFileName}-video.mp4`);
    await encodeVideo(tempDir, videoOutputPath, fps, exportFormat, qualityPreset, bitrate, progressCallback);

    // Mix audio if needed
    let finalVideoPath = videoOutputPath;
    if (shouldGenerateNarration || hasBgMusic) {
      finalVideoPath = path.join(tempDir, `${baseFileName}-with-audio.mp4`);
      await mixAllAudio(
        videoOutputPath,
        narrationAudioPath,
        bgMusicPath,
        bgMusicOptions.volume || 0.5,
        bgMusicOptions.fadeIn || 0,
        bgMusicOptions.fadeOut || 0,
        finalVideoPath,
        progressCallback
      );
      await fs.unlink(videoOutputPath).catch(() => {});
    }

    // Move to final location
    const finalOutputPath = path.join(outputDir, `${baseFileName}.${exportFormat}`);
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
async function encodeVideo(tempDir, outputPath, fps, format, qualityPreset, bitrate, progressCallback) {
  return new Promise((resolve, reject) => {
    if (progressCallback) {
      progressCallback({
        type: 'encoding',
        progress: 0,
        message: 'Encoding video...',
      });
    }

    const command = ffmpeg()
      .input(path.join(tempDir, 'frame%06d.png'))
      .inputFPS(fps);

    // Set codec based on format
    if (format === 'webm') {
      command.outputOptions(['-c:v libvpx-vp9', '-pix_fmt yuv420p']);
    } else if (format === 'mov') {
      command.outputOptions(['-c:v libx264', '-pix_fmt yuv420p']);
    } else {
      command.outputOptions(['-c:v libx264', '-pix_fmt yuv420p']);
    }

    // Set quality preset
    const crfMap = { low: 28, medium: 23, high: 18, ultra: 15 };
    const presetMap = { low: 'veryfast', medium: 'fast', high: 'medium', ultra: 'slow' };
    const crf = bitrate ? null : (crfMap[qualityPreset] || 18);
    const preset = presetMap[qualityPreset] || 'fast';

    if (bitrate) {
      command.outputOptions([`-b:v ${bitrate}k`, `-preset ${preset}`]);
    } else {
      command.outputOptions([`-crf ${crf}`, `-preset ${preset}`]);
    }

    command
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
  progressCallback
) {
  if (progressCallback) {
    progressCallback({
      type: 'audio-mix',
      message: 'Mixing audio with video...',
    });
  }

  return new Promise((resolve, reject) => {
    const command = ffmpeg().input(videoPath);
    let audioFilters = [];
    let audioMap = '';

    // Handle narration
    if (narrationPath) {
      command.input(narrationPath);
      audioFilters.push('[1:a]apad[a1]');
    }

    // Handle background music
    if (bgMusicPath) {
      const inputIndex = narrationPath ? 2 : 1;
      command.input(bgMusicPath);
      
      let musicFilter = `[${inputIndex}:a]`;
      
      // Apply volume
      if (bgMusicVolume !== 1) {
        musicFilter += `volume=${bgMusicVolume}[m1]`;
      } else {
        musicFilter += 'copy[m1]';
      }

      // Apply fades
      if (bgMusicFadeIn > 0 || bgMusicFadeOut > 0) {
        // Get video duration for fade out timing
        musicFilter = musicFilter.replace('[m1]', `afade=t=in:st=0:d=${bgMusicFadeIn},afade=t=out:st=0:d=${bgMusicFadeOut}[m2]`);
      } else {
        musicFilter = musicFilter.replace('[m1]', 'copy[m2]');
      }

      audioFilters.push(musicFilter);

      // Mix narration and music if both exist
      if (narrationPath) {
        audioFilters.push('[a1][m2]amix=inputs=2:duration=first:dropout_transition=2[aout]');
        audioMap = '[aout]';
      } else {
        audioMap = '[m2]';
      }
    } else if (narrationPath) {
      audioMap = '[a1]';
    }

    const outputOptions = ['-map', '0:v:0'];
    if (audioMap) {
      outputOptions.push('-map', audioMap);
    }
    outputOptions.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest');

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
async function generateGif(tempDir, outputPath, fps, progressCallback) {
  if (progressCallback) {
    progressCallback({
      type: 'gif',
      message: 'Generating GIF...',
    });
  }

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(path.join(tempDir, 'frame%06d.png'))
      .inputFPS(fps)
      .outputOptions([
        '-vf',
        'fps=10,scale=640:-1:flags=lanczos,palettegen=reserve_transparent=0',
      ])
      .output(path.join(tempDir, 'palette.png'))
      .on('end', () => {
        ffmpeg()
          .input(path.join(tempDir, 'frame%06d.png'))
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
