# Video Generation Flow - Advanced Video Generator

This document explains how audio and video generation works in the Advanced Video Generator feature.

## High-Level Flow Overview

```
User Input (UI) 
  ↓
IPC Handler (main.js)
  ↓
Video Generator (videoGenerator.js)
  ├── Audio Generation (FIRST - if enabled)
  ├── Frame Rendering (MIDDLE)
  └── Video Encoding + Audio Mixing (LAST)
  ↓
Final Video Output
```

## Detailed Step-by-Step Flow

### 1. **User Triggers Generation** (`Studio.jsx`)

**Location:** `client/src/features/studio/Studio.jsx:1290-1325`

- User clicks "Generate Video" button
- `handleGenerate()` function:
  - Validates inputs (images, text, dimensions, etc.)
  - Calls `buildConfig()` to create options object
  - Sets loading state (`setIsGenerating(true)`)
  - Calls `window.electronAPI.generateScrollingVideo(options)`

**Key Options Built:**
```javascript
{
  imagePath, imagePaths, videoPath,  // Visual content
  text, texts,                        // Text to display
  width, height, fps,                 // Video specs
  narration: {
    enabled: true/false,
    text: "narration text",
    language: "en",
    provider: "xtts" | "system" | "google",
    voiceName: "voice-id"
  },
  backgroundMusic: { enabled, path, volume, fadeIn, fadeOut },
  // ... styling options
}
```

---

### 2. **IPC Handler** (`main.js`)

**Location:** `main/main.js:397-427`

- Listens for `'generate-scrolling-video'` IPC event
- Creates progress callback that sends updates to renderer via `'scrolling-video-progress'`
- Handles cancellation state
- Calls `generateScrollingVideo()` from `videoGenerator.js`
- Sends results back:
  - `'scrolling-video-done'` on success
  - `'scrolling-video-error'` on error
  - `'scrolling-video-cancelled'` if cancelled

---

### 3. **Audio Generation Phase** (FIRST - if enabled)

**Location:** `main/videoGenerator.js:273-294`

#### 3.1 Check if Narration is Needed
```javascript
const shouldGenerateNarration = 
  Boolean(narrationOptions.enabled) &&
  Boolean(narrationOptions.text && narrationOptions.text.trim().length > 0);
```

#### 3.2 Generate Narration Audio
If narration is enabled, calls `generateNarrationAudio()`:

**Location:** `main/videoGenerator.js:1219-1314`

**Provider Routing:**
- **XTTS Provider** (`generateXttsNarrationAudio`):
  - **Location:** `main/videoGenerator.js:1193-1217`
  - Calls `xttsManager.synthesizeWav()`
  - **XTTS Manager Flow** (`main/xttsManager.js:320-384`):
    1. Ensures XTTS server is running (`ensureRunning()`)
       - Checks if server exists on known port (8045)
       - If not, spawns Python wrapper: `python xtts_server_wrapper.py`
       - Server runs on `http://127.0.0.1:8045`
    2. Sends POST request to `/tts` endpoint:
       ```json
       {
         "text": "narration text",
         "language": "en",
         "voiceId": "voice-female-1"
       }
       ```
    3. XTTS server:
       - Lazy-loads XTTS model (first call takes 1-2 min)
       - Generates WAV audio from text
       - Returns audio bytes
    4. Saves WAV file to temp directory
    5. Returns path to audio file
  
- **System Provider** (`generateSystemNarrationAudioWindows`):
  - **Location:** `main/videoGenerator.js:1138-1191`
  - Uses Windows PowerShell + SAPI (System.Speech)
  - Generates WAV file directly using system TTS
  - No external server needed
  
- **Google Provider** (default):
  - Uses `gTTS` npm package
  - Makes HTTP request to Google TTS API
  - Downloads MP3 file
  - Saves to temp directory

**Result:** `narrationAudioPath` = path to generated audio file (WAV or MP3)

#### 3.3 Background Music Setup
- If enabled, uses provided music file path
- No generation needed, just tracks the path

---

### 4. **Frame Rendering Phase** (MIDDLE)

**Location:** `main/videoGenerator.js:369-659`

#### 4.1 Setup
- Creates temporary directory for frames
- Creates Canvas instances for rendering
- Pre-computes total frame count for progress tracking

#### 4.2 Per-Slide Processing
For each slide in `slideConfigs`:

1. **Load Background Assets:**
   - Loads image/video background
   - Caches images for multi-image slides
   - Applies filters/transformations

2. **Calculate Slide Duration:**
   - Based on text scroll distance and scroll speed
   - Or uses explicit duration if provided
   - Calculates: `slideFrames = Math.ceil(slideDuration * fps)`

3. **Generate Frames Sequentially:**
   - **Location:** `main/videoGenerator.js:455-622`
   - For each frame (0 to slideFrames):
     - **Draw Background:**
       - Applies color adjustments (brightness, contrast, saturation)
       - Applies image filters (sepia, grayscale, etc.)
       - Handles crop/rotation if enabled
     
     - **Draw Text:**
       - Calculates scroll position based on frame number
       - Applies text styling (font, color, size)
       - Applies text effects (bold, italic, outline, shadow, gradient)
       - Applies text animations (fade, zoom, pulse, etc.)
       - Word-wraps text to fit width
       - Renders text at calculated scroll position
     
     - **Draw Subtitles (if enabled):**
       - Renders subtitle text at bottom of screen
       - Times subtitles based on current frame
     
     - **Save Frame:**
       - Converts canvas to JPEG buffer (quality: 0.95)
       - Saves to temp directory: `frame000001.jpg`, `frame000002.jpg`, etc.
     
     - **Progress Reporting:**
       - Reports progress ~once per second to keep UI responsive
       - Updates: `{ type: 'frame', progress: X%, current: X, total: Y }`

4. **Frame Offset Tracking:**
   - Tracks cumulative frame count across all slides
   - `frameOffset += slideFrames`

#### 4.3 Key Design Decisions
- **Sequential Rendering:** Frames are rendered one-by-one (not parallelized)
- **Reason:** Prevents blocking Electron's event loop
- **Progress Yielding:** Yields to event loop every 5 frames to keep UI responsive

---

### 5. **Video Encoding Phase**

**Location:** `main/videoGenerator.js:665-685`

- **Encode Video from Frames:**
  - Uses FFmpeg to encode JPEG frames into video
  - Input: All frame JPEG files from temp directory
  - Output: Video file (MP4/MOV/WebM) WITHOUT audio
  - Applies quality preset (low/medium/high/ultra)
  - Uses custom bitrate if specified
  - Progress: ~85% complete

**Temporary Output:** `scrolling-video-{timestamp}-video.mp4`

---

### 6. **Audio Mixing Phase** (if audio exists)

**Location:** `main/videoGenerator.js:687-703`

If narration or background music exists, calls `mixAllAudio()`:

**Location:** `main/videoGenerator.js:930-1044`

#### 6.1 FFmpeg Audio Mixing
Uses FFmpeg's complex filter system:

1. **Inputs:**
   - Video file (no audio)
   - Narration audio (if exists)
   - Background music (if exists)

2. **Audio Processing:**
   - **Narration:** Adds padding if needed
   - **Background Music:**
     - Applies volume adjustment
     - Applies fade-in effect (if enabled)
     - Applies fade-out effect (if enabled, based on video duration)
   - **Mixing:** Combines narration + music using `amix` filter
   - Uses first audio duration (prevents audio cutting off)

3. **Output:**
   - Maps video stream from input
   - Maps mixed audio stream
   - Encodes with appropriate codec (AAC for MP4, Opus for WebM)
   - Saves: `scrolling-video-{timestamp}-with-audio.mp4`

**Progress:** ~95% complete

---

### 7. **Final Output & Cleanup**

**Location:** `main/videoGenerator.js:705-732`

1. **Copy to Final Location:**
   - Copies final video to user's output directory (or Desktop)
   - Filename: `scrolling-video-{timestamp}.mp4`

2. **Additional Exports** (if enabled):
   - **GIF Export:** Converts video to animated GIF
   - **Image Sequence:** Copies all frames to folder
   - **Thumbnail:** Generates thumbnail image from first frame

3. **Cleanup:**
   - Deletes temporary directory and all files
   - Cleans up frame JPEGs, audio files, temp videos

4. **Return:**
   - Returns final output path
   - IPC handler sends `'scrolling-video-done'` to renderer
   - UI updates with success message

---

## Progress Updates Flow

Progress updates flow back to UI via IPC:

```
videoGenerator.js
  → progressCallback({ type, progress, message, current, total })
  → main.js progressCallback
    → event.sender.send('scrolling-video-progress', progress)
      → Studio.jsx listens for 'scrolling-video-progress'
        → Updates state: setProgress(), setProgressMessage()
          → UI re-renders with progress bar
```

**Progress Types:**
- `'audio'` - Audio generation phase
- `'frame'` - Frame rendering phase
- `'encoding'` - Video encoding phase
- `'audio-mix'` - Audio mixing phase

---

## Key Files & Responsibilities

| File | Responsibility |
|------|---------------|
| `client/src/features/studio/Studio.jsx` | UI, user input, state management |
| `main/main.js` | IPC handlers, event routing |
| `main/videoGenerator.js` | Main orchestration, frame rendering, audio mixing |
| `main/xttsManager.js` | XTTS server management, HTTP requests to XTTS |
| `xtts/server/xtts_server_wrapper.py` | Python wrapper, starts XTTS FastAPI server |
| `xtts/server/xtts_server.py` | XTTS FastAPI server, model loading, TTS generation |

---

## Audio Provider Comparison

| Provider | Server | Speed | Quality | Offline | Setup |
|----------|--------|-------|---------|---------|-------|
| **XTTS** | Local Python | Slow (1-2 min first call) | High | ✅ Yes | Complex (needs models) |
| **System** | None (OS) | Fast | Medium | ✅ Yes | Simple (built-in) |
| **Google** | Cloud API | Medium | High | ❌ No | Simple (requires internet) |

---

## Performance Characteristics

- **Frame Rendering:** CPU-intensive, sequential to keep UI responsive
- **Video Encoding:** FFmpeg handles encoding (multi-threaded)
- **Audio Generation:** 
  - XTTS: Slow first call (model load), fast subsequent calls
  - System: Fast (native OS)
  - Google: Network dependent
- **Audio Mixing:** FFmpeg handles (fast, efficient)

---

## Error Handling

- **Cancellation:** Checked before each major phase, throws error to stop generation
- **Audio Generation:** Retries with exponential backoff (Google TTS), server restart (XTTS)
- **Cleanup:** Always cleans temp directory, even on error
- **Progress:** Errors sent via IPC `'scrolling-video-error'` event

