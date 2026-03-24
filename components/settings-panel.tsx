"use client";

import { Eye, EyeOff, KeyRound, RotateCcw, Save, X } from "lucide-react";
import { useState } from "react";

import { formatConversationTimestamp, getDisplayTitle } from "@/lib/conversations";
import { THEME_OPTIONS } from "@/lib/app-config";
import { getModelOptions } from "@/lib/models";
import type { ConversationRecord, LocalSettings } from "@/lib/persistence";

type SettingsPanelProps = {
  archivedConversations: ConversationRecord[];
  isOpen: boolean;
  modelId: string;
  onClose: () => void;
  onRestoreConversation: (conversation: ConversationRecord) => void;
  onSave: (settings: LocalSettings) => void | Promise<void>;
  settings: LocalSettings;
};

export function SettingsPanel({
  archivedConversations,
  isOpen,
  modelId,
  onClose,
  onRestoreConversation,
  onSave,
  settings,
}: SettingsPanelProps) {
  const [draftSettings, setDraftSettings] = useState(settings);
  const [showApiKey, setShowApiKey] = useState(false);

  if (!isOpen) {
    return null;
  }

  const modelOptions = getModelOptions(draftSettings.customModelId);

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 p-4 backdrop-blur-sm"
      data-testid="settings-panel"
    >
      <div className="panel-surface mx-auto flex h-full w-full max-w-2xl flex-col rounded-[30px]">
        <div className="flex items-center justify-between border-b border-[color:var(--border)] px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--muted-foreground)]">
              Local settings
            </p>
            <h2 className="serif-heading mt-2 text-4xl leading-none text-[color:var(--foreground)]">
              Keep it local.
            </h2>
          </div>

          <button
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)]"
            type="button"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scroll-column flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <section
            className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5"
            data-testid="archived-threads-section"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--surface-muted)] text-[color:var(--accent-strong)]">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                  OpenRouter key
                </h3>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                  Stored in IndexedDB on this device only.
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <input
                className="flex-1 rounded-2xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--border-strong)]"
                data-testid="api-key-input"
                placeholder="sk-or-v1-..."
                type={showApiKey ? "text" : "password"}
                value={draftSettings.openRouterApiKey}
                onChange={(event) =>
                  setDraftSettings((currentSettings) => ({
                    ...currentSettings,
                    openRouterApiKey: event.target.value,
                  }))
                }
              />

              <button
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)]"
                type="button"
                onClick={() => setShowApiKey((visible) => !visible)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <label className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5">
              <span className="text-sm font-semibold text-[color:var(--foreground)]">
                Default model
              </span>
              <span className="mt-1 block text-sm text-[color:var(--muted-foreground)]">
                Used for new threads. Current thread: {modelId}
              </span>
              <select
                className="mt-4 w-full rounded-2xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm text-[color:var(--foreground)] outline-none"
                value={draftSettings.defaultModelId}
                onChange={(event) =>
                  setDraftSettings((currentSettings) => ({
                    ...currentSettings,
                    defaultModelId: event.target.value,
                  }))
                }
              >
                {modelOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5">
              <span className="text-sm font-semibold text-[color:var(--foreground)]">
                Appearance
              </span>
              <span className="mt-1 block text-sm text-[color:var(--muted-foreground)]">
                Choose the tone that fits your desk.
              </span>
              <select
                className="mt-4 w-full rounded-2xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm text-[color:var(--foreground)] outline-none"
                value={draftSettings.themePreference}
                onChange={(event) =>
                  setDraftSettings((currentSettings) => ({
                    ...currentSettings,
                    themePreference: event.target
                      .value as LocalSettings["themePreference"],
                  }))
                }
              >
                {THEME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <label className="block rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5">
            <span className="text-sm font-semibold text-[color:var(--foreground)]">
              Custom model id
            </span>
            <span className="mt-1 block text-sm text-[color:var(--muted-foreground)]">
              Optional advanced override for any OpenRouter model id.
            </span>
            <input
              className="mt-4 w-full rounded-2xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]"
              placeholder="anthropic/claude-sonnet-4.6"
              value={draftSettings.customModelId}
              onChange={(event) =>
                setDraftSettings((currentSettings) => ({
                  ...currentSettings,
                  customModelId: event.target.value,
                }))
              }
            />
          </label>

          <section className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                  Archived threads
                </h3>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                  Hidden from the sidebar until restored.
                </p>
              </div>
              <span className="rounded-full bg-[color:var(--surface-muted)] px-3 py-1 text-xs text-[color:var(--muted-foreground)]">
                {archivedConversations.length}
              </span>
            </div>

            {archivedConversations.length === 0 ? (
              <div className="mt-4 rounded-[20px] border border-dashed border-[color:var(--border)] px-4 py-4 text-sm text-[color:var(--muted-foreground)]">
                No archived threads.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {archivedConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className="flex items-center justify-between gap-3 rounded-[20px] border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[color:var(--foreground)]">
                        {getDisplayTitle(conversation)}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                        {formatConversationTimestamp(conversation.updatedAt)}
                      </p>
                    </div>
                    <button
                      className="rounded-full border border-[color:var(--border)] px-3 py-2 text-sm text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--accent-strong)]"
                      data-testid={`restore-archived-${conversation.id}`}
                      type="button"
                      onClick={() => onRestoreConversation(conversation)}
                    >
                      <span className="inline-flex items-center gap-2">
                        <RotateCcw className="h-4 w-4" />
                        Restore
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-[color:var(--border)] px-6 py-5">
          <p className="text-sm text-[color:var(--muted-foreground)]">
            Saving keeps everything local to this browser.
          </p>
          <div className="flex gap-3">
            <button
              className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--foreground)]"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
              data-testid="save-settings-button"
              type="button"
              onClick={() => void onSave(draftSettings)}
            >
              <Save className="h-4 w-4" />
              Save settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
