export type ModelOption = {
  blurb: string;
  id: string;
  label: string;
  provider: string;
  supportsImages?: boolean;
  supportsTools?: boolean;
  supportsReasoning?: boolean;
  supportsCode?: boolean;
};

export const AUTO_MODEL_ID = "auto/router";

export const AUTO_MODEL_OPTION: ModelOption = {
  id: AUTO_MODEL_ID,
  label: "Auto Router",
  provider: "System",
  blurb: "Chooses a model based on the task, attachments, and tools.",
  supportsCode: true,
  supportsImages: true,
  supportsReasoning: true,
  supportsTools: true,
};

export const FEATURED_MODELS: ModelOption[] = [
  {
    id: "openai/gpt-5.4-mini",
    label: "GPT-5.4 Mini",
    provider: "OpenAI",
    blurb: "Balanced default for fast everyday chat.",
    supportsCode: true,
    supportsReasoning: true,
    supportsTools: true,
  },
  {
    id: "openai/gpt-5.4",
    label: "GPT-5.4",
    provider: "OpenAI",
    blurb: "Stronger reasoning for longer drafting sessions.",
    supportsCode: true,
    supportsReasoning: true,
    supportsTools: true,
  },
  {
    id: "anthropic/claude-sonnet-4",
    label: "Claude Sonnet 4",
    provider: "Anthropic",
    blurb: "Careful writing and strong long-form edits.",
    supportsCode: true,
    supportsReasoning: true,
    supportsTools: true,
  },
  {
    id: "anthropic/claude-3.5-haiku",
    label: "Claude 3.5 Haiku",
    provider: "Anthropic",
    blurb: "Fast and lightweight for quick back-and-forth.",
    supportsCode: true,
    supportsTools: true,
  },
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "Google",
    blurb: "Responsive and flexible for mixed tasks.",
    supportsCode: true,
    supportsImages: true,
    supportsReasoning: true,
    supportsTools: true,
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "Google",
    blurb: "Higher ceiling for tougher synthesis work.",
    supportsCode: true,
    supportsImages: true,
    supportsReasoning: true,
    supportsTools: true,
  },
  {
    id: "deepseek/deepseek-chat-v3.1",
    label: "DeepSeek Chat V3.1",
    provider: "DeepSeek",
    blurb: "Cost-conscious general chat with solid depth.",
  },
  {
    id: "qwen/qwen3.5-27b",
    label: "Qwen 3.5 27B",
    provider: "Qwen",
    blurb: "A compact alternative with strong coding fluency.",
    supportsCode: true,
  },
];

export const DEFAULT_MODEL_ID = FEATURED_MODELS[0].id;

export const MODEL_OPTIONS = [AUTO_MODEL_OPTION, ...FEATURED_MODELS];

export function getFeaturedModel(modelId: string) {
  return FEATURED_MODELS.find((model) => model.id === modelId);
}

export function getKnownModel(modelId: string) {
  return MODEL_OPTIONS.find((model) => model.id === modelId);
}

export function isSupportedModel(modelId: string) {
  return Boolean(getKnownModel(modelId));
}

export function getModelOptions(customModelId?: string) {
  const trimmedCustomModelId = customModelId?.trim();

  if (!trimmedCustomModelId || isSupportedModel(trimmedCustomModelId)) {
    return MODEL_OPTIONS;
  }

  return [
    ...MODEL_OPTIONS,
    {
      id: trimmedCustomModelId,
      label: "Custom OpenRouter model",
      provider: "Custom",
      blurb: trimmedCustomModelId,
    },
  ];
}

export function getModelOption(modelId: string, customModelId?: string) {
  return getModelOptions(customModelId).find((model) => model.id === modelId);
}

export function modelSupportsImages(modelId: string, customModelId?: string) {
  return Boolean(getModelOption(modelId, customModelId)?.supportsImages);
}

export function modelSupportsTools(modelId: string, customModelId?: string) {
  return Boolean(getModelOption(modelId, customModelId)?.supportsTools);
}

export function getMemoryManagerModelId(modelId: string) {
  return modelId === AUTO_MODEL_ID ? DEFAULT_MODEL_ID : modelId;
}
