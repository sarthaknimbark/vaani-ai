import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Send, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { AmbientBackground } from "./components/AmbientBackground";
import { AISphere } from "./components/AISphere";
import { IconSidebar } from "./components/IconSidebar";
import { StatusPill } from "./components/StatusPill";
import { useAudioAnalyzer } from "./hooks/useAudioAnalyzer";
import type { AIStatus, ChatMessage, Conversation, UIMode } from "./types";

function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [conversationsOpen, setConversationsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );
  const [uiMode, setUiMode] = useState<UIMode>("chat");
  const [callDuration, setCallDuration] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const callDurationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentMessagesRef = useRef<ChatMessage[]>([]);

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );
  const currentMessages = currentConversation?.messages ?? [];

  currentMessagesRef.current = currentMessages;

  const isMicActive =
    isRecording || isCallActive || isConnecting;
  const audioEnabled = isMicActive && !!audioStream;

  const { levels, voiceDetected, averageLevel } = useAudioAnalyzer(
    audioStream,
    audioEnabled
  );

  const aiStatus: AIStatus = useMemo(() => {
    if (isConnecting || loading) return "thinking";
    if (isAiSpeaking) return "responding";
    if (isRecording || (isCallActive && !isAiSpeaking)) return "listening";
    return "idle";
  }, [
    isConnecting,
    loading,
    isAiSpeaking,
    isRecording,
    isCallActive,
  ]);

  const hasMessages = currentMessages.length > 0;
  const sphereCompact = hasMessages && uiMode === "chat" && !isCallActive;

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, loading]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (isCallActive && !isConnecting) {
      callDurationRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
      return () => {
        if (callDurationRef.current) clearInterval(callDurationRef.current);
      };
    }
  }, [isCallActive, isConnecting]);

  const loadConversations = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/chat-history");
      const data = await response.json();

      if (data.messages?.length > 0) {
        const lastConvId = "main";
        const formattedMessages: ChatMessage[] = data.messages.map(
          (msg: { type: string; message: string; timestamp: string }) => ({
            role: msg.type === "user" ? "user" : "ai",
            text: msg.message,
            timestamp: msg.timestamp,
          })
        );

        const conv: Conversation = {
          id: lastConvId,
          title: `Chat — ${new Date().toLocaleDateString()}`,
          messages: formattedMessages,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setConversations([conv]);
        setCurrentConversationId(lastConvId);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  };

  const createNewChat = () => {
    const newId = `chat_${Date.now()}`;
    const newConversation: Conversation = {
      id: newId,
      title: `New chat`,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setConversations((prev) => [newConversation, ...prev]);
    setCurrentConversationId(newId);
    setError(null);
    setUiMode("chat");
  };

  const deleteConversation = (id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (currentConversationId === id) {
        setCurrentConversationId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const updateConversationMessages = useCallback(
    (convId: string, messages: ChatMessage[]) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, messages, updatedAt: new Date().toISOString() }
            : c
        )
      );
    },
    []
  );

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSend = async () => {
    if (!input.trim() || loading || !currentConversationId) return;

    const userMessage = input.trim().substring(0, 200);
    setInput("");
    setError(null);

    const updatedMessages: ChatMessage[] = [
      ...currentMessages,
      {
        role: "user",
        text: userMessage,
        timestamp: new Date().toISOString(),
      },
    ];

    updateConversationMessages(currentConversationId, updatedMessages);
    setLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get response");
      }

      const data = await response.json();
      const aiMessage: ChatMessage = {
        role: "ai",
        text: data.ai_response,
        timestamp: data.timestamp,
      };

      updateConversationMessages(currentConversationId, [
        ...updatedMessages,
        aiMessage,
      ]);

      if (data.audio_url) {
        setIsAiSpeaking(true);
        const audio = new Audio(data.audio_url);
        audio.onended = () => setIsAiSpeaking(false);
        audio.onerror = () => setIsAiSpeaking(false);
        audio.play().catch(() => setIsAiSpeaking(false));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error sending message");
    } finally {
      setLoading(false);
    }
  };

  const connectAndSendAudio = (audioBlob: Blob) => {
    if (!currentConversationId) return;

    setLoading(true);
    const ws = new WebSocket("ws://localhost:8000/ws/voice");
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(audioBlob);
    };

    ws.onmessage = (event) => {
      try {
        if (typeof event.data === "string") {
          const data = JSON.parse(event.data);
          if (data.type === "transcript") {
            const newMsg: ChatMessage = {
              role: data.role,
              text: data.text,
              timestamp: data.timestamp,
            };
            const convId = currentConversationId;
            const msgs = [...currentMessagesRef.current, newMsg];
            updateConversationMessages(convId, msgs);
            if (data.role === "ai") setIsAiSpeaking(true);
          }
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    ws.onclose = () => {
      setLoading(false);
      setIsAiSpeaking(false);
    };

    ws.onerror = () => {
      setError("Voice connection error");
      setLoading(false);
    };
  };

  const startRecording = async () => {
    if (!currentConversationId) {
      setError("Create or select a chat first");
      return;
    }

    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setAudioStream(stream);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/wav";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: mimeType });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setAudioStream(null);
        connectAndSendAudio(audioBlob);
      };

      recorder.start();
      setIsRecording(true);
      setUiMode("voice");
    } catch (err) {
      setError("Microphone access denied or unavailable");
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else void startRecording();
  };

  const startCall = async () => {
    if (!currentConversationId) {
      setError("Create or select a chat first");
      return;
    }
    setIsConnecting(true);
    setCallDuration(0);
    setIsAiSpeaking(false);
    setUiMode("voice");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setAudioStream(stream);

      const ws = new WebSocket("ws://localhost:8000/ws/voice");
      wsRef.current = ws;

      ws.onopen = () => {
        setTimeout(() => {
          setIsConnecting(false);
          setIsCallActive(true);
        }, 1200);
      };

      ws.onmessage = (event) => {
        try {
          if (typeof event.data === "string") {
            const data = JSON.parse(event.data);
            if (data.type === "transcript") {
              setIsAiSpeaking(data.role === "ai");
              const newMsg: ChatMessage = {
                role: data.role,
                text: data.text,
                timestamp: data.timestamp,
              };
              const convId = currentConversationId;
              const msgs = [...currentMessagesRef.current, newMsg];
              updateConversationMessages(convId, msgs);
            }
          }
        } catch (err) {
          console.error("Parse error:", err);
        }
      };

      ws.onerror = () => {
        setError("Failed to connect");
        setIsConnecting(false);
        setIsCallActive(false);
      };
    } catch {
      setError("Microphone access denied");
      setIsConnecting(false);
    }
  };

  const endCall = () => {
    if (callDurationRef.current) clearInterval(callDurationRef.current);
    wsRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setAudioStream(null);
    setIsCallActive(false);
    setIsConnecting(false);
    setCallDuration(0);
    setIsAiSpeaking(false);
    setUiMode("chat");
  };

  const ensureConversation = () => {
    if (!currentConversationId) {
      createNewChat();
    }
  };

  return (
    <div className="app-shell">
      <AmbientBackground />

      <IconSidebar
        conversationsOpen={conversationsOpen}
        onToggleConversations={() => setConversationsOpen((o) => !o)}
        onNewChat={createNewChat}
        onVoiceMode={() => {
          ensureConversation();
          if (isCallActive || isConnecting) return;
          void startCall();
        }}
        voiceModeActive={uiMode === "voice" && (isCallActive || isConnecting)}
        conversations={conversations}
        currentId={currentConversationId}
        onSelectConversation={(id) => {
          setCurrentConversationId(id);
        }}
        onDeleteRequest={setShowDeleteConfirm}
        deleteConfirmId={showDeleteConfirm}
        onConfirmDelete={(id) => {
          deleteConversation(id);
          setShowDeleteConfirm(null);
        }}
        onCancelDelete={() => setShowDeleteConfirm(null)}
      />

      <main className="main-content">
        <div className="main-glass glass-panel">
          <header className="main-header">
            <div>
              <h1>{currentConversation?.title ?? "Vaani"}</h1>
              <p>
                {currentConversation
                  ? `${currentConversation.messages.length} messages`
                  : "Your intelligent assistant"}
              </p>
            </div>
            <StatusPill status={aiStatus} />
          </header>

          <section
            className={`interaction-zone ${sphereCompact ? "interaction-zone--compact" : ""}`}
          >
            <AISphere
              status={aiStatus}
              audioLevels={levels}
              averageLevel={averageLevel}
              voiceDetected={voiceDetected}
              isMicActive={isMicActive}
            />
          </section>

          <div className="chat-scroll">
            {!currentConversation ? (
              <div className="chat-empty">
                <h2>Welcome to Vaani</h2>
                <p>
                  A calm, intelligent space for voice and text. Start a
                  conversation or tap the microphone to speak naturally.
                </p>
              </div>
            ) : currentMessages.length === 0 ? (
              <div className="chat-empty">
                <h2>Start a conversation</h2>
                <p>
                  Type below or hold the microphone to share your thoughts.
                  Vaani listens with care.
                </p>
              </div>
            ) : (
              <div className="chat-messages">
                {currentMessages.map((msg, i) => (
                  <div
                    key={`${msg.timestamp}-${i}`}
                    className={`chat-bubble chat-bubble--${msg.role}`}
                    style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                  >
                    {msg.text}
                    <span className="chat-bubble-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
                {loading && (
                  <div className="chat-thinking" aria-label="Thinking">
                    <span />
                    <span />
                    <span />
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {currentConversation && !isCallActive && !isConnecting && (
            <div className="input-bar">
              <div className="input-bar-inner">
                <input
                  type="text"
                  className="input-field"
                  value={input}
                  onChange={(e) =>
                    setInput(e.target.value.substring(0, 200))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="Message Vaani..."
                  disabled={loading || isRecording}
                  maxLength={200}
                />
                <button
                  type="button"
                  className={`input-btn input-btn--mic ${isRecording ? "input-btn--mic-active" : ""}`}
                  onClick={toggleRecording}
                  disabled={loading}
                  title={isRecording ? "Stop recording" : "Record voice"}
                  aria-pressed={isRecording}
                >
                  {isRecording ? (
                    <MicOff size={20} strokeWidth={1.75} />
                  ) : (
                    <Mic size={20} strokeWidth={1.75} />
                  )}
                </button>
                <button
                  type="button"
                  className="input-btn input-btn--voice"
                  onClick={() => {
                    ensureConversation();
                    void startCall();
                  }}
                  disabled={loading || isRecording}
                  title="Voice session"
                >
                  <Phone size={18} strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  className="input-btn input-btn--send"
                  onClick={() => void handleSend()}
                  disabled={loading || !input.trim() || isRecording}
                  title="Send"
                >
                  <Send size={18} strokeWidth={1.75} />
                </button>
              </div>
              {input.length > 0 && (
                <p className="input-char-count">{input.length}/200</p>
              )}
            </div>
          )}

          {(isCallActive || isConnecting) && (
            <div className="voice-overlay">
              <StatusPill status={aiStatus} />
              <AISphere
                status={aiStatus}
                audioLevels={levels}
                averageLevel={averageLevel}
                voiceDetected={voiceDetected}
                isMicActive={isMicActive}
              />
              {!isConnecting && (
                <p className="voice-duration">{formatDuration(callDuration)}</p>
              )}
              <button type="button" className="btn-end-call" onClick={endCall}>
                <PhoneOff size={18} strokeWidth={1.75} />
                End session
              </button>
            </div>
          )}
        </div>
      </main>

      {error && <div className="error-toast" role="alert">{error}</div>}
    </div>
  );
}

export default App;
