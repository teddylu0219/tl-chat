"use client";

import { Plus, Settings2, X } from "lucide-react";

import { formatConversationTimestamp } from "@/lib/conversations";
import type { ConversationRecord } from "@/lib/persistence";

type ChatSidebarProps = {
  activeConversationId: string;
  conversations: ConversationRecord[];
  onConversationSelect: (conversationId: string) => void;
  onNewConversation: () => void;
  onOpenSettings: () => void;
  onRequestClose?: () => void;
};

export function ChatSidebar({
  activeConversationId,
  conversations,
  onConversationSelect,
  onNewConversation,
  onOpenSettings,
  onRequestClose,
}: ChatSidebarProps) {
  return (
    <aside className="panel-surface flex h-full w-[292px] shrink-0 flex-col rounded-[28px] p-4">
      <div className="flex items-start justify-between border-b border-[color:var(--border)] pb-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--muted-foreground)]">
            Own AI Chat
          </p>
          <h1 className="serif-heading mt-2 text-3xl leading-none text-[color:var(--foreground)]">
            Alma-inspired calm.
          </h1>
        </div>

        {onRequestClose ? (
          <button
            aria-label="Close sidebar"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] text-[color:var(--muted-foreground)]"
            data-testid="close-sidebar-button"
            type="button"
            onClick={onRequestClose}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <button
        className="mt-4 flex items-center justify-center gap-2 rounded-full bg-[color:var(--accent)] px-4 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
        data-testid="new-chat-button"
        type="button"
        onClick={onNewConversation}
      >
        <Plus className="h-4 w-4" />
        New chat
      </button>

      <div className="mt-5 flex-1 overflow-y-auto pr-1">
        <p className="px-2 text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted-foreground)]">
          Threads
        </p>

        {conversations.length === 0 ? (
          <div className="mt-4 rounded-[22px] border border-dashed border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-5 text-sm leading-6 text-[color:var(--muted-foreground)]">
            Your first saved thread will appear here after you send a message.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;

              return (
                <button
                  key={conversation.id}
                  className={`w-full rounded-[22px] border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-[color:var(--border-strong)] bg-[color:var(--surface-strong)]"
                      : "border-transparent bg-[color:var(--surface-muted)] hover:border-[color:var(--border)]"
                  }`}
                  data-testid={`conversation-${conversation.id}`}
                  type="button"
                  onClick={() => onConversationSelect(conversation.id)}
                >
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {conversation.title}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                    {formatConversationTimestamp(conversation.updatedAt)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4">
        <button
          className="flex w-full items-center justify-between text-sm text-[color:var(--foreground)] transition hover:text-[color:var(--accent-strong)]"
          data-testid="open-settings-button"
          type="button"
          onClick={onOpenSettings}
        >
          Settings
          <Settings2 className="h-4 w-4" />
        </button>
        <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
          Your OpenRouter key and conversation history stay in this browser only.
        </p>
      </div>
    </aside>
  );
}
