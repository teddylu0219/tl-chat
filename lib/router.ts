import type { UIMessage } from "ai";

import { getMessageText } from "./conversations";
import {
  AUTO_MODEL_ID,
  DEFAULT_MODEL_ID,
  getModelOption,
  modelSupportsImages,
  modelSupportsTools,
  type ModelCapabilityFlags,
  type ModelOption,
} from "./models";

export type RouteDecision = {
  label: string;
  mode: "auto" | "fallback" | "manual";
  modelId: string;
  reason: string;
};

function lastUserMessage(messages: UIMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user");
}

function hasImageAttachment(message?: UIMessage) {
  return Boolean(
    message?.parts.some(
      (part) => part.type === "file" && part.mediaType.startsWith("image/"),
    ),
  );
}

function getTextAttachmentLength(message?: UIMessage) {
  return (
    message?.parts.reduce((total, part) => {
      if (part.type !== "data-attachment-text") {
        return total;
      }

      const data = part.data as { text?: string };

      return total + (data.text?.length ?? 0);
    }, 0) ?? 0
  );
}

function extractLatestUserText(messages: UIMessage[]) {
  return getMessageText(lastUserMessage(messages)).toLowerCase();
}

function looksLikeCodeTask(text: string) {
  return (
    /\b(code|bug|debug|typescript|javascript|react|next\.?js|component|api|test|refactor|stack trace|error)\b/i.test(
      text,
    ) ||
    /(?:程式|代碼|除錯|偵錯|錯誤|元件|測試|重構|堆疊|修 bug|修bug)/i.test(text)
  );
}

function looksLikeDeepReasoningTask(text: string) {
  return (
    text.length > 900 ||
    /\b(compare|tradeoff|strategy|architecture|analyze|evaluate|research|roadmap|synthesis|deep dive|pros and cons)\b/i.test(
      text,
    ) ||
    /(?:比較|取捨|策略|架構|分析|評估|研究|路線圖|綜合整理|深入|優缺點)/.test(text)
  );
}

function looksLikeToolTask(text: string) {
  return (
    /\b(current time|what time|remember|forget|tool|mcp|github|filesystem|calendar|gmail|search|look up|fetch)\b/i.test(
      text,
    ) ||
    /(?:現在幾點|幾點|記住|記得|忘記|工具|查詢|搜尋|抓取|讀取|檔案|行事曆|郵件)/.test(
      text,
    )
  );
}

function pickAutoModel({
  hasImages,
  needsCode,
  needsDeepReasoning,
  needsTools,
}: {
  hasImages: boolean;
  needsCode: boolean;
  needsDeepReasoning: boolean;
  needsTools: boolean;
}) {
  if (hasImages) {
    return {
      modelId: needsDeepReasoning
        ? "google/gemini-2.5-pro"
        : "google/gemini-2.5-flash",
      reason: needsDeepReasoning
        ? "Image input plus deeper reasoning detected."
        : "Image input detected.",
    };
  }

  if (needsCode) {
    return {
      modelId: "anthropic/claude-sonnet-4",
      reason: "Code-oriented task detected.",
    };
  }

  if (needsDeepReasoning || needsTools) {
    return {
      modelId: "openai/gpt-5.4",
      reason: needsTools
        ? "Tool-capable reasoning route selected."
        : "Longer reasoning task detected.",
    };
  }

  return {
    modelId: DEFAULT_MODEL_ID,
    reason: "Fast general chat route selected.",
  };
}

function pickCustomAutoModel({
  customModel,
  hasImages,
  needsCode,
  needsDeepReasoning,
  needsTools,
}: {
  customModel?: ModelOption;
  hasImages: boolean;
  needsCode: boolean;
  needsDeepReasoning: boolean;
  needsTools: boolean;
}) {
  if (!customModel || customModel.id === AUTO_MODEL_ID) {
    return null;
  }

  if (hasImages) {
    if (
      !customModel.supportsImages ||
      (needsDeepReasoning && !customModel.supportsReasoning) ||
      (needsTools && !customModel.supportsTools)
    ) {
      return null;
    }

    return {
      modelId: customModel.id,
      reason: needsDeepReasoning
        ? "Custom model marked vision and reasoning capable."
        : "Custom model marked vision-capable.",
    };
  }

  if (needsCode && customModel.supportsCode) {
    if (needsTools && !customModel.supportsTools) {
      return null;
    }

    return {
      modelId: customModel.id,
      reason: "Custom model marked code-capable.",
    };
  }

  if (
    (needsDeepReasoning || needsTools) &&
    (!needsDeepReasoning || customModel.supportsReasoning) &&
    (!needsTools || customModel.supportsTools)
  ) {
    return {
      modelId: customModel.id,
      reason: needsTools
        ? "Custom model marked tool-capable."
        : "Custom model marked reasoning-capable.",
    };
  }

  return null;
}

export function resolveModelRoute({
  availableToolCount = 0,
  customModelCapabilities,
  customModelId,
  messages,
  requestedModelId,
}: {
  availableToolCount?: number;
  customModelCapabilities?: ModelCapabilityFlags;
  customModelId?: string;
  messages: UIMessage[];
  requestedModelId: string;
}): RouteDecision {
  const latestText = extractLatestUserText(messages);
  const latestUser = lastUserMessage(messages);
  const hasImages = hasImageAttachment(latestUser);
  const textAttachmentLength = getTextAttachmentLength(latestUser);
  const needsCode = looksLikeCodeTask(latestText);
  const needsDeepReasoning =
    looksLikeDeepReasoningTask(latestText) || textAttachmentLength > 6_000;
  const needsTools = availableToolCount > 0 && looksLikeToolTask(latestText);
  const requestedModel = getModelOption(
    requestedModelId,
    customModelId,
    customModelCapabilities,
  );
  const trimmedCustomModelId = customModelId?.trim();
  const customModel = trimmedCustomModelId
    ? getModelOption(
        trimmedCustomModelId,
        customModelId,
        customModelCapabilities,
      )
    : undefined;

  if (requestedModelId === AUTO_MODEL_ID || !requestedModel) {
    const resolved =
      pickCustomAutoModel({
        customModel,
        hasImages,
        needsCode,
        needsDeepReasoning,
        needsTools,
      }) ??
      pickAutoModel({
        hasImages,
        needsCode,
        needsDeepReasoning,
        needsTools,
      });
    const option = getModelOption(
      resolved.modelId,
      customModelId,
      customModelCapabilities,
    );

    return {
      label: option?.label ?? resolved.modelId,
      mode: "auto",
      modelId: resolved.modelId,
      reason: resolved.reason,
    };
  }

  if (
    hasImages &&
    !modelSupportsImages(
      requestedModelId,
      customModelId,
      customModelCapabilities,
    )
  ) {
    const fallbackModelId = needsDeepReasoning
      ? "google/gemini-2.5-pro"
      : "google/gemini-2.5-flash";

    return {
      label: getModelOption(fallbackModelId)?.label ?? fallbackModelId,
      mode: "fallback",
      modelId: fallbackModelId,
      reason: `${requestedModel.label} does not support image input.`,
    };
  }

  if (
    needsTools &&
    !modelSupportsTools(
      requestedModelId,
      customModelId,
      customModelCapabilities,
    )
  ) {
    return {
      label: getModelOption("openai/gpt-5.4")?.label ?? "openai/gpt-5.4",
      mode: "fallback",
      modelId: "openai/gpt-5.4",
      reason: `${requestedModel.label} is not marked as tool-capable.`,
    };
  }

  return {
    label: requestedModel.label,
    mode: "manual",
    modelId: requestedModel.id,
    reason: "Manual model selection.",
  };
}
