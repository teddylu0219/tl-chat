import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
} from "ai";
import { ZodError, z } from "zod";

import { parseChatRequest } from "@/lib/chat-schema";
import {
  convertAttachmentDataPart,
  prepareMessagesForModel,
} from "@/lib/model-message-parts";
import { getModelOption, modelSupportsTools } from "@/lib/models";
import { createOpenRouterProvider, getErrorMessage, getErrorStatus } from "@/lib/openrouter";
import { resolveModelRoute } from "@/lib/router";

export const maxDuration = 60;

function omitMessageId<T extends { id: string }>(message: T) {
  const { id, ...nextMessage } = message;

  void id;

  return nextMessage;
}

function buildMockResponse(modelId: string, text: string) {
  const responseText = text
    ? `Mock reply from ${modelId}:\n\n${text}`
    : `Mock reply from ${modelId}: Ready for the next prompt.`;
  const chunkId = crypto.randomUUID();

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: "text-start", id: chunkId });

        for (const chunk of responseText.match(/[\s\S]{1,18}/g) ?? []) {
          writer.write({ type: "text-delta", id: chunkId, delta: chunk });
          await new Promise((resolve) => setTimeout(resolve, 8));
        }

        writer.write({ type: "text-end", id: chunkId });
      },
    }),
  });
}

function getLastMessageText(
  messages: Awaited<ReturnType<typeof parseChatRequest>>["messages"],
) {
  const lastMessage = messages.at(-1);

  if (!lastMessage) {
    return "";
  }

  return lastMessage.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function buildCapabilityPrompt({
  memoryToolsEnabled,
  webSearchEnabled,
}: {
  memoryToolsEnabled: boolean;
  webSearchEnabled: boolean;
}) {
  return [
    memoryToolsEnabled
      ? "Use tools when they help you answer more accurately."
      : "",
    webSearchEnabled
      ? "Web is enabled. Use web search for current information and web fetch for explicit URLs before answering."
      : "",
    webSearchEnabled
      ? "When Web sources are used, mention the most relevant source names or URLs naturally in the answer."
      : "",
    memoryToolsEnabled
      ? "If the user explicitly asks you to remember or forget something long-term, use the memory tools instead of only promising."
      : "",
    "Do not invent tool outputs. If a tool fails, say what failed and continue with the best fallback you can.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSearchMemoriesTool(
  memories: Awaited<ReturnType<typeof parseChatRequest>>["memories"],
) {
  return tool({
    description: "Search the user's long-term memories by keyword.",
    execute: async ({ query }) => {
      const normalizedQuery = query.trim().toLowerCase();
      const matches =
        normalizedQuery.length === 0
          ? memories
          : memories.filter((memory) =>
              memory.content.toLowerCase().includes(normalizedQuery),
            );

      return {
        matches,
      };
    },
    inputSchema: z.object({
      query: z.string().default(""),
    }),
  });
}

function buildMemoryMutationTools() {
  return {
    delete_memory: tool({
      description:
        "Queue a long-term memory deletion when the user explicitly wants something forgotten.",
      execute: async ({ id, reason }) => ({
        operation: { id, type: "delete" as const },
        reason,
        status: "queued",
      }),
      inputSchema: z.object({
        id: z.string().trim().min(1),
        reason: z.string().trim().optional(),
      }),
    }),
    remember_memory: tool({
      description:
        "Queue a new long-term memory when the user explicitly wants something remembered.",
      execute: async ({ content }) => ({
        operation: { content: content.trim(), type: "add" as const },
        status: "queued",
      }),
      inputSchema: z.object({
        content: z.string().trim().min(1),
      }),
    }),
    update_memory: tool({
      description:
        "Rewrite an existing long-term memory when the user corrects or refines it.",
      execute: async ({ content, id }) => ({
        operation: { content: content.trim(), id, type: "update" as const },
        status: "queued",
      }),
      inputSchema: z.object({
        content: z.string().trim().min(1),
        id: z.string().trim().min(1),
      }),
    }),
  };
}

function buildCurrentTimeTool() {
  return tool({
    description: "Get the current time in a requested IANA timezone.",
    execute: async ({ timezone }) => {
      const now = new Date();
      const resolvedTimezone = timezone?.trim() || "UTC";

      return {
        iso: now.toISOString(),
        local: new Intl.DateTimeFormat("en-US", {
          dateStyle: "full",
          timeStyle: "long",
          timeZone: resolvedTimezone,
        }).format(now),
        timezone: resolvedTimezone,
      };
    },
    inputSchema: z.object({
      timezone: z.string().trim().optional(),
    }),
  });
}

export async function POST(request: Request) {
  try {
    const body = await parseChatRequest(await request.json());
    const route = resolveModelRoute({
      availableToolCount: 4 + (body.webSearchEnabled ? 2 : 0),
      customModelCapabilities: body.customModelCapabilities,
      customModelId: body.customModelId,
      messages: body.messages,
      requestedModelId: body.modelId,
    });
    const provider = createOpenRouterProvider(body.apiKey, request.url, {
      enabled: body.webSearchEnabled,
    });
    const canUseTools = modelSupportsTools(
      route.modelId,
      body.customModelId,
      body.customModelCapabilities,
    );

    const modelMessages = await convertToModelMessages(
      prepareMessagesForModel(body.messages.map(omitMessageId)),
      {
        convertDataPart: convertAttachmentDataPart,
      },
    );

    if (process.env.OPENROUTER_MOCK_RESPONSE === "1") {
      return buildMockResponse(route.modelId, getLastMessageText(body.messages));
    }
    const tools = canUseTools
      ? {
          get_current_time: buildCurrentTimeTool(),
          search_memories: buildSearchMemoriesTool(body.memories),
          ...buildMemoryMutationTools(),
        }
      : undefined;
    const fullSystemPrompt =
      [
        body.systemPrompt?.trim(),
        canUseTools || body.webSearchEnabled
          ? buildCapabilityPrompt({
              memoryToolsEnabled: canUseTools,
              webSearchEnabled: body.webSearchEnabled,
            })
          : "",
      ]
        .filter(Boolean)
        .join("\n\n") || undefined;
    const result = streamText({
      model: provider(route.modelId),
      system: fullSystemPrompt,
      messages: modelMessages,
      ...(tools
        ? {
            stopWhen: stepCountIs(6),
            tools,
          }
        : {}),
    });

    return result.toUIMessageStreamResponse({
      messageMetadata: ({ part }) => {
        if (part.type !== "start" && part.type !== "finish") {
          return undefined;
        }

        return {
          routeMode: route.mode,
          routeReason: route.reason,
          routedModelId: route.modelId,
          routedModelLabel:
            getModelOption(
              route.modelId,
              body.customModelId,
              body.customModelCapabilities,
            )?.label ?? route.label,
        };
      },
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
