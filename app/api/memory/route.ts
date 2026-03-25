import { generateObject } from "ai";
import { ZodError, z } from "zod";

import {
  buildMemoryExtractionSystemPrompt,
  buildMemoryExtractionUserPrompt,
  memoryExtractionSchema,
  resolveMemoryCandidates,
} from "@/lib/memory";
import { createOpenRouterProvider, getErrorMessage, getErrorStatus } from "@/lib/openrouter";

export const maxDuration = 30;

const memoryRequestSchema = z.object({
  apiKey: z.string().trim().min(12, "OpenRouter API key is required."),
  existingMemories: z.array(z.string().trim()).default([]),
  input: z.string().trim().min(1, "A user message is required."),
  modelId: z.string().trim().min(1, "A model is required."),
  recentUserMessages: z.array(z.string().trim()).default([]),
});

function normalizeMemories(memories: string[]) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const memory of memories) {
    const value = memory.trim();
    const key = value.toLowerCase();

    if (!value || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(value);
  }

  return normalized;
}

export async function POST(request: Request) {
  try {
    const body = memoryRequestSchema.parse(await request.json());

    if (process.env.OPENROUTER_MOCK_RESPONSE === "1") {
      return Response.json({
        memories: resolveMemoryCandidates(body.input, body.recentUserMessages),
      });
    }

    const provider = createOpenRouterProvider(body.apiKey, request.url);
    const result = await generateObject({
      model: provider(body.modelId),
      schema: memoryExtractionSchema,
      schemaName: "memory_candidates",
      schemaDescription:
        "Durable user facts or preferences worth remembering across future chats.",
      system: buildMemoryExtractionSystemPrompt(),
      prompt: buildMemoryExtractionUserPrompt(body),
      temperature: 0,
    });

    return Response.json({
      memories: normalizeMemories(result.object.memories),
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
