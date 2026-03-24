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

export function extractMemoriesFromUserInput(text: string): string[] {
  const input = text.trim();

  if (!input) {
    return [];
  }

  const memories = new Set<string>();
  const addMemory = (value: string | undefined, formatter: (value: string) => string) => {
    if (!value) {
      return;
    }

    const normalized = normalizeMemoryValue(value);

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
    input.match(/\b(?:my university is|i study at|i'm studying at)\s+(.+?)(?:[.!?]|$)/i)?.[1],
    (value) => `User's university is ${value}`,
  );

  addMemory(
    input.match(/\bmy name is\s+(.+?)(?:[.!?]|$)/i)?.[1],
    (value) => `User's name is ${value}`,
  );

  addMemory(
    input.match(/\bi prefer\s+(.+?)(?:[.!?]|$)/i)?.[1],
    (value) => `User prefers ${value}`,
  );

  return Array.from(memories);
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
