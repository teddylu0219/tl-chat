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

const MEMORY_INSTRUCTIONS = [
  "\n\n---\nMEMORY INSTRUCTIONS (invisible to user):",
  "When the user shares personal preferences, facts about themselves, work context, or recurring instructions,",
  "silently output a <memory> tag at the END of your response (after all visible content).",
  "Format: <memory>concise fact or preference</memory>",
  "Examples:",
  '- User says "I\'m a frontend developer" → <memory>User is a frontend developer</memory>',
  '- User says "Always use TypeScript" → <memory>User prefers TypeScript over JavaScript</memory>',
  '- User says "My name is Alex" → <memory>User\'s name is Alex</memory>',
  "Rules:",
  "- Only emit <memory> for durable facts/preferences, NOT for ephemeral task details.",
  "- Do NOT mention the memory system to the user.",
  "- Do NOT emit <memory> if the fact is already in the existing memories above.",
  "- Maximum 1-2 memories per response. Skip if nothing is worth remembering.",
].join("\n");

export const memoryExtractionSchema = z.object({
  memories: z.array(z.string().trim().min(1)).max(2).default([]),
});

export function formatMemoriesAsSystemPrompt(memories: MemoryEntry[]): string {
  const memoryContext =
    memories.length > 0
      ? [
          "The user has shared the following preferences and facts about themselves.",
          "Use this context to personalize your responses when relevant:\n",
          memories.map((m) => `- ${m.content}`).join("\n"),
        ].join("\n")
      : "";

  return memoryContext + MEMORY_INSTRUCTIONS;
}

export function buildMemoryExtractionSystemPrompt() {
  return [
    "You extract durable user memories from a chat.",
    "The user's messages may be in any language.",
    "Return only facts, preferences, identity details, long-term context, or recurring instructions that should persist across future chats.",
    "Ignore one-off tasks, temporary requests, short-lived context, and facts about other people unless the user clearly says the fact is about themselves.",
    "If the latest message is a remember/save request like 'remember this', infer the memory from the recent user messages.",
    "Write each memory as a concise standalone English sentence that starts with 'User'.",
    "Avoid duplicates with existing memories.",
    "If nothing is worth remembering, return an empty array.",
  ].join("\n");
}

export function buildMemoryExtractionUserPrompt({
  existingMemories,
  input,
  recentUserMessages,
}: {
  existingMemories: string[];
  input: string;
  recentUserMessages: string[];
}) {
  return [
    "Latest user message:",
    input || "(empty)",
    "",
    "Recent user messages:",
    recentUserMessages.length > 0
      ? recentUserMessages.map((message) => `- ${message}`).join("\n")
      : "- None",
    "",
    "Existing memories:",
    existingMemories.length > 0
      ? existingMemories.map((memory) => `- ${memory}`).join("\n")
      : "- None",
  ].join("\n");
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

export function isDuplicateMemory(
  existing: MemoryEntry[],
  newContent: string,
): boolean {
  const normalized = newContent.toLowerCase().trim();

  return existing.some(
    (entry) => entry.content.toLowerCase().trim() === normalized,
  );
}
