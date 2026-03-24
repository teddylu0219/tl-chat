import type { UIMessage } from "ai";

import {
  archiveConversation,
  clearPersistence,
  deleteConversationPermanent,
  getSettings,
  listConversations,
  pinConversation,
  renameConversation,
  restoreConversation,
  saveConversation,
  saveSettings,
  unpinConversation,
} from "./persistence";

function createMessage(text: string): UIMessage {
  return {
    id: crypto.randomUUID(),
    parts: [{ type: "text", text }],
    role: "user",
  };
}

describe("persistence adapter", () => {
  beforeEach(async () => {
    await clearPersistence();
  });

  it("sorts conversations by most recent update first", async () => {
    await saveConversation({
      archivedAt: null,
      createdAt: "2026-03-19T08:00:00.000Z",
      draft: "",
      id: "first",
      manualTitle: null,
      messages: [createMessage("first")],
      modelId: "openai/gpt-5.4-mini",
      pinnedAt: null,
      previewText: "first",
      title: "First",
      updatedAt: "2026-03-19T08:00:00.000Z",
    });
    await saveConversation({
      archivedAt: null,
      createdAt: "2026-03-19T09:00:00.000Z",
      draft: "",
      id: "second",
      manualTitle: null,
      messages: [createMessage("second")],
      modelId: "openai/gpt-5.4-mini",
      pinnedAt: null,
      previewText: "second",
      title: "Second",
      updatedAt: "2026-03-19T10:00:00.000Z",
    });

    await expect(listConversations()).resolves.toMatchObject([
      { id: "second" },
      { id: "first" },
    ]);
  });

  it("persists settings while preserving defaults", async () => {
    await saveSettings({
      openRouterApiKey: "sk-or-v1-local-key",
      themePreference: "graphite-dark",
    });

    await expect(getSettings()).resolves.toMatchObject({
      defaultModelId: "openai/gpt-5.4-mini",
      openRouterApiKey: "sk-or-v1-local-key",
      themePreference: "graphite-dark",
    });
  });

  it("deletes conversations cleanly", async () => {
    await saveConversation({
      archivedAt: null,
      createdAt: "2026-03-19T08:00:00.000Z",
      draft: "",
      id: "remove-me",
      manualTitle: null,
      messages: [createMessage("bye")],
      modelId: "openai/gpt-5.4-mini",
      pinnedAt: null,
      previewText: "bye",
      title: "Delete me",
      updatedAt: "2026-03-19T08:00:00.000Z",
    });

    await deleteConversationPermanent("remove-me");

    await expect(listConversations()).resolves.toHaveLength(0);
  });

  it("renames, pins, archives, restores, and unpins conversations", async () => {
    await saveConversation({
      archivedAt: null,
      createdAt: "2026-03-19T08:00:00.000Z",
      draft: "",
      id: "managed",
      manualTitle: null,
      messages: [createMessage("persistent text")],
      modelId: "openai/gpt-5.4-mini",
      pinnedAt: null,
      previewText: "",
      title: "Managed",
      updatedAt: "2026-03-19T08:00:00.000Z",
    });

    await renameConversation("managed", "Manual title");
    await pinConversation("managed");
    await archiveConversation("managed");
    await restoreConversation("managed");
    await unpinConversation("managed");

    await expect(listConversations()).resolves.toMatchObject([
      {
        archivedAt: null,
        id: "managed",
        manualTitle: "Manual title",
        pinnedAt: null,
        previewText: "persistent text",
      },
    ]);
  });
});
