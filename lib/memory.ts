import { z } from "zod";

export type MemoryEntry = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export function createMemoryEntry(content: string): MemoryEntry {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    content: content.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

const INSTITUTION_ALIASES: Record<string, string> = {
  "nycu": "National Yang Ming Chiao Tung University (NYCU)",
  "national yang ming chiao tung university":
    "National Yang Ming Chiao Tung University (NYCU)",
  "國立陽明交通大學": "National Yang Ming Chiao Tung University (NYCU)",
  "陽明交大": "National Yang Ming Chiao Tung University (NYCU)",
  "交大": "National Yang Ming Chiao Tung University (NYCU)",
};

function normalizeMemoryValue(value: string) {
  const cleaned = value
    .trim()
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/[.?!,;:]+$/g, "")
    .replace(/\s+/g, " ");

  if (/^[a-z]{2,10}$/i.test(cleaned) && !cleaned.includes(" ")) {
    return cleaned.toUpperCase();
  }

  return cleaned;
}

function normalizeInstitutionValue(value: string) {
  const normalized = normalizeMemoryValue(value);

  return INSTITUTION_ALIASES[normalized.toLowerCase()] ?? normalized;
}

const memoryAddOperationSchema = z.object({
  content: z.string().trim().min(1),
  type: z.literal("add"),
});

const memoryDeleteOperationSchema = z.object({
  id: z.string().trim().min(1),
  type: z.literal("delete"),
});

const memoryUpdateOperationSchema = z.object({
  content: z.string().trim().min(1),
  id: z.string().trim().min(1),
  type: z.literal("update"),
});

export const memoryOperationSchema = z.discriminatedUnion("type", [
  memoryAddOperationSchema,
  memoryDeleteOperationSchema,
  memoryUpdateOperationSchema,
]);

export const memorySyncSchema = z.object({
  operations: z.array(memoryOperationSchema).max(4).default([]),
});

export type MemoryOperation = z.infer<typeof memoryOperationSchema>;
export type MemoryReference = Pick<MemoryEntry, "content" | "id">;

export function formatMemoriesAsSystemPrompt(memories: MemoryEntry[]): string {
  if (memories.length === 0) {
    return "";
  }

  return [
    "The user has shared the following long-term preferences and facts.",
    "Use them only when relevant to personalize responses:\n",
    memories.map((memory) => `- ${memory.content}`).join("\n"),
  ].join("\n");
}

export function buildMemoryManagerSystemPrompt() {
  return [
    "You are a long-term memory manager for an AI assistant.",
    "The conversation can be in any language, but stored memories must be concise English sentences.",
    "Memories should only capture durable facts, preferences, identity details, recurring instructions, or long-term work context about the user.",
    "Do not store one-off tasks, temporary plans, short-lived context, or generic facts unrelated to the user.",
    "If the latest message says things like 'remember this' or '記住他', infer the actual memory from the recent conversation instead of storing the command itself.",
    "Compare against existing memories and return operations that keep the memory store clean.",
    "Use 'add' for new durable memories.",
    "Use 'update' when an existing memory should be rewritten or consolidated.",
    "Use 'delete' when an existing memory is contradicted, stale, or redundant.",
    "Prefer update/delete over creating duplicates.",
    "Return strict JSON only with this shape: {\"operations\":[...]}",
    "Each add needs {\"type\":\"add\",\"content\":\"User ...\"}.",
    "Each update needs {\"type\":\"update\",\"id\":\"memory-id\",\"content\":\"User ...\"}.",
    "Each delete needs {\"type\":\"delete\",\"id\":\"memory-id\"}.",
    "If no changes are needed, return {\"operations\":[]}.",
    "Never wrap the JSON in markdown unless you absolutely must.",
  ].join("\n");
}

export function buildMemoryManagerUserPrompt({
  conversation,
  existingMemories,
}: {
  conversation: Array<{ content: string; role: "assistant" | "user" }>;
  existingMemories: MemoryReference[];
}) {
  return [
    "Recent conversation:",
    conversation.length > 0
      ? conversation
          .map((message) => `${message.role.toUpperCase()}: ${message.content || "(empty)"}`)
          .join("\n")
      : "USER: (empty)",
    "",
    "Recent user messages:",
    conversation.filter((message) => message.role === "user").length > 0
      ? conversation
          .filter((message) => message.role === "user")
          .map((message) => `- ${message.content || "(empty)"}`)
          .join("\n")
      : "- None",
    "",
    "Existing memories:",
    existingMemories.length > 0
      ? existingMemories
          .map((memory) => `- [${memory.id}] ${memory.content}`)
          .join("\n")
      : "- None",
  ].join("\n");
}

export function parseMemoryManagerResponse(text: string) {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const rawJson = fencedMatch?.[1]?.trim() ?? trimmed;
  const start = rawJson.indexOf("{");
  const end = rawJson.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("Memory manager did not return JSON.");
  }

  const candidate = rawJson.slice(start, end + 1);
  return memorySyncSchema.parse(JSON.parse(candidate));
}

export function normalizeMemoryOperations(
  operations: MemoryOperation[],
  existingMemories: MemoryReference[],
) {
  const existingIds = new Set(existingMemories.map((memory) => memory.id));
  const seen = new Set<string>();
  const normalized: MemoryOperation[] = [];

  for (const operation of operations) {
    if (operation.type === "add") {
      const content = normalizeMemoryValue(operation.content);

      if (!content) {
        continue;
      }

      const key = `add:${content.toLowerCase()}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      normalized.push({ type: "add", content });
      continue;
    }

    if (!existingIds.has(operation.id)) {
      continue;
    }

    if (operation.type === "delete") {
      const key = `delete:${operation.id}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      normalized.push(operation);
      continue;
    }

    const content = normalizeMemoryValue(operation.content);

    if (!content) {
      continue;
    }

    const key = `update:${operation.id}:${content.toLowerCase()}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push({
      type: "update",
      id: operation.id,
      content,
    });
  }

  return normalized;
}

export function isExplicitRememberRequest(text: string) {
  const input = text.trim();

  if (!input) {
    return false;
  }

  return (
    /\b(?:remember (?:this|that|it)|please remember|keep (?:this|that) in mind|save this)\b/i.test(
      input,
    ) ||
    /(?:記住(?:它|他|這個|這件事)?|請記住|幫我記住|把.+記住|記下來|記得這件事)/.test(
      input,
    )
  );
}

export function extractMemoriesFromUserInput(text: string): string[] {
  const input = text.trim();

  if (!input) {
    return [];
  }

  const memories = new Set<string>();
  const addMemory = (
    value: string | undefined,
    formatter: (value: string) => string,
    normalizer = normalizeMemoryValue,
  ) => {
    if (!value) {
      return;
    }

    const normalized = normalizer(value);

    if (!normalized) {
      return;
    }

    memories.add(formatter(normalized));
  };

  addMemory(
    input.match(/\b(?:i am|i'm)\s+(?:a\s+)?student\s+(?:from|at)\s+(.+?)(?:[.!?]|$)/i)?.[1],
    (value) => `User is a student from ${value}`,
  );

  addMemory(
    input.match(/我(?:是|係)(.+?)的學生(?:[。！？!?]|$)/)?.[1],
    (value) => `User is a student at ${value}`,
    normalizeInstitutionValue,
  );

  addMemory(
    input.match(/我(?:在|目前在|現在在|正?在)?(.+?)(?:讀書|念書|就讀)(?:[。！？!?]|$)/)?.[1],
    (value) => `User studies at ${value}`,
    normalizeInstitutionValue,
  );

  addMemory(
    input.match(/\b(?:my university is|i study at|i'm studying at)\s+(.+?)(?:[.!?]|$)/i)?.[1],
    (value) => `User's university is ${value}`,
  );

  addMemory(
    input.match(/我(?:的)?(?:大學|學校)(?:是|叫)\s*(.+?)(?:[。！？!?]|$)/)?.[1],
    (value) => `User's university is ${value}`,
    normalizeInstitutionValue,
  );

  addMemory(
    input.match(/\bmy name is\s+(.+?)(?:[.!?]|$)/i)?.[1],
    (value) => `User's name is ${value}`,
  );

  addMemory(
    input.match(/我(?:叫|的名字是)\s*(.+?)(?:[。！？!?]|$)/)?.[1],
    (value) => `User's name is ${value}`,
  );

  addMemory(
    input.match(/\bi prefer\s+(.+?)(?:[.!?]|$)/i)?.[1],
    (value) => `User prefers ${value}`,
  );

  addMemory(
    input.match(/我(?:比較)?喜歡\s*(.+?)(?:[。！？!?]|$)/)?.[1],
    (value) => `User prefers ${value}`,
  );

  return Array.from(memories);
}

export function resolveMemoryCandidates(
  input: string,
  previousUserInputs: string[] = [],
): string[] {
  const directMemories = extractMemoriesFromUserInput(input);

  if (directMemories.length > 0) {
    return directMemories;
  }

  if (!isExplicitRememberRequest(input)) {
    return [];
  }

  for (const previousInput of [...previousUserInputs].reverse()) {
    const extracted = extractMemoriesFromUserInput(previousInput);

    if (extracted.length > 0) {
      return extracted;
    }
  }

  return [];
}

const MEMORY_TAG_RE = /<memory>([\s\S]*?)<\/memory>/g;

export function extractMemoriesFromResponse(text: string): {
  cleanText: string;
  memories: string[];
} {
  const memories: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = MEMORY_TAG_RE.exec(text)) !== null) {
    const content = match[1].trim();
    if (content) {
      memories.push(content);
    }
  }

  // Reset regex state
  MEMORY_TAG_RE.lastIndex = 0;

  // Remove memory tags from visible text
  const cleanText = text.replace(MEMORY_TAG_RE, "").trimEnd();

  return { cleanText, memories };
}

export function extractMemoryOperationsFromToolParts(message: {
  parts: Array<{ output?: unknown; type: string }>;
}): MemoryOperation[] {
  const operations: MemoryOperation[] = [];

  for (const part of message.parts) {
    if (
      part.type !== "dynamic-tool" &&
      !part.type.startsWith("tool-")
    ) {
      continue;
    }

    if (!part.output || typeof part.output !== "object") {
      continue;
    }

    const output = part.output as { operation?: unknown };
    const parsed = memoryOperationSchema.safeParse(output.operation);

    if (parsed.success) {
      operations.push(parsed.data);
    }
  }

  return operations;
}

export function isDuplicateMemory(
  existing: MemoryEntry[],
  newContent: string,
): boolean {
  const normalized = newContent.toLowerCase().trim();

  return existing.some(
    (entry) => entry.content.toLowerCase().trim() === normalized,
  );
}
