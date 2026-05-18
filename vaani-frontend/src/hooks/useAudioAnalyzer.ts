import { useEffect, useRef, useState } from "react";

const BAR_COUNT = 24;
const SMOOTHING = 0.82;
const MIN_LEVEL = 0.1;
const MAX_LEVEL = 1;

function createIdleLevels(): number[] {
  return Array.from({ length: BAR_COUNT }, (_, i) => {
    const wave = Math.sin(i * 0.45) * 0.06;
    return MIN_LEVEL + 0.04 + wave;
  });
}

export function useAudioAnalyzer(
  stream: MediaStream | null,
  enabled: boolean
): { levels: number[]; voiceDetected: boolean; averageLevel: number } {
  const [levels, setLevels] = useState<number[]>(createIdleLevels);
  const [voiceDetected, setVoiceDetected] = useState(false);
  const [averageLevel, setAverageLevel] = useState(0.15);
  const smoothedRef = useRef<number[]>(createIdleLevels());
  const voiceHoldRef = useRef(0);

  useEffect(() => {
    if (!stream || !enabled) {
      smoothedRef.current = createIdleLevels();
      setLevels(createIdleLevels());
      setVoiceDetected(false);
      setAverageLevel(0.15);
      return;
    }

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.88;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      const step = Math.max(1, Math.floor(dataArray.length / BAR_COUNT));
      let sum = 0;

      for (let i = 0; i < BAR_COUNT; i++) {
        let bandSum = 0;
        for (let j = 0; j < step; j++) {
          bandSum += dataArray[i * step + j] ?? 0;
        }
        const raw = bandSum / step / 255;
        const prev = smoothedRef.current[i];
        const next = prev * SMOOTHING + raw * (1 - SMOOTHING);
        smoothedRef.current[i] = Math.max(
          MIN_LEVEL,
          Math.min(MAX_LEVEL, next)
        );
        sum += smoothedRef.current[i];
      }

      const avg = sum / BAR_COUNT;
      setLevels([...smoothedRef.current]);
      setAverageLevel(avg);

      const threshold = 0.22;
      if (avg > threshold) {
        voiceHoldRef.current = 8;
      } else if (voiceHoldRef.current > 0) {
        voiceHoldRef.current -= 1;
      }
      setVoiceDetected(voiceHoldRef.current > 0);

      raf = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      void ctx.close();
    };
  }, [stream, enabled]);

  return { levels, voiceDetected, averageLevel };
}
