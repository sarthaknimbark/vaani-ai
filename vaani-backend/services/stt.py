import os
import tempfile

import numpy as np
import whisper

model = whisper.load_model("base")

WHISPER_OPTIONS = {
    "fp16": False,
    "language": "en",
    "no_speech_threshold": 0.35,
    "condition_on_previous_text": False,
}


def _detect_suffix(audio_bytes: bytes) -> str:
    if len(audio_bytes) >= 4 and audio_bytes[:4] == b"RIFF":
        return ".wav"
    if len(audio_bytes) >= 4 and audio_bytes[:4] == b"\x1aE\xdf\xa3":
        return ".webm"
    if len(audio_bytes) >= 8 and audio_bytes[4:8] == b"ftyp":
        return ".mp4"
    if len(audio_bytes) >= 4 and audio_bytes[:4] == b"OggS":
        return ".ogg"
    return ".webm"


def _audio_peak(path: str) -> float:
    try:
        audio = whisper.load_audio(path)
        return float(np.abs(audio).max())
    except Exception as exc:
        print(f"STT: load_audio diagnostic failed: {exc}")
        return 0.0


def speech_to_text(audio_bytes: bytes) -> str:
    if len(audio_bytes) < 100:
        print(f"STT: Audio too small ({len(audio_bytes)} bytes), skipping")
        return ""

    suffix = _detect_suffix(audio_bytes)
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
        f.write(audio_bytes)
        path = f.name

    try:
        print(f"STT: Processing {len(audio_bytes)} bytes ({suffix}) at {path}")
        peak = _audio_peak(path)
        print(f"STT: Decoded peak amplitude: {peak:.6f}")

        if peak < 1e-4:
            print("STT: Audio decodes as silence — check mic level or recording")
            return ""

        result = model.transcribe(path, **WHISPER_OPTIONS)
        text = (result.get("text") or "").strip()
        print(f"STT: Transcribed -> '{text}' (length: {len(text)})")

        if not text and peak > 1e-3:
            # Retry with array input if file path gave empty text despite signal
            audio = whisper.load_audio(path)
            audio = whisper.pad_or_trim(audio)
            mel = whisper.log_mel_spectrogram(audio).to(model.device)
            _, probs = model.detect_language(mel)
            print(f"STT: Detected languages: {probs}")
            result2 = model.transcribe(
                audio,
                **WHISPER_OPTIONS,
            )
            text = (result2.get("text") or "").strip()
            print(f"STT: Retry transcribed -> '{text}' (length: {len(text)})")

        return text
    except Exception as e:
        print(f"STT Error: {e}")
        import traceback

        traceback.print_exc()
        return "[Could not transcribe audio]"
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass
