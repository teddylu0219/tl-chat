import { createConversationRecord, deriveConversationTitle, hasConversationContent } from "./conversations";

describe("conversation helpers", () => {
  it("creates an empty conversation scaffold", () => {
    const conversation = createConversationRecord("openai/gpt-5.4-mini");

    expect(conversation.modelId).toBe("openai/gpt-5.4-mini");
    expect(conversation.messages).toHaveLength(0);
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
        createdAt: "2026-03-19T08:00:00.000Z",
        draft: "still typing",
        id: "draft-thread",
        messages: [],
        modelId: "openai/gpt-5.4-mini",
        title: "New thread",
        updatedAt: "2026-03-19T08:00:00.000Z",
      }),
    ).toBe(true);
  });
});
