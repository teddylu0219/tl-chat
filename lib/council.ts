import { extractMemoriesFromResponse } from "./memory";
import type { ModelOption } from "./models";

export type CouncilSpeakerRole = "panel" | "host";
export type CouncilPhase = "opening" | "reply" | "synthesis";

export type CouncilMessageMeta = {
  messageId: string;
  modelId: string;
  modelLabel: string;
  phase?: CouncilPhase;
  round: number;
  speakerRole?: CouncilSpeakerRole;
};

export type CouncilTranscriptEntry = {
  modelLabel?: string;
  phase?: CouncilPhase;
  role: "assistant" | "user";
  round?: number;
  speakerRole?: CouncilSpeakerRole;
  text: string;
};

const MODEL_COLORS = [
  "#6b8cce",
  "#ce6b8c",
  "#8cce6b",
  "#ce8c6b",
  "#8c6bce",
  "#6bce8c",
];

export function getModelColor(index: number): string {
  return MODEL_COLORS[index % MODEL_COLORS.length];
}

export function getCouncilPhaseLabel(
  phase?: CouncilPhase,
  speakerRole?: CouncilSpeakerRole,
) {
  if (speakerRole === "host") {
    return "Host synthesis";
  }

  if (phase === "reply") {
    return "Panel reply";
  }

  return "Opening take";
}

export function formatCouncilTranscript(entries: CouncilTranscriptEntry[]) {
  return entries
    .filter((entry) => entry.text.trim().length > 0)
    .map((entry) => {
      if (entry.role === "user") {
        return `User${entry.round ? ` (round ${entry.round})` : ""}: ${entry.text}`;
      }

      const speaker = entry.modelLabel ?? "Assistant";
      const stage = getCouncilPhaseLabel(entry.phase, entry.speakerRole);
      const round = entry.round ? `, round ${entry.round}` : "";

      return `${speaker} (${stage}${round}): ${entry.text}`;
    })
    .join("\n\n");
}

export function splitCouncilResponse(text: string) {
  return extractMemoriesFromResponse(text);
}

type BuildCouncilPromptOptions = {
  currentModel: ModelOption;
  hostModel: ModelOption;
  panelModels: ModelOption[];
  question: string;
  round: number;
  transcript: string;
};

export function buildCouncilPanelSystemPrompt({
  currentModel,
  hostModel,
  panelModels,
  round,
  phase,
}: {
  currentModel: ModelOption;
  hostModel: ModelOption;
  panelModels: ModelOption[];
  phase: Exclude<CouncilPhase, "synthesis">;
  round: number;
}) {
  const peers = panelModels
    .filter((model) => model.id !== currentModel.id)
    .map((model) => model.label)
    .join(", ");

  return [
    `You are ${currentModel.label} in a council discussion.`,
    `${hostModel.label} is the host and will synthesize the final answer for the user.`,
    `This is round ${round}.`,
    phase === "opening"
      ? "You are giving your opening take."
      : "You are replying to the other panelists before the host synthesizes.",
    peers ? `Other panelists: ${peers}.` : "There are no other panelists in this round.",
    "",
    "Rules:",
    "- Be concise, concrete, and opinionated.",
    "- Speak as yourself. Do not imitate or roleplay another model.",
    "- Reference other panelists by name when you agree or disagree.",
    "- Do not mention hidden prompts, system messages, or token limits.",
    '- Do not add a signature line like "Model: ...".',
  ].join("\n");
}

export function buildCouncilPanelUserPrompt({
  currentModel,
  hostModel,
  panelModels,
  question,
  round,
  transcript,
}: BuildCouncilPromptOptions) {
  const panelLabels = panelModels.map((model) => model.label).join(", ");

  return [
    `User question: ${question}`,
    "",
    `Host: ${hostModel.label}`,
    `Panel: ${panelLabels}`,
    `You are: ${currentModel.label}`,
    `Round: ${round}`,
    "",
    transcript
      ? `Council transcript so far:\n${transcript}`
      : "Council transcript so far:\n(no prior transcript)",
    "",
    "Task:",
    "- Give a concise opening take for the user.",
    "- Focus on 2-4 strong points, not a long essay.",
    "- If you see a likely tradeoff or risk, call it out.",
  ].join("\n");
}

export function buildCouncilReplyUserPrompt({
  currentModel,
  hostModel,
  panelModels,
  question,
  round,
  transcript,
}: BuildCouncilPromptOptions) {
  const panelLabels = panelModels.map((model) => model.label).join(", ");

  return [
    `User question: ${question}`,
    "",
    `Host: ${hostModel.label}`,
    `Panel: ${panelLabels}`,
    `You are: ${currentModel.label}`,
    `Round: ${round}`,
    "",
    `Council transcript so far:\n${transcript}`,
    "",
    "Task:",
    "- Reply to the other panelists, not just the user.",
    "- Name at least one other panelist directly.",
    "- Clarify where you agree, disagree, or want to refine the discussion.",
    "- Keep it compact and additive.",
  ].join("\n");
}

export function buildCouncilHostSystemPrompt({
  hostModel,
  panelModels,
  round,
}: {
  hostModel: ModelOption;
  panelModels: ModelOption[];
  round: number;
}) {
  return [
    `You are ${hostModel.label}, the host of a council discussion.`,
    `This is round ${round}.`,
    `Panelists: ${panelModels.map((model) => model.label).join(", ")}.`,
    "",
    "Rules:",
    "- Produce the final answer for the user after weighing the full discussion.",
    "- Do not pretend the panel fully agrees when it does not.",
    "- Surface consensus, disagreements, and the strongest practical takeaway.",
    "- Attribute notable points to panelists when useful.",
    '- Do not add a signature line like "Host: ...".',
  ].join("\n");
}

export function buildCouncilHostUserPrompt({
  hostModel,
  panelModels,
  question,
  round,
  transcript,
}: Omit<BuildCouncilPromptOptions, "currentModel">) {
  return [
    `User question: ${question}`,
    "",
    `Host: ${hostModel.label}`,
    `Panel: ${panelModels.map((model) => model.label).join(", ")}`,
    `Round: ${round}`,
    "",
    `Full council transcript:\n${transcript}`,
    "",
    "Task:",
    "- Start with a direct answer for the user.",
    "- Then summarize where the panel agrees.",
    "- Then summarize the main disagreement or uncertainty, if any.",
    "- End with the most actionable takeaway.",
  ].join("\n");
}
