"use client";

import {
  Cable,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

import { MemoryManager } from "@/components/memory-manager";
import { formatConversationTimestamp, getDisplayTitle } from "@/lib/conversations";
import { createMcpServerConfig } from "@/lib/mcp";
import type { MemoryEntry } from "@/lib/memory";
import { THEME_OPTIONS } from "@/lib/app-config";
import { getModelOptions, type ModelCapabilityFlags } from "@/lib/models";
import type { ConversationRecord, LocalSettings } from "@/lib/persistence";
import {
  createSettingsBackup,
  parseSettingsBackup,
  type SettingsBackup,
} from "@/lib/settings-backup";

function createHeaderDrafts(servers: LocalSettings["mcpServers"]) {
  return Object.fromEntries(
    servers.map((server) => [
      server.id,
      JSON.stringify(server.headers ?? {}, null, 2),
    ]),
  );
}

function parseMcpServerDraft(
  server: LocalSettings["mcpServers"][number],
  headerDrafts: Record<string, string>,
) {
  const rawHeaders = headerDrafts[server.id]?.trim() || "{}";
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawHeaders) as unknown;
  } catch {
    throw new Error("MCP headers must be valid JSON.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.values(parsed).some((value) => typeof value !== "string")
  ) {
    throw new Error("MCP headers must be a JSON object with string values.");
  }

  return {
    ...server,
    headers: parsed as Record<string, string>,
  };
}

function parseHeaderDrafts(
  servers: LocalSettings["mcpServers"],
  headerDrafts: Record<string, string>,
) {
  return servers.map((server) => parseMcpServerDraft(server, headerDrafts));
}

type SettingsPanelProps = {
  archivedConversations: ConversationRecord[];
  isOpen: boolean;
  memories: MemoryEntry[];
  modelId: string;
  onAddMemory: (entry: MemoryEntry) => void;
  onClearMemories: () => void;
  onClose: () => void;
  onDeleteMemory: (id: string) => void;
  onImportBackup: (backup: SettingsBackup) => void | Promise<void>;
  onRestoreConversation: (conversation: ConversationRecord) => void;
  onSave: (settings: LocalSettings) => void | Promise<void>;
  settings: LocalSettings;
};

type McpConnectionTestState = {
  message: string;
  status: "error" | "success" | "testing";
};

const CUSTOM_MODEL_CAPABILITY_OPTIONS = [
  {
    description: "Allows image attachments to stay on this custom model.",
    key: "supportsImages",
    label: "Vision",
  },
  {
    description: "Allows memory, built-in tools, and MCP tools on this model.",
    key: "supportsTools",
    label: "Tools + MCP",
  },
  {
    description: "Marks it eligible for heavier analysis and planning work.",
    key: "supportsReasoning",
    label: "Reasoning",
  },
  {
    description: "Marks it eligible for coding and debugging tasks.",
    key: "supportsCode",
    label: "Code",
  },
] satisfies Array<{
  description: string;
  key: keyof ModelCapabilityFlags;
  label: string;
}>;

export function SettingsPanel(props: SettingsPanelProps) {
  if (!props.isOpen) {
    return null;
  }

  return <SettingsPanelContent {...props} />;
}

function SettingsPanelContent({
  archivedConversations,
  memories,
  modelId,
  onAddMemory,
  onClearMemories,
  onClose,
  onDeleteMemory,
  onImportBackup,
  onRestoreConversation,
  onSave,
  settings,
}: SettingsPanelProps) {
  const [draftSettings, setDraftSettings] = useState(settings);
  const [mcpHeaderError, setMcpHeaderError] = useState<string | null>(null);
  const [mcpTestResults, setMcpTestResults] = useState<
    Record<string, McpConnectionTestState>
  >({});
  const [showApiKey, setShowApiKey] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [headerDrafts, setHeaderDrafts] = useState<Record<string, string>>(
    () => createHeaderDrafts(settings.mcpServers),
  );

  const hasCustomModelId = draftSettings.customModelId.trim().length > 0;
  const modelOptions = getModelOptions(
    draftSettings.customModelId,
    draftSettings.customModelCapabilities,
  );

  function updateMcpServer(
    serverId: string,
    updater: (server: LocalSettings["mcpServers"][number]) => LocalSettings["mcpServers"][number],
  ) {
    clearMcpTestResult(serverId);
    setDraftSettings((currentSettings) => ({
      ...currentSettings,
      mcpServers: currentSettings.mcpServers.map((server) =>
        server.id === serverId ? updater(server) : server,
      ),
    }));
  }

  function clearMcpTestResult(serverId: string) {
    setMcpTestResults((currentResults) => {
      if (!currentResults[serverId]) {
        return currentResults;
      }

      const nextResults = { ...currentResults };
      delete nextResults[serverId];
      return nextResults;
    });
  }

  async function handleTestMcpServer(
    server: LocalSettings["mcpServers"][number],
  ) {
    setMcpTestResults((currentResults) => ({
      ...currentResults,
      [server.id]: {
        message: "Testing MCP connection...",
        status: "testing",
      },
    }));
    setMcpHeaderError(null);

    try {
      const parsedServer = parseMcpServerDraft(server, headerDrafts);
      const response = await fetch("/api/mcp-test", {
        body: JSON.stringify({ server: parsedServer }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as {
        message?: string;
        ok?: boolean;
      };
      const message = payload.message ?? "MCP connection test failed.";

      setMcpTestResults((currentResults) => ({
        ...currentResults,
        [server.id]: {
          message,
          status: response.ok && payload.ok ? "success" : "error",
        },
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "MCP connection test failed.";

      setMcpTestResults((currentResults) => ({
        ...currentResults,
        [server.id]: {
          message,
          status: "error",
        },
      }));
    }
  }

  async function handleSave() {
    try {
      const nextSettings: LocalSettings = {
        ...draftSettings,
        mcpServers: parseHeaderDrafts(draftSettings.mcpServers, headerDrafts),
      };

      setMcpHeaderError(null);
      await onSave(nextSettings);
    } catch (error) {
      setMcpHeaderError(
        error instanceof Error
          ? error.message
          : "MCP headers must be valid JSON.",
      );
    }
  }

  async function handleImportBackup(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const backup = parseSettingsBackup(await file.text());
      await onImportBackup(backup);
      setDraftSettings((currentSettings) => ({
        ...currentSettings,
        mcpServers: backup.mcpServers,
      }));
      setHeaderDrafts(createHeaderDrafts(backup.mcpServers));
      setMcpHeaderError(null);
    } catch (error) {
      setMcpHeaderError(
        error instanceof Error
          ? error.message
          : "Settings backup could not be imported.",
      );
    }
  }

  function handleExportBackup() {
    try {
      const backup = createSettingsBackup({
        mcpServers: parseHeaderDrafts(draftSettings.mcpServers, headerDrafts),
        memories,
      });
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `tl-chat-settings-${backup.exportedAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMcpHeaderError(null);
    } catch (error) {
      setMcpHeaderError(
        error instanceof Error
          ? error.message
          : "Settings backup could not be exported.",
      );
    }
  }

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

            <form
              className="mt-4 flex gap-3"
              onSubmit={(event) => event.preventDefault()}
            >
              <input
                autoComplete="off"
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
            </form>
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

          <section className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5">
            <label
              className="block text-sm font-semibold text-[color:var(--foreground)]"
              htmlFor="custom-model-id-input"
            >
              Custom model id
            </label>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
              Optional advanced override for any OpenRouter model id.
            </p>
            <input
              id="custom-model-id-input"
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
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {CUSTOM_MODEL_CAPABILITY_OPTIONS.map((option) => (
                <label
                  key={option.key}
                  className={`rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-3 transition ${
                    hasCustomModelId ? "" : "opacity-55"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-[color:var(--foreground)]">
                    <input
                      checked={Boolean(
                        draftSettings.customModelCapabilities[option.key],
                      )}
                      data-testid={`custom-model-capability-${option.key}`}
                      disabled={!hasCustomModelId}
                      type="checkbox"
                      onChange={(event) =>
                        setDraftSettings((currentSettings) => ({
                          ...currentSettings,
                          customModelCapabilities: {
                            ...currentSettings.customModelCapabilities,
                            [option.key]: event.target.checked,
                          },
                        }))
                      }
                    />
                    {option.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[color:var(--muted-foreground)]">
                    {option.description}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--surface-muted)] text-[color:var(--accent-strong)]">
                  <Cable className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                    MCP servers
                  </h3>
                  <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                    Connect Streamable HTTP servers so the assistant can call external tools.
                  </p>
                </div>
              </div>
              <button
                className="flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-2 text-sm text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--accent-strong)]"
                type="button"
                onClick={() => {
                  const nextServer = createMcpServerConfig();
                  setDraftSettings((currentSettings) => ({
                    ...currentSettings,
                    mcpServers: [...currentSettings.mcpServers, nextServer],
                  }));
                  setHeaderDrafts((currentDrafts) => ({
                    ...currentDrafts,
                    [nextServer.id]: "{}",
                  }));
                }}
              >
                <Plus className="h-4 w-4" />
                Add server
              </button>
            </div>

            {draftSettings.mcpServers.length === 0 ? (
              <div className="mt-4 rounded-[20px] border border-dashed border-[color:var(--border)] px-4 py-4 text-sm text-[color:var(--muted-foreground)]">
                No MCP servers configured.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {draftSettings.mcpServers.map((server) => {
                  const testResult = mcpTestResults[server.id];
                  const isTesting = testResult?.status === "testing";

                  return (
                    <div
                      key={server.id}
                      className="rounded-[22px] border border-[color:var(--border)] bg-[color:var(--surface-muted)] p-4"
                    >
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm text-[color:var(--foreground)]">
                        <input
                          checked={server.enabled}
                          type="checkbox"
                          onChange={(event) =>
                            updateMcpServer(server.id, (currentServer) => ({
                              ...currentServer,
                              enabled: event.target.checked,
                            }))
                          }
                        />
                        Enabled
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-55"
                          data-testid={`test-mcp-server-${server.id}`}
                          disabled={isTesting}
                          type="button"
                          onClick={() => void handleTestMcpServer(server)}
                        >
                          {isTesting ? (
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Test
                        </button>
                        <button
                          aria-label={`Remove ${server.name}`}
                          className="text-[color:var(--muted-foreground)] transition hover:text-[color:var(--danger)]"
                          title="Remove MCP server"
                          type="button"
                          onClick={() => {
                            setDraftSettings((currentSettings) => ({
                              ...currentSettings,
                              mcpServers: currentSettings.mcpServers.filter(
                                (currentServer) => currentServer.id !== server.id,
                              ),
                            }));
                            setHeaderDrafts((currentDrafts) => {
                              const nextDrafts = { ...currentDrafts };
                              delete nextDrafts[server.id];
                              return nextDrafts;
                            });
                            clearMcpTestResult(server.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <input
                        className="rounded-2xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]"
                        placeholder="GitHub MCP"
                        value={server.name}
                        onChange={(event) =>
                          updateMcpServer(server.id, (currentServer) => ({
                            ...currentServer,
                            name: event.target.value,
                          }))
                        }
                      />
                      <input
                        className="rounded-2xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]"
                        placeholder="https://example.com/mcp"
                        value={server.url}
                        onChange={(event) =>
                          updateMcpServer(server.id, (currentServer) => ({
                            ...currentServer,
                            url: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <textarea
                      aria-invalid={Boolean(mcpHeaderError)}
                      className="mt-3 min-h-[96px] w-full rounded-2xl border border-[color:var(--border)] bg-transparent px-4 py-3 text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]"
                      placeholder={'{\n  "Authorization": "Bearer ..."\n}'}
                      value={headerDrafts[server.id] ?? "{}"}
                      onChange={(event) => {
                        setMcpHeaderError(null);
                        clearMcpTestResult(server.id);
                        setHeaderDrafts((currentDrafts) => ({
                          ...currentDrafts,
                          [server.id]: event.target.value,
                        }));
                      }}
                    />
                    {testResult ? (
                      <p
                        aria-live="polite"
                        className={`mt-3 rounded-[16px] border px-3 py-2 text-xs leading-5 ${
                          testResult.status === "success"
                            ? "border-[color:var(--accent)]/25 bg-[color:var(--accent)]/8 text-[color:var(--accent-strong)]"
                            : testResult.status === "testing"
                              ? "border-[color:var(--border)] bg-[color:var(--surface-strong)] text-[color:var(--muted-foreground)]"
                              : "border-[color:var(--danger)]/25 bg-[color:var(--danger)]/8 text-[color:var(--danger)]"
                        }`}
                        data-testid={`mcp-server-test-result-${server.id}`}
                      >
                        {testResult.message}
                      </p>
                    ) : null}
                  </div>
                  );
                })}
              </div>
            )}

            {mcpHeaderError ? (
              <p
                aria-live="polite"
                className="mt-3 rounded-[18px] border border-[color:var(--danger)]/25 bg-[color:var(--danger)]/8 px-4 py-3 text-sm text-[color:var(--danger)]"
              >
                {mcpHeaderError}
              </p>
            ) : null}
          </section>

          <MemoryManager
            memories={memories}
            onAddMemory={onAddMemory}
            onClearAll={onClearMemories}
            onDeleteMemory={onDeleteMemory}
          />

          <section className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
                  Local backup
                </h3>
                <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
                  Export memories and MCP servers as JSON. OpenRouter keys are
                  intentionally excluded. Import replaces memories and MCP
                  servers, while keeping your API key.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <input
                  ref={backupInputRef}
                  accept="application/json,.json"
                  className="hidden"
                  data-testid="import-settings-backup-input"
                  type="file"
                  onChange={(event) => {
                    void handleImportBackup(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <button
                  className="flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-2 text-sm text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--accent-strong)]"
                  data-testid="import-settings-backup-button"
                  type="button"
                  onClick={() => backupInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  Import
                </button>
                <button
                  className="flex items-center gap-2 rounded-full border border-[color:var(--border)] px-3 py-2 text-sm text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--accent-strong)]"
                  data-testid="export-settings-backup-button"
                  type="button"
                  onClick={handleExportBackup}
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
              </div>
            </div>
          </section>

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
              onClick={() => void handleSave()}
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
