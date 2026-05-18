const TARGET_SAMPLE_RATE = 16000;

function encodeWavMono(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

/** Convert browser recording (WebM/MP4) to 16 kHz mono WAV for reliable Whisper STT. */
export async function recordingBlobToWav(blob: Blob): Promise<Blob> {
  if (blob.type.includes("wav")) {
    return blob;
  }

  const arrayBuffer = await blob.arrayBuffer();
  if (arrayBuffer.byteLength < 100) {
    throw new Error("Recording is empty");
  }

  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const frames = Math.max(
      1,
      Math.ceil(decoded.duration * TARGET_SAMPLE_RATE)
    );
    const offline = new OfflineAudioContext(1, frames, TARGET_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    const pcm = rendered.getChannelData(0);
    const wavBuffer = encodeWavMono(pcm, TARGET_SAMPLE_RATE);
    return new Blob([wavBuffer], { type: "audio/wav" });
  } finally {
    await ctx.close();
  }
}
