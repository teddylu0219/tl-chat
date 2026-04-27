"use client";

import { MessagesSquare, Pin, Plus, Search, Settings2, Trash2, X } from "lucide-react";
import { Fragment, type KeyboardEvent, useId } from "react";

import { ConversationActionMenu } from "@/components/conversation-action-menu";
import { APP_NAME } from "@/lib/app-config";
import {
  formatConversationTimestamp,
  getDisplayTitle,
  groupConversationsByDate,
  isPinnedConversation,
} from "@/lib/conversations";
import type { ConversationRecord } from "@/lib/persistence";

function getSearchHighlightSegments(text: string, query: string) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [{ isMatch: false, text }];
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmedQuery.toLowerCase();
  const segments: Array<{ isMatch: boolean; text: string }> = [];
  let cursor = 0;
  let matchIndex = lowerText.indexOf(lowerQuery);

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      segments.push({
        isMatch: false,
        text: text.slice(cursor, matchIndex),
      });
    }

    const matchEnd = matchIndex + trimmedQuery.length;
    segments.push({
      isMatch: true,
      text: text.slice(matchIndex, matchEnd),
    });
    cursor = matchEnd;
    matchIndex = lowerText.indexOf(lowerQuery, cursor);
  }

  if (cursor < text.length) {
    segments.push({
      isMatch: false,
      text: text.slice(cursor),
    });
  }

  return segments.length > 0 ? segments : [{ isMatch: false, text }];
}

function HighlightedText({
  fallback,
  query,
  text,
}: {
  fallback?: string;
  query: string;
  text: string;
}) {
  const content = text || fallback || "";

  return getSearchHighlightSegments(content, query).map((segment, index) =>
    segment.isMatch ? (
      <mark
        key={`${segment.text}-${index}`}
        className="conversation-search-highlight rounded-md px-0.5 py-px"
        data-testid="conversation-search-highlight"
      >
        {segment.text}
      </mark>
    ) : (
      <Fragment key={`${segment.text}-${index}`}>{segment.text}</Fragment>
    ),
  );
}

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

function getThreadButtons(sidebar: HTMLElement) {
  return Array.from(
    sidebar.querySelectorAll<HTMLButtonElement>(
      '[data-testid^="conversation-item-"]',
    ),
  );
}

function handleSearchKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  conversations: ConversationRecord[],
  onConversationSelect: (conversationId: string) => void,
) {
  if (event.key === "ArrowDown") {
    const sidebar = event.currentTarget.closest<HTMLElement>(
      '[data-testid="chat-sidebar"]',
    );
    const firstThreadButton = sidebar ? getThreadButtons(sidebar)[0] : null;

    if (firstThreadButton) {
      event.preventDefault();
      firstThreadButton.focus();
    }

    return;
  }

  if (event.key !== "Enter") {
    return;
  }

  const firstConversation = conversations[0];

  if (!firstConversation) {
    return;
  }

  event.preventDefault();
  onConversationSelect(firstConversation.id);
}

function ThreadCard({
  activeConversationId,
  conversation,
  onArchiveToggle,
  onConversationSelect,
  onDeleteConversation,
  onPinToggle,
  onRenameConversation,
  searchQuery,
}: {
  activeConversationId: string;
  conversation: ConversationRecord;
  onArchiveToggle: (conversation: ConversationRecord) => void;
  onConversationSelect: (conversationId: string) => void;
  onDeleteConversation: (conversation: ConversationRecord) => void;
  onPinToggle?: (conversation: ConversationRecord) => void;
  onRenameConversation: (conversation: ConversationRecord) => void;
  searchQuery: string;
}) {
  const isActive = conversation.id === activeConversationId;
  const isPinned = isPinnedConversation(conversation);

  return (
    <div
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
          <p className="flex items-center gap-1.5 truncate text-[14px] font-medium text-[color:var(--foreground)] transition-colors duration-200 group-hover:text-[color:var(--accent-strong)]">
            {conversation.mode === "council" ? <MessagesSquare className="h-3 w-3 shrink-0 text-[color:var(--accent-strong)]" /> : null}
            {isPinned ? <Pin className="h-3 w-3 shrink-0 text-[color:var(--accent-strong)]" /> : null}
            <span className="truncate">
              <HighlightedText
                query={searchQuery}
                text={getDisplayTitle(conversation)}
              />
            </span>
          </p>
          <p className="mt-1 line-clamp-1 text-[12px] leading-5 text-[color:var(--muted-foreground)]">
            <HighlightedText
              fallback="No messages yet"
              query={searchQuery}
              text={conversation.previewText}
            />
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
          onPinToggle={onPinToggle}
          onRename={onRenameConversation}
        />
      </div>
    </div>
  );
}

type ChatSidebarProps = {
  activeConversationId: string;
  clearableConversationCount: number;
  conversations: ConversationRecord[];
  onArchiveToggle: (conversation: ConversationRecord) => void;
  onClearHistory: () => void;
  onConversationSelect: (conversationId: string) => void;
  onDeleteConversation: (conversation: ConversationRecord) => void;
  onNewConversation: () => void;
  onNewCouncil?: () => void;
  onOpenSettings: () => void;
  onPinToggle?: (conversation: ConversationRecord) => void;
  onRequestClose?: () => void;
  onRenameConversation: (conversation: ConversationRecord) => void;
  onSearchChange: (value: string) => void;
  searchQuery: string;
};

export function ChatSidebar({
  activeConversationId,
  clearableConversationCount,
  conversations,
  onArchiveToggle,
  onClearHistory,
  onConversationSelect,
  onDeleteConversation,
  onNewConversation,
  onNewCouncil,
  onOpenSettings,
  onPinToggle,
  onRequestClose,
  onRenameConversation,
  onSearchChange,
  searchQuery,
}: ChatSidebarProps) {
  const hasSearchQuery = searchQuery.trim().length > 0;
  const resultCountLabel =
    conversations.length === 1 ? "1 match" : `${conversations.length} matches`;
  const groups = hasSearchQuery ? null : groupConversationsByDate(conversations);
  const searchHintId = useId();
  const searchInputId = useId();

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
        <label className="sr-only" htmlFor={searchInputId}>
          Search threads
        </label>
        <div className="search-shell flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-[color:var(--muted-foreground)]" />
          <input
            aria-describedby={hasSearchQuery ? searchHintId : undefined}
            className="w-full bg-transparent text-[13px] text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]"
            data-testid="sidebar-search-input"
            id={searchInputId}
            placeholder="Search threads"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) =>
              handleSearchKeyDown(event, conversations, onConversationSelect)
            }
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
        {hasSearchQuery ? (
          <p
            className="mt-2 px-1 text-[11px] leading-5 text-[color:var(--muted-foreground)]"
            data-testid="sidebar-search-hint"
            id={searchHintId}
          >
            {conversations.length > 0
              ? `${resultCountLabel}. Press Enter to open the first result.`
              : "No matches. Try a broader phrase."}
          </p>
        ) : null}
      </div>

      <div className="scroll-column mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        {conversations.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-[color:var(--border)] px-4 py-5 text-[13px] leading-6 text-[color:var(--muted-foreground)]">
            {hasSearchQuery
              ? "No threads match this search."
              : "Start a new chat to build your first thread."}
          </div>
        ) : groups ? (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="flex items-center justify-between px-1 pb-2">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                    {group.label}
                  </p>
                  <span className="text-[10px] text-[color:var(--muted-foreground)]">
                    {group.conversations.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.conversations.map((conversation) => (
                    <ThreadCard
                      key={conversation.id}
                      activeConversationId={activeConversationId}
                      conversation={conversation}
                      onArchiveToggle={onArchiveToggle}
                      onConversationSelect={onConversationSelect}
                      onDeleteConversation={onDeleteConversation}
                      onPinToggle={onPinToggle}
                      onRenameConversation={onRenameConversation}
                      searchQuery={searchQuery}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <ThreadCard
                key={conversation.id}
                activeConversationId={activeConversationId}
                conversation={conversation}
                onArchiveToggle={onArchiveToggle}
                onConversationSelect={onConversationSelect}
                onDeleteConversation={onDeleteConversation}
                onPinToggle={onPinToggle}
                onRenameConversation={onRenameConversation}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-3.5 space-y-1 border-t border-[color:var(--border)] pt-3.5">
        {onNewCouncil ? (
          <button
            className="motion-lift flex w-full items-center justify-between rounded-2xl px-2 py-2 text-[13px] text-[color:var(--foreground)] transition hover:text-[color:var(--accent-strong)]"
            type="button"
            onClick={onNewCouncil}
          >
            New council
            <MessagesSquare className="h-4 w-4" />
          </button>
        ) : null}
        <button
          className="motion-lift flex w-full items-center justify-between rounded-2xl px-2 py-2 text-[13px] text-[color:var(--foreground)] transition hover:text-[color:var(--accent-strong)]"
          data-testid="open-settings-button"
          type="button"
          onClick={onOpenSettings}
        >
          Settings
          <Settings2 className="h-4 w-4" />
        </button>
        <button
          className="motion-lift flex w-full items-center justify-between rounded-2xl px-2 py-2 text-[13px] text-[color:var(--danger)] transition hover:bg-[color:var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-45"
          data-testid="clear-history-button"
          disabled={clearableConversationCount === 0}
          type="button"
          onClick={onClearHistory}
        >
          Clear history
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
