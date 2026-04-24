"use client";

import {
  ArrowUp,
  Check,
  Copy,
  Crown,
  LoaderCircle,
  Menu,
  MessagesSquare,
  Settings2,
  Square,
} from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ModelCapabilityBadges } from "@/components/model-capability-badges";
import { useToast } from "@/components/toast";
import { APP_NAME } from "@/lib/app-config";
import {
  buildCouncilHostSystemPrompt,
  buildCouncilHostUserPrompt,
  buildCouncilPanelSystemPrompt,
  buildCouncilPanelUserPrompt,
  buildCouncilReplyUserPrompt,
  formatCouncilTranscript,
  getCouncilPhaseLabel,
  getModelColor,
  splitCouncilResponse,
  type CouncilMessageMeta,
  type CouncilPhase,
  type CouncilSpeakerRole,
  type CouncilTranscriptEntry,
} from "@/lib/council";
import {
  deriveConversationTitle,
  getDisplayTitle,
  getMessageText,
} from "@/lib/conversations";
import {
  createMemoryEntry,
  formatMemoriesAsSystemPrompt,
  isDuplicateMemory,
  type MemoryEntry,
} from "@/lib/memory";
import {
  FEATURED_MODELS,
  getModelOptions,
  type ModelCapabilityFlags,
  type ModelOption,
} from "@/lib/models";
import type { ConversationRecord } from "@/lib/persistence";

type CouncilSessionProps = {
  conversation: ConversationRecord;
  customModelCapabilities: ModelCapabilityFlags;
  customModelId: string;
  memories: MemoryEntry[];
  onAutoMemory?: (entry: MemoryEntry) => void;
  onConversationChange: (conversation: ConversationRecord) => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  openRouterApiKey: string;
};

type CouncilMessage = {
  id: string;
  modelId?: string;
  modelIndex?: number;
  modelLabel?: string;
  phase?: CouncilPhase;
  role: "user" | "assistant";
  round?: number;
  speakerRole?: CouncilSpeakerRole;
  text: string;
};

const DEFAULT_COUNCIL_MODEL_IDS = [
  FEATURED_MODELS[0].id,
  FEATURED_MODELS[3].id,
  FEATURED_MODELS[4].id,
];

function areSameIds(left: string[] | undefined, right: string[]) {
  if ((left?.length ?? 0) !== right.length) {
    return false;
  }

  return right.every((value, index) => left?.[index] === value);
}

function normalizeHostModelId(selectedIds: string[], hostModelId?: string | null) {
  if (hostModelId && selectedIds.includes(hostModelId)) {
    return hostModelId;
  }

  return selectedIds[0] ?? null;
}

function toTranscriptEntries(messages: CouncilMessage[]): CouncilTranscriptEntry[] {
  return messages.map((message) => ({
    modelLabel: message.modelLabel,
    phase: message.phase,
    role: message.role,
    round: message.round,
    speakerRole: message.speakerRole,
    text: message.text,
  }));
}

function getTranscriptWindow(messages: CouncilMessage[], limit = 12) {
  return formatCouncilTranscript(toTranscriptEntries(messages.slice(-limit)));
}

function councilMetaForMessage(message: CouncilMessage): CouncilMessageMeta | null {
  if (message.role !== "assistant" || !message.modelId || !message.modelLabel || !message.round) {
    return null;
  }

  return {
    messageId: message.id,
    modelId: message.modelId,
    modelLabel: message.modelLabel,
    phase: message.phase,
    round: message.round,
    speakerRole: message.speakerRole,
  };
}

function parseSseDataLines(buffer: string) {
  const events: string[] = [];
  let remainder = buffer;

  while (true) {
    const boundaryIndex = remainder.indexOf("\n\n");

    if (boundaryIndex === -1) {
      break;
    }

    const rawEvent = remainder.slice(0, boundaryIndex);
    remainder = remainder.slice(boundaryIndex + 2);

    const payload = rawEvent
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");

    if (payload) {
      events.push(payload);
    }
  }

  return { events, remainder };
}

const CopyMessageButton = memo(function CopyMessageButton({
  label,
  text,
  tone = "default",
}: {
  label: string;
  text: string;
  tone?: "default" | "inverse";
}) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => setCopied(false), 1500);

    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast("Copied to clipboard");
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      aria-label={label}
      className={`message-copy-button message-copy-button-compact flex h-7 w-7 items-center justify-center rounded-full transition ${
        tone === "inverse"
          ? "bg-white/12 text-white/74 hover:bg-white/18 hover:text-white"
          : "bg-[color:var(--surface-muted)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
      }`}
      title={copied ? "Copied" : "Copy"}
      type="button"
      onClick={() => void handleCopy()}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
});

const CouncilBubble = memo(function CouncilBubble({
  message,
}: {
  message: CouncilMessage;
}) {
  const isUser = message.role === "user";
  const color = message.modelIndex !== undefined ? getModelColor(message.modelIndex) : undefined;
  const phaseLabel = getCouncilPhaseLabel(message.phase, message.speakerRole);

  return (
    <article
      className={`group mx-auto flex w-full max-w-[940px] ${isUser ? "justify-end" : "justify-start"} animate-[message-rise_220ms_ease-out]`}
      data-testid={isUser ? "council-message-user" : "council-message-assistant"}
    >
      <div
        className={`${
          isUser
            ? "max-w-[min(100%,560px)] rounded-[22px] bg-[color:var(--user-bubble)] px-3.5 py-3 text-white shadow-[0_10px_24px_rgba(122,96,73,0.12)]"
            : "max-w-[min(100%,840px)] px-0 py-0.5 text-[color:var(--foreground)]"
        }`}
      >
        <div className={`mb-2 flex items-center justify-between gap-3 ${isUser ? "" : "px-0.5"}`}>
          <div className="flex min-w-0 items-center gap-2">
            {!isUser && color ? (
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
            ) : null}
            <p
              className={`truncate text-[10px] uppercase tracking-[0.22em] ${
                isUser ? "text-white/70" : "text-[color:var(--muted-foreground)]"
              }`}
            >
              {isUser ? "You" : message.modelLabel ?? "Assistant"}
              {!isUser ? ` · ${phaseLabel}` : ""}
              {message.round ? ` · Round ${message.round}` : ""}
            </p>
            {!isUser && message.speakerRole === "host" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--surface-muted)] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[color:var(--accent-strong)]">
                <Crown className="h-2.5 w-2.5" />
                Host
              </span>
            ) : null}
          </div>

          {message.text.trim().length > 0 ? (
            <CopyMessageButton
              label={`Copy ${isUser ? "message" : `${message.modelLabel ?? "assistant"} message`}`}
              text={message.text}
              tone={isUser ? "inverse" : "default"}
            />
          ) : null}
        </div>

        <div className="text-[14px] leading-7 text-inherit sm:text-[14.5px]">
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{message.text}</div>
          ) : (
            <div className="markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.text}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </article>
  );
});

export function CouncilSession({
  conversation,
  customModelCapabilities,
  customModelId,
  memories,
  onAutoMemory,
  onConversationChange,
  onOpenSettings,
  onToggleSidebar,
  openRouterApiKey,
}: CouncilSessionProps) {
  const initialSelectedModelIds = conversation.councilModelIds?.length
    ? conversation.councilModelIds
    : DEFAULT_COUNCIL_MODEL_IDS;
  const initialHostModelId =
    normalizeHostModelId(initialSelectedModelIds, conversation.councilHostModelId) ??
    initialSelectedModelIds[0];

  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(initialSelectedModelIds);
  const [hostModelId, setHostModelId] = useState<string | null>(initialHostModelId);
  const [councilMessages, setCouncilMessages] = useState<CouncilMessage[]>(() => {
    const meta = conversation.councilMeta ?? [];
    const selectedIds = conversation.councilModelIds?.length
      ? conversation.councilModelIds
      : initialSelectedModelIds;

    return conversation.messages.map((msg) => {
      const messageMeta = meta.find((councilMessage) => councilMessage.messageId === msg.id);

      return {
        id: msg.id,
        modelId: messageMeta?.modelId,
        modelIndex: messageMeta ? selectedIds.indexOf(messageMeta.modelId) : undefined,
        modelLabel: messageMeta?.modelLabel,
        phase: messageMeta?.phase,
        role: msg.role as "user" | "assistant",
        round: messageMeta?.round,
        speakerRole: messageMeta?.speakerRole,
        text: getMessageText(msg),
      };
    });
  });
  const [draft, setDraft] = useState(conversation.draft);
  const [isRunning, setIsRunning] = useState(false);
  const [currentModelLabel, setCurrentModelLabel] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState(
    conversation.councilMeta?.length
      ? Math.max(...conversation.councilMeta.map((message) => message.round))
      : 0,
  );
  const [runError, setRunError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const modelOptions = getModelOptions(customModelId, customModelCapabilities);
  const normalizedHostModelId = normalizeHostModelId(selectedModelIds, hostModelId);
  const selectedModels = selectedModelIds
    .map((modelId) => modelOptions.find((model) => model.id === modelId))
    .filter(Boolean) as ModelOption[];
  const hostModel =
    selectedModels.find((model) => model.id === normalizedHostModelId) ??
    selectedModels[0] ??
    null;
  const panelModels = hostModel
    ? selectedModels.filter((model) => model.id !== hostModel.id)
    : [];

  function syncConversation(messages: CouncilMessage[], meta: CouncilMessageMeta[]) {
    onConversationChange({
      ...conversation,
      councilHostModelId: normalizedHostModelId,
      councilMeta: meta,
      councilModelIds: selectedModelIds,
      draft,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        parts: [{ type: "text" as const, text: message.text }],
        createdAt: new Date(),
      })),
      title: deriveConversationTitle(
        messages
          .filter((message) => message.role === "user")
          .map((message) => ({
            id: message.id,
            role: message.role as "user",
            parts: [{ type: "text" as const, text: message.text }],
            createdAt: new Date(),
          })),
      ),
      updatedAt: new Date().toISOString(),
    });
  }

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [draft]);

  useEffect(() => {
    messageContainerRef.current?.scrollTo({
      top: messageContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [councilMessages.length]);

  useEffect(() => {
    if (normalizedHostModelId === hostModelId) {
      return;
    }

    setHostModelId(normalizedHostModelId);
  }, [hostModelId, normalizedHostModelId]);

  useEffect(() => {
    if (
      areSameIds(conversation.councilModelIds, selectedModelIds) &&
      (conversation.councilHostModelId ?? null) === normalizedHostModelId
    ) {
      return;
    }

    onConversationChange({
      ...conversation,
      councilHostModelId: normalizedHostModelId,
      councilModelIds: selectedModelIds,
    });
  }, [
    conversation,
    normalizedHostModelId,
    onConversationChange,
    selectedModelIds,
  ]);

  function toggleModel(modelId: string) {
    setSelectedModelIds((previousModelIds) => {
      if (previousModelIds.includes(modelId)) {
        if (previousModelIds.length <= 3) {
          return previousModelIds;
        }

        return previousModelIds.filter((value) => value !== modelId);
      }

      if (previousModelIds.length >= 4) {
        return previousModelIds;
      }

      return [...previousModelIds, modelId];
    });
  }

  async function streamModelResponse(
    apiKey: string,
    modelId: string,
    prompt: string,
    systemPrompt: string,
    signal: AbortSignal,
  ) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        messages: [
          {
            id: crypto.randomUUID(),
            role: "user",
            parts: [{ type: "text", text: prompt }],
          },
        ],
        modelId,
        systemPrompt,
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Model ${modelId} returned ${response.status}`);
    }

    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });

      const { events, remainder } = parseSseDataLines(buffer);
      buffer = remainder;

      for (const event of events) {
        if (event === "[DONE]") {
          return fullText.trim();
        }

        const parsed = JSON.parse(event) as
          | { type: "error"; errorText: string }
          | { type: "text-delta"; delta: string };

        if (parsed.type === "error") {
          throw new Error(parsed.errorText || `Model ${modelId} returned an error`);
        }

        if (parsed.type === "text-delta" && typeof parsed.delta === "string") {
          fullText += parsed.delta;
        }
      }

      if (done) {
        break;
      }
    }

    return fullText.trim();
  }

  async function runCouncil({
    prompt,
    userMessageText,
  }: {
    prompt: string;
    userMessageText?: string;
  }) {
    if (!openRouterApiKey.trim() || isRunning || !hostModel || panelModels.length < 2) {
      return;
    }

    setIsRunning(true);
    setRunError(null);
    const round = currentRound + 1;
    setCurrentRound(round);

    const nextMessages = [...councilMessages];

    if (userMessageText) {
      nextMessages.push({
        id: crypto.randomUUID(),
        role: "user",
        text: userMessageText,
      });
    }

    setCouncilMessages(nextMessages);

    const metaSoFar: CouncilMessageMeta[] = [...(conversation.councilMeta ?? [])];
    const abortController = new AbortController();
    abortRef.current = abortController;
    const memoryPrompt = formatMemoriesAsSystemPrompt(memories);
    const knownMemories = new Set(
      memories.map((entry) => entry.content.toLowerCase().trim()),
    );
    let accumulated = nextMessages;

    function persistExtractedMemories(contents: string[]) {
      if (!onAutoMemory) {
        return;
      }

      for (const content of contents) {
        const normalized = content.toLowerCase().trim();

        if (!normalized || knownMemories.has(normalized) || isDuplicateMemory(memories, content)) {
          continue;
        }

        knownMemories.add(normalized);
        onAutoMemory(createMemoryEntry(content));
      }
    }

    try {
      for (const panelModel of panelModels) {
        if (abortController.signal.aborted) {
          break;
        }

        setCurrentModelLabel(`${panelModel.label} · opening take`);

        const systemPrompt = [
          memoryPrompt,
          buildCouncilPanelSystemPrompt({
            currentModel: panelModel,
            hostModel,
            panelModels,
            phase: "opening",
            round,
          }),
        ]
          .filter(Boolean)
          .join("\n\n---\n\n");
        const responseText = await streamModelResponse(
          openRouterApiKey,
          panelModel.id,
          buildCouncilPanelUserPrompt({
            currentModel: panelModel,
            hostModel,
            panelModels,
            question: prompt,
            round,
            transcript: getTranscriptWindow(accumulated),
          }),
          systemPrompt,
          abortController.signal,
        );
        const { cleanText, memories: extractedMemories } =
          splitCouncilResponse(responseText);

        persistExtractedMemories(extractedMemories);

        const assistantMessage: CouncilMessage = {
          id: crypto.randomUUID(),
          modelId: panelModel.id,
          modelIndex: selectedModelIds.indexOf(panelModel.id),
          modelLabel: panelModel.label,
          phase: "opening",
          role: "assistant",
          round,
          speakerRole: "panel",
          text: cleanText || "The model returned an empty response.",
        };
        const meta = councilMetaForMessage(assistantMessage);

        if (meta) {
          metaSoFar.push(meta);
        }

        accumulated = [...accumulated, assistantMessage];
        setCouncilMessages(accumulated);
      }

      for (const panelModel of panelModels) {
        if (abortController.signal.aborted) {
          break;
        }

        setCurrentModelLabel(`${panelModel.label} · reply`);

        const systemPrompt = [
          memoryPrompt,
          buildCouncilPanelSystemPrompt({
            currentModel: panelModel,
            hostModel,
            panelModels,
            phase: "reply",
            round,
          }),
        ]
          .filter(Boolean)
          .join("\n\n---\n\n");
        const responseText = await streamModelResponse(
          openRouterApiKey,
          panelModel.id,
          buildCouncilReplyUserPrompt({
            currentModel: panelModel,
            hostModel,
            panelModels,
            question: prompt,
            round,
            transcript: getTranscriptWindow(accumulated),
          }),
          systemPrompt,
          abortController.signal,
        );
        const { cleanText, memories: extractedMemories } =
          splitCouncilResponse(responseText);

        persistExtractedMemories(extractedMemories);

        const assistantMessage: CouncilMessage = {
          id: crypto.randomUUID(),
          modelId: panelModel.id,
          modelIndex: selectedModelIds.indexOf(panelModel.id),
          modelLabel: panelModel.label,
          phase: "reply",
          role: "assistant",
          round,
          speakerRole: "panel",
          text: cleanText || "The model returned an empty response.",
        };
        const meta = councilMetaForMessage(assistantMessage);

        if (meta) {
          metaSoFar.push(meta);
        }

        accumulated = [...accumulated, assistantMessage];
        setCouncilMessages(accumulated);
      }

      if (!abortController.signal.aborted) {
        setCurrentModelLabel(`${hostModel.label} · host synthesis`);

        const systemPrompt = [
          memoryPrompt,
          buildCouncilHostSystemPrompt({
            hostModel,
            panelModels,
            round,
          }),
        ]
          .filter(Boolean)
          .join("\n\n---\n\n");
        const responseText = await streamModelResponse(
          openRouterApiKey,
          hostModel.id,
          buildCouncilHostUserPrompt({
            hostModel,
            panelModels,
            question: prompt,
            round,
            transcript: getTranscriptWindow(accumulated, 18),
          }),
          systemPrompt,
          abortController.signal,
        );
        const { cleanText, memories: extractedMemories } =
          splitCouncilResponse(responseText);

        persistExtractedMemories(extractedMemories);

        const hostMessage: CouncilMessage = {
          id: crypto.randomUUID(),
          modelId: hostModel.id,
          modelIndex: selectedModelIds.indexOf(hostModel.id),
          modelLabel: hostModel.label,
          phase: "synthesis",
          role: "assistant",
          round,
          speakerRole: "host",
          text: cleanText || "The host returned an empty response.",
        };
        const meta = councilMetaForMessage(hostMessage);

        if (meta) {
          metaSoFar.push(meta);
        }

        accumulated = [...accumulated, hostMessage];
        setCouncilMessages(accumulated);
      }

    } catch (error) {
      if (!abortController.signal.aborted) {
        setRunError(error instanceof Error ? error.message : "Council run failed.");
      }
    } finally {
      setCurrentModelLabel(null);
      setIsRunning(false);
      abortRef.current = null;
      syncConversation(accumulated, metaSoFar);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setIsRunning(false);
    setCurrentModelLabel(null);
  }

  async function handleSubmit() {
    const text = draft.trim();

    if (!text || panelModels.length < 2 || !hostModel) {
      return;
    }

    setDraft("");
    await runCouncil({
      prompt: text,
      userMessageText: text,
    });
  }

  const hasMessages = councilMessages.length > 0;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            aria-label="Open sidebar"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] lg:hidden"
            type="button"
            onClick={onToggleSidebar}
          >
            <Menu className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <MessagesSquare className="h-4 w-4 text-[color:var(--accent-strong)]" />
              <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                Council mode
              </p>
            </div>
            <h2 className="mt-1 text-[14px] font-medium text-[color:var(--foreground)] sm:text-[15px]">
              {hasMessages ? getDisplayTitle(conversation) : "New council discussion"}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hostModel && hasMessages ? (
            <label className="hidden items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-3 py-1.5 text-[13px] text-[color:var(--foreground)] md:flex">
              <Crown className="h-4 w-4 text-[color:var(--accent-strong)]" />
              <span className="text-[12px] text-[color:var(--muted-foreground)]">Host</span>
              <select
                className="bg-transparent outline-none"
                disabled={isRunning}
                value={normalizedHostModelId ?? ""}
                onChange={(event) => setHostModelId(event.target.value)}
              >
                {selectedModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
              <ModelCapabilityBadges compact model={hostModel} />
            </label>
          ) : null}
          {isRunning ? (
            <button
              className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-3.5 py-1.5 text-[14px] text-[color:var(--foreground)]"
              type="button"
              onClick={handleStop}
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          ) : null}
          <button
            className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-3.5 py-1.5 text-[14px] text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--accent-strong)]"
            type="button"
            onClick={onOpenSettings}
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      <div
        ref={messageContainerRef}
        className="scroll-column min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-10 sm:py-8"
      >
        {!hasMessages ? (
          <div className="flex min-h-full flex-col items-center justify-center text-center">
            <div className="max-w-[760px]">
              <p className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--accent-strong)]">
                {APP_NAME} · Council
              </p>
              <h3 className="serif-heading mt-4 text-4xl leading-none text-[color:var(--foreground)] sm:text-5xl">
                Multi-model discussion with a host.
              </h3>
              <p className="mx-auto mt-5 max-w-[40rem] text-[15px] leading-7 text-[color:var(--muted-foreground)]">
                Pick 3–4 models. Panelists challenge each other first, then a host model weighs the discussion and gives the final synthesis.
              </p>

              <div className="mt-8">
                <p className="mb-3 text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
                  Select models (3–4)
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {modelOptions.map((model) => {
                    const isSelected = selectedModelIds.includes(model.id);
                    const colorIndex = selectedModelIds.indexOf(model.id);
                    const isHost = normalizedHostModelId === model.id;

                    return (
                      <button
                        key={model.id}
                        className={`rounded-[22px] border px-4 py-2 text-[13px] transition ${
                          isSelected
                            ? "border-[color:var(--accent-strong)] bg-[color:var(--accent-strong)] text-white"
                            : "border-[color:var(--border)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)] hover:border-[color:var(--border-strong)]"
                        }`}
                        type="button"
                        onClick={() => toggleModel(model.id)}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {isSelected && colorIndex >= 0 ? (
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: getModelColor(colorIndex) }}
                            />
                          ) : null}
                          {model.label}
                          {isHost ? " · Host" : ""}
                        </span>
                        <ModelCapabilityBadges
                          compact
                          className="mt-1 justify-center"
                          model={model}
                          tone={isSelected ? "inverse" : "default"}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {hostModel ? (
                <label className="mx-auto mt-6 flex w-fit items-center gap-3 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-2 text-[13px] text-[color:var(--foreground)]">
                  <Crown className="h-4 w-4 text-[color:var(--accent-strong)]" />
                  <span className="text-[color:var(--muted-foreground)]">Host</span>
                  <select
                    className="bg-transparent outline-none"
                    data-testid="council-host-select"
                    disabled={isRunning}
                    value={normalizedHostModelId ?? ""}
                    onChange={(event) => setHostModelId(event.target.value)}
                  >
                    {selectedModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                  <ModelCapabilityBadges compact model={hostModel} />
                </label>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="mx-auto flex max-w-[940px] flex-wrap gap-3">
              {selectedModelIds.map((modelId, index) => {
                const model = modelOptions.find((option) => option.id === modelId);
                const isHost = normalizedHostModelId === modelId;

                return (
                  <div
                    key={modelId}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] ${
                      isHost
                        ? "border-[color:var(--accent-strong)] bg-[color:var(--surface-muted)] text-[color:var(--accent-strong)]"
                        : "border-[color:var(--border)] bg-[color:var(--surface-strong)] text-[color:var(--foreground)]"
                    }`}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: getModelColor(index) }}
                    />
                    {model?.label ?? modelId}
                    <ModelCapabilityBadges compact model={model} />
                    {isHost ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--surface-strong)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em]">
                        <Crown className="h-2.5 w-2.5" />
                        Host
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {councilMessages.map((message) => (
              <CouncilBubble key={message.id} message={message} />
            ))}

            {isRunning && currentModelLabel ? (
              <div className="mx-auto flex w-full max-w-[940px] animate-[message-rise_220ms_ease-out] justify-start">
                <div className="flex items-center gap-2 px-1 py-2 text-[color:var(--muted-foreground)]">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  <span className="text-[13px]">
                    {currentModelLabel} is thinking...
                  </span>
                </div>
              </div>
            ) : null}

            {runError ? (
              <div className="mx-auto max-w-[940px] rounded-[20px] border border-[color:var(--danger)]/30 bg-[color:var(--surface-strong)] px-4 py-3 text-[13px] text-[color:var(--foreground)]">
                {runError}
              </div>
            ) : null}

            {!isRunning && councilMessages.some((message) => message.role === "assistant") ? (
              <div className="mx-auto flex max-w-[940px] justify-center">
                <button
                  className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-5 py-2 text-[13px] text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--accent-strong)]"
                  type="button"
                  onClick={() =>
                    void runCouncil({
                      prompt:
                        "Continue the discussion. Panelists should react to the strongest disagreement or uncertainty from the last round, and the host should update the synthesis.",
                    })
                  }
                >
                  Continue discussion (Round {currentRound + 1})
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <div className="border-t border-[color:var(--border)] p-3.5 sm:px-6 sm:py-4">
        <div className="mx-auto max-w-[920px] rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <textarea
            ref={textareaRef}
            className="min-h-[54px] w-full resize-none bg-transparent px-2.5 py-2 text-[14px] leading-6 text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]"
            data-testid="council-composer-input"
            placeholder="Ask a question for the council to discuss..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
          />

          <div className="flex items-center justify-between border-t border-[color:var(--border)] px-2.5 pt-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[color:var(--muted-foreground)]">
              <span className="rounded-full bg-[color:var(--surface-muted)] px-2 py-1">
                Council · {selectedModelIds.length} models
              </span>
              {hostModel ? (
                <span className="rounded-full bg-[color:var(--surface-muted)] px-2 py-1">
                  Host · {hostModel.label}
                </span>
              ) : null}
              {isRunning ? (
                <span className="rounded-full bg-[color:var(--surface-muted)] px-2 py-1">
                  Round {currentRound}
                </span>
              ) : null}
            </div>

            <button
              className="motion-lift flex h-9 items-center gap-2 rounded-full bg-[color:var(--accent)] px-4 text-[13px] font-medium text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="council-send-button"
              disabled={
                isRunning ||
                draft.trim().length === 0 ||
                !hostModel ||
                panelModels.length < 2
              }
              type="button"
              onClick={() => void handleSubmit()}
            >
              {isRunning ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
