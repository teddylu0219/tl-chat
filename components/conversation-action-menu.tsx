"use client";

import {
  Archive,
  Download,
  Ellipsis,
  SquarePen,
  Trash2,
  Undo2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  getDisplayTitle,
  isArchivedConversation,
} from "@/lib/conversations";
import type { ConversationRecord } from "@/lib/persistence";

type ConversationActionMenuProps = {
  conversation: ConversationRecord;
  disabled?: boolean;
  itemTestIdPrefix?: string;
  layout?: "popover" | "inline";
  onArchiveToggle: (conversation: ConversationRecord) => void;
  onDelete: (conversation: ConversationRecord) => void;
  onExport?: (conversation: ConversationRecord) => void;
  onRename: (conversation: ConversationRecord) => void;
  triggerTestId?: string;
};

export function ConversationActionMenu({
  conversation,
  disabled = false,
  itemTestIdPrefix,
  layout = "popover",
  onArchiveToggle,
  onDelete,
  onExport,
  onRename,
  triggerTestId,
}: ConversationActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isArchived = isArchivedConversation(conversation);
  const isInline = layout === "inline";
  const actionButtonClass =
    "flex w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left text-[12px] text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-muted)]";
  const menuClass =
    "border border-[color:var(--border-strong)] bg-[color:var(--surface-strong)] shadow-[0_18px_38px_rgba(49,35,21,0.16)]";

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function closeAndRun(action: () => void) {
    setIsOpen(false);
    action();
  }

  return (
    <div
      ref={menuRef}
      className={`thread-actions relative ${isInline ? "flex shrink-0 flex-col items-end gap-2" : ""}`}
      data-open={isOpen}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        aria-label={`Manage ${getDisplayTitle(conversation)}`}
        aria-expanded={isOpen}
        className="thread-actions-trigger flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-[color:var(--muted-foreground)]"
        data-testid={triggerTestId ?? `conversation-actions-${conversation.id}`}
        disabled={disabled}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
      >
        <Ellipsis className="h-3.5 w-3.5" />
      </button>

      {isOpen && !disabled ? (
        <div
          className={`menu-pop rounded-[18px] p-1.5 ${
            isInline
              ? `${menuClass} relative w-40`
              : `${menuClass} absolute right-0 top-9 z-30 min-w-44`
          }`}
        >
          <button
            className={actionButtonClass}
            data-testid={itemTestIdPrefix ? `${itemTestIdPrefix}-rename` : undefined}
            type="button"
            onClick={() => closeAndRun(() => onRename(conversation))}
          >
            <SquarePen className="h-4 w-4" />
            Rename
          </button>
          <button
            className={actionButtonClass}
            data-testid={itemTestIdPrefix ? `${itemTestIdPrefix}-archive` : undefined}
            type="button"
            onClick={() => closeAndRun(() => onArchiveToggle(conversation))}
          >
            {isArchived ? (
              <Undo2 className="h-4 w-4" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            {isArchived ? "Restore" : "Archive"}
          </button>
          {onExport ? (
            <button
              className={actionButtonClass}
              data-testid={itemTestIdPrefix ? `${itemTestIdPrefix}-export` : undefined}
              type="button"
              onClick={() => closeAndRun(() => onExport(conversation))}
            >
              <Download className="h-4 w-4" />
              Export markdown
            </button>
          ) : null}
          <button
            className={`${actionButtonClass} text-[color:var(--danger)]`}
            data-testid={itemTestIdPrefix ? `${itemTestIdPrefix}-delete` : undefined}
            type="button"
            onClick={() => closeAndRun(() => onDelete(conversation))}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
