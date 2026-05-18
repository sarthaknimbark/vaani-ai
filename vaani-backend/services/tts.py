import os
from camb.client import CambAI
from dotenv import load_dotenv
from camb.types import StreamTtsOutputConfiguration

load_dotenv()

API_KEY = os.getenv("CAMB_API_KEY")
if not API_KEY:
    print("Warning: CAMB_API_KEY not found in environment variables")

try:
    client = CambAI(api_key=API_KEY)
    print("CambAI client initialized successfully")
except Exception as e:
    print(f"Error initializing CambAI: {e}")
    client = None

# mars-flash = lowest latency; fast=True adds quick-delivery hint for instruct-capable paths
FAST_SPEECH_MODEL = "mars-flash"
FAST_VOICE_PREFIX = ""


def stream_tts(text, fast: bool = False):
    """Stream text to speech audio."""
    if not text or not text.strip():
        print("TTS: Empty text provided")
        return

    if client is None:
        print("TTS: CambAI client not initialized")
        return

    spoken = text.strip()
    if fast and len(spoken) < 200:
        spoken = f"{FAST_VOICE_PREFIX}{spoken}"

    try:
        print(f"TTS: Generating audio ({len(spoken)} chars, fast={fast})")
        for chunk in client.text_to_speech.tts(
            text=spoken,
            language="en-us",
            voice_id=147342,
            speech_model=FAST_SPEECH_MODEL,
            output_configuration=StreamTtsOutputConfiguration(format="wav"),
        ):
            if chunk:
                yield chunk
        print("TTS: Audio generation completed")
    except Exception as e:
        print(f"TTS Error: {e}")
        import traceback

        traceback.print_exc()
        return
