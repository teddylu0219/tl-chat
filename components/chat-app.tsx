"use client";

import { LoaderCircle, Menu } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

import { DeleteConversationDialog, RenameConversationDialog } from "@/components/thread-dialogs";
import { ConversationSession } from "@/components/conversation-session";
import { ChatSidebar } from "@/components/chat-sidebar";
import { SettingsPanel } from "@/components/settings-panel";
import {
  createConversationRecord,
  exportConversationAsMarkdown,
  getDisplayTitle,
  hasConversationContent,
  isArchivedConversation,
  matchesConversationSearch,
  sortConversations,
} from "@/lib/conversations";
import { DEFAULT_SETTINGS, type ConversationRecord, type LocalSettings } from "@/lib/persistence";
import {
  archiveConversation,
  deleteConversationPermanent,
  getSettings,
  listConversations,
  renameConversation,
  restoreConversation,
  saveConversation,
  saveSettings,
} from "@/lib/persistence";

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
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
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
      const [storedSettings, storedConversations] = await Promise.all([
        getSettings(),
        listConversations(),
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

  async function createAndSelectConversation() {
    const nextConversation = await saveConversation(
      createConversationRecord(settings.defaultModelId),
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

  function handleNewConversation() {
    const activeConversation = conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );

    if (activeConversation && !hasConversationContent(activeConversation)) {
      setIsSidebarOpen(false);
      return;
    }

    void createAndSelectConversation();
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
      return;
    }

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
              onOpenSettings={() => setIsSettingsOpen(true)}
              onRenameConversation={(conversation) => setRenameTarget(conversation)}
              onSearchChange={setSidebarSearchQuery}
              searchQuery={sidebarSearchQuery}
            />
          </div>

          <section className="panel-surface relative flex h-full min-h-0 flex-1 overflow-hidden rounded-[30px]">
            <ConversationSession
              key={activeConversation.id}
              conversation={activeConversation}
              customModelId={settings.customModelId}
              openRouterApiKey={settings.openRouterApiKey}
              onConversationChange={replaceConversation}
              onDeleteConversation={(conversation) => setDeleteTarget(conversation)}
              onExportConversation={handleExportConversation}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onRenameConversation={(conversation) => setRenameTarget(conversation)}
              onToggleArchiveConversation={(conversation) =>
                void handleArchiveToggle(conversation)
              }
              onToggleSidebar={() => setIsSidebarOpen(true)}
            />
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
              onOpenSettings={() => {
                setIsSidebarOpen(false);
                setIsSettingsOpen(true);
              }}
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
        modelId={activeConversation.modelId}
        onClose={() => setIsSettingsOpen(false)}
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
