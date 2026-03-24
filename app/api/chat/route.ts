import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
} from "ai";
import { ZodError } from "zod";

import { parseChatRequest } from "@/lib/chat-schema";
import { createOpenRouterProvider, getErrorMessage, getErrorStatus } from "@/lib/openrouter";

export const maxDuration = 30;

function omitMessageId<T extends { id: string }>(message: T) {
  const { id, ...nextMessage } = message;

  void id;

  return nextMessage;
}

function buildMockResponse(modelId: string, text: string) {
  const responseText = `Mock reply from ${modelId}: ${text || "Ready for the next prompt."}`;
  const chunkId = crypto.randomUUID();

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({ type: "text-start", id: chunkId });

        for (const chunk of responseText.match(/.{1,18}/g) ?? []) {
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

export async function POST(request: Request) {
  try {
    const body = await parseChatRequest(await request.json());

    if (process.env.OPENROUTER_MOCK_RESPONSE === "1") {
      return buildMockResponse(body.modelId, getLastMessageText(body.messages));
    }

    const provider = createOpenRouterProvider(body.apiKey, request.url);
    const modelMessages = await convertToModelMessages(
      body.messages.map(omitMessageId),
    );

    const result = streamText({
      model: provider(body.modelId),
      messages: modelMessages,
    });

    return result.toUIMessageStreamResponse();
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
