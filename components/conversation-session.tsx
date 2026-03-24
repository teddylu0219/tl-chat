"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ArrowUp,
  Check,
  CornerDownRight,
  Copy,
  LoaderCircle,
  Menu,
  RefreshCcw,
  Settings2,
  Sparkles,
  Square,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import remarkGfm from "remark-gfm";

import { ConversationActionMenu } from "@/components/conversation-action-menu";
import { APP_NAME } from "@/lib/app-config";
import {
  deriveConversationTitle,
  getDisplayTitle,
  getMessageText,
} from "@/lib/conversations";
import { getModelOption, getModelOptions } from "@/lib/models";
import type { ConversationRecord } from "@/lib/persistence";

type ConversationSessionProps = {
  conversation: ConversationRecord;
  customModelId: string;
  onConversationChange: (conversation: ConversationRecord) => void;
  onDeleteConversation: (conversation: ConversationRecord) => void;
  onExportConversation: (conversation: ConversationRecord) => void;
  onOpenSettings: () => void;
  onRenameConversation: (conversation: ConversationRecord) => void;
  onToggleArchiveConversation: (conversation: ConversationRecord) => void;
  onToggleSidebar: () => void;
  openRouterApiKey: string;
};

function extractCodeLanguage(className?: string) {
  const match = /language-([\w-]+)/.exec(className ?? "");

  return match?.[1] ?? null;
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

function CodeBlock({
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
}

function MarkdownMessage({ text }: { text: string }) {
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
        {text}
      </ReactMarkdown>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const text = getMessageText(message);
  const isUser = message.role === "user";

  return (
    <article
      className={`group mx-auto flex w-full max-w-[940px] ${isUser ? "justify-end" : "justify-start"} animate-[message-rise_220ms_ease-out]`}
      data-testid={`message-${message.role}`}
    >
      <div
        className={`${
          isUser
            ? "max-w-[min(100%,560px)] rounded-[22px] bg-[color:var(--accent)] px-3.5 py-2.5 text-white shadow-[0_12px_24px_rgba(122,96,73,0.14)]"
            : "max-w-[min(100%,840px)] px-0 py-0.5 text-[color:var(--foreground)]"
        }`}
      >
        <div className={`mb-2 flex items-center justify-between gap-3 ${isUser ? "" : "px-0.5"}`}>
          <p
            className={`text-[10px] uppercase tracking-[0.22em] ${
              isUser ? "text-white/70" : "text-[color:var(--muted-foreground)]"
            }`}
          >
            {isUser ? "You" : "Assistant"}
          </p>
          {text ? (
            <CopyTextButton
              label={isUser ? "Copy prompt" : "Copy answer"}
              text={text}
              tone={isUser ? "inverse" : "default"}
              variant="icon"
            />
          ) : null}
        </div>
        <MarkdownMessage text={text} />
      </div>
    </article>
  );
}

export function ConversationSession({
  conversation,
  customModelId,
  onConversationChange,
  onDeleteConversation,
  onExportConversation,
  onOpenSettings,
  onRenameConversation,
  onToggleArchiveConversation,
  onToggleSidebar,
  openRouterApiKey,
}: ConversationSessionProps) {
  const [draft, setDraft] = useState(conversation.draft);
  const [gateError, setGateError] = useState<string | null>(null);
  const [modelId, setModelId] = useState(conversation.modelId);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [transport] = useState(
    () => new DefaultChatTransport<UIMessage>({ api: "/api/chat" }),
  );

  const {
    clearError,
    error,
    messages,
    regenerate,
    sendMessage,
    status,
    stop,
  } = useChat({
    experimental_throttle: 50,
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

    if (!container) {
      return;
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: status === "ready" ? "smooth" : "auto",
    });
  });

  useEffect(() => {
    resizeTextarea();
  }, [draft]);

  useEffect(() => {
    scrollToLatest();
  }, [messages, status]);

  useEffect(() => {
    syncConversation(draft, messages);
  }, [draft, messages, modelId]);

  const modelOptions = getModelOptions(customModelId);
  const currentModel =
    getModelOption(modelId, customModelId) ??
    modelOptions[0];
  const activeError = gateError ?? error?.message;
  const isStreaming = status === "streaming" || status === "submitted";

  async function handleSubmit(textOverride?: string) {
    const nextText = (textOverride ?? draft).trim();

    if (!nextText || isStreaming) {
      return;
    }

    if (!openRouterApiKey.trim()) {
      setGateError("Add your OpenRouter key before sending the first prompt.");
      onOpenSettings();
      return;
    }

    clearError();
    setGateError(null);
    setDraft("");

    try {
      await sendMessage(
        { text: nextText },
        {
          body: {
            apiKey: openRouterApiKey.trim(),
            modelId,
          },
        },
      );
    } catch {
      setDraft(nextText);
    }
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
      const text = getMessageText(lastMessage);

      await sendMessage(
        {
          messageId: lastMessage.id,
          text,
        },
        {
          body: {
            apiKey: openRouterApiKey.trim(),
            modelId,
          },
        },
      );
      return;
    }

    await regenerate({
      body: {
        apiKey: openRouterApiKey.trim(),
        modelId,
      },
    });
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
            onRename={onRenameConversation}
            triggerTestId="active-conversation-actions"
          />
        </div>
      </header>

      <div
        ref={messageContainerRef}
        className="scroll-column min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-10 sm:py-8"
        data-testid="message-list"
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
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

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

      <div className="border-t border-[color:var(--border)] p-3.5 sm:px-6 sm:py-4">
        <div className="mx-auto max-w-[920px] rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface-strong)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <textarea
            ref={textareaRef}
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
                {currentModel.provider}
              </span>
              <span className="rounded-full bg-[color:var(--surface-muted)] px-2 py-1">
                {currentModel.label}
              </span>
              <span className="rounded-full bg-[color:var(--surface-muted)] px-2 py-1">
                {isStreaming ? "Streaming..." : "Saved locally"}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
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
                disabled={isStreaming || draft.trim().length === 0}
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
