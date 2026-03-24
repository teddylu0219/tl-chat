import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { APP_NAME } from "./app-config";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const LOCAL_FALLBACK_ORIGIN = "http://localhost:3000";

export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export function createOpenRouterProvider(apiKey: string, requestUrl?: string) {
  const origin = requestUrl ? new URL(requestUrl).origin : LOCAL_FALLBACK_ORIGIN;

  return createOpenAICompatible({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    headers: {
      "HTTP-Referer": origin,
      "X-Title": APP_NAME,
    },
    name: "openrouter",
  });
}

export function getErrorMessage(error: unknown) {
  if (error instanceof RequestValidationError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong while contacting OpenRouter.";
}

export function getErrorStatus(error: unknown) {
  if (error instanceof RequestValidationError) {
    return 400;
  }

  return 502;
}
