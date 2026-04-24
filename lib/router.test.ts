import type { UIMessage } from "ai";

import { AUTO_MODEL_ID } from "./models";
import { resolveModelRoute } from "./router";

function createUserMessage(
  text: string,
  parts: UIMessage["parts"] = [{ type: "text", text }],
): UIMessage {
  return {
    id: crypto.randomUUID(),
    parts,
    role: "user",
  };
}

describe("model router", () => {
  it("routes image prompts to a vision-capable model in auto mode", () => {
    const route = resolveModelRoute({
      messages: [
        createUserMessage("Describe this image", [
          {
            filename: "photo.png",
            mediaType: "image/png",
            type: "file",
            url: "data:image/png;base64,abc",
          },
          { type: "text", text: "Describe this image" },
        ]),
      ],
      requestedModelId: AUTO_MODEL_ID,
    });

    expect(route.modelId).toBe("google/gemini-2.5-flash");
    expect(route.mode).toBe("auto");
  });

  it("routes code-heavy prompts to Claude in auto mode", () => {
    const route = resolveModelRoute({
      messages: [createUserMessage("Help me debug this Next.js component and fix the TypeScript error.")],
      requestedModelId: AUTO_MODEL_ID,
    });

    expect(route.modelId).toBe("anthropic/claude-sonnet-4");
  });

  it("routes Chinese code prompts to Claude in auto mode", () => {
    const route = resolveModelRoute({
      messages: [createUserMessage("幫我除錯這個 React 元件的 TypeScript 錯誤。")],
      requestedModelId: AUTO_MODEL_ID,
    });

    expect(route.modelId).toBe("anthropic/claude-sonnet-4");
  });

  it("falls back away from a non-vision model when image input is attached", () => {
    const route = resolveModelRoute({
      messages: [
        createUserMessage("What is in this image?", [
          {
            filename: "diagram.png",
            mediaType: "image/png",
            type: "file",
            url: "data:image/png;base64,abc",
          },
          { type: "text", text: "What is in this image?" },
        ]),
      ],
      requestedModelId: "openai/gpt-5.4-mini",
    });

    expect(route.mode).toBe("fallback");
    expect(route.modelId).toBe("google/gemini-2.5-flash");
  });

  it("routes large text attachments to a stronger reasoning model", () => {
    const route = resolveModelRoute({
      messages: [
        createUserMessage("Summarize the attached file.", [
          {
            data: {
              filename: "long-notes.md",
              mediaType: "text/markdown",
              text: "x".repeat(7_000),
            },
            id: "attachment_1",
            type: "data-attachment-text",
          },
          { type: "text", text: "Summarize the attached file." },
        ]),
      ],
      requestedModelId: AUTO_MODEL_ID,
    });

    expect(route.modelId).toBe("openai/gpt-5.4");
    expect(route.reason).toContain("Longer reasoning");
  });

  it("routes Chinese analysis prompts to a stronger reasoning model", () => {
    const route = resolveModelRoute({
      messages: [createUserMessage("比較這三種架構的優缺點，並分析取捨。")],
      requestedModelId: AUTO_MODEL_ID,
    });

    expect(route.modelId).toBe("openai/gpt-5.4");
  });

  it("falls back to a tool-capable model for explicit tool prompts", () => {
    const route = resolveModelRoute({
      availableToolCount: 2,
      messages: [createUserMessage("Use MCP to fetch the GitHub issue.")],
      requestedModelId: "qwen/qwen3.5-27b",
    });

    expect(route.mode).toBe("fallback");
    expect(route.modelId).toBe("openai/gpt-5.4");
  });

  it("falls back to a tool-capable model for Chinese memory prompts", () => {
    const route = resolveModelRoute({
      availableToolCount: 2,
      messages: [createUserMessage("請記住我偏好使用繁體中文。")],
      requestedModelId: "deepseek/deepseek-chat-v3.1",
    });

    expect(route.mode).toBe("fallback");
    expect(route.modelId).toBe("openai/gpt-5.4");
  });
});
