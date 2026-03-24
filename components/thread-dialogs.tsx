"use client";

import { AlertTriangle, PencilLine, Trash2, X } from "lucide-react";
import { useState } from "react";

import { getDisplayTitle } from "@/lib/conversations";
import type { ConversationRecord } from "@/lib/persistence";

type RenameConversationDialogProps = {
  conversation: ConversationRecord | null;
  onClose: () => void;
  onSave: (conversation: ConversationRecord, manualTitle: string | null) => void;
};

type DeleteConversationDialogProps = {
  conversation: ConversationRecord | null;
  onClose: () => void;
  onDelete: (conversation: ConversationRecord) => void;
};

function DialogShell({
  children,
  onClose,
}: Readonly<{
  children: React.ReactNode;
  onClose: () => void;
}>) {
  return (
    <div className="fixed inset-0 z-50 bg-black/30 p-4 backdrop-blur-sm">
      <div className="panel-surface mx-auto flex w-full max-w-xl flex-col rounded-[30px]">
        <div className="flex items-center justify-end px-4 pt-4">
          <button
            aria-label="Close dialog"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)]"
            type="button"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function RenameConversationDialog({
  conversation,
  onClose,
  onSave,
}: RenameConversationDialogProps) {
  if (!conversation) {
    return null;
  }

  return (
    <RenameConversationDialogInner
      key={conversation.id}
      conversation={conversation}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function RenameConversationDialogInner({
  conversation,
  onClose,
  onSave,
}: Omit<RenameConversationDialogProps, "conversation"> & {
  conversation: ConversationRecord;
}) {
  const [manualTitle, setManualTitle] = useState(
    conversation.manualTitle ?? getDisplayTitle(conversation),
  );

  return (
    <DialogShell onClose={onClose}>
      <div className="px-6 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--surface-muted)] text-[color:var(--accent-strong)]">
            <PencilLine className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--muted-foreground)]">
              Rename thread
            </p>
            <h2 className="serif-heading mt-2 text-4xl leading-none text-[color:var(--foreground)]">
              Make it easier to find.
            </h2>
          </div>
        </div>

        <label className="mt-6 block">
          <span className="text-sm font-semibold text-[color:var(--foreground)]">
            Thread title
          </span>
          <input
            autoFocus
            className="mt-3 w-full rounded-[22px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3 text-sm text-[color:var(--foreground)] outline-none"
            data-testid="rename-thread-input"
            placeholder="Type a clearer title"
            value={manualTitle}
            onChange={(event) => setManualTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSave(conversation, manualTitle.trim() || null);
              }
            }}
          />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--foreground)]"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded-full bg-[color:var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
            data-testid="rename-thread-save"
            type="button"
            onClick={() => onSave(conversation, manualTitle.trim() || null)}
          >
            Save title
          </button>
        </div>
      </div>
    </DialogShell>
  );
}

export function DeleteConversationDialog({
  conversation,
  onClose,
  onDelete,
}: DeleteConversationDialogProps) {
  if (!conversation) {
    return null;
  }

  return (
    <DialogShell onClose={onClose}>
      <div className="px-6 pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--surface-muted)] text-[color:var(--danger)]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--muted-foreground)]">
              Delete thread
            </p>
            <h2 className="serif-heading mt-2 text-4xl leading-none text-[color:var(--foreground)]">
              This cannot be undone.
            </h2>
          </div>
        </div>

        <p className="mt-6 text-sm leading-6 text-[color:var(--muted-foreground)]">
          Delete <span className="font-medium text-[color:var(--foreground)]">{getDisplayTitle(conversation)}</span> permanently from this browser.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--foreground)]"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="flex items-center gap-2 rounded-full bg-[color:var(--danger)] px-5 py-2.5 text-sm font-medium text-white"
            data-testid="delete-thread-confirm"
            type="button"
            onClick={() => onDelete(conversation)}
          >
            <Trash2 className="h-4 w-4" />
            Delete forever
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
