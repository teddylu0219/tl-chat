"use client";

import { LoaderCircle, Menu } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

import { ConversationSession } from "@/components/conversation-session";
import { SettingsPanel } from "@/components/settings-panel";
import { ChatSidebar } from "@/components/chat-sidebar";
import {
  createConversationRecord,
  hasConversationContent,
} from "@/lib/conversations";
import { DEFAULT_SETTINGS, type ConversationRecord, type LocalSettings } from "@/lib/persistence";
import {
  getSettings,
  listConversations,
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

  return nextConversations.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
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
      setActiveConversationId(nextActiveConversationId);
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

    const nextConversation = createConversationRecord(settings.defaultModelId);

    replaceConversation(nextConversation);
    setActiveConversationId(nextConversation.id);
    setIsSidebarOpen(false);
  }

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ??
    conversations[0] ??
    null;

  const visibleConversations = conversations.filter((conversation) =>
    hasConversationContent(conversation),
  );

  if (!isLoaded || !activeConversation) {
    return (
      <main className="app-shell isolate flex min-h-screen items-center justify-center p-4">
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
      <main className="app-shell isolate flex min-h-screen p-3 sm:p-5">
        <div className="mx-auto flex w-full max-w-[1600px] gap-3 lg:gap-4">
          <div className="hidden lg:block">
            <ChatSidebar
              activeConversationId={activeConversation.id}
              conversations={visibleConversations}
              onConversationSelect={(conversationId) =>
                setActiveConversationId(conversationId)
              }
              onNewConversation={handleNewConversation}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          </div>

          <section className="panel-surface relative flex min-h-[calc(100vh-24px)] flex-1 overflow-hidden rounded-[32px] sm:min-h-[calc(100vh-40px)]">
            <ConversationSession
              key={activeConversation.id}
              conversation={activeConversation}
              customModelId={settings.customModelId}
              openRouterApiKey={settings.openRouterApiKey}
              onConversationChange={replaceConversation}
              onOpenSettings={() => setIsSettingsOpen(true)}
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
              conversations={visibleConversations}
              onConversationSelect={(conversationId) => {
                setActiveConversationId(conversationId);
                setIsSidebarOpen(false);
              }}
              onNewConversation={handleNewConversation}
              onOpenSettings={() => {
                setIsSidebarOpen(false);
                setIsSettingsOpen(true);
              }}
              onRequestClose={() => setIsSidebarOpen(false)}
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
        isOpen={isSettingsOpen}
        modelId={activeConversation.modelId}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
        settings={settings}
      />
    </>
  );
}
