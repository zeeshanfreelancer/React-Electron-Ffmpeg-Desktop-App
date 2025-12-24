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


def list_voice_wavs(voices_dir: Path):
    if not voices_dir.exists():
        return []
    wavs = sorted([p for p in voices_dir.glob("*.wav") if p.is_file()])
    return [{"id": p.stem, "label": p.stem, "filename": p.name} for p in wavs]


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
    return {"voices": list_voice_wavs(voices_dir_path)}


@app.post("/tts")
async def tts_endpoint(payload: dict):
    """
    payload:
      text: str
      language: str (e.g. 'en', 'es', ...)
      voiceId: str (stem of wav in voices dir) OR omit for default voice
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
        candidate = voices_dir_path / f"{voice_id}.wav"
        if not candidate.exists():
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


