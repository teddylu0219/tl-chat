import {
  createConversationRecord,
  deriveConversationTitle,
  exportConversationAsMarkdown,
  getDisplayTitle,
  getPreviewText,
  hasConversationContent,
  isArchivedConversation,
  isPinnedConversation,
  matchesConversationSearch,
  sortConversations,
} from "./conversations";

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
