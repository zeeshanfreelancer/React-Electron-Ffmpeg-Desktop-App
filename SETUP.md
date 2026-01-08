# 🚀 Setup Guide - Slideshow Generator

Complete step-by-step guide to set up the Slideshow Generator project after cloning from GitHub.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Installing Git LFS](#installing-git-lfs)
4. [Cloning the Repository](#cloning-the-repository)
5. [Installing Dependencies](#installing-dependencies)
6. [Setting Up XTTS Server](#setting-up-xtts-server)
7. [Verifying Installation](#verifying-installation)
8. [Running the Application](#running-the-application)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

1. **Node.js** (v16 or higher)
   - Download: https://nodejs.org/
   - Verify installation:
     ```bash
     node --version
     npm --version
     ```

2. **Git** (with Git LFS support)
   - Download: https://git-scm.com/downloads
   - Verify installation:
     ```bash
     git --version
     git lfs version
     ```

3. **Python 3.10 or 3.11** (for XTTS server)
   - Download: https://www.python.org/downloads/
   - **Important**: Check "Add Python to PATH" during installation
   - Verify installation:
     ```bash
     python --version
     pip --version
     ```

4. **Microsoft Visual C++ Redistributable 2015-2022 (x64)**
   - Required for PyInstaller executables
   - Download: https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist
   - Install the x64 version

### Platform-Specific Requirements

#### Windows
- Windows 10 or later
- Administrator privileges (for some installations)
- PowerShell or Command Prompt

#### macOS
- macOS 10.15 or later
- Xcode Command Line Tools:
  ```bash
  xcode-select --install
  ```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install -y build-essential libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev librsvg2-dev python3-pip
```

---

## Initial Setup

### Step 1: Install Git LFS

Git LFS (Large File Storage) is required to download large model files and executables.

#### Windows
1. Download Git LFS from: https://git-lfs.github.com/
2. Run the installer
3. Or if you have Git for Windows, it may already be included

#### macOS
```bash
brew install git-lfs
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt-get install git-lfs

# Or download from: https://git-lfs.github.com/
```

#### Verify Git LFS Installation
```bash
git lfs version
# Should show: git-lfs/x.x.x
```

#### Initialize Git LFS (One-time setup)
```bash
git lfs install
```

---

## Cloning the Repository

### Step 2: Clone the Repository

```bash
# Clone the repository
git clone <your-repository-url>
cd slideshow-generator
```

**Important**: If you already cloned without LFS, run:
```bash
git lfs pull
```

This downloads all large files tracked by Git LFS.

### Step 3: Verify Large Files Were Downloaded

Check that XTTS models and executables are present:

```bash
# Windows (PowerShell)
Test-Path "xtts\models\tts\tts_models--multilingual--multi-dataset--xtts_v2\model.pth"
Test-Path "xtts\bin\xtts-server.exe"

# Mac/Linux
ls -lh xtts/models/tts/tts_models--multilingual--multi-dataset--xtts_v2/model.pth
ls -lh xtts/bin/xtts-server.exe
```

If files are missing or show as "pointer" files, run:
```bash
git lfs pull
```

---

## Installing Dependencies

### Step 4: Install Root Dependencies

Install all Node.js dependencies for the main Electron application:

```bash
# From the project root directory
npm install
```

**Expected output:**
- Downloads and installs Electron, Skia Canvas, FFmpeg, and other dependencies
- May take 2-5 minutes depending on your internet connection
- `skia-canvas` will download platform-specific binaries

**Troubleshooting:**
- If `skia-canvas` fails, see [Troubleshooting](#troubleshooting) section
- If you see network errors, check your firewall/proxy settings

### Step 5: Install Client Dependencies

Install React and Vite dependencies for the frontend:

```bash
cd client
npm install
cd ..
```

**Expected output:**
- Installs React, Vite, and development tools
- Usually completes in 30-60 seconds

---

## Setting Up XTTS Server

### Step 6: Set Up Python Virtual Environment

The XTTS server requires a Python virtual environment:

```bash
# Navigate to XTTS server directory
cd xtts/server

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.venv\Scripts\Activate.ps1

# Windows (Command Prompt):
.venv\Scripts\activate.bat

# Mac/Linux:
source .venv/bin/activate
```

**Note**: If PowerShell execution policy blocks activation:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Step 7: Install Python Dependencies

With the virtual environment activated:

```bash
# Make sure you're in xtts/server directory
pip install --upgrade pip
pip install -r requirements.txt
```

**Expected output:**
- Downloads and installs PyTorch, TTS, and other Python packages
- **This may take 10-20 minutes** and requires several GB of disk space
- Progress bars will show download/installation status

**Troubleshooting:**
- If pip fails, ensure Python is in your PATH
- If PyTorch download fails, check your internet connection (PyTorch is large ~2GB)
- On Windows, you may need Visual C++ Build Tools

### Step 8: Verify XTTS Server Executable

The XTTS server executable should already be included via Git LFS:

```bash
# From project root
# Windows
Test-Path "xtts\bin\xtts-server.exe"

# Mac/Linux
ls -lh xtts/bin/xtts-server.exe
```

If the executable is missing:
1. Ensure Git LFS is installed and initialized
2. Run `git lfs pull` to download large files
3. If still missing, you may need to build it (see [Building XTTS Server](#building-xtts-server-optional))

### Step 9: Verify XTTS Models

Check that model files are present:

```bash
# Windows (PowerShell)
$modelPath = "xtts\models\tts\tts_models--multilingual--multi-dataset--xtts_v2"
Test-Path "$modelPath\model.pth"
Test-Path "$modelPath\config.json"
Test-Path "$modelPath\vocab.json"
Test-Path "$modelPath\speakers_xtts.pth"

# Mac/Linux
ls -lh xtts/models/tts/tts_models--multilingual--multi-dataset--xtts_v2/
```

**Expected files:**
- `model.pth` (~1.5GB)
- `config.json`
- `vocab.json`
- `speakers_xtts.pth`
- `hash.md5`

If models are missing:
1. Run `git lfs pull` to download
2. Check your Git LFS quota (GitHub free tier: 1GB storage, 1GB bandwidth/month)
3. If quota exceeded, download models manually (see [Manual Model Download](#manual-model-download-optional))

---

## Verifying Installation

### Step 10: Verify All Components

Run these checks to ensure everything is installed:

```bash
# Check Node.js version
node --version
# Should show: v16.x.x or higher

# Check npm packages
npm list --depth=0

# Check Python version
python --version
# Should show: Python 3.10.x or 3.11.x

# Check XTTS server executable
# Windows
Test-Path "xtts\bin\xtts-server.exe"
# Mac/Linux
test -f xtts/bin/xtts-server.exe && echo "Found" || echo "Missing"

# Check XTTS models
# Windows
Test-Path "xtts\models\tts\tts_models--multilingual--multi-dataset--xtts_v2\model.pth"
# Mac/Linux
test -f xtts/models/tts/tts_models--multilingual--multi-dataset--xtts_v2/model.pth && echo "Found" || echo "Missing"
```

---

## Running the Application

### Step 11: Start the Application

From the project root directory:

```bash
npm start
```

**What this does:**
1. Starts the Vite dev server (React frontend) on `http://localhost:5173`
2. Waits for the server to be ready
3. Launches the Electron application window

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

**First Launch:**
- The XTTS server will automatically start in the background
- First startup may take 1-3 minutes (model loading)
- You'll see "Connecting to XTTS server..." in the UI
- Once ready, you can generate videos with narration

### Step 12: Test the Application

1. **Test Basic Video Generation:**
   - Click "📸 Select Image" and choose an image
   - Enter some text
   - Click "🎥 Generate Video"
   - Wait for generation to complete

2. **Test XTTS Narration:**
   - Go to "Advanced" tab → "Audio Settings"
   - Select "XTTS" as narration provider
   - Choose a voice from "XTTS Voice" dropdown
   - Enter narration text
   - Generate a video with audio

3. **Test System Voice (Windows):**
   - Select "System Voices" as narration provider
   - Choose a Windows voice
   - Generate a video

---

## Troubleshooting

### Git LFS Issues

**Problem**: Files show as "pointer" files instead of actual files
```bash
# Solution: Pull LFS files
git lfs pull

# Verify LFS is working
git lfs ls-files
```

**Problem**: "git-lfs: command not found"
```bash
# Install Git LFS (see Step 1)
# Then initialize:
git lfs install
```

**Problem**: LFS quota exceeded
- GitHub free tier: 1GB storage, 1GB bandwidth/month
- Options:
  1. Wait for quota reset (monthly)
  2. Upgrade GitHub account
  3. Download models manually (see below)

### Node.js Installation Issues

**Problem**: `skia-canvas` installation fails
```bash
# Clear npm cache
npm cache clean --force

# Remove and reinstall
npm uninstall skia-canvas
npm install skia-canvas --verbose

# Check firewall/proxy settings
```

**Problem**: Port 5173 already in use
```bash
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:5173 | xargs kill -9
```

### Python/XTTS Issues

**Problem**: Python not found
- Ensure Python is installed and added to PATH
- Restart terminal after Python installation
- Verify: `python --version`

**Problem**: Virtual environment activation fails (Windows PowerShell)
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Problem**: PyTorch installation fails
- Check internet connection (PyTorch is ~2GB)
- Try installing with specific index:
  ```bash
  pip install torch --index-url https://download.pytorch.org/whl/cpu
  ```

**Problem**: XTTS server won't start
- Check that executable exists: `xtts/bin/xtts-server.exe`
- Check that models exist: `xtts/models/tts/.../model.pth`
- Check console for error messages
- Ensure Visual C++ Redistributable is installed

### Application Issues

**Problem**: Electron won't start
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
rm -rf client/node_modules client/package-lock.json
npm install
cd client && npm install && cd ..
npm start
```

**Problem**: XTTS server connection fails
- First startup takes 1-3 minutes (model loading)
- Check console for "Model initialization error"
- Try restarting the app
- Check that port 8045 is not in use:
  ```bash
  # Windows
  netstat -ano | findstr :8045
  
  # Mac/Linux
  lsof -i :8045
  ```

**Problem**: Video generation fails
- Check that FFmpeg is working: `npm list ffmpeg-static`
- Check console for error messages
- Ensure sufficient disk space (2GB+ recommended)
- Check that temp directory is writable

---

## Building XTTS Server (Optional)

If the XTTS server executable is missing or you need to rebuild it:

### Prerequisites
- Python 3.10 or 3.11 installed
- PyInstaller installed: `pip install pyinstaller`
- All Python dependencies installed (see Step 7)

### Build Steps

```bash
# Navigate to XTTS server directory
cd xtts/server

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

# Build executable
pyinstaller xtts-server.spec

# The executable will be in:
# Windows: xtts/server/dist/xtts-server.exe
# Copy it to: xtts/bin/xtts-server.exe
```

---

## Manual Model Download (Optional)

If Git LFS quota is exceeded, download models manually:

1. **Download XTTS v2 Model:**
   - Visit: https://huggingface.co/coqui/XTTS-v2
   - Download model files to: `xtts/models/tts/tts_models--multilingual--multi-dataset--xtts_v2/`
   - Required files:
     - `model.pth`
     - `config.json`
     - `vocab.json`
     - `speakers_xtts.pth`
     - `hash.md5`

2. **Verify Model Files:**
   ```bash
   # Windows
   Get-ChildItem "xtts\models\tts\tts_models--multilingual--multi-dataset--xtts_v2\" | Select-Object Name, Length
   
   # Mac/Linux
   ls -lh xtts/models/tts/tts_models--multilingual--multi-dataset--xtts_v2/
   ```

---

## Project Structure

```
slideshow-generator/
├── main/                    # Electron main process
│   ├── main.js             # Main entry point
│   ├── preload.js          # Context bridge
│   ├── videoGenerator.js   # Video generation
│   ├── xttsManager.js      # XTTS server management
│   └── workers/            # Worker processes
│       └── scrollingWorker.js
│
├── client/                 # React frontend
│   ├── src/               # Source code
│   ├── dist/              # Build output (generated)
│   └── package.json       # Client dependencies
│
├── xtts/                   # XTTS server and models
│   ├── bin/               # XTTS server executable (LFS)
│   ├── models/            # XTTS model files (LFS)
│   ├── voices/            # Voice samples
│   └── server/            # Python server source
│       ├── xtts_server.py
│       ├── requirements.txt
│       └── xtts-server.spec
│
├── .gitattributes         # Git LFS configuration
├── .gitignore            # Git ignore rules
├── package.json          # Root dependencies
└── SETUP.md              # This file
```

---

## Next Steps

After successful setup:

1. ✅ **Test Basic Features:**
   - Generate a scrolling text video
   - Test different video settings
   - Try different fonts and colors

2. ✅ **Test Audio Features:**
   - Generate narration with XTTS
   - Test System Voices (Windows)
   - Test Google TTS
   - Add background music

3. ✅ **Explore Advanced Features:**
   - Pan/Zoom video generation
   - Custom voice settings
   - Video export formats

4. ✅ **Build Production Version:**
   ```bash
   npm run build
   ```
   Creates distributable in `dist/` directory

---

## Getting Help

### Check Logs
- Electron console: Press `F12` or `Ctrl+Shift+I` in the app
- Terminal output: Check the terminal where you ran `npm start`

### Common Issues
- Review the [Troubleshooting](#troubleshooting) section
- Check console for specific error messages
- Verify all prerequisites are installed

### Support
- Check project documentation files
- Review code comments in source files
- Open an issue on GitHub (if applicable)

---

## System Requirements

### Minimum Requirements
- **OS**: Windows 10, macOS 10.15, or Linux (Ubuntu 20.04+)
- **RAM**: 8GB (16GB recommended for video generation)
- **Storage**: 10GB free space (for dependencies and models)
- **CPU**: Multi-core processor (4+ cores recommended)
- **GPU**: Optional (CPU-only works, GPU speeds up XTTS)

### Recommended Requirements
- **RAM**: 16GB+
- **Storage**: 20GB+ free space
- **CPU**: 8+ cores
- **GPU**: NVIDIA GPU with CUDA support (for faster XTTS)

---

## License

Part of the Slideshow Generator project.

---

**Last Updated**: 2024
**Version**: 1.0.0


