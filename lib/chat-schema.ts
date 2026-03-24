import { validateUIMessages } from "ai";
import { z } from "zod";

import { DEFAULT_MODEL_ID } from "./models";

export const chatRequestSchema = z.object({
  apiKey: z.string().trim().min(12, "OpenRouter API key is required."),
  messages: z.unknown(),
  modelId: z
    .string()
    .trim()
    .min(1, "A model is required.")
    .catch(DEFAULT_MODEL_ID),
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
