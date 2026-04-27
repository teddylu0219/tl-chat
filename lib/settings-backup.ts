import { z } from "zod";

import type { MemoryEntry } from "./memory";

export const SETTINGS_BACKUP_VERSION = 1;

const memoryEntryBackupSchema = z.object({
  content: z.string().trim().min(1),
  createdAt: z.string().trim().min(1),
  id: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
});

export const settingsBackupSchema = z.object({
  exportedAt: z.string().datetime(),
  memories: z.array(memoryEntryBackupSchema).default([]),
  version: z.literal(SETTINGS_BACKUP_VERSION),
});

export type SettingsBackup = z.infer<typeof settingsBackupSchema>;

export function createSettingsBackup({
  exportedAt = new Date().toISOString(),
  memories,
}: {
  exportedAt?: string;
  memories: MemoryEntry[];
}) {
  return settingsBackupSchema.parse({
    exportedAt,
    memories,
    version: SETTINGS_BACKUP_VERSION,
  });
}

export function parseSettingsBackup(input: string | unknown) {
  const raw = typeof input === "string" ? JSON.parse(input) : input;

  return settingsBackupSchema.parse(raw);
}
