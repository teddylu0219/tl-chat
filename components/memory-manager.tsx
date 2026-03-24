"use client";

import { Brain, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import type { MemoryEntry } from "@/lib/memory";
import { createMemoryEntry } from "@/lib/memory";

type MemoryManagerProps = {
  memories: MemoryEntry[];
  onAddMemory: (entry: MemoryEntry) => void;
  onClearAll: () => void;
  onDeleteMemory: (id: string) => void;
};

export function MemoryManager({
  memories,
  onAddMemory,
  onClearAll,
  onDeleteMemory,
}: MemoryManagerProps) {
  const [draft, setDraft] = useState("");

  function handleAdd() {
    const trimmed = draft.trim();

    if (!trimmed) {
      return;
    }

    onAddMemory(createMemoryEntry(trimmed));
    setDraft("");
  }

  return (
    <section className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--surface-muted)] text-[color:var(--accent-strong)]">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
              Memory
            </h3>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
              Facts & preferences the AI remembers across chats.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-[color:var(--surface-muted)] px-3 py-1 text-xs text-[color:var(--muted-foreground)]">
          {memories.length}
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-2xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--border-strong)]"
          placeholder="e.g. I prefer TypeScript over JavaScript"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)]"
          title="Add memory"
          type="button"
          onClick={handleAdd}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {memories.length === 0 ? (
        <div className="mt-4 rounded-[20px] border border-dashed border-[color:var(--border)] px-4 py-4 text-sm text-[color:var(--muted-foreground)]">
          No memories yet. Add facts or preferences above.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {memories.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3"
            >
              <p className="min-w-0 flex-1 text-sm text-[color:var(--foreground)]">
                {entry.content}
              </p>
              <button
                aria-label="Delete memory"
                className="mt-0.5 flex-shrink-0 text-[color:var(--muted-foreground)] transition hover:text-[color:var(--danger)]"
                type="button"
                onClick={() => onDeleteMemory(entry.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            className="mt-2 text-xs text-[color:var(--muted-foreground)] transition hover:text-[color:var(--danger)]"
            type="button"
            onClick={onClearAll}
          >
            Clear all memories
          </button>
        </div>
      )}
    </section>
  );
}
