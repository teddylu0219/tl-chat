"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ArrowUp,
  Check,
  ChevronDown,
  CornerDownRight,
  Copy,
  FileText,
  Globe2,
  ImageIcon,
  Languages,
  LoaderCircle,
  Menu,
  Mic,
  MicOff,
  Paperclip,
  RefreshCcw,
  Settings2,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  memo,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import remarkGfm from "remark-gfm";

import { ConversationActionMenu } from "@/components/conversation-action-menu";
import { ModelCapabilityBadges } from "@/components/model-capability-badges";
import { useToast } from "@/components/toast";
import { APP_NAME } from "@/lib/app-config";
import {
  MAX_ATTACHMENTS,
  MAX_IMAGE_ATTACHMENT_BYTES,
  MAX_PDF_ATTACHMENT_BYTES,
  MAX_TEXT_ATTACHMENT_CHARS,
  type ComposerAttachment,
  canPreviewImageInBrowser,
  createImagePreviewUrl,
  isAttachmentPdfPart,
  isAttachmentTextPart,
  prepareComposerAttachments,
} from "@/lib/attachments";
import {
  deriveConversationTitle,
  getDisplayTitle,
  isMessageStreaming,
  getMessageText,
} from "@/lib/conversations";
import {
  extractMemoryOperationsFromToolParts,
  extractMemoriesFromResponse,
  formatMemoriesAsSystemPrompt,
  type MemoryOperation,
  type MemoryEntry,
} from "@/lib/memory";
import {
  getModelOption,
  getModelOptions,
  type ModelCapabilityFlags,
  type ModelOption,
} from "@/lib/models";
import type { ConversationRecord } from "@/lib/persistence";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";

type ConversationSessionProps = {
  conversation: ConversationRecord;
  customModelCapabilities: ModelCapabilityFlags;
  customModelId: string;
  memories: MemoryEntry[];
  onApplyMemoryOperations?: (operations: MemoryOperation[]) => void | Promise<void>;
  onConversationChange: (conversation: ConversationRecord) => void;
  onDeleteConversation: (conversation: ConversationRecord) => void;
  onExportConversation: (conversation: ConversationRecord) => void;
  onOpenSettings: () => void;
  onPinToggle?: (conversation: ConversationRecord) => void;
  onRenameConversation: (conversation: ConversationRecord) => void;
  onToggleArchiveConversation: (conversation: ConversationRecord) => void;
  onToggleSidebar: () => void;
  openRouterApiKey: string;
};

const CHAT_STREAM_THROTTLE_MS = 120;
const COMPOSER_ATTACHMENT_HELP_ID = "composer-attachment-help";
const IMAGE_ATTACHMENT_LIMIT_MB = MAX_IMAGE_ATTACHMENT_BYTES / 1024 / 1024;
const PDF_ATTACHMENT_LIMIT_MB = MAX_PDF_ATTACHMENT_BYTES / 1024 / 1024;
const LARGE_MESSAGE_RICH_RENDER_THRESHOLD = 2400;
const TEXT_ATTACHMENT_LIMIT_LABEL = `${Math.round(MAX_TEXT_ATTACHMENT_CHARS / 1000)}k`;
const VOICE_LANGUAGE_OPTIONS = [
  { label: "Auto", value: "auto" },
  { label: "繁中", value: "zh-TW" },
  { label: "简中", value: "zh-CN" },
  { label: "EN", value: "en-US" },
  { label: "日本語", value: "ja-JP" },
  { label: "한국어", value: "ko-KR" },
];
const VOICE_WAVEFORM_WEIGHTS = [0.5, 0.8, 1, 0.75, 0.55];

type RouteMetadata = {
  routeMode?: string;
  routeReason?: string;
  routedModelId?: string;
  routedModelLabel?: string;
};

function extractCodeLanguage(className?: string) {
  const match = /language-([\w-]+)/.exec(className ?? "");

  return match?.[1] ?? null;
}

function getRouteMetadata(message?: UIMessage): RouteMetadata | null {
  const metadata = message?.metadata as RouteMetadata | undefined;

  if (!metadata) {
    return null;
  }

  return metadata;
}

async function requestMemoryOperations({
  apiKey,
  conversation,
  existingMemories,
  modelId,
}: {
  apiKey: string;
  conversation: Array<{ content: string; role: "assistant" | "user" }>;
  existingMemories: Array<{ content: string; id: string }>;
  modelId: string;
}) {
  const response = await fetch("/api/memory", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      apiKey,
      conversation,
      existingMemories,
      modelId,
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = (await response.json()) as { operations?: MemoryOperation[] };
  return data.operations ?? [];
}

function CopyTextButton({
  label,
  text,
  tone = "default",
  variant = "pill",
}: Readonly<{
  label: string;
  text: string;
  tone?: "default" | "inverse";
  variant?: "pill" | "icon";
}>) {
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
      className={`message-copy-button ${variant === "icon" ? "message-copy-button-compact" : ""} flex items-center justify-center gap-1 rounded-full transition ${
        variant === "icon"
          ? "h-7 w-7 p-0"
          : "px-2.5 py-1 text-[10px] font-medium"
      } ${
        tone === "inverse"
          ? "bg-white/12 text-white/74 hover:bg-white/18 hover:text-white"
          : "bg-[color:var(--surface-muted)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
      }`}
      title={copied ? "Copied" : "Copy"}
      type="button"
      onClick={() => void handleCopy()}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {variant === "pill" ? (copied ? "Copied" : "Copy") : null}
    </button>
  );
}

const CodeBlock = memo(function CodeBlock({
  code,
  language,
}: Readonly<{
  code: string;
  language: string | null;
}>) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-white/10 bg-[#201a16] text-[#f6efe8] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/10 px-4 py-2.5">
        <span className="text-[11px] uppercase tracking-[0.22em] text-[#d4c3b2]">
          {language ?? "Plain text"}
        </span>
        <CopyTextButton
          label="Copy code"
          text={code}
          tone="inverse"
        />
      </div>
      <SyntaxHighlighter
        PreTag="div"
        codeTagProps={{ className: "code-syntax-body" }}
        customStyle={{
          background: "transparent",
          fontSize: "0.92rem",
          margin: 0,
          overflowX: "auto",
          padding: "1rem",
        }}
        language={language ?? "text"}
        lineNumberStyle={{
          color: "rgba(212, 195, 178, 0.32)",
          minWidth: "2.4em",
          paddingRight: "1rem",
        }}
        showLineNumbers={code.includes("\n")}
        style={oneDark}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
});

const MarkdownMessage = memo(function MarkdownMessage({
  text,
  mode = "rich",
}: {
  text: string;
  mode?: "rich" | "streaming";
}) {
  const deferredText = useDeferredValue(text);
  const renderPlainText =
    mode === "streaming" ||
    (text.length >= LARGE_MESSAGE_RICH_RENDER_THRESHOLD && deferredText !== text);
  const renderedText = renderPlainText ? text : deferredText;

  if (renderPlainText) {
    return (
      <div className="whitespace-pre-wrap break-words text-[14px] leading-7 text-inherit sm:text-[14.5px]">
        {renderedText}
      </div>
    );
  }

  return (
    <div className="markdown-content text-[14px] leading-7 text-inherit sm:text-[14.5px]">
      <ReactMarkdown
        components={{
          a: ({ href, ...props }) => {
            const anchorProps = props as Record<string, unknown>;
            const isFootnoteRef = Boolean(anchorProps["data-footnote-ref"]);
            const isFootnoteBackref = href?.startsWith("#user-content-fnref-");

            if (isFootnoteRef) {
              return (
                <a
                  {...props}
                  href={href}
                  className="citation-chip"
                />
              );
            }

            if (isFootnoteBackref) {
              return (
                <a
                  {...props}
                  href={href}
                  className="citation-backlink"
                />
              );
            }

            return (
              <a
                {...props}
                href={href}
                className="text-[color:var(--accent-strong)] underline underline-offset-4"
                target="_blank"
                rel="noreferrer"
              />
            );
          },
          code: ({ children, className, ...props }) => {
            const code = String(children).replace(/\n$/, "");
            const language = extractCodeLanguage(className);
            const isBlock = Boolean(language) || code.includes("\n");

            if (isBlock) {
              return <CodeBlock code={code} language={language} />;
            }

            return (
              <code
                {...props}
                className="rounded-xl bg-black/5 px-1.5 py-0.5 text-[0.92em]"
              >
                {children}
              </code>
            );
          },
          h1: ({ ...props }) => (
            <h1 {...props} className="serif-heading text-[2rem] leading-tight font-semibold" />
          ),
          h2: ({ ...props }) => (
            <h2 {...props} className="serif-heading text-[1.65rem] leading-tight font-semibold" />
          ),
          h3: ({ ...props }) => (
            <h3 {...props} className="text-[1.05rem] font-semibold leading-tight" />
          ),
          li: ({ ...props }) => <li {...props} className="my-1 pl-1" />,
          ol: ({ ...props }) => (
            <ol {...props} className="list-decimal space-y-2 pl-5 marker:font-semibold marker:text-[color:var(--accent-strong)]" />
          ),
          p: ({ ...props }) => <p {...props} className="leading-7" />,
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ ...props }) => (
            <blockquote
              {...props}
              className="rounded-r-[20px] border-l-[3px] border-[color:var(--accent)] bg-[color:var(--surface-muted)] px-4 py-3 italic text-[color:var(--foreground)]/88"
            />
          ),
          strong: ({ ...props }) => <strong {...props} className="font-semibold text-[color:var(--foreground)]" />,
          sup: ({ ...props }) => (
            <sup
              {...props}
              className="ml-1 align-super text-[0.72em] font-semibold"
            />
          ),
          section: ({ children, ...props }) => {
            const sectionProps = props as Record<string, unknown>;

            if (sectionProps["data-footnotes"]) {
              return (
                <section
                  {...props}
                  className="footnotes-section mt-8 rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-5 py-4"
                >
                  <p className="mb-3 text-[11px] uppercase tracking-[0.26em] text-[color:var(--muted-foreground)]">
                    References
                  </p>
                  {children}
                </section>
              );
            }

            return <section {...props}>{children}</section>;
          },
          table: ({ ...props }) => (
            <div className="overflow-x-auto">
              <table {...props} className="w-full min-w-[28rem] border-separate border-spacing-0" />
            </div>
          ),
          td: ({ ...props }) => (
            <td {...props} className="border-b border-[color:var(--border)] px-3 py-2 align-top" />
          ),
          th: ({ ...props }) => (
            <th {...props} className="border-b border-[color:var(--border-strong)] px-3 py-2 text-left font-semibold" />
          ),
          ul: ({ ...props }) => (
            <ul {...props} className="list-disc space-y-2 pl-5 marker:text-[color:var(--accent-strong)]" />
          ),
        }}
        remarkPlugins={[remarkGfm]}
      >
        {renderedText}
      </ReactMarkdown>
    </div>
  );
});

type AssistantActivity = "thinking" | "searching" | "using-tools";

function getVisibleAssistantText(message?: UIMessage) {
  return extractMemoriesFromResponse(getMessageText(message)).cleanText.trim();
}

function hasToolActivity(message?: UIMessage) {
  if (!message) {
    return false;
  }

  return message.parts.some(
    (part) => part.type === "dynamic-tool" || part.type.startsWith("tool-"),
  );
}

function getAssistantActivity({
  messages,
  status,
  webSearchEnabled,
}: {
  messages: UIMessage[];
  status: string;
  webSearchEnabled: boolean;
}): AssistantActivity | null {
  if (status === "submitted") {
    return webSearchEnabled ? "searching" : "thinking";
  }

  if (status !== "streaming") {
    return null;
  }

  const lastAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");

  if (getVisibleAssistantText(lastAssistantMessage)) {
    return null;
  }

  if (webSearchEnabled) {
    return "searching";
  }

  return hasToolActivity(lastAssistantMessage) ? "using-tools" : "thinking";
}

function getAssistantActivityLabel(activity: AssistantActivity) {
  switch (activity) {
    case "searching":
      return "Searching web";
    case "using-tools":
      return "Using tools";
    case "thinking":
      return "Thinking";
  }
}

function AssistantActivityIndicator({ activity }: { activity: AssistantActivity }) {
  const label = getAssistantActivityLabel(activity);

  return (
    <div
      aria-label={label}
      aria-live="polite"
      className="mx-auto flex w-full max-w-[940px] justify-start animate-[message-rise_220ms_ease-out]"
      data-testid="assistant-activity-indicator"
      role="status"
    >
      <div className="max-w-[min(100%,840px)] px-0 py-0.5 text-[color:var(--foreground)]">
        <p className="mb-2 px-0.5 text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
          Assistant
        </p>
        <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-3.5 py-2.5 text-[13px] font-medium text-white shadow-[0_10px_22px_rgba(122,96,73,0.18)]">
          <LoaderCircle className="h-4 w-4 animate-spin text-white" />
          {label}
        </div>
      </div>
    </div>
  );
}

function formatMediaTypeLabel(mediaType: string) {
  return mediaType.replace(/^image\//, "").replace(/\+xml$/, "").toUpperCase();
}

function ImageAttachmentPreview({
  filename,
  mediaType,
  tone,
  url,
}: Readonly<{
  filename?: string;
  mediaType: string;
  tone: "default" | "inverse";
  url: string;
}>) {
  const isBrowserPreviewable = canPreviewImageInBrowser(mediaType);
  const [convertedPreviewUrl, setConvertedPreviewUrl] = useState<string | null>(null);
  const [isResolvingPreview, setIsResolvingPreview] = useState(
    () => !isBrowserPreviewable && url.startsWith("data:"),
  );
  const label = filename ?? "Uploaded image";
  const isInverse = tone === "inverse";
  const resolvedPreviewUrl = isBrowserPreviewable ? url : convertedPreviewUrl;
  const previewFailed = !resolvedPreviewUrl && !isResolvingPreview;

  useEffect(() => {
    let isCurrent = true;

    if (isBrowserPreviewable || !url.startsWith("data:")) {
      return () => {
        isCurrent = false;
      };
    }

    void createImagePreviewUrl({ filename, mediaType, url }).then((previewUrl) => {
      if (!isCurrent) {
        return;
      }

      setConvertedPreviewUrl(previewUrl ?? null);
      setIsResolvingPreview(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [filename, isBrowserPreviewable, mediaType, url]);

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={url.startsWith("data:") ? label : undefined}
      className={`group/attachment overflow-hidden rounded-[18px] border transition ${
        isInverse
          ? "border-white/18 bg-white/10 text-white hover:bg-white/14"
          : "border-[color:var(--border)] bg-[color:var(--surface-muted)] text-[color:var(--foreground)] hover:border-[color:var(--border-strong)]"
      }`}
      data-testid="message-image-attachment"
      title={
        previewFailed
          ? `${label} is attached, but this browser cannot preview ${mediaType}.`
          : label
      }
    >
      {resolvedPreviewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={label}
          className="h-32 w-32 object-cover"
          src={resolvedPreviewUrl}
          onError={() => setConvertedPreviewUrl(null)}
        />
      ) : (
        <div className="flex h-24 w-32 flex-col justify-between p-3">
          <div className="flex items-center justify-between gap-2">
            <ImageIcon className="h-4 w-4 opacity-80" />
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-[0.16em] ${
                isInverse
                  ? "bg-white/14 text-white/82"
                  : "bg-[color:var(--surface-strong)] text-[color:var(--muted-foreground)]"
              }`}
            >
              {formatMediaTypeLabel(mediaType)}
            </span>
          </div>
          <div>
            <p className="line-clamp-2 break-all text-[12px] font-medium leading-4">
              {label}
            </p>
            {isResolvingPreview ? (
              <p
                className={`mt-1 text-[10px] leading-4 ${
                  isInverse ? "text-white/70" : "text-[color:var(--muted-foreground)]"
                }`}
              >
                Preparing...
              </p>
            ) : null}
          </div>
        </div>
      )}
    </a>
  );
}

function PendingAttachmentCard({
  attachment,
  onRemove,
}: Readonly<{
  attachment: ComposerAttachment;
  onRemove: (attachmentId: string) => void;
}>) {
  const [previewFailed, setPreviewFailed] = useState(
    attachment.kind === "image" && !attachment.previewUrl,
  );
  const canShowPreview =
    attachment.kind === "image" && attachment.previewUrl && !previewFailed;

  return (
    <div
      className="inline-flex min-h-14 max-w-full items-center gap-3 rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-2.5 py-2 text-[12px] text-[color:var(--foreground)]"
      data-testid="pending-attachment"
    >
      {canShowPreview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={attachment.filename}
          className="h-10 w-10 rounded-[12px] object-cover"
          src={attachment.previewUrl}
          onError={() => setPreviewFailed(true)}
        />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[color:var(--surface-strong)] text-[color:var(--muted-foreground)]">
          {attachment.kind === "image" ? (
            <ImageIcon className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </span>
      )}
      <span className="min-w-0">
        <span className="block max-w-[16rem] truncate font-medium">
          {attachment.filename}
        </span>
        <span className="block max-w-[16rem] truncate text-[10px] text-[color:var(--muted-foreground)]">
          {attachment.kind === "image"
            ? previewFailed
              ? formatMediaTypeLabel(attachment.mediaType)
              : "Image"
            : attachment.kind === "pdf"
              ? "PDF"
            : "Text context"}
        </span>
      </span>
      <button
        aria-label={`Remove ${attachment.filename}`}
        className="ml-auto rounded-full p-1 text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--foreground)]"
        type="button"
        onClick={() => onRemove(attachment.id)}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function VoiceInputCapsule({
  audioLevel,
  isRefining,
  transcript,
}: Readonly<{
  audioLevel: number;
  isRefining: boolean;
  transcript: string;
}>) {
  return (
    <div
      className="mb-2 inline-flex max-w-full items-center gap-3 rounded-full bg-[color:var(--accent)] px-3.5 py-2.5 text-white shadow-[0_12px_28px_rgba(122,96,73,0.18)]"
      data-testid="voice-input-capsule"
      role="status"
    >
      <div
        aria-hidden="true"
        className="flex h-8 w-11 shrink-0 items-center justify-center gap-1"
      >
        {VOICE_WAVEFORM_WEIGHTS.map((weight, index) => {
          const height = Math.max(7, Math.round(8 + audioLevel * 24 * weight));

          return (
            <span
              key={`${weight}-${index}`}
              className="w-1.5 rounded-full bg-white/90 transition-[height] duration-75 ease-out"
              data-testid="voice-level-bar"
              style={{ height }}
            />
          );
        })}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70">
          {isRefining ? "Refining voice" : "Listening"}
        </p>
        <p className="max-w-[min(34rem,70vw)] truncate text-[13px] font-medium leading-5">
          {isRefining
            ? "Cleaning obvious speech recognition mistakes..."
            : transcript || "Speak naturally. Click the mic again to insert."}
        </p>
      </div>
    </div>
  );
}

function MessageAttachments({ message }: { message: UIMessage }) {
  const fileParts = message.parts.filter((part) => part.type === "file");
  const pdfAttachments = message.parts.filter(isAttachmentPdfPart);
  const textAttachments = message.parts.filter(isAttachmentTextPart);
  const isUser = message.role === "user";

  if (fileParts.length === 0 && pdfAttachments.length === 0 && textAttachments.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {fileParts.map((part, index) =>
        part.mediaType.startsWith("image/") ? (
          <ImageAttachmentPreview
            key={`${part.filename ?? part.url}-${index}`}
            filename={part.filename}
            mediaType={part.mediaType}
            tone={isUser ? "inverse" : "default"}
            url={part.url}
          />
        ) : (
          <div
            key={`${part.filename ?? part.url}-${index}`}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${
              isUser
                ? "border-white/15 bg-white/10 text-white"
                : "border-[color:var(--border)] bg-[color:var(--surface-muted)]"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            {part.filename ?? "Attachment"}
          </div>
        ),
      )}
      {textAttachments.map((part) => (
        <div
          key={part.id}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${
            isUser
              ? "border-white/15 bg-white/10 text-white"
              : "border-[color:var(--border)] bg-[color:var(--surface-muted)]"
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          {part.data.filename}
        </div>
      ))}
      {pdfAttachments.map((part) => (
        <div
          key={part.id}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${
            isUser
              ? "border-white/15 bg-white/10 text-white"
              : "border-[color:var(--border)] bg-[color:var(--surface-muted)]"
          }`}
          data-testid="message-pdf-attachment"
        >
          <FileText className="h-3.5 w-3.5" />
          {part.data.filename}
        </div>
      ))}
    </div>
  );
}

function MessageBubble({
  message,
  modelLabel,
  modelOptions,
  onRegenerate,
}: {
  message: UIMessage;
  modelLabel?: string;
  modelOptions: ModelOption[];
  onRegenerate?: () => void;
}) {
  const rawText = getMessageText(message);
  const isUser = message.role === "user";
  const isStreaming = !isUser && isMessageStreaming(message);
  const routeMetadata = getRouteMetadata(message);
  const routedModel = routeMetadata?.routedModelId
    ? modelOptions.find((model) => model.id === routeMetadata.routedModelId)
    : null;
  // Strip <memory> tags from display
  const text = isUser ? rawText : extractMemoriesFromResponse(rawText).cleanText;

  return (
    <article
      className={`group mx-auto flex w-full max-w-[940px] ${isUser ? "justify-end" : "justify-start"} animate-[message-rise_220ms_ease-out]`}
      data-testid={`message-${message.role}`}
    >
      <div
        className={`${
          isUser
            ? "max-w-[min(100%,560px)] rounded-[22px] bg-[color:var(--user-bubble)] px-3.5 py-2.5 text-white shadow-[0_12px_24px_rgba(122,96,73,0.14)]"
            : "max-w-[min(100%,840px)] px-0 py-0.5 text-[color:var(--foreground)]"
        }`}
      >
        <div className={`mb-2 flex items-center justify-between gap-3 ${isUser ? "" : "px-0.5"}`}>
          <p
            className={`text-[10px] uppercase tracking-[0.22em] ${
              isUser ? "text-white/70" : "text-[color:var(--muted-foreground)]"
            }`}
          >
            {isUser
              ? "You"
              : routeMetadata?.routedModelLabel || modelLabel || "Assistant"}
          </p>
          {isUser && text ? (
            <CopyTextButton
              label="Copy prompt"
              text={text}
              tone="inverse"
              variant="icon"
            />
          ) : null}
        </div>
        {routeMetadata?.routeMode && routeMetadata.routeMode !== "manual" ? (
          <span className="sr-only">
            Routed to {routedModel?.label ?? routeMetadata.routedModelLabel ?? "assistant model"}.
            {routeMetadata.routeReason ? ` ${routeMetadata.routeReason}` : ""}
          </span>
        ) : null}
        <MessageAttachments message={message} />
        <MarkdownMessage
          mode={isStreaming ? "streaming" : "rich"}
          text={text}
        />
        {!isUser && text && !isStreaming ? (
          <div className="mt-2 flex items-center gap-1 px-0.5 opacity-0 transition-opacity duration-180 group-hover:opacity-100">
            <CopyTextButton
              label="Copy answer"
              text={text}
              variant="icon"
            />
            {onRegenerate ? (
              <button
                aria-label="Regenerate response"
                className="message-copy-button message-copy-button-compact flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--surface-muted)] text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
                type="button"
                onClick={onRegenerate}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function ConversationSession({
  conversation,
  customModelCapabilities,
  customModelId,
  memories,
  onApplyMemoryOperations,
  onConversationChange,
  onDeleteConversation,
  onExportConversation,
  onOpenSettings,
  onPinToggle,
  onRenameConversation,
  onToggleArchiveConversation,
  onToggleSidebar,
  openRouterApiKey,
}: ConversationSessionProps) {
  const { showToast } = useToast();
  const [draft, setDraft] = useState(conversation.draft);
  const [gateError, setGateError] = useState<string | null>(null);
  const [modelId, setModelId] = useState(conversation.modelId);
  const [pendingAttachments, setPendingAttachments] = useState<ComposerAttachment[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isRefiningVoice, setIsRefiningVoice] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState("auto");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const isAutoScrolling = useRef(false);
  const isNearBottom = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [transport] = useState(
    () => new DefaultChatTransport<UIMessage>({ api: "/api/chat" }),
  );
  const processedMemoryMessageIdRef = useRef<string | null>(null);

  const {
    audioLevel,
    isListening,
    isSupported: isSpeechSupported,
    startListening,
    stopListening,
    transcript,
    error: speechError,
  } = useSpeechRecognition({ language: voiceLanguage });

  const {
    clearError,
    error,
    messages,
    regenerate,
    sendMessage,
    status,
    stop,
  } = useChat({
    experimental_throttle: CHAT_STREAM_THROTTLE_MS,
    id: conversation.id,
    messages: conversation.messages,
    transport,
  });

  const syncConversation = useEffectEvent((nextDraft: string, nextMessages: UIMessage[]) => {
    onConversationChange({
      ...conversation,
      draft: nextDraft,
      messages: nextMessages,
      modelId,
      title: deriveConversationTitle(nextMessages),
      updatedAt:
        nextDraft.trim() || nextMessages.length > 0
          ? new Date().toISOString()
          : conversation.updatedAt,
    });
  });

  const resizeTextarea = useEffectEvent(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  });

  const scrollToLatest = useEffectEvent(() => {
    const container = messageContainerRef.current;

    if (!container || !isNearBottom.current) {
      return;
    }

    isAutoScrolling.current = true;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: status === "ready" ? "smooth" : "auto",
    });
    requestAnimationFrame(() => {
      isAutoScrolling.current = false;
    });
  });

  function handleScroll() {
    const container = messageContainerRef.current;

    if (!container) {
      return;
    }

    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    isNearBottom.current = nearBottom;

    if (!isAutoScrolling.current) {
      setShowScrollButton(!nearBottom && messages.length > 0);
    }
  }

  function scrollToBottom() {
    const container = messageContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    isNearBottom.current = true;
    setShowScrollButton(false);
  }

  useEffect(() => {
    resizeTextarea();
  }, [draft]);

  useEffect(() => {
    setPendingAttachments([]);
  }, [conversation.id]);

  useEffect(() => {
    if (status === "submitted") {
      isNearBottom.current = true;
    }

    scrollToLatest();
  }, [messages, status]);

  // Sync on draft/model/status changes — intentionally excludes `messages` to avoid
  // cascading re-renders during streaming. syncConversation (useEffectEvent) reads
  // the latest messages automatically; the final sync fires when status → "ready".
  useEffect(() => {
    syncConversation(draft, messages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, modelId, status]);

  // Auto-extract memories from completed assistant responses
  useEffect(() => {
    if (status !== "ready" || !onApplyMemoryOperations) {
      return;
    }

    const lastMessage = messages.at(-1);

    if (!lastMessage || lastMessage.role !== "assistant") {
      return;
    }

    if (processedMemoryMessageIdRef.current === lastMessage.id) {
      return;
    }

    processedMemoryMessageIdRef.current = lastMessage.id;
    const toolOperations = extractMemoryOperationsFromToolParts(lastMessage);

    const recentConversation = messages
      .slice(-6)
      .map((message) => ({
        content: getMessageText(message),
        role: message.role,
      }))
      .filter(
        (
          message,
        ): message is { content: string; role: "assistant" | "user" } =>
          (message.role === "assistant" || message.role === "user") &&
          Boolean(message.content.trim()),
      );
    const assistantMemories = extractMemoriesFromResponse(
      getMessageText(lastMessage),
    ).memories;

    if (toolOperations.length > 0) {
      const assistantOperations = assistantMemories.map((content) => ({
        content,
        type: "add" as const,
      }));

      void onApplyMemoryOperations([...toolOperations, ...assistantOperations]);
      return;
    }

    void requestMemoryOperations({
      apiKey: openRouterApiKey.trim(),
      conversation: recentConversation,
      existingMemories: memories.map((memory) => ({
        content: memory.content,
        id: memory.id,
      })),
      modelId,
    })
      .then(async (operations) => {
        const assistantOperations = assistantMemories.map((content) => ({
          content,
          type: "add" as const,
        }));
        await onApplyMemoryOperations([...operations, ...assistantOperations]);
      })
      .catch((error) => {
        console.warn("Memory sync failed", error);
      });
  }, [memories, messages, modelId, onApplyMemoryOperations, openRouterApiKey, status]);

  const modelOptions = getModelOptions(customModelId, customModelCapabilities);
  const currentModel =
    getModelOption(modelId, customModelId, customModelCapabilities) ??
    modelOptions[0];
  const activeError = gateError ?? error?.message ?? (speechError || null);
  const isStreaming = status === "streaming" || status === "submitted";
  const isVoiceBusy = isListening || isRefiningVoice;
  const assistantActivity = getAssistantActivity({
    messages,
    status,
    webSearchEnabled,
  });

  // Build system prompt from memories
  const systemPrompt = formatMemoriesAsSystemPrompt(memories);

  async function handleAttachmentSelection(files: FileList | null) {
    const { attachments, rejected } = await prepareComposerAttachments(files);

    if (attachments.length > 0) {
      setPendingAttachments((currentAttachments) => {
        const nextAttachments = [...currentAttachments, ...attachments].slice(
          0,
          MAX_ATTACHMENTS,
        );

        if (currentAttachments.length + attachments.length > MAX_ATTACHMENTS) {
          showToast(`Only ${MAX_ATTACHMENTS} attachments can be queued at once.`);
        }

        return nextAttachments;
      });
    }

    if (rejected.length > 0) {
      showToast(rejected[0]);
    }
  }

  function removePendingAttachment(attachmentId: string) {
    setPendingAttachments((currentAttachments) =>
      currentAttachments.filter((attachment) => attachment.id !== attachmentId),
    );
  }

  async function handleSubmit(textOverride?: string) {
    const nextText = (textOverride ?? draft).trim();

    if ((!nextText && pendingAttachments.length === 0) || isStreaming) {
      return;
    }

    if (!openRouterApiKey.trim()) {
      setGateError("Add your OpenRouter key before sending the first prompt.");
      onOpenSettings();
      return;
    }

    clearError();
    setGateError(null);

    const previousAttachments = pendingAttachments;
    const nextParts: UIMessage["parts"] = [
      ...pendingAttachments.map((attachment) => attachment.part as UIMessage["parts"][number]),
      ...(
        nextText
          ? [{ type: "text" as const, text: nextText }]
          : pendingAttachments.length > 0
            ? [{ type: "text" as const, text: "Please use the attached materials in your answer." }]
            : []
      ),
    ];

    setDraft("");
    setPendingAttachments([]);

    try {
      await sendMessage(
        { parts: nextParts },
        {
          body: {
            apiKey: openRouterApiKey.trim(),
            customModelCapabilities,
            customModelId: customModelId || undefined,
            memories: memories.map((memory) => ({
              content: memory.content,
              id: memory.id,
            })),
            modelId,
            systemPrompt: systemPrompt || undefined,
            webSearchEnabled,
          },
        },
      );
    } catch {
      setDraft(nextText);
      setPendingAttachments(previousAttachments);
    }
  }

  async function handleRegenerate() {
    if (!openRouterApiKey.trim() || isStreaming) {
      return;
    }

    clearError();
    setGateError(null);

    await regenerate({
      body: {
        apiKey: openRouterApiKey.trim(),
        customModelCapabilities,
        customModelId: customModelId || undefined,
        memories: memories.map((memory) => ({
          content: memory.content,
          id: memory.id,
        })),
        modelId,
        systemPrompt: systemPrompt || undefined,
        webSearchEnabled,
      },
    });
  }

  async function handleRetry() {
    if (!openRouterApiKey.trim()) {
      onOpenSettings();
      return;
    }

    clearError();
    setGateError(null);

    const lastMessage = messages.at(-1);

    if (!lastMessage) {
      return;
    }

    if (lastMessage.role === "user") {
      await sendMessage(
        {
          messageId: lastMessage.id,
          parts: lastMessage.parts,
        },
        {
          body: {
            apiKey: openRouterApiKey.trim(),
            customModelCapabilities,
            customModelId: customModelId || undefined,
            memories: memories.map((memory) => ({
              content: memory.content,
              id: memory.id,
            })),
            modelId,
            systemPrompt: systemPrompt || undefined,
            webSearchEnabled,
          },
        },
      );
      return;
    }

    await regenerate({
      body: {
        apiKey: openRouterApiKey.trim(),
        customModelCapabilities,
        customModelId: customModelId || undefined,
        memories: memories.map((memory) => ({
          content: memory.content,
          id: memory.id,
        })),
        modelId,
        systemPrompt: systemPrompt || undefined,
        webSearchEnabled,
      },
    });
  }

  async function refineVoiceTranscript(rawText: string) {
    if (!openRouterApiKey.trim()) {
      return rawText;
    }

    setIsRefiningVoice(true);

    try {
      const response = await fetch("/api/voice-refine", {
        body: JSON.stringify({
          apiKey: openRouterApiKey.trim(),
          language: voiceLanguage,
          modelId,
          text: rawText,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as { text?: string };
      return payload.text?.trim() || rawText;
    } catch {
      showToast("Voice refinement failed; inserted raw transcript.");
      return rawText;
    } finally {
      setIsRefiningVoice(false);
    }
  }

  async function handleVoiceToggle() {
    if (isRefiningVoice) {
      return;
    }

    if (!isSpeechSupported) {
      showToast("Voice input needs Chrome or Safari Web Speech support.");
      return;
    }

    if (isListening) {
      const text = stopListening();
      const trimmedText = text.trim();

      if (trimmedText) {
        const refinedText = await refineVoiceTranscript(trimmedText);
        setDraft((prev) => (prev ? `${prev} ${refinedText}` : refinedText));
      }
    } else {
      startListening();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            aria-label="Open sidebar"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] lg:hidden"
            data-testid="sidebar-toggle"
            type="button"
            onClick={onToggleSidebar}
          >
            <Menu className="h-4 w-4" />
          </button>

          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
              {openRouterApiKey ? "Private chat" : "Setup required"}
            </p>
            <h2 className="mt-1 text-[14px] font-medium text-[color:var(--foreground)] sm:text-[15px]">
              {getDisplayTitle(conversation)}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="hidden sm:block">
            <span className="sr-only">Model</span>
            <select
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-3.5 py-1.5 text-[14px] text-[color:var(--foreground)] outline-none"
              data-testid="model-select"
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
            >
              {modelOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <ModelCapabilityBadges
            compact
            className="sr-only"
            model={currentModel}
            testId="active-model-capabilities"
          />

          {isStreaming ? (
            <button
              className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-3.5 py-1.5 text-[14px] text-[color:var(--foreground)]"
              type="button"
              onClick={stop}
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          ) : null}

          <button
            className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-3.5 py-1.5 text-[14px] text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--accent-strong)]"
            data-testid="header-settings-button"
            type="button"
            onClick={onOpenSettings}
          >
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <ConversationActionMenu
            conversation={conversation}
            itemTestIdPrefix="active-conversation-actions"
            onArchiveToggle={onToggleArchiveConversation}
            onDelete={onDeleteConversation}
            onExport={onExportConversation}
            onPinToggle={onPinToggle}
            onRename={onRenameConversation}
            triggerTestId="active-conversation-actions"
          />
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
      <div
        ref={messageContainerRef}
        className="scroll-column h-full overflow-y-auto px-5 py-6 sm:px-10 sm:py-8"
        data-testid="message-list"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="flex min-h-full flex-col items-center justify-center text-center">
            <div className="max-w-[760px]">
              <p className="text-[10px] uppercase tracking-[0.32em] text-[color:var(--accent-strong)]">
                {APP_NAME}
              </p>
              <h3 className="serif-heading mt-4 text-4xl leading-none text-[color:var(--foreground)] sm:text-5xl">
                Start with a real question.
              </h3>
              <p className="mx-auto mt-5 max-w-[38rem] text-[15px] leading-7 text-[color:var(--muted-foreground)]">
                Private chat, local threads, and quick model switching built around your own OpenRouter key.
              </p>

              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-3.5 py-1.5 text-[13px] text-[color:var(--foreground)]">
                <Sparkles className="h-4 w-4 text-[color:var(--accent-strong)]" />
                {currentModel.label}
              </div>

              <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
                {[
                  "Sketch a homepage that feels like a trusted editorial product.",
                  "Compare three ways to learn TypeScript without burning out.",
                  "Turn my rough product idea into a launch-ready scope.",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    className="motion-lift rounded-[22px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-4 text-[14px] leading-6 text-[color:var(--foreground)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--accent-strong)]"
                    type="button"
                    onClick={() => void handleSubmit(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {!openRouterApiKey ? (
                <button
                  className="motion-lift mt-8 rounded-full bg-[color:var(--accent)] px-5 py-2.5 text-[14px] font-medium text-white transition hover:bg-[color:var(--accent-strong)]"
                  type="button"
                  onClick={onOpenSettings}
                >
                  Add OpenRouter key
                </button>
              ) : null}

              {assistantActivity ? (
                <div className="mt-8">
                  <AssistantActivityIndicator activity={assistantActivity} />
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {messages.map((message, index) => {
              const isLastAssistant =
                message.role === "assistant" &&
                index === messages.length - 1 &&
                !isStreaming;

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  modelLabel={message.role === "assistant" ? currentModel.label : undefined}
                  modelOptions={modelOptions}
                  onRegenerate={isLastAssistant ? () => void handleRegenerate() : undefined}
                />
              );
            })}

            {assistantActivity ? (
              <AssistantActivityIndicator activity={assistantActivity} />
            ) : null}

            {activeError ? (
              <div className="mx-auto max-w-[min(100%,760px)] rounded-[22px] border border-[color:var(--danger)]/30 bg-[color:var(--surface-strong)] px-4 py-4 text-left">
                <p className="text-[14px] font-medium text-[color:var(--foreground)]">
                  {activeError}
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    className="flex items-center gap-2 rounded-full border border-[color:var(--border)] px-4 py-2 text-[14px] text-[color:var(--foreground)]"
                    data-testid="retry-button"
                    type="button"
                    onClick={() => void handleRetry()}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    Retry
                  </button>
                  <button
                    className="rounded-full px-4 py-2 text-[14px] text-[color:var(--muted-foreground)]"
                    type="button"
                    onClick={onOpenSettings}
                  >
                    Review settings
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {showScrollButton ? (
        <button
          aria-label="Scroll to bottom"
          className="absolute bottom-4 left-1/2 z-10 flex h-9 w-9 -translate-x-1/2 animate-[fade-in-up_180ms_ease-out] items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface-strong)] text-[color:var(--muted-foreground)] shadow-lg transition hover:text-[color:var(--foreground)]"
          type="button"
          onClick={scrollToBottom}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      ) : null}
      </div>

      <div className="border-t border-[color:var(--border)] p-3.5 sm:px-6 sm:py-4">
        <div className="mx-auto max-w-[920px] rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <input
            ref={fileInputRef}
            className="hidden"
            multiple
            accept="image/*,application/pdf,.pdf,.txt,.md,.markdown,.csv,.json,.jsonl,.ts,.tsx,.js,.jsx,.css,.html,.xml,.yml,.yaml"
            data-testid="composer-file-input"
            type="file"
            onChange={(event) => {
              void handleAttachmentSelection(event.target.files);
              event.target.value = "";
            }}
          />

          {isVoiceBusy ? (
            <VoiceInputCapsule
              audioLevel={audioLevel}
              isRefining={isRefiningVoice}
              transcript={transcript}
            />
          ) : null}

          {pendingAttachments.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-2 px-2.5">
              {pendingAttachments.map((attachment) => (
                <PendingAttachmentCard
                  key={attachment.id}
                  attachment={attachment}
                  onRemove={removePendingAttachment}
                />
              ))}
            </div>
          ) : null}

          <p
            id={COMPOSER_ATTACHMENT_HELP_ID}
            className="sr-only"
          >
            Attach up to {MAX_ATTACHMENTS} files: images up to{" "}
            {IMAGE_ATTACHMENT_LIMIT_MB}MB each, PDFs up to{" "}
            {PDF_ATTACHMENT_LIMIT_MB}MB each, plus Markdown, text, CSV, JSON/YAML,
            HTML/CSS/JS/TS files up to {TEXT_ATTACHMENT_LIMIT_LABEL} chars.
          </p>

          <textarea
            ref={textareaRef}
            aria-describedby={COMPOSER_ATTACHMENT_HELP_ID}
            className="min-h-[54px] w-full resize-none bg-transparent px-2.5 py-2 text-[14px] leading-6 text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]"
            data-testid="composer-input"
            placeholder={
              openRouterApiKey
                ? "Ask anything worth continuing."
                : "Add your OpenRouter key before starting the first thread."
            }
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (gateError) {
                setGateError(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[color:var(--border)] px-2.5 pt-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[color:var(--muted-foreground)]">
              <span className="rounded-full bg-[color:var(--surface-muted)] px-2 py-1">
                {currentModel.label}
              </span>
              {webSearchEnabled ? (
                <span className="rounded-full bg-[color:var(--surface-muted)] px-2 py-1">
                  Web on
                </span>
              ) : null}
              {memories.length > 0 ? (
                <span className="rounded-full bg-[color:var(--surface-muted)] px-2 py-1">
                  {memories.length} mem
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                aria-pressed={webSearchEnabled}
                className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] transition ${
                  webSearchEnabled
                    ? "bg-[color:var(--accent)] text-white shadow-[0_8px_18px_rgba(122,96,73,0.18)]"
                    : "text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
                }`}
                data-testid="web-search-toggle"
                type="button"
                onClick={() => setWebSearchEnabled((enabled) => !enabled)}
              >
                <Globe2 className="h-4 w-4" />
                Web
              </button>
              <button
                aria-label="Attach files"
                aria-describedby={COMPOSER_ATTACHMENT_HELP_ID}
                className="flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-1">
                {isSpeechSupported ? (
                  <label className="flex h-9 items-center gap-1.5 rounded-full px-2 text-[12px] text-[color:var(--muted-foreground)] transition hover:bg-[color:var(--surface-muted)]">
                    <Languages className="h-4 w-4" />
                    <span className="sr-only">Voice language</span>
                    <select
                      aria-label="Voice language"
                      className="max-w-16 bg-transparent outline-none"
                      data-testid="voice-language-select"
                      disabled={isVoiceBusy}
                      value={voiceLanguage}
                      onChange={(event) => setVoiceLanguage(event.target.value)}
                    >
                      {VOICE_LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <button
                  aria-label={
                    isSpeechSupported
                      ? isListening
                        ? "Stop recording"
                        : "Voice input"
                      : "Voice input is not supported in this browser"
                  }
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
                    isVoiceBusy
                      ? "bg-[color:var(--accent)] text-white animate-[voice-pulse_1.5s_ease-in-out_infinite]"
                      : isSpeechSupported
                        ? "text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-muted)] hover:text-[color:var(--foreground)]"
                        : "text-[color:var(--muted-foreground)] opacity-70 hover:bg-[color:var(--surface-muted)] hover:opacity-100"
                  }`}
                  data-testid="voice-input-button"
                  title={
                    isSpeechSupported
                      ? "Voice input"
                      : "Voice input needs Chrome or Safari Web Speech support."
                  }
                  type="button"
                  onClick={() => void handleVoiceToggle()}
                >
                  {isVoiceBusy ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </button>
              </div>

              <button
                className="flex items-center gap-1.5 text-[13px] text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
                type="button"
                onClick={onOpenSettings}
              >
                <CornerDownRight className="h-4 w-4" />
                {openRouterApiKey ? "Review key" : "Add key"}
              </button>
              <button
                className="motion-lift flex h-9 items-center gap-2 rounded-full bg-[color:var(--accent)] px-4 text-[13px] font-medium text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="send-button"
                disabled={isStreaming || (draft.trim().length === 0 && pendingAttachments.length === 0)}
                type="button"
                onClick={() => void handleSubmit()}
              >
                {isStreaming ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
                Send
              </button>
            </div>
          </div>

          {activeError && messages.length === 0 ? (
            <p className="px-3 pt-3 text-[14px] text-[color:var(--danger)]">{activeError}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
