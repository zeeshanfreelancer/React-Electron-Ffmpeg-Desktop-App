import io
import os
import argparse
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response

import soundfile as sf


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8045)
    p.add_argument("--models-dir", default="")
    p.add_argument("--voices-dir", default="")
    return p.parse_args()


def list_voice_audio_files(voices_dir: Path):
    """List all supported audio files in the voices directory.
    Supports: .wav, .mp3, .flac, .ogg, .m4a, .aac
    """
    if not voices_dir.exists():
        return []
    
    # Supported audio formats (soundfile supports: wav, flac, ogg)
    # For MP3/M4A/AAC, we'll rely on Coqui TTS's internal handling
    audio_extensions = ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac']
    
    audio_files = []
    for ext in audio_extensions:
        audio_files.extend([p for p in voices_dir.glob(f"*{ext}") if p.is_file()])
    
    # Sort by stem (base name) first, then by extension preference (prefer .wav)
    ext_priority = {'.wav': 0, '.flac': 1, '.ogg': 2, '.mp3': 3, '.m4a': 4, '.aac': 5}
    audio_files.sort(key=lambda p: (p.stem.lower(), ext_priority.get(p.suffix.lower(), 99)))
    
    # If multiple formats exist for the same stem, prefer WAV
    seen_stems = {}
    unique_files = []
    for p in audio_files:
        stem = p.stem
        if stem not in seen_stems:
            seen_stems[stem] = p
            unique_files.append(p)
        elif p.suffix.lower() == '.wav':
            # Replace with WAV if we found a WAV version
            idx = unique_files.index(seen_stems[stem])
            unique_files[idx] = p
            seen_stems[stem] = p
    
    return [{"id": p.stem, "label": p.stem, "filename": p.name} for p in unique_files]


def load_xtts(models_dir: Path):
    # IMPORTANT (A1 bundling):
    # We set TTS_HOME to a directory that already contains the cached model files.
    # This prevents runtime downloads on the target machine.
    if models_dir and str(models_dir).strip():
        os.environ["TTS_HOME"] = str(models_dir)

    # Lazy import (heavy) so `--help` is fast
    from TTS.api import TTS  # noqa: WPS433

    # This will load from TTS_HOME cache if present.
    return TTS("tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=False)


app = FastAPI()
tts = None
voices_dir_path = None
models_dir_path = None


@app.get("/health")
def health():
    return {"ok": True, "modelLoaded": tts is not None}


@app.get("/voices")
def voices():
    assert voices_dir_path is not None
    return {"voices": list_voice_audio_files(voices_dir_path)}


@app.post("/tts")
async def tts_endpoint(payload: dict):
    """
    payload:
      text: str
      language: str (e.g. 'en', 'es', ...)
      voiceId: str (stem of audio file in voices dir) OR omit for default voice
              Supports: .wav, .mp3, .flac, .ogg, .m4a, .aac
    returns: audio/wav bytes
    """
    global tts
    # Lazy-load model: lets /health + /voices respond immediately on startup.
    # First /tts call may take a while (model load + warmup).
    if tts is None:
        assert models_dir_path is not None
        try:
            tts = load_xtts(models_dir_path)
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=500, detail=f"Failed to initialize XTTS: {e}")

    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Missing text")

    language = (payload.get("language") or "en").strip()
    voice_id = (payload.get("voiceId") or payload.get("voice") or "").strip()

    speaker_wav = None
    if voice_id:
        assert voices_dir_path is not None
        # Try to find the voice file by checking common audio formats
        # Priority: check if a specific filename was provided (for backward compatibility),
        # otherwise try common extensions
        candidate = None
        
        # First, get the list of available voices to find the exact filename
        available_voices = list_voice_audio_files(voices_dir_path)
        voice_match = next((v for v in available_voices if v["id"] == voice_id), None)
        
        if voice_match:
            # Use the exact filename from the voices list
            candidate = voices_dir_path / voice_match["filename"]
        else:
            # Fallback: try common extensions in order of preference
            for ext in ['.wav', '.flac', '.ogg', '.mp3', '.m4a', '.aac']:
                test_path = voices_dir_path / f"{voice_id}{ext}"
                if test_path.exists():
                    candidate = test_path
                    break
        
        if not candidate or not candidate.exists():
            raise HTTPException(status_code=400, detail=f"Voice '{voice_id}' not found")
        speaker_wav = str(candidate)

    try:
        if speaker_wav:
            wav = tts.tts(text=text, speaker_wav=speaker_wav, language=language)
        else:
            # If no voice provided, XTTS will use its default speaker.
            wav = tts.tts(text=text, language=language)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))

    # Write wav array to in-memory WAV bytes
    buf = io.BytesIO()
    sf.write(buf, wav, 24000, format="WAV")
    return Response(content=buf.getvalue(), media_type="audio/wav")


def main():
    global voices_dir_path, models_dir_path
    args = parse_args()
    models_dir_path = Path(args.models_dir).resolve() if args.models_dir else Path()
    voices_dir_path = Path(args.voices_dir).resolve() if args.voices_dir else Path()

    import uvicorn  # noqa: WPS433

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()


