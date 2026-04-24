import { validateUIMessages } from "ai";
import { z } from "zod";

import { mcpServerConfigSchema } from "./mcp";
import { DEFAULT_MODEL_ID } from "./models";

const customModelCapabilitiesSchema = z.object({
  supportsCode: z.boolean().optional(),
  supportsImages: z.boolean().optional(),
  supportsReasoning: z.boolean().optional(),
  supportsTools: z.boolean().optional(),
});

export const chatRequestSchema = z.object({
  apiKey: z.string().trim().min(12, "OpenRouter API key is required."),
  customModelCapabilities: customModelCapabilitiesSchema.default({}),
  customModelId: z.string().trim().optional(),
  mcpServers: z.array(mcpServerConfigSchema).default([]),
  memories: z
    .array(
      z.object({
        content: z.string().trim().min(1),
        id: z.string().trim().min(1),
      }),
    )
    .default([]),
  messages: z.unknown(),
  modelId: z
    .string()
    .trim()
    .min(1, "A model is required.")
    .catch(DEFAULT_MODEL_ID),
  systemPrompt: z.string().optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export async function parseChatRequest(input: unknown) {
  const body = chatRequestSchema.parse(input);
  const messages = await validateUIMessages({
    messages: body.messages,
  });

  if (messages.length === 0) {
    throw new z.ZodError([
      {
        code: "custom",
        message: "At least one message is required.",
        path: ["messages"],
      },
    ]);
  }

  return {
    ...body,
    messages,
  };
}
