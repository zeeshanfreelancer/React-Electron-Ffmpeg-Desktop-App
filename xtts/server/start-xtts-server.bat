@echo off
REM Helper script to run the XTTS server from Python source
REM Usage: start-xtts-server.bat --host HOST --port PORT --models-dir DIR --voices-dir DIR

cd /d "%~dp0"

REM Check if TTS is installed
python -c "import TTS" 2>nul
if errorlevel 1 (
    echo [XTTS] TTS package not found. Installing dependencies...
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [XTTS] Failed to install dependencies.
        exit /b 1
    )
)

REM Run the server (pass all arguments as-is)
python xtts_server.py %*

