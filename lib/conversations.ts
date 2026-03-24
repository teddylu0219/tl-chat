import type { UIMessage } from "ai";

import type { ConversationRecord } from "./persistence";

export function createConversationRecord(modelId: string): ConversationRecord {
  const timestamp = new Date().toISOString();

  return {
    createdAt: timestamp,
    draft: "",
    id: crypto.randomUUID(),
    messages: [],
    modelId,
    title: "New thread",
    updatedAt: timestamp,
  };
}

export function getMessageText(message?: UIMessage) {
  if (!message) {
    return "";
  }

  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n")
    .trim();
}

export function deriveConversationTitle(messages: UIMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const text = getMessageText(firstUserMessage);

  if (!text) {
    return "New thread";
  }

  return text.length > 48 ? `${text.slice(0, 48).trimEnd()}...` : text;
}

export function hasConversationContent(conversation: ConversationRecord) {
  return conversation.messages.length > 0 || conversation.draft.trim().length > 0;
}

export function formatConversationTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    hour: isSameDay ? "numeric" : undefined,
    minute: isSameDay ? "2-digit" : undefined,
    month: "short",
  }).format(date);
}
