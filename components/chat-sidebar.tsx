"use client";

import { Plus, Search, Settings2, X } from "lucide-react";
import { type KeyboardEvent } from "react";

import { ConversationActionMenu } from "@/components/conversation-action-menu";
import { APP_NAME } from "@/lib/app-config";
import {
  formatConversationTimestamp,
  getDisplayTitle,
} from "@/lib/conversations";
import type { ConversationRecord } from "@/lib/persistence";

function handleThreadListKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
  const navigableKeys = ["ArrowDown", "ArrowUp", "Home", "End"];

  if (!navigableKeys.includes(event.key)) {
    return;
  }

  const sidebar = event.currentTarget.closest<HTMLElement>(
    '[data-testid="chat-sidebar"]',
  );

  if (!sidebar) {
    return;
  }

  const items = Array.from(
    sidebar.querySelectorAll<HTMLButtonElement>(
      '[data-testid^="conversation-item-"]',
    ),
  );
  const currentIndex = items.indexOf(event.currentTarget);

  if (currentIndex === -1 || items.length === 0) {
    return;
  }

  event.preventDefault();

  const targetIndex =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? Math.min(currentIndex + 1, items.length - 1)
          : Math.max(currentIndex - 1, 0);

  items[targetIndex]?.focus();
}

type ChatSidebarProps = {
  activeConversationId: string;
  conversations: ConversationRecord[];
  onArchiveToggle: (conversation: ConversationRecord) => void;
  onConversationSelect: (conversationId: string) => void;
  onDeleteConversation: (conversation: ConversationRecord) => void;
  onNewConversation: () => void;
  onOpenSettings: () => void;
  onRequestClose?: () => void;
  onRenameConversation: (conversation: ConversationRecord) => void;
  onSearchChange: (value: string) => void;
  searchQuery: string;
};

export function ChatSidebar({
  activeConversationId,
  conversations,
  onArchiveToggle,
  onConversationSelect,
  onDeleteConversation,
  onNewConversation,
  onOpenSettings,
  onRequestClose,
  onRenameConversation,
  onSearchChange,
  searchQuery,
}: ChatSidebarProps) {
  const hasSearchQuery = searchQuery.trim().length > 0;

  return (
    <aside
      className="panel-surface flex h-full min-h-0 w-[286px] shrink-0 flex-col overflow-hidden rounded-[28px] p-3.5"
      data-testid="chat-sidebar"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] pb-3.5">
        <div className="min-w-0">
          <p className="brand-wordmark truncate text-[2rem] leading-none font-semibold text-[color:var(--foreground)]">
            {APP_NAME}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="motion-lift flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--accent)] text-white transition hover:bg-[color:var(--accent-strong)]"
            data-testid="new-chat-button"
            type="button"
            onClick={onNewConversation}
          >
            <Plus className="h-4 w-4" />
          </button>

          {onRequestClose ? (
            <button
              aria-label="Close sidebar"
              className="motion-lift flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] text-[color:var(--muted-foreground)]"
              data-testid="close-sidebar-button"
              type="button"
              onClick={onRequestClose}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3.5">
        <label className="sr-only" htmlFor="sidebar-search-input-field">
          Search threads
        </label>
        <div className="search-shell flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-[color:var(--muted-foreground)]" />
          <input
            id="sidebar-search-input-field"
            className="w-full bg-transparent text-[13px] text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]"
            data-testid="sidebar-search-input"
            placeholder="Search threads"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          {hasSearchQuery ? (
            <button
              aria-label="Clear search"
              className="flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
              type="button"
              onClick={() => onSearchChange("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between px-1">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Threads
          </p>
          <span className="text-[10px] text-[color:var(--muted-foreground)]">
            {conversations.length}
          </span>
        </div>
      </div>

      <div className="scroll-column mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        {conversations.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-[color:var(--border)] px-4 py-5 text-[13px] leading-6 text-[color:var(--muted-foreground)]">
            {hasSearchQuery
              ? "No threads match this search."
              : "Start a new chat to build your first thread."}
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;

              return (
                <div
                  key={conversation.id}
                  className={`thread-card group rounded-[20px] border px-3.5 py-3 ${
                    isActive
                      ? "border-[color:var(--border-strong)] bg-[color:var(--surface-strong)]"
                      : "border-transparent bg-[color:var(--surface-muted)] hover:border-[color:var(--border)]"
                  }`}
                  data-active={isActive}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      aria-current={isActive ? "page" : undefined}
                      className="thread-card-button min-w-0 flex-1 text-left outline-none"
                      data-testid={`conversation-item-${conversation.id}`}
                      type="button"
                      onClick={() => onConversationSelect(conversation.id)}
                      onKeyDown={handleThreadListKeyDown}
                    >
                      <p className="truncate text-[14px] font-medium text-[color:var(--foreground)] transition-colors duration-200 group-hover:text-[color:var(--accent-strong)]">
                        {getDisplayTitle(conversation)}
                      </p>
                      <p className="mt-1 line-clamp-1 text-[12px] leading-5 text-[color:var(--muted-foreground)]">
                        {conversation.previewText || "No messages yet"}
                      </p>
                      <p className="mt-2 text-[10px] text-[color:var(--muted-foreground)]">
                        {formatConversationTimestamp(conversation.updatedAt)}
                      </p>
                    </button>

                    <ConversationActionMenu
                      conversation={conversation}
                      layout="inline"
                      onArchiveToggle={onArchiveToggle}
                      onDelete={onDeleteConversation}
                      onRename={onRenameConversation}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3.5 border-t border-[color:var(--border)] pt-3.5">
        <button
          className="motion-lift flex w-full items-center justify-between rounded-2xl px-2 py-2 text-[13px] text-[color:var(--foreground)] transition hover:text-[color:var(--accent-strong)]"
          data-testid="open-settings-button"
          type="button"
          onClick={onOpenSettings}
        >
          Settings
          <Settings2 className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
