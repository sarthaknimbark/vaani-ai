export type AIStatus = "idle" | "listening" | "thinking" | "responding";

export interface ChatMessage {
  role: "user" | "ai";
  text: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export type UIMode = "chat" | "voice";
