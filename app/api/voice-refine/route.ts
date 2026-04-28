import { generateText } from "ai";
import { ZodError } from "zod";

import {
  buildVoiceRefinePrompt,
  normalizeVoiceTranscriptForMock,
  voiceRefineRequestSchema,
} from "@/lib/voice-refine";
import { createOpenRouterProvider, getErrorMessage, getErrorStatus } from "@/lib/openrouter";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = voiceRefineRequestSchema.parse(await request.json());

    if (process.env.OPENROUTER_MOCK_RESPONSE === "1") {
      return Response.json({
        text: normalizeVoiceTranscriptForMock(body.text),
      });
    }

    const provider = createOpenRouterProvider(body.apiKey, request.url);
    const result = await generateText({
      model: provider(body.modelId),
      prompt: buildVoiceRefinePrompt({
        language: body.language,
        text: body.text,
      }),
    });
    const refinedText = result.text.trim();

    return Response.json({
      text: refinedText || body.text,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "Invalid voice refinement request." },
        { status: 400 },
      );
    }

    return Response.json(
      { error: getErrorMessage(error) },
      { status: getErrorStatus(error) },
    );
  }
}
