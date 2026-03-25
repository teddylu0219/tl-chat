import { generateText } from "ai";
import { ZodError, z } from "zod";

import {
  buildMemoryManagerSystemPrompt,
  buildMemoryManagerUserPrompt,
  normalizeMemoryOperations,
  parseMemoryManagerResponse,
  resolveMemoryCandidates,
} from "@/lib/memory";
import { createOpenRouterProvider, getErrorMessage, getErrorStatus } from "@/lib/openrouter";

export const maxDuration = 30;

const memoryConversationSchema = z.object({
  content: z.string().trim(),
  role: z.enum(["assistant", "user"]),
});

const memoryRequestSchema = z.object({
  apiKey: z.string().trim().min(12, "OpenRouter API key is required."),
  conversation: z.array(memoryConversationSchema).min(1, "A recent conversation is required."),
  existingMemories: z
    .array(
      z.object({
        content: z.string().trim().min(1),
        id: z.string().trim().min(1),
      }),
    )
    .default([]),
  modelId: z.string().trim().min(1, "A model is required."),
});

function buildMemoryRepairPrompt(text: string) {
  return [
    "Convert the following output into strict JSON.",
    "Return only this shape: {\"operations\":[{\"type\":\"add\",\"content\":\"User ...\"}]}",
    "Allowed operation types: add, update, delete.",
    "Do not include markdown or commentary.",
    "",
    text,
  ].join("\n");
}

function buildMockOperations(conversation: Array<{ content: string; role: "assistant" | "user" }>) {
  const recentUserMessages = conversation
    .filter((message) => message.role === "user")
    .map((message) => message.content);
  const latestUserMessage = recentUserMessages.at(-1) ?? "";

  return resolveMemoryCandidates(latestUserMessage, recentUserMessages.slice(0, -1)).map(
    (content) => ({
      content,
      type: "add" as const,
    }),
  );
}

export async function POST(request: Request) {
  try {
    const body = memoryRequestSchema.parse(await request.json());

    if (process.env.OPENROUTER_MOCK_RESPONSE === "1") {
      return Response.json({
        operations: buildMockOperations(body.conversation),
      });
    }

    const provider = createOpenRouterProvider(body.apiKey, request.url);
    const result = await generateText({
      model: provider(body.modelId),
      system: buildMemoryManagerSystemPrompt(),
      prompt: buildMemoryManagerUserPrompt({
        conversation: body.conversation,
        existingMemories: body.existingMemories,
      }),
      temperature: 0,
    });
    let operations;

    try {
      operations = parseMemoryManagerResponse(result.text).operations;
    } catch {
      const repaired = await generateText({
        model: provider(body.modelId),
        prompt: buildMemoryRepairPrompt(result.text),
        temperature: 0,
      });
      operations = parseMemoryManagerResponse(repaired.text).operations;
    }

    return Response.json({
      operations: normalizeMemoryOperations(operations, body.existingMemories),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return new Response(error.issues[0]?.message ?? "Invalid request body.", {
        status: 400,
      });
    }

    return new Response(getErrorMessage(error), {
      status: getErrorStatus(error),
    });
  }
}
