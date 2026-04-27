import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { APP_NAME } from "./app-config";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const LOCAL_FALLBACK_ORIGIN = "http://localhost:3000";

type OpenRouterWebToolOptions = {
  enabled?: boolean;
};

export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export function appendOpenRouterWebTools(requestBody: Record<string, unknown>) {
  const existingTools = Array.isArray(requestBody.tools)
    ? requestBody.tools
    : [];

  return {
    ...requestBody,
    tool_choice: requestBody.tool_choice ?? "auto",
    tools: [
      ...existingTools,
      {
        parameters: {
          max_results: 5,
          max_total_results: 10,
          search_context_size: "medium",
        },
        type: "openrouter:web_search",
      },
      {
        parameters: {
          max_content_tokens: 50_000,
          max_uses: 5,
        },
        type: "openrouter:web_fetch",
      },
    ],
  };
}

export function createOpenRouterProvider(
  apiKey: string,
  requestUrl?: string,
  webTools?: OpenRouterWebToolOptions,
) {
  const origin = requestUrl ? new URL(requestUrl).origin : LOCAL_FALLBACK_ORIGIN;

  return createOpenAICompatible({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    headers: {
      "HTTP-Referer": origin,
      "X-Title": APP_NAME,
    },
    name: "openrouter",
    transformRequestBody: webTools?.enabled
      ? appendOpenRouterWebTools
      : undefined,
  });
}

export function getErrorMessage(error: unknown) {
  if (error instanceof RequestValidationError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return formatOpenRouterError(error.message);
  }

  return "Something went wrong while contacting OpenRouter.";
}

function formatOpenRouterError(message: string) {
  if (/URL scheme must be http or https, got data:/i.test(message)) {
    return "Image upload was rejected because the provider received a browser data URL instead of image bytes. Retry the message; if it still fails, convert HEIC to PNG/JPEG or choose a vision-capable model.";
  }

  if (/(unauthorized|invalid api key|401|403)/i.test(message)) {
    return "OpenRouter rejected the API key. Review the key in Settings, then retry.";
  }

  if (/(rate limit|too many requests|429)/i.test(message)) {
    return "OpenRouter rate-limited this request. Wait a moment or choose a cheaper/faster model, then retry.";
  }

  if (/(no content generated|no output generated|returned no response)/i.test(message)) {
    return "The model returned no visible output. Retry once; if it repeats, switch models or simplify the prompt.";
  }

  return message;
}

export function getErrorStatus(error: unknown) {
  if (error instanceof RequestValidationError) {
    return 400;
  }

  return 502;
}
