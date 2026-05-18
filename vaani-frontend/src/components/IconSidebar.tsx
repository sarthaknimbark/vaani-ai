import {
  MessageSquarePlus,
  MessagesSquare,
  Mic,
  PanelLeft,
  Sparkles,
  Trash2,
  Clock,
} from "lucide-react";
import type { Conversation } from "../types";

interface IconSidebarProps {
  conversationsOpen: boolean;
  onToggleConversations: () => void;
  onNewChat: () => void;
  onVoiceMode: () => void;
  voiceModeActive: boolean;
  conversations: Conversation[];
  currentId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteRequest: (id: string) => void;
  deleteConfirmId: string | null;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}

export function IconSidebar({
  conversationsOpen,
  onToggleConversations,
  onNewChat,
  onVoiceMode,
  voiceModeActive,
  conversations,
  currentId,
  onSelectConversation,
  onDeleteRequest,
  deleteConfirmId,
  onConfirmDelete,
  onCancelDelete,
}: IconSidebarProps) {
  return (
  <>
    <aside className="icon-sidebar glass-panel">
      <div className="icon-sidebar-brand">
        <div className="icon-sidebar-logo">
          <Sparkles strokeWidth={1.75} />
        </div>
      </div>

      <nav className="icon-sidebar-nav">
        <button
          type="button"
          className="icon-sidebar-btn"
          onClick={onNewChat}
          title="New chat"
        >
          <MessageSquarePlus strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={`icon-sidebar-btn ${conversationsOpen ? "icon-sidebar-btn--active" : ""}`}
          onClick={onToggleConversations}
          title="Conversations"
        >
          <PanelLeft strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={`icon-sidebar-btn ${voiceModeActive ? "icon-sidebar-btn--active" : ""}`}
          onClick={onVoiceMode}
          title="Voice mode"
        >
          <Mic strokeWidth={1.75} />
        </button>
      </nav>

      <div className="icon-sidebar-footer">
        <MessagesSquare strokeWidth={1.75} className="icon-sidebar-muted" />
        <span className="icon-sidebar-count">{conversations.length}</span>
      </div>
    </aside>

    {conversationsOpen && (
      <aside className="conversations-panel glass-panel">
        <header className="conversations-panel-header">
          <h2>Chats</h2>
          <span>{conversations.length}</span>
        </header>
        <div className="conversations-panel-list">
          {conversations.length === 0 ? (
            <p className="conversations-empty">No conversations yet</p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-card ${currentId === conv.id ? "conversation-card--active" : ""}`}
                onClick={() => onSelectConversation(conv.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSelectConversation(conv.id);
                }}
                role="button"
                tabIndex={0}
              >
                <p className="conversation-card-title">{conv.title}</p>
                <p className="conversation-card-meta">
                  <Clock size={12} />
                  {conv.messages.length} messages
                </p>
                {deleteConfirmId === conv.id ? (
                  <div
                    className="conversation-card-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="btn-danger-sm"
                      onClick={() => onConfirmDelete(conv.id)}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className="btn-ghost-sm"
                      onClick={onCancelDelete}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="conversation-card-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRequest(conv.id);
                    }}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </aside>
    )}
  </>
  );
}
