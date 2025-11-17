# 📜 Scrolling Text Video Generator

## Overview

A powerful feature that generates professional scrolling text videos from a single background image and text content. Perfect for creating credits, lyrics videos, announcements, and more!

## Features

✨ **Complete Customization**
- Adjustable video dimensions (width/height)
- Customizable scroll speed (pixels per second)
- Full text styling (color, size, font family)
- Configurable frame rate (FPS)

🎨 **Professional Output**
- High-quality video rendering
- Automatic text wrapping
- Semi-transparent overlay for better readability
- Background image scaling to fit video dimensions

📊 **Real-time Progress**
- Frame generation progress bar
- Video encoding status
- Detailed progress messages

## How It Works

### 1. Frame Generation
The system uses `skia-canvas` to generate individual video frames:
- Loads the background image
- Applies scaling to fit video dimensions
- Adds a semi-transparent overlay
- Renders text with word wrapping
- Scrolls text from bottom to top
- Saves each frame as PNG

### 2. Video Encoding
Once all frames are generated, `fluent-ffmpeg` stitches them together:
- Combines frames at specified FPS
- Encodes with H.264 codec (libx264)
- Outputs as MP4 with yuv420p pixel format
- Optimizes for quality and file size

### 3. Cleanup
- Automatically removes temporary frame files
- Cleans up temp directory after completion

## Usage Guide

### Basic Steps

1. **Select Background Image**
   - Click "📸 Select Image"
   - Choose a JPG or PNG file
   - Image will be scaled to fit video dimensions

2. **Enter Text**
   - Type or paste your text in the text area
   - Text automatically wraps to fit video width
   - Supports multi-line content

3. **Configure Settings**
   - **Video Dimensions**: Set width and height (default: 1920x1080)
   - **Scroll Speed**: Control how fast text moves (default: 100 px/s)
   - **FPS**: Set frame rate (default: 30)
   - **Text Color**: Choose any color (default: white)
   - **Font Size**: Adjust text size (default: 48px)
   - **Font Family**: Select from 10 common fonts

4. **Generate Video**
   - Click "🎥 Generate Video"
   - Watch real-time progress
   - Video saves to Desktop automatically

### Settings Explained

#### Video Dimensions
- **Width**: Video width in pixels (e.g., 1920, 1280, 720)
- **Height**: Video height in pixels (e.g., 1080, 720, 480)
- **Common Presets**:
  - 1920x1080 (Full HD)
  - 1280x720 (HD)
  - 3840x2160 (4K)

#### Scroll Speed
- **Measured in**: Pixels per second
- **Lower values**: Slower scrolling (more time to read)
- **Higher values**: Faster scrolling (shorter video)
- **Recommended**: 50-150 px/s
- **Calculation**: Duration ≈ (text height + video height) / scroll speed

#### Text Styling
- **Color**: Any valid CSS color (hex, rgb, named)
- **Font Size**: Larger = easier to read, takes more space
- **Font Family**: Choose based on video style
  - Serif fonts: More formal (Times New Roman, Georgia)
  - Sans-serif fonts: Modern, clean (Arial, Helvetica)
  - Monospace: Technical content (Courier New)

## Technical Details

### Frame Calculation

```javascript
// Total scroll distance
totalScrollDistance = videoHeight + textHeight

// Frames needed
totalFrames = Math.ceil(totalScrollDistance / (scrollSpeed / fps))

// Per-frame scroll
scrollPerFrame = scrollSpeed / fps
```

### Example Calculation

**Settings:**
- Video: 1920x1080
- Text height: 2000px
- Scroll speed: 100 px/s
- FPS: 30

**Result:**
- Total distance: 3080px (1080 + 2000)
- Scroll per frame: 3.33px (100 / 30)
- Total frames: 925 frames
- Video duration: 30.8 seconds (925 / 30)

### File Structure

```
main/
  ├── main.js              # Electron main process with IPC handlers
  ├── preload.js           # Context bridge API exposure
  └── videoGenerator.js    # Core video generation logic

client/src/
  ├── App.jsx              # Shell that renders the scrolling UI
  ├── App.css              # Global shell styling
  ├── ScrollingTextVideo.jsx   # Scrolling video component
  └── ScrollingTextVideo.css   # Component styling
```

## Dependencies

### Backend (Node.js)
- `skia-canvas` (^3.0.8): GPU-accelerated Canvas rendering engine
- `fluent-ffmpeg` (^2.1.3): FFmpeg wrapper for video encoding
- `ffmpeg-static` (^5.2.0): FFmpeg binary

### Frontend (React)
- React 19 with hooks
- CSS3 for modern styling

## API Reference

### IPC Handlers

#### `select-single-image`
- **Type**: invoke
- **Returns**: String (image path) or null
- **Description**: Opens file dialog for image selection

#### `generate-scrolling-video`
- **Type**: send
- **Parameters**: 
  ```javascript
  {
    imagePath: string,
    text: string,
    width: number,
    height: number,
    scrollSpeed: number,
    textColor: string,
    fontSize: number,
    fontFamily: string,
    fps: number
  }
  ```
- **Description**: Initiates video generation

#### Events

- `scrolling-video-progress`: Progress updates during generation
- `scrolling-video-done`: Video generation completed
- `scrolling-video-error`: Error occurred during generation

## Performance Considerations

### Memory Usage
- Each frame is temporarily stored as PNG
- Approximate memory: `width × height × 4 bytes × buffer count`
- Frames are written to disk immediately to minimize RAM usage

### Generation Time
Depends on:
- Video resolution (higher = slower)
- Text length (more text = more frames)
- Scroll speed (slower = more frames)
- CPU performance

**Typical times:**
- 1080p, 30s video: 1-3 minutes
- 1080p, 60s video: 3-6 minutes

### Optimization Tips
1. Use lower resolution for testing
2. Increase scroll speed to reduce frame count
3. Use lower FPS for faster generation (minimum 24 for smooth playback)
4. Close other applications during encoding

## Troubleshooting

### Common Issues

**1. Canvas installation fails**
- Ensure build tools are installed:
  - Windows: `npm install --global windows-build-tools`
  - Mac: Xcode Command Line Tools
  - Linux: `libcairo2-dev`, `libjpeg-dev`, `libpango1.0-dev`

**2. FFmpeg errors**
- FFmpeg is bundled with `ffmpeg-static`
- Check console for detailed error messages
- Ensure write permissions to Desktop

**3. Video won't play**
- Some players require yuv420p pixel format (included)
- Try VLC Media Player if default player fails
- Check video codec support in your player

**4. Progress bar stuck**
- Large videos take time
- Check console for errors
- Verify sufficient disk space

**5. Text appears cut off**
- Increase video width
- Reduce font size
- Check text content for long words

## Examples

### Credits Roll
```javascript
Settings:
  Width: 1920
  Height: 1080
  Scroll Speed: 75 px/s
  Font Size: 42px
  Font Family: Georgia
  Text Color: #ffffff
```

### Lyric Video
```javascript
Settings:
  Width: 1280
  Height: 720
  Scroll Speed: 50 px/s
  Font Size: 48px
  Font Family: Arial
  Text Color: #ffeb3b
```

### Announcement Video
```javascript
Settings:
  Width: 1080
  Height: 1920 (Vertical/Portrait)
  Scroll Speed: 120 px/s
  Font Size: 56px
  Font Family: Helvetica
  Text Color: #ff5722
```

## Future Enhancements

Potential improvements:
- [ ] Multiple text alignment options
- [ ] Text shadow/outline effects
- [ ] Custom background colors instead of images
- [ ] Fade in/out transitions
- [ ] Multiple font styles in one video
- [ ] Background music integration
- [ ] Video preset templates
- [ ] Export format options (WebM, GIF)

## License

Part of the Slideshow Generator project.

