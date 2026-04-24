"use client";

import { LoaderCircle, Menu } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

import { DeleteConversationDialog, RenameConversationDialog } from "@/components/thread-dialogs";
import { ConversationSession } from "@/components/conversation-session";
import { CouncilSession } from "@/components/council-session";
import { ChatSidebar } from "@/components/chat-sidebar";
import { SettingsPanel } from "@/components/settings-panel";
import { ToastProvider, useToast } from "@/components/toast";
import {
  createConversationRecord,
  exportConversationAsMarkdown,
  getDisplayTitle,
  hasConversationContent,
  isArchivedConversation,
  isPinnedConversation,
  matchesConversationSearch,
  sortConversations,
} from "@/lib/conversations";
import {
  createMemoryEntry,
  isDuplicateMemory,
  type MemoryEntry,
  type MemoryOperation,
} from "@/lib/memory";
import { DEFAULT_SETTINGS, type ConversationRecord, type LocalSettings } from "@/lib/persistence";
import {
  archiveConversation,
  clearMemories,
  deleteConversationPermanent,
  deleteMemory,
  getSettings,
  listConversations,
  listMemories,
  pinConversation,
  renameConversation,
  restoreConversation,
  saveConversation,
  saveMemory,
  saveSettings,
  unpinConversation,
} from "@/lib/persistence";
import type { SettingsBackup } from "@/lib/settings-backup";

function upsertConversation(
  conversations: ConversationRecord[],
  nextConversation: ConversationRecord,
) {
  const nextConversations = conversations.some(
    (conversation) => conversation.id === nextConversation.id,
  )
    ? conversations.map((conversation) =>
        conversation.id === nextConversation.id ? nextConversation : conversation,
      )
    : [nextConversation, ...conversations];

  return sortConversations(nextConversations);
}

function removeConversation(
  conversations: ConversationRecord[],
  conversationId: string,
) {
  return conversations.filter((conversation) => conversation.id !== conversationId);
}

function findFallbackConversation(
  conversations: ConversationRecord[],
) {
  const nonEmptyConversations = conversations.filter(hasConversationContent);
  return nonEmptyConversations.find((conversation) => !isArchivedConversation(conversation)) ?? null;
}

export function ChatApp() {
  return (
    <ToastProvider>
      <ChatAppInner />
    </ToastProvider>
  );
}

function ChatAppInner() {
  const { showToast } = useToast();
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null,
  );
  const [settings, setSettings] = useState<LocalSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ConversationRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConversationRecord | null>(null);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");

  const applyTheme = useEffectEvent((themePreference: LocalSettings["themePreference"]) => {
    const root = document.documentElement;

    if (themePreference === "system") {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      root.dataset.theme = prefersDark ? "graphite-dark" : "warm-light";
      return;
    }

    root.dataset.theme = themePreference;
  });

  useEffect(() => {
    async function loadLocalState() {
      const [storedSettings, storedConversations, storedMemories] = await Promise.all([
        getSettings(),
        listConversations(),
        listMemories(),
      ]);
      const nextConversations =
        storedConversations.length > 0
          ? storedConversations
          : [createConversationRecord(storedSettings.defaultModelId)];
      const nextActiveConversationId =
        storedSettings.activeConversationId &&
        nextConversations.some(
          (conversation) => conversation.id === storedSettings.activeConversationId,
        )
          ? storedSettings.activeConversationId
          : nextConversations[0]?.id ?? null;

      setSettings(storedSettings);
      setConversations(nextConversations);
      setMemories(storedMemories);
      setActiveConversationId(
        nextConversations.find(
          (conversation) => conversation.id === nextActiveConversationId,
        )?.archivedAt
          ? findFallbackConversation(nextConversations)?.id ??
              nextConversations.find((conversation) => !conversation.archivedAt)?.id ??
              null
          : nextActiveConversationId,
      );
      setIsLoaded(true);

      if (storedConversations.length === 0) {
        await saveConversation(nextConversations[0]);
      }
    }

    void loadLocalState();
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    applyTheme(settings.themePreference);

    if (settings.themePreference !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");

    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [isLoaded, settings.themePreference]);

  useEffect(() => {
    if (!isLoaded || !activeConversationId) {
      return;
    }

    void saveSettings({ activeConversationId });
  }, [activeConversationId, isLoaded]);

  function replaceConversation(nextConversation: ConversationRecord) {
    setConversations((currentConversations) =>
      upsertConversation(currentConversations, nextConversation),
    );
    void saveConversation(nextConversation);
  }

  async function createAndSelectConversation(mode?: "standard" | "council") {
    const record = createConversationRecord(settings.defaultModelId);
    const nextConversation = await saveConversation(
      mode === "council" ? { ...record, mode: "council" } : record,
    );

    setConversations((currentConversations) =>
      upsertConversation(currentConversations, nextConversation),
    );
    setActiveConversationId(nextConversation.id);

    return nextConversation;
  }

  async function handleSaveSettings(nextSettings: LocalSettings) {
    setSettings(nextSettings);
    await saveSettings(nextSettings);

    const activeConversation = conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );

    if (activeConversation && !hasConversationContent(activeConversation)) {
      replaceConversation({
        ...activeConversation,
        modelId: nextSettings.defaultModelId,
      });
    }

    setIsSettingsOpen(false);
  }

  async function handleImportSettingsBackup(backup: SettingsBackup) {
    await clearMemories();
    await Promise.all(backup.memories.map((memory) => saveMemory(memory)));

    const nextSettings = await saveSettings({
      mcpServers: backup.mcpServers,
    });

    setMemories(backup.memories);
    setSettings(nextSettings);
    showToast(
      `Imported ${backup.memories.length} memories and ${backup.mcpServers.length} MCP servers`,
    );
  }

  function getConversationMode(conversation: ConversationRecord | undefined | null) {
    return conversation?.mode === "council" ? "council" : "standard";
  }

  function handleNewConversation() {
    const activeConversation = conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );

    if (
      activeConversation &&
      !hasConversationContent(activeConversation) &&
      getConversationMode(activeConversation) === "standard"
    ) {
      setIsSidebarOpen(false);
      return;
    }

    void createAndSelectConversation();
    setIsSidebarOpen(false);
  }

  function handleNewCouncil() {
    const activeConversation = conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );

    if (
      activeConversation &&
      !hasConversationContent(activeConversation) &&
      getConversationMode(activeConversation) === "council"
    ) {
      setIsSidebarOpen(false);
      return;
    }

    void createAndSelectConversation("council");
    setIsSidebarOpen(false);
  }

  async function handleRenameConversation(
    conversation: ConversationRecord,
    manualTitle: string | null,
  ) {
    const updatedConversation = await renameConversation(
      conversation.id,
      manualTitle,
    );

    if (updatedConversation) {
      setConversations((currentConversations) =>
        upsertConversation(currentConversations, updatedConversation),
      );
    }

    setRenameTarget(null);
  }

  async function handlePinToggle(conversation: ConversationRecord) {
    const updatedConversation = isPinnedConversation(conversation)
      ? await unpinConversation(conversation.id)
      : await pinConversation(conversation.id);

    if (updatedConversation) {
      setConversations((currentConversations) =>
        upsertConversation(currentConversations, updatedConversation),
      );
    }
  }

  async function handleArchiveToggle(conversation: ConversationRecord) {
    const updatedConversation = isArchivedConversation(conversation)
      ? await restoreConversation(conversation.id)
      : await archiveConversation(conversation.id);

    if (!updatedConversation) {
      return;
    }

    const nextConversations = upsertConversation(conversations, updatedConversation);
    setConversations(nextConversations);

    if (isArchivedConversation(conversation)) {
      setActiveConversationId(updatedConversation.id);
      showToast("Thread restored");
      return;
    }

    showToast("Thread archived");

    if (activeConversationId !== conversation.id) {
      return;
    }

    const fallbackConversation = findFallbackConversation(
      nextConversations.filter(
        (item) =>
          item.id !== conversation.id || !isArchivedConversation(updatedConversation),
      ),
    );

    if (fallbackConversation) {
      setActiveConversationId(fallbackConversation.id);
      return;
    }

    await createAndSelectConversation();
  }

  async function handleDeleteConversation(conversation: ConversationRecord) {
    await deleteConversationPermanent(conversation.id);

    const nextConversations = removeConversation(conversations, conversation.id);
    setConversations(nextConversations);
    setDeleteTarget(null);
    showToast("Thread deleted");

    if (activeConversationId !== conversation.id) {
      return;
    }

    const fallbackConversation = findFallbackConversation(nextConversations);

    if (fallbackConversation) {
      setActiveConversationId(fallbackConversation.id);
      return;
    }

    await createAndSelectConversation();
  }

  async function handleRestoreArchivedConversation(conversation: ConversationRecord) {
    const updatedConversation = await restoreConversation(conversation.id);

    if (!updatedConversation) {
      return;
    }

    setConversations((currentConversations) =>
      upsertConversation(currentConversations, updatedConversation),
    );
    setActiveConversationId(updatedConversation.id);
  }

  function handleExportConversation(conversation: ConversationRecord) {
    const blob = new Blob([exportConversationAsMarkdown(conversation)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${getDisplayTitle(conversation)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "conversation"}.md`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Exported as markdown");
  }

  // Memory handlers
  async function handleAddMemory(entry: MemoryEntry) {
    if (isDuplicateMemory(memories, entry.content)) {
      return;
    }

    await saveMemory(entry);
    setMemories((prev) => [entry, ...prev]);
    showToast("Memory saved");
  }

  async function handleDeleteMemory(id: string) {
    await deleteMemory(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleClearMemories() {
    await clearMemories();
    setMemories([]);
    showToast("All memories cleared");
  }

  async function handleApplyMemoryOperations(operations: MemoryOperation[]) {
    if (operations.length === 0) {
      return;
    }

    let nextMemories = [...memories];
    let didChange = false;

    for (const operation of operations) {
      if (operation.type === "add") {
        if (isDuplicateMemory(nextMemories, operation.content)) {
          continue;
        }

        const entry: MemoryEntry = {
          ...createMemoryEntry(operation.content),
        };

        await saveMemory(entry);
        nextMemories = [entry, ...nextMemories];
        didChange = true;
        continue;
      }

      const currentMemory = nextMemories.find((memory) => memory.id === operation.id);

      if (!currentMemory) {
        continue;
      }

      if (operation.type === "delete") {
        await deleteMemory(operation.id);
        nextMemories = nextMemories.filter((memory) => memory.id !== operation.id);
        didChange = true;
        continue;
      }

      const nextContent = operation.content.trim();

      if (!nextContent) {
        continue;
      }

      const duplicateTarget = nextMemories.find(
        (memory) =>
          memory.id !== operation.id &&
          memory.content.toLowerCase().trim() === nextContent.toLowerCase(),
      );

      if (duplicateTarget) {
        await deleteMemory(operation.id);
        nextMemories = nextMemories.filter((memory) => memory.id !== operation.id);
        didChange = true;
        continue;
      }

      if (currentMemory.content === nextContent) {
        continue;
      }

      const updatedMemory: MemoryEntry = {
        ...currentMemory,
        content: nextContent,
        updatedAt: new Date().toISOString(),
      };

      await saveMemory(updatedMemory);
      nextMemories = nextMemories.map((memory) =>
        memory.id === operation.id ? updatedMemory : memory,
      );
      didChange = true;
    }

    if (didChange) {
      setMemories(nextMemories);
      showToast("Memory updated", {
        actionLabel: "Review memory",
        onAction: () => setIsSettingsOpen(true),
      });
    }
  }

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ??
    conversations[0] ??
    null;

  const visibleConversations = conversations.filter(hasConversationContent);
  const matchingConversations = visibleConversations.filter((conversation) =>
    matchesConversationSearch(conversation, sidebarSearchQuery),
  );
  const activeConversations = matchingConversations.filter(
    (conversation) => !isArchivedConversation(conversation),
  );
  const archivedConversations = matchingConversations.filter(isArchivedConversation);

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      if (deleteTarget) {
        setDeleteTarget(null);
      } else if (renameTarget) {
        setRenameTarget(null);
      } else if (isSettingsOpen) {
        setIsSettingsOpen(false);
      } else if (isSidebarOpen) {
        setIsSidebarOpen(false);
      }
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === "n") {
      const target = event.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (isInput) {
        return;
      }

      event.preventDefault();
      handleNewConversation();
    }
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      handleKeyDown(event);
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!isLoaded || !activeConversation) {
    return (
      <main className="app-shell isolate flex h-dvh items-center justify-center overflow-hidden p-4">
        <div className="panel-surface flex w-full max-w-xl items-center gap-4 rounded-[28px] px-6 py-5 text-[color:var(--foreground)]">
          <LoaderCircle className="h-5 w-5 animate-spin text-[color:var(--accent-strong)]" />
          <div>
            <p className="text-sm font-medium">Preparing your local workspace</p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
              Loading settings, conversations, and theme preferences from IndexedDB.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const isCouncilMode = activeConversation.mode === "council";

  return (
    <>
      <main className="app-shell isolate flex h-dvh overflow-hidden p-3 sm:p-4">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1720px] gap-3 lg:gap-5">
          <div className="hidden lg:block">
            <ChatSidebar
              activeConversationId={activeConversation.id}
              conversations={activeConversations}
              onArchiveToggle={(conversation) => void handleArchiveToggle(conversation)}
              onConversationSelect={(conversationId) =>
                setActiveConversationId(conversationId)
              }
              onDeleteConversation={(conversation) => setDeleteTarget(conversation)}
              onNewConversation={handleNewConversation}
              onNewCouncil={handleNewCouncil}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onPinToggle={(conversation) => void handlePinToggle(conversation)}
              onRenameConversation={(conversation) => setRenameTarget(conversation)}
              onSearchChange={setSidebarSearchQuery}
              searchQuery={sidebarSearchQuery}
            />
          </div>

          <section className="panel-surface relative flex h-full min-h-0 flex-1 overflow-hidden rounded-[30px]">
            {isCouncilMode ? (
              <CouncilSession
                key={activeConversation.id}
                conversation={activeConversation}
                customModelCapabilities={settings.customModelCapabilities}
                customModelId={settings.customModelId}
                memories={memories}
                openRouterApiKey={settings.openRouterApiKey}
                onAutoMemory={(entry) => void handleAddMemory(entry)}
                onConversationChange={replaceConversation}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onToggleSidebar={() => setIsSidebarOpen(true)}
              />
            ) : (
              <ConversationSession
                key={activeConversation.id}
                conversation={activeConversation}
                customModelCapabilities={settings.customModelCapabilities}
                customModelId={settings.customModelId}
                memories={memories}
                mcpServers={settings.mcpServers}
                openRouterApiKey={settings.openRouterApiKey}
                onApplyMemoryOperations={(operations) =>
                  void handleApplyMemoryOperations(operations)
                }
                onConversationChange={replaceConversation}
                onDeleteConversation={(conversation) => setDeleteTarget(conversation)}
                onExportConversation={handleExportConversation}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onPinToggle={(conversation) => void handlePinToggle(conversation)}
                onRenameConversation={(conversation) => setRenameTarget(conversation)}
                onToggleArchiveConversation={(conversation) =>
                  void handleArchiveToggle(conversation)
                }
                onToggleSidebar={() => setIsSidebarOpen(true)}
              />
            )}
          </section>
        </div>
      </main>

      {isSidebarOpen ? (
        <div className="fixed inset-0 z-30 bg-black/30 p-3 backdrop-blur-sm lg:hidden">
          <div className="flex h-full w-[min(100%,340px)] flex-col">
            <ChatSidebar
              activeConversationId={activeConversation.id}
              conversations={activeConversations}
              onArchiveToggle={(conversation) => void handleArchiveToggle(conversation)}
              onConversationSelect={(conversationId) => {
                setActiveConversationId(conversationId);
                setIsSidebarOpen(false);
              }}
              onDeleteConversation={(conversation) => {
                setDeleteTarget(conversation);
                setIsSidebarOpen(false);
              }}
              onNewConversation={handleNewConversation}
              onNewCouncil={handleNewCouncil}
              onOpenSettings={() => {
                setIsSidebarOpen(false);
                setIsSettingsOpen(true);
              }}
              onPinToggle={(conversation) => void handlePinToggle(conversation)}
              onRequestClose={() => setIsSidebarOpen(false)}
              onRenameConversation={(conversation) => {
                setRenameTarget(conversation);
                setIsSidebarOpen(false);
              }}
              onSearchChange={setSidebarSearchQuery}
              searchQuery={sidebarSearchQuery}
            />
          </div>
        </div>
      ) : null}

      <button
        aria-label="Open sidebar"
        className="fixed bottom-4 left-4 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)] shadow-lg lg:hidden"
        data-testid="floating-sidebar-toggle"
        type="button"
        onClick={() => setIsSidebarOpen(true)}
      >
        <Menu className="h-4 w-4" />
      </button>

      <SettingsPanel
        archivedConversations={archivedConversations}
        isOpen={isSettingsOpen}
        key={isSettingsOpen ? `settings-open-${JSON.stringify(settings)}` : "settings-closed"}
        memories={memories}
        modelId={activeConversation.modelId}
        onAddMemory={(entry) => void handleAddMemory(entry)}
        onClearMemories={() => void handleClearMemories()}
        onClose={() => setIsSettingsOpen(false)}
        onDeleteMemory={(id) => void handleDeleteMemory(id)}
        onImportBackup={(backup) => void handleImportSettingsBackup(backup)}
        onRestoreConversation={(conversation) =>
          void handleRestoreArchivedConversation(conversation)
        }
        onSave={handleSaveSettings}
        settings={settings}
      />
      <RenameConversationDialog
        conversation={renameTarget}
        onClose={() => setRenameTarget(null)}
        onSave={(conversation, manualTitle) =>
          void handleRenameConversation(conversation, manualTitle)
        }
      />
      <DeleteConversationDialog
        conversation={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDelete={(conversation) => void handleDeleteConversation(conversation)}
      />
    </>
  );
}
