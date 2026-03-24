import type { UIMessage } from "ai";
import { openDB, type DBSchema } from "idb";

import { DEFAULT_THEME, type ThemePreference } from "./app-config";
import { getPreviewText, sortConversations } from "./conversations";
import { DEFAULT_MODEL_ID } from "./models";

const DATABASE_NAME = "own-ai-chat";
const DATABASE_VERSION = 2;
const SETTINGS_KEY = "local-settings";

export type ConversationRecord = {
  archivedAt?: string | null;
  createdAt: string;
  draft: string;
  id: string;
  manualTitle?: string | null;
  messages: UIMessage[];
  modelId: string;
  pinnedAt?: string | null;
  previewText: string;
  title: string;
  updatedAt: string;
};

export type LocalSettings = {
  activeConversationId: string | null;
  customModelId: string;
  defaultModelId: string;
  openRouterApiKey: string;
  themePreference: ThemePreference;
};

type OwnAiChatSchema = DBSchema & {
  conversations: {
    indexes: { "by-updatedAt": string };
    key: string;
    value: ConversationRecord;
  };
  settings: {
    key: string;
    value: LocalSettings;
  };
};

export const DEFAULT_SETTINGS: LocalSettings = {
  activeConversationId: null,
  customModelId: "",
  defaultModelId: DEFAULT_MODEL_ID,
  openRouterApiKey: "",
  themePreference: DEFAULT_THEME,
};

function normalizeConversationRecord(
  conversation: ConversationRecord,
): ConversationRecord {
  const derivedPreviewText = getPreviewText(conversation.messages);

  return {
    ...conversation,
    archivedAt: conversation.archivedAt ?? null,
    manualTitle: conversation.manualTitle?.trim() || null,
    pinnedAt: conversation.pinnedAt ?? null,
    previewText: derivedPreviewText || conversation.previewText || "",
  };
}

async function openChatDatabase() {
  return openDB<OwnAiChatSchema>(DATABASE_NAME, DATABASE_VERSION, {
    async upgrade(database, oldVersion, _newVersion, transaction) {
      if (!database.objectStoreNames.contains("conversations")) {
        const conversations = database.createObjectStore("conversations", {
          keyPath: "id",
        });

        conversations.createIndex("by-updatedAt", "updatedAt");
      }

      if (!database.objectStoreNames.contains("settings")) {
        database.createObjectStore("settings");
      }

      if (oldVersion < 2) {
        const conversations = transaction.objectStore("conversations");
        let cursor = await conversations.openCursor();

        while (cursor) {
          await cursor.update(
            normalizeConversationRecord(cursor.value as ConversationRecord),
          );
          cursor = await cursor.continue();
        }
      }
    },
  });
}

export async function listConversations() {
  const database = await openChatDatabase();
  const conversations = await database.getAll("conversations");

  return sortConversations(conversations.map(normalizeConversationRecord));
}

export async function getConversation(conversationId: string) {
  const database = await openChatDatabase();

  return database.get("conversations", conversationId);
}

export async function saveConversation(conversation: ConversationRecord) {
  const database = await openChatDatabase();
  const normalizedConversation = normalizeConversationRecord(conversation);
  await database.put("conversations", normalizedConversation);

  return normalizedConversation;
}

export async function renameConversation(
  conversationId: string,
  manualTitle: string | null,
) {
  const database = await openChatDatabase();
  const conversation = await database.get("conversations", conversationId);

  if (!conversation) {
    return null;
  }

  return saveConversation({
    ...normalizeConversationRecord(conversation),
    manualTitle,
    updatedAt: new Date().toISOString(),
  });
}

export async function pinConversation(conversationId: string) {
  const database = await openChatDatabase();
  const conversation = await database.get("conversations", conversationId);

  if (!conversation) {
    return null;
  }

  return saveConversation({
    ...normalizeConversationRecord(conversation),
    pinnedAt: new Date().toISOString(),
  });
}

export async function unpinConversation(conversationId: string) {
  const database = await openChatDatabase();
  const conversation = await database.get("conversations", conversationId);

  if (!conversation) {
    return null;
  }

  return saveConversation({
    ...normalizeConversationRecord(conversation),
    pinnedAt: null,
  });
}

export async function archiveConversation(conversationId: string) {
  const database = await openChatDatabase();
  const conversation = await database.get("conversations", conversationId);

  if (!conversation) {
    return null;
  }

  return saveConversation({
    ...normalizeConversationRecord(conversation),
    archivedAt: new Date().toISOString(),
  });
}

export async function restoreConversation(conversationId: string) {
  const database = await openChatDatabase();
  const conversation = await database.get("conversations", conversationId);

  if (!conversation) {
    return null;
  }

  return saveConversation({
    ...normalizeConversationRecord(conversation),
    archivedAt: null,
  });
}

export async function deleteConversationPermanent(conversationId: string) {
  const database = await openChatDatabase();
  await database.delete("conversations", conversationId);
}

export async function getSettings() {
  const database = await openChatDatabase();
  const settings = await database.get("settings", SETTINGS_KEY);

  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function saveSettings(settings: Partial<LocalSettings>) {
  const database = await openChatDatabase();
  const currentSettings = await getSettings();
  const nextSettings = { ...currentSettings, ...settings };

  await database.put("settings", nextSettings, SETTINGS_KEY);

  return nextSettings;
}

export async function clearPersistence() {
  const database = await openChatDatabase();
  await database.clear("conversations");
  await database.clear("settings");
}
