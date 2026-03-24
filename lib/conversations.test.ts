import {
  createConversationRecord,
  deriveConversationTitle,
  exportConversationAsMarkdown,
  getDisplayTitle,
  getPreviewText,
  groupConversationsByDate,
  hasConversationContent,
  isArchivedConversation,
  isMessageStreaming,
  isPinnedConversation,
  matchesConversationSearch,
  sortConversations,
} from "./conversations";
import type { ConversationRecord } from "./persistence";

describe("conversation helpers", () => {
  it("creates an empty conversation scaffold", () => {
    const conversation = createConversationRecord("openai/gpt-5.4-mini");

    expect(conversation.modelId).toBe("openai/gpt-5.4-mini");
    expect(conversation.messages).toHaveLength(0);
    expect(conversation.previewText).toBe("");
    expect(conversation.title).toBe("New thread");
  });

  it("derives a human title from the first user message", () => {
    expect(
      deriveConversationTitle([
        {
          id: "msg_1",
          parts: [{ type: "text", text: "Plan a short Kyoto trip for food lovers" }],
          role: "user",
        },
      ]),
    ).toBe("Plan a short Kyoto trip for food lovers");
  });

  it("treats drafts as conversation content", () => {
    expect(
      hasConversationContent({
        archivedAt: null,
        createdAt: "2026-03-19T08:00:00.000Z",
        draft: "still typing",
        id: "draft-thread",
        manualTitle: null,
        messages: [],
        modelId: "openai/gpt-5.4-mini",
        pinnedAt: null,
        previewText: "",
        title: "New thread",
        updatedAt: "2026-03-19T08:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("prefers manual titles over generated titles", () => {
    expect(
      getDisplayTitle({
        archivedAt: null,
        createdAt: "2026-03-19T08:00:00.000Z",
        draft: "",
        id: "manual-title",
        manualTitle: "Travel ideas",
        messages: [],
        modelId: "openai/gpt-5.4-mini",
        pinnedAt: null,
        previewText: "",
        title: "New thread",
        updatedAt: "2026-03-19T08:00:00.000Z",
      }),
    ).toBe("Travel ideas");
  });

  it("derives preview text from the latest text message", () => {
    expect(
      getPreviewText([
        {
          id: "msg_1",
          parts: [{ type: "text", text: "Older context" }],
          role: "user",
        },
        {
          id: "msg_2",
          parts: [{ type: "text", text: "Newest response preview" }],
          role: "assistant",
        },
      ]),
    ).toBe("Newest response preview");
  });

  it("detects when a message is still streaming", () => {
    expect(
      isMessageStreaming({
        id: "msg_streaming",
        parts: [{ type: "text", text: "Building tree...", state: "streaming" }],
        role: "assistant",
      }),
    ).toBe(true);

    expect(
      isMessageStreaming({
        id: "msg_done",
        parts: [{ type: "text", text: "Done", state: "done" }],
        role: "assistant",
      }),
    ).toBe(false);
  });

  it("matches conversation search against title, preview, and message text", () => {
    expect(
      matchesConversationSearch(
        {
          archivedAt: null,
          createdAt: "2026-03-19T08:00:00.000Z",
          draft: "",
          id: "searchable",
          manualTitle: "Kyoto notes",
          messages: [
            {
              id: "msg_1",
              parts: [{ type: "text", text: "Find temples and coffee shops" }],
              role: "user",
            },
          ],
          modelId: "openai/gpt-5.4-mini",
          pinnedAt: null,
          previewText: "coffee shops",
          title: "New thread",
          updatedAt: "2026-03-19T08:00:00.000Z",
        },
        "coffee",
      ),
    ).toBe(true);
  });

  it("sorts pinned conversations ahead of recents and archives last", () => {
    const sorted = sortConversations([
      {
        archivedAt: "2026-03-19T09:00:00.000Z",
        createdAt: "2026-03-19T08:00:00.000Z",
        draft: "",
        id: "archived",
        manualTitle: null,
        messages: [],
        modelId: "openai/gpt-5.4-mini",
        pinnedAt: null,
        previewText: "",
        title: "Archived",
        updatedAt: "2026-03-19T09:00:00.000Z",
      },
      {
        archivedAt: null,
        createdAt: "2026-03-19T08:00:00.000Z",
        draft: "",
        id: "recent",
        manualTitle: null,
        messages: [],
        modelId: "openai/gpt-5.4-mini",
        pinnedAt: null,
        previewText: "",
        title: "Recent",
        updatedAt: "2026-03-19T10:00:00.000Z",
      },
      {
        archivedAt: null,
        createdAt: "2026-03-19T08:00:00.000Z",
        draft: "",
        id: "pinned",
        manualTitle: null,
        messages: [],
        modelId: "openai/gpt-5.4-mini",
        pinnedAt: "2026-03-19T11:00:00.000Z",
        previewText: "",
        title: "Pinned",
        updatedAt: "2026-03-19T09:30:00.000Z",
      },
    ]);

    expect(sorted.map((conversation) => conversation.id)).toEqual([
      "pinned",
      "recent",
      "archived",
    ]);
    expect(isPinnedConversation(sorted[0])).toBe(true);
    expect(isArchivedConversation(sorted[2])).toBe(true);
  });

  it("groups conversations by date with pinned on top", () => {
    const base: ConversationRecord = {
      archivedAt: null,
      createdAt: "2026-03-23T08:00:00.000Z",
      draft: "",
      id: "id",
      manualTitle: null,
      messages: [],
      modelId: "openai/gpt-5.4-mini",
      pinnedAt: null,
      previewText: "",
      title: "Thread",
      updatedAt: "2026-03-23T08:00:00.000Z",
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10);
    const yesterday = new Date(today.getTime() - 86_400_000);
    const fiveDaysAgo = new Date(today.getTime() - 5 * 86_400_000);
    const fifteenDaysAgo = new Date(today.getTime() - 15 * 86_400_000);
    const sixtyDaysAgo = new Date(today.getTime() - 60 * 86_400_000);

    const conversations: ConversationRecord[] = [
      { ...base, id: "pinned", pinnedAt: today.toISOString(), updatedAt: yesterday.toISOString() },
      { ...base, id: "today", updatedAt: today.toISOString() },
      { ...base, id: "yesterday", updatedAt: yesterday.toISOString() },
      { ...base, id: "week", updatedAt: fiveDaysAgo.toISOString() },
      { ...base, id: "month", updatedAt: fifteenDaysAgo.toISOString() },
      { ...base, id: "older", updatedAt: sixtyDaysAgo.toISOString() },
    ];

    const groups = groupConversationsByDate(conversations);
    const labels = groups.map((g) => g.label);

    expect(labels).toEqual(["Pinned", "Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"]);
    expect(groups.find((g) => g.label === "Pinned")?.conversations[0].id).toBe("pinned");
    expect(groups.find((g) => g.label === "Today")?.conversations[0].id).toBe("today");
    expect(groups.find((g) => g.label === "Older")?.conversations[0].id).toBe("older");
  });

  it("omits empty groups", () => {
    const base: ConversationRecord = {
      archivedAt: null,
      createdAt: "2026-03-23T08:00:00.000Z",
      draft: "",
      id: "today-only",
      manualTitle: null,
      messages: [],
      modelId: "openai/gpt-5.4-mini",
      pinnedAt: null,
      previewText: "",
      title: "Thread",
      updatedAt: new Date().toISOString(),
    };

    const groups = groupConversationsByDate([base]);

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Today");
  });

  it("exports a conversation to markdown", () => {
    expect(
      exportConversationAsMarkdown({
        archivedAt: null,
        createdAt: "2026-03-19T08:00:00.000Z",
        draft: "",
        id: "export",
        manualTitle: "Launch plan",
        messages: [
          {
            id: "msg_1",
            parts: [{ type: "text", text: "Help me launch this product." }],
            role: "user",
          },
          {
            id: "msg_2",
            parts: [{ type: "text", text: "Start with a concise checklist." }],
            role: "assistant",
          },
        ],
        modelId: "openai/gpt-5.4-mini",
        pinnedAt: null,
        previewText: "Start with a concise checklist.",
        title: "New thread",
        updatedAt: "2026-03-19T09:00:00.000Z",
      }),
    ).toContain("## Assistant");
  });
});
