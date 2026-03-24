import type { UIMessage } from "ai";
import { openDB, type DBSchema } from "idb";

import { DEFAULT_THEME, type ThemePreference } from "./app-config";
import { DEFAULT_MODEL_ID } from "./models";

const DATABASE_NAME = "own-ai-chat";
const DATABASE_VERSION = 1;
const SETTINGS_KEY = "local-settings";

export type ConversationRecord = {
  createdAt: string;
  draft: string;
  id: string;
  messages: UIMessage[];
  modelId: string;
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

async function openChatDatabase() {
  return openDB<OwnAiChatSchema>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains("conversations")) {
        const conversations = database.createObjectStore("conversations", {
          keyPath: "id",
        });

        conversations.createIndex("by-updatedAt", "updatedAt");
      }

      if (!database.objectStoreNames.contains("settings")) {
        database.createObjectStore("settings");
      }
    },
  });
}

export async function listConversations() {
  const database = await openChatDatabase();
  const conversations = await database.getAll("conversations");

  return conversations.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

export async function getConversation(conversationId: string) {
  const database = await openChatDatabase();

  return database.get("conversations", conversationId);
}

export async function saveConversation(conversation: ConversationRecord) {
  const database = await openChatDatabase();
  await database.put("conversations", conversation);

  return conversation;
}

export async function deleteConversation(conversationId: string) {
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
