import type { UIMessage } from "ai";

import {
  clearPersistence,
  deleteConversation,
  getSettings,
  listConversations,
  saveConversation,
  saveSettings,
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
      createdAt: "2026-03-19T08:00:00.000Z",
      draft: "",
      id: "first",
      messages: [createMessage("first")],
      modelId: "openai/gpt-5.4-mini",
      title: "First",
      updatedAt: "2026-03-19T08:00:00.000Z",
    });
    await saveConversation({
      createdAt: "2026-03-19T09:00:00.000Z",
      draft: "",
      id: "second",
      messages: [createMessage("second")],
      modelId: "openai/gpt-5.4-mini",
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
      createdAt: "2026-03-19T08:00:00.000Z",
      draft: "",
      id: "remove-me",
      messages: [createMessage("bye")],
      modelId: "openai/gpt-5.4-mini",
      title: "Delete me",
      updatedAt: "2026-03-19T08:00:00.000Z",
    });

    await deleteConversation("remove-me");

    await expect(listConversations()).resolves.toHaveLength(0);
  });
});
