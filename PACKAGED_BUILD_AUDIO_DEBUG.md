# Packaged Build Audio Debugging Guide

## Issues to Investigate

### 1. Audio Not Generated/Mixed in Packaged Builds
- **Symptom**: Video generates successfully but has no audio
- **Works in**: Dev mode
- **Fails in**: Packaged build (win-unpacked)

### 2. Temp Files in `xtts-tmp`
- **Location**: `C:\Users\zeesh\AppData\Roaming\slideshow-generator\xtts-tmp`
- **Cause**: PyInstaller onefile EXE extraction creates `_MEI*` folders
- **Status**: Expected behavior, cleanup code should handle this

## Debugging Steps

### Step 1: Check Console Logs
When running the packaged build, check for these log messages:

1. **XTTS Path Resolution**:
   ```
   [xttsManager] Packaged build - XTTS root: ...
   [xttsManager] process.resourcesPath: ...
   [xttsManager] getPaths() - root exists: true/false
   ```

2. **XTTS Server Startup**:
   ```
   [xttsManager] Spawning server on port: ...
   [xttsManager] Server became healthy on port: ...
   ```

3. **Audio Generation**:
   ```
   [main] XTTS synthesis request: ...
   [xttsManager] synthesizeWav() called: ...
   [xttsManager] Audio file saved successfully, size: ... bytes
   [main] XTTS synthesis succeeded: ...
   ```

4. **Worker Process**:
   ```
   [scrollingWorker] Temp dir: ...
   [scrollingWorker] XTTS audio file verified: ...
   [scrollingWorker] Audio file check: ...
   ```

### Step 2: Verify File Paths

Check if these paths exist in packaged build:

1. **XTTS Resources**:
   - `dist/win-unpacked/resources/xtts/bin/xtts-server.exe` (or onedir)
   - `dist/win-unpacked/resources/xtts/models/tts/.../model.pth`
   - `dist/win-unpacked/resources/xtts/voices/`

2. **Temp Directories**:
   - Video temp: `C:\Users\zeesh\AppData\Roaming\slideshow-generator\video-temp\scrolling-video-*`
   - XTTS temp: `C:\Users\zeesh\AppData\Roaming\slideshow-generator\xtts-tmp`

### Step 3: Check Audio File Creation

After generating a video, check if audio file exists:
- Look in: `C:\Users\zeesh\AppData\Roaming\slideshow-generator\video-temp\scrolling-video-*\narration-*.wav`
- File should be > 0 bytes

### Step 4: Common Issues

#### Issue A: XTTS Server Not Starting
**Symptoms**:
- Logs show "Failed to start XTTS server"
- No "Server became healthy" message

**Possible Causes**:
- XTTS executable not found
- Models directory missing
- Port conflict
- PyInstaller extraction failing

**Fix**: Check `process.resourcesPath` resolution

#### Issue B: Audio File Not Created
**Symptoms**:
- XTTS synthesis succeeds but file doesn't exist
- "Audio file not found after synthesis" error

**Possible Causes**:
- Path mismatch between worker and main process
- Permission issues
- Directory doesn't exist

**Fix**: Verify temp directory paths match

#### Issue C: Audio File Created But Not Mixed
**Symptoms**:
- Audio file exists and has size > 0
- Video has no audio track

**Possible Causes**:
- FFmpeg mixing command failing silently
- Audio file path incorrect in mixing step
- Audio format incompatible

**Fix**: Check FFmpeg logs and audio file path

## Enhanced Logging Added

The following logging has been added to help diagnose:

1. **File Existence Checks**: After XTTS synthesis, verify file exists
2. **File Size Verification**: Check audio file is not empty
3. **Path Logging**: Log all temp directories and file paths
4. **Error Details**: More detailed error messages with paths

## Next Steps

1. Run packaged build with console visible (F12 or check terminal)
2. Generate a video with XTTS narration
3. Collect all log messages starting with:
   - `[xttsManager]`
   - `[main] XTTS`
   - `[scrollingWorker]`
4. Check if audio file exists in temp directory
5. Share logs for further diagnosis




