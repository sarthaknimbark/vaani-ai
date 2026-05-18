import os
import whisper
import tempfile

model = whisper.load_model("base")

def speech_to_text(audio_bytes):
    # Validate audio size - too small means no real audio content
    if len(audio_bytes) < 100:
        print(f"STT: Audio too small ({len(audio_bytes)} bytes), skipping")
        return ""

    # Pick extension from container magic bytes for ffmpeg/whisper
    suffix = ".webm"
    if len(audio_bytes) >= 4:
        if audio_bytes[:4] == b"\x1aE\xdf\xa3":
            suffix = ".webm"
        elif audio_bytes[4:8] == b"ftyp" or audio_bytes[:4] in (b"\x00\x00\x00", b"ftyp"):
            suffix = ".mp4"
        elif audio_bytes[:4] == b"OggS":
            suffix = ".ogg"
        elif audio_bytes[:4] == b"RIFF":
            suffix = ".wav"

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
        f.write(audio_bytes)
        path = f.name

    try:
        print(f"STT: Processing audio file ({len(audio_bytes)} bytes) at {path}")
        result = model.transcribe(path, fp16=False)
        text = result["text"].strip()
        print(f"STT: Transcribed -> '{text}' (length: {len(text)})")
        return text
    except Exception as e:
        print(f"STT Error: {e}")
        import traceback
        traceback.print_exc()
        return "[Could not transcribe audio]"
    finally:
        # Clean up temp file
        try:
            os.unlink(path)
            print(f"STT: Cleaned up temp file {path}")
        except OSError:
            pass