import type { AIStatus } from "../types";

interface AISphereProps {
  status: AIStatus;
  audioLevels: number[];
  averageLevel: number;
  voiceDetected: boolean;
  isMicActive: boolean;
}

export function AISphere({
  status,
  audioLevels,
  averageLevel,
  voiceDetected,
  isMicActive,
}: AISphereProps) {
  const isListening = status === "listening";
  const isThinking = status === "thinking";
  const isResponding = status === "responding";
  const active = isMicActive || isListening || isResponding;

  const glowScale = 1 + (averageLevel - 0.15) * 0.12;
  const breatheIntensity = isThinking ? 0.92 : 1;

  return (
    <div
      className={`ai-sphere-wrap ai-sphere-wrap--${status}`}
      style={
        {
          "--glow-scale": glowScale,
          "--breathe": breatheIntensity,
        } as React.CSSProperties
      }
    >
      {isListening && (
        <>
          <span className="ai-ripple ai-ripple--1" />
          <span className="ai-ripple ai-ripple--2" />
          <span className="ai-ripple ai-ripple--3" />
        </>
      )}

      <div className="ai-ring ai-ring--outer" />
      <div className="ai-ring ai-ring--middle" />

      <div className="ai-orb-container">
        <div className="ai-orb-glow" />
        <div className="ai-orb">
          <div className="ai-orb-inner">
            <div className="ai-waveform">
              {audioLevels.map((level, i) => (
                <span
                  key={i}
                  className="ai-waveform-bar"
                  style={{
                    transform: `scaleY(${active ? level : 0.35 + Math.sin(i * 0.5) * 0.08})`,
                    opacity: active ? 0.5 + level * 0.5 : 0.35,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="ai-particles">
            {[...Array(6)].map((_, i) => (
              <span key={i} className={`ai-particle ai-particle--${i}`} />
            ))}
          </div>
        </div>
      </div>

      {voiceDetected && isListening && (
        <span className="ai-voice-badge">Voice detected</span>
      )}

      {isThinking && <span className="ai-latency-indicator" aria-hidden />}
    </div>
  );
}
