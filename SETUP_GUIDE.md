# 🚀 Setup Guide - Scrolling Video Generator

## Prerequisites

Before you begin, ensure you have:
- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** (optional, for cloning)

### Platform-Specific Requirements

#### Windows
```powershell
# Install Windows Build Tools (run as Administrator)
npm install --global windows-build-tools

# Or install Visual Studio 2017 Build Tools
# https://visualstudio.microsoft.com/downloads/
```

#### macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install
```

#### Linux (Ubuntu/Debian)
```bash
# Install required libraries
sudo apt-get update
sudo apt-get install -y build-essential libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev librsvg2-dev
```

## Installation Steps

### Step 1: Navigate to Project Directory

```bash
cd "C:\Users\zeesh\Desktop\Development\Personal Projects\slideshow-generator"
```

### Step 2: Install Root Dependencies

This installs Electron, Skia Canvas, FFmpeg, and other core dependencies.

```bash
npm install
```

**Note:** Installing `skia-canvas` downloads a prebuilt binary per platform. It usually finishes within a few seconds.

### Step 3: Install Client Dependencies

```bash
cd client
npm install
cd ..
```

### Step 4: Verify Installation

Check that key packages are installed:

```bash
# Check for skia-canvas
npm list skia-canvas

# Check for ffmpeg
npm list fluent-ffmpeg ffmpeg-static
```

You should see version numbers without errors.

## Running the Application

### Development Mode

Start both the Vite dev server and Electron:

```bash
npm start
```

This command:
1. Starts the React dev server on `http://localhost:5173`
2. Waits for the server to be ready
3. Launches Electron window

**Expected output:**
```
[0] > client@0.0.0 dev
[0] > vite
[0] 
[0]   VITE v7.x.x  ready in XXX ms
[0] 
[0]   ➜  Local:   http://localhost:5173/
[1] Electron app started
```

### Production Build

Build the React app and create a distributable:

```bash
npm run build
```

This creates optimized production files in `client/dist/`.

## Troubleshooting Installation

### Issue: Skia Canvas Installation Fails

`skia-canvas` ships prebuilt binaries for every major platform. When installation fails it is usually due to a stale cache or a blocked download.

```bash
# Clear npm cache
npm cache clean --force

# Remove the broken install
npm uninstall skia-canvas

# Reinstall with verbose logging
npm install skia-canvas --verbose
```

Still stuck? Check that your proxy/firewall allows downloads from `https://github.com/samizdatco/skia-canvas/releases` and open an issue on the project if the binary for your platform is missing.

### Issue: Electron Won't Start

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
rm -rf client/node_modules client/package-lock.json

npm install
cd client && npm install && cd ..

# Try starting again
npm start
```

### Issue: Port 5173 Already in Use

```bash
# Kill process on port 5173 (Windows)
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Kill process on port 5173 (Mac/Linux)
lsof -ti:5173 | xargs kill -9
```

### Issue: FFmpeg Errors

FFmpeg is bundled with `ffmpeg-static`, so no separate installation needed. If you encounter errors:

```bash
# Verify ffmpeg-static is installed
npm list ffmpeg-static

# Reinstall if needed
npm install ffmpeg-static --save
```

## Project Structure

```
slideshow-generator/
├── main/
│   ├── main.js              # Electron main process
│   ├── preload.js           # Context bridge
│   └── videoGenerator.js    # Video generation logic
│
├── client/
│   ├── src/
│   │   ├── App.jsx          # Main React component
│   │   ├── App.css          # App styles
│   │   ├── ScrollingTextVideo.jsx    # Scrolling video UI
│   │   ├── ScrollingTextVideo.css    # Component styles
│   │   └── main.jsx         # React entry point
│   │
│   ├── public/              # Static assets
│   ├── index.html           # HTML template
│   ├── vite.config.js       # Vite configuration
│   └── package.json         # Client dependencies
│
├── package.json             # Root dependencies
├── README.md                # Project overview
├── SCROLLING_VIDEO_FEATURE.md    # Feature documentation
└── SETUP_GUIDE.md           # This file
```

## Configuration

### Changing Window Size

Edit `main/main.js`:

```javascript
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,  // Change this
    height: 900,  // Change this
    // ...
  });
}
```

### Changing Port

Edit `client/vite.config.js`:

```javascript
export default defineConfig({
  server: {
    port: 5173,  // Change this
  },
});
```

Then update `package.json` script:

```json
"start": "concurrently \"npm run dev --prefix client\" \"wait-on http://localhost:YOUR_PORT && cross-env ELECTRON_START_URL=http://localhost:YOUR_PORT electron .\""
```

## Testing the Scrolling Video Feature

### Quick Test

1. Start the application: `npm start`
2. The scrolling text video interface loads automatically
3. Click "📸 Select Image" - choose any image
4. Enter test text:
   ```
   This is a test of the scrolling video generator.
   It should scroll smoothly from bottom to top.
   Adjust the settings to customize your video!
   ```
5. Use default settings:
   - Width: 1920
   - Height: 1080
   - Scroll Speed: 100 px/s
   - Text Color: #ffffff
   - Font Size: 48px
   - Font Family: Arial
   - FPS: 30
6. Click "🎥 Generate Video"
7. Wait for generation (watch progress bar)
8. Video will be saved to Desktop

### Expected Output

- Progress bar shows frame generation (0-100%)
- Encoding phase (may show separate progress)
- Success message with file path
- Video file on Desktop named `scrolling-video-[timestamp].mp4`

## Performance Tips

### For Faster Development Testing

Use these settings for quick tests:

```
Width: 1280
Height: 720
Scroll Speed: 150 px/s
FPS: 24
Font Size: 36px
```

This generates fewer frames and processes faster.

### For Production Videos

Use these settings for best quality:

```
Width: 1920
Height: 1080
Scroll Speed: 75 px/s
FPS: 30
Font Size: 48px
```

## Common Workflows

### Creating a Credits Video

1. Use a dark, simple background image
2. Enter credits text (names, roles, etc.)
3. Settings:
   - Slow scroll speed (50-75 px/s)
   - Serif font (Georgia, Times New Roman)
   - White text (#ffffff)
   - Large font size (48-56px)

### Creating a Lyrics Video

1. Use an artistic background image
2. Enter song lyrics
3. Settings:
   - Medium scroll speed (75-100 px/s)
   - Clear sans-serif font (Arial, Helvetica)
   - Contrasting text color
   - Medium font size (42-48px)

### Creating an Announcement

1. Use branded background image
2. Enter announcement text
3. Settings:
   - Fast scroll speed (100-150 px/s)
   - Bold font (Impact, Arial Black)
   - Brand color for text
   - Large font size (56-64px)

## Updating the Application

To update dependencies:

```bash
# Update root dependencies
npm update

# Update client dependencies
cd client
npm update
cd ..
```

To add new features, edit the respective files and restart the dev server.

## Getting Help

### Debug Mode

To see detailed logs:

```bash
# Windows
set DEBUG=* && npm start

# Mac/Linux
DEBUG=* npm start
```

This shows all console logs, errors, and FFmpeg commands.

### Check Versions

```bash
node --version
npm --version
npx electron --version
```

### Community & Support

- Check the [feature documentation](SCROLLING_VIDEO_FEATURE.md)
- Review the code comments in `main/videoGenerator.js`
- Search skia-canvas issues: https://github.com/samizdatco/skia-canvas/issues

## Next Steps

After successful setup:
1. ✅ Test the scrolling text video feature end-to-end
2. ✅ Experiment with different settings
3. ✅ Create your first real video
4. ✅ Customize the UI (optional)

## Development Tips

### Hot Reload

Changes to React components auto-reload. For Electron main process changes:
1. Stop the app (Ctrl+C)
2. Run `npm start` again

### Debugging React

Use React DevTools in the Electron window:
1. Open DevTools (F12 or Ctrl+Shift+I)
2. Install React DevTools extension (if available)
3. Inspect components and state

### Debugging Electron

Add to `main/main.js`:

```javascript
win.webContents.openDevTools();  // Opens DevTools automatically
```

## Security Notes

- File paths are validated before processing
- No arbitrary code execution
- FFmpeg commands are parameterized
- Context isolation enabled in Electron
- Node integration disabled in renderer

## License

Part of the Slideshow Generator project.

