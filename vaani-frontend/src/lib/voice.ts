export const VOICE_WS_URL =
  import.meta.env.VITE_VOICE_WS_URL ?? "ws://localhost:8000/ws/voice";

export const MIN_AUDIO_BYTES = 1500;
export const RECORDER_TIMESLICE_MS = 100;

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export function pickRecorderMimeType(): string {
  const found = MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
  if (!found) {
    throw new Error(
      "This browser does not support voice recording. Try Chrome or Edge."
    );
  }
  return found;
}

export function createMediaRecorder(stream: MediaStream): {
  recorder: MediaRecorder;
  mimeType: string;
} {
  const mimeType = pickRecorderMimeType();
  const recorder = new MediaRecorder(stream, {
    mimeType,
    audioBitsPerSecond: 128000,
  });
  return { recorder, mimeType };
}

export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}

export type VoiceTranscript = {
  type: "transcript";
  role: "user" | "ai";
  text: string;
  timestamp: string;
};

export type VoiceHandlers = {
  onTranscript: (msg: VoiceTranscript) => void;
  onAudioChunk?: (data: ArrayBuffer) => void;
  onReady?: () => void;
  onProcessingEnd?: () => void;
  onError?: (message: string) => void;
};

/** Wait until the server finishes its initial greeting. */
export function waitForVoiceReady(
  ws: WebSocket,
  timeoutMs = 15000
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      // May have already received greeting via existing listener — caller handles
    }

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Voice connection timed out"));
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      try {
        const data = JSON.parse(event.data) as { type?: string };
        if (data.type === "audio_complete") {
          cleanup();
          resolve();
        }
      } catch {
        /* ignore */
      }
    };

    const onError = () => {
      cleanup();
      reject(new Error("Voice connection failed"));
    };

    const onClose = () => {
      cleanup();
      reject(new Error("Voice connection closed"));
    };

    const cleanup = () => {
      clearTimeout(timer);
      ws.removeEventListener("message", onMessage);
      ws.removeEventListener("error", onError);
      ws.removeEventListener("close", onClose);
    };

    ws.addEventListener("message", onMessage);
    ws.addEventListener("error", onError);
    ws.addEventListener("close", onClose);
  });
}

export function attachVoiceMessageHandler(
  ws: WebSocket,
  handlers: VoiceHandlers
): () => void {
  const onMessage = (event: MessageEvent) => {
    if (typeof event.data === "string") {
      try {
        const data = JSON.parse(event.data) as {
          type?: string;
          role?: "user" | "ai";
          text?: string;
          timestamp?: string;
        };
        if (
          data.type === "transcript" &&
          data.role &&
          data.text != null &&
          data.timestamp
        ) {
          handlers.onTranscript({
            type: "transcript",
            role: data.role,
            text: data.text,
            timestamp: data.timestamp,
          });
        } else if (data.type === "audio_complete") {
          handlers.onProcessingEnd?.();
          handlers.onReady?.();
        }
      } catch {
        /* ignore malformed */
      }
    } else if (event.data instanceof ArrayBuffer) {
      handlers.onAudioChunk?.(event.data);
    } else if (event.data instanceof Blob) {
      void event.data.arrayBuffer().then((buf) => {
        handlers.onAudioChunk?.(buf);
      });
    }
  };

  ws.addEventListener("message", onMessage);
  return () => ws.removeEventListener("message", onMessage);
}

export async function sendAudioOnSocket(
  ws: WebSocket,
  blob: Blob
): Promise<void> {
  if (ws.readyState !== WebSocket.OPEN) {
    throw new Error("Voice connection is not open");
  }
  if (blob.size < MIN_AUDIO_BYTES) {
    throw new Error("Recording too short — speak a bit longer and try again");
  }
  const buffer = await blobToArrayBuffer(blob);
  ws.send(buffer);
}

export async function getMicrophoneStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}
