# XTTS (Bundled) - A1 Mode (Include model files in the installer)

This folder contains an **offline XTTS voice-over service** that you can bundle inside your Electron app.

## What you ship in the installer (A1)

Your Electron installer should include:

- `xtts/bin/xtts-server.exe` (the local HTTP server, built from Python)
- `xtts/models/` (the **pre-downloaded** Coqui TTS cache containing XTTS v2 model files)
- `xtts/voices/` (voice reference WAV files; each one becomes a selectable voice in the app)

When the app runs on another laptop, it starts `xtts-server.exe` locally and calls it over `http://127.0.0.1:<port>`.

## Folder layout

```
xtts/
  bin/
    xtts-server.exe
  models/
    (Coqui TTS cache directory; set as TTS_HOME)
  voices/
    alice.wav
    bob.wav
    ...
  server/
    xtts_server.py
    requirements.txt
```

## Build `xtts-server.exe` (developer machine)

1) Create a Python venv and install deps:

```powershell
cd xtts\server
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

2) Download/cache the XTTS model **into** `xtts/models/` (A1 requires it to be present before packaging).

Set `TTS_HOME` to point at `xtts/models` and run a one-time warmup:

```powershell
$env:TTS_HOME = (Resolve-Path "..\models").Path
python -c "from TTS.api import TTS; TTS('tts_models/multilingual/multi-dataset/xtts_v2', progress_bar=False)"
```

3) Build the exe using PyInstaller:

```powershell
pip install pyinstaller
pyinstaller --noconfirm --clean --onefile --name xtts-server xtts_server.py
```

Copy output:

```powershell
mkdir ..\bin -Force | Out-Null
copy .\dist\xtts-server.exe ..\bin\xtts-server.exe -Force
```

## Voices

Add voice reference WAVs to `xtts/voices/` (short, clean voice clips work best).

The app will show them in a dropdown and pass the selected WAV to XTTS for cloning.


