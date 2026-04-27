import { ZodError } from "zod";

import { parseChatRequest } from "./chat-schema";

describe("chat request schema", () => {
  it("accepts a minimal text-only request payload", async () => {
    await expect(
      parseChatRequest({
        apiKey: "sk-or-v1-example-key",
        messages: [
          {
            id: "msg_1",
            parts: [{ type: "text", text: "Hello" }],
            role: "user",
          },
        ],
        modelId: "openai/gpt-5.4-mini",
      }),
    ).resolves.toMatchObject({
      apiKey: "sk-or-v1-example-key",
      modelId: "openai/gpt-5.4-mini",
    });
  });

  it("rejects payloads without an API key", async () => {
    await expect(
      parseChatRequest({
        apiKey: "",
        messages: [
          {
            id: "msg_1",
            parts: [{ type: "text", text: "Hello" }],
            role: "user",
          },
        ],
        modelId: "openai/gpt-5.4-mini",
      }),
    ).rejects.toThrow(ZodError);
  });

  it("falls back to the default model when modelId is missing", async () => {
    await expect(
      parseChatRequest({
        apiKey: "sk-or-v1-example-key",
        messages: [
          {
            id: "msg_1",
            parts: [{ type: "text", text: "Hello" }],
            role: "user",
          },
        ],
      }),
    ).resolves.toMatchObject({
      modelId: "openai/gpt-5.4-mini",
    });
  });

  it("accepts AI SDK step-start parts in conversation history", async () => {
    await expect(
      parseChatRequest({
        apiKey: "sk-or-v1-example-key",
        messages: [
          {
            id: "msg_1",
            parts: [{ type: "text", text: "Hello" }],
            role: "user",
          },
          {
            id: "msg_2",
            parts: [
              { type: "step-start" },
              { type: "text", text: "Hi there." },
            ],
            role: "assistant",
          },
        ],
        modelId: "openai/gpt-5.4-mini",
      }),
    ).resolves.toMatchObject({
      messages: [
        expect.objectContaining({ role: "user" }),
        expect.objectContaining({ role: "assistant" }),
      ],
    });
  });

  it("accepts text attachment data parts, memories, and web search flag", async () => {
    await expect(
      parseChatRequest({
        apiKey: "sk-or-v1-example-key",
        memories: [
          {
            content: "User prefers concise Traditional Chinese responses.",
            id: "memory_1",
          },
        ],
        messages: [
          {
            id: "msg_1",
            parts: [
              {
                data: {
                  filename: "notes.md",
                  mediaType: "text/markdown",
                  text: "# Notes\n\nUse this as context.",
                },
                id: "attachment_1",
                type: "data-attachment-text",
              },
              { type: "text", text: "Summarize this." },
            ],
            role: "user",
          },
        ],
        modelId: "auto/router",
        webSearchEnabled: true,
      }),
    ).resolves.toMatchObject({
      memories: [
        {
          id: "memory_1",
        },
      ],
      modelId: "auto/router",
      webSearchEnabled: true,
    });
  });

  it("defaults web search to disabled", async () => {
    await expect(
      parseChatRequest({
        apiKey: "sk-or-v1-example-key",
        messages: [
          {
            id: "msg_1",
            parts: [{ type: "text", text: "Hello" }],
            role: "user",
          },
        ],
        modelId: "auto/router",
      }),
    ).resolves.toMatchObject({
      webSearchEnabled: false,
    });
  });

  it("accepts custom model capability flags", async () => {
    await expect(
      parseChatRequest({
        apiKey: "sk-or-v1-example-key",
        customModelCapabilities: {
          supportsImages: true,
          supportsTools: true,
        },
        customModelId: "custom/omni-router",
        messages: [
          {
            id: "msg_1",
            parts: [{ type: "text", text: "Hello" }],
            role: "user",
          },
        ],
        modelId: "custom/omni-router",
      }),
    ).resolves.toMatchObject({
      customModelCapabilities: {
        supportsImages: true,
        supportsTools: true,
      },
      customModelId: "custom/omni-router",
    });
  });
});
