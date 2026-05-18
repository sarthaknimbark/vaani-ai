import { Ear, Brain, MessageSquare, Sparkles } from "lucide-react";
import type { AIStatus } from "../types";

const STATUS_CONFIG: Record<
  AIStatus,
  { label: string; icon: typeof Sparkles }
> = {
  idle: { label: "Ready", icon: Sparkles },
  listening: { label: "Listening", icon: Ear },
  thinking: { label: "Thinking", icon: Brain },
  responding: { label: "Responding", icon: MessageSquare },
};

interface StatusPillProps {
  status: AIStatus;
}

export function StatusPill({ status }: StatusPillProps) {
  const { label, icon: Icon } = STATUS_CONFIG[status];

  return (
    <div className={`status-pill status-pill--${status}`} role="status">
      <span className="status-pill-dot" />
      <Icon className="status-pill-icon" strokeWidth={1.75} />
      <span>{label}</span>
    </div>
  );
}
