import { z } from "zod";

export const voiceRefineRequestSchema = z.object({
  apiKey: z.string().trim().min(1),
  language: z.string().trim().optional(),
  modelId: z.string().trim().min(1),
  text: z.string().trim().min(1).max(4_000),
});

export type VoiceRefineRequest = z.infer<typeof voiceRefineRequestSchema>;

export function buildVoiceRefinePrompt({
  language,
  text,
}: {
  language?: string;
  text: string;
}) {
  return [
    "You are a conservative speech-to-text correction engine.",
    "Return only the corrected transcript text. No markdown, no explanation.",
    "Only fix obvious speech recognition mistakes, especially Chinese homophones and mixed Chinese-English technical terms.",
    "Never rewrite, polish, summarize, translate, or remove content that appears correct.",
    "If the transcript already looks correct, return it exactly as-is.",
    language ? `Recognition language: ${language}` : "",
    "",
    "Transcript:",
    text,
  ]
    .filter(Boolean)
    .join("\n");
}

export function normalizeVoiceTranscriptForMock(text: string) {
  return text
    .replaceAll("配森", "Python")
    .replaceAll("派森", "Python")
    .replaceAll("杰森", "JSON")
    .replaceAll("傑森", "JSON")
    .replaceAll("爪哇腳本", "JavaScript")
    .trim();
}
