import type { UIMessage } from "ai";

import type { ConversationRecord } from "./persistence";

export function createConversationRecord(modelId: string): ConversationRecord {
  const timestamp = new Date().toISOString();

  return {
    archivedAt: null,
    createdAt: timestamp,
    draft: "",
    id: crypto.randomUUID(),
    manualTitle: null,
    messages: [],
    modelId,
    pinnedAt: null,
    previewText: "",
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

export function getPreviewText(messages: UIMessage[]) {
  const orderedMessages = [...messages].reverse();

  for (const message of orderedMessages) {
    const text = getMessageText(message);

    if (text) {
      return text.length > 96 ? `${text.slice(0, 96).trimEnd()}...` : text;
    }
  }

  return "";
}

export function getDisplayTitle(conversation: ConversationRecord) {
  const manualTitle = conversation.manualTitle?.trim();

  return manualTitle || conversation.title;
}

export function hasConversationContent(conversation: ConversationRecord) {
  return conversation.messages.length > 0 || conversation.draft.trim().length > 0;
}

export function isPinnedConversation(conversation: ConversationRecord) {
  return Boolean(conversation.pinnedAt);
}

export function isArchivedConversation(conversation: ConversationRecord) {
  return Boolean(conversation.archivedAt);
}

export function sortConversations(conversations: ConversationRecord[]) {
  return [...conversations].sort((left, right) => {
    if (Boolean(left.archivedAt) !== Boolean(right.archivedAt)) {
      return left.archivedAt ? 1 : -1;
    }

    if (Boolean(left.pinnedAt) && Boolean(right.pinnedAt)) {
      return right.pinnedAt!.localeCompare(left.pinnedAt!);
    }

    if (Boolean(left.pinnedAt) !== Boolean(right.pinnedAt)) {
      return left.pinnedAt ? -1 : 1;
    }

    return right.updatedAt.localeCompare(left.updatedAt);
  });
}

export function matchesConversationSearch(
  conversation: ConversationRecord,
  query: string,
) {
  const trimmedQuery = query.trim().toLowerCase();

  if (!trimmedQuery) {
    return true;
  }

  const haystack = [
    getDisplayTitle(conversation),
    conversation.previewText,
    conversation.messages.map(getMessageText).join("\n"),
  ]
    .join("\n")
    .toLowerCase();

  return haystack.includes(trimmedQuery);
}

export function exportConversationAsMarkdown(conversation: ConversationRecord) {
  const title = getDisplayTitle(conversation);
  const sections = conversation.messages
    .map((message) => {
      const heading = message.role === "user" ? "You" : "Assistant";
      const text = getMessageText(message);

      return text ? `## ${heading}\n\n${text}` : null;
    })
    .filter(Boolean)
    .join("\n\n");

  return [
    `# ${title}`,
    "",
    `- Model: ${conversation.modelId}`,
    `- Created: ${conversation.createdAt}`,
    `- Updated: ${conversation.updatedAt}`,
    "",
    sections,
  ]
    .join("\n")
    .trim();
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
