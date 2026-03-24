# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev          # Dev server on :3000
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest unit tests with coverage
npm run test:watch   # Vitest watch mode
npm run test:e2e     # Build + Playwright (Chromium)
```

Run a single test file: `npx vitest run lib/conversations.test.ts`

Run a single E2E test: `npx playwright test e2e/app.spec.ts --grep "test name"`

E2E tests use `OPENROUTER_MOCK_RESPONSE=1` to mock the chat API.

## Architecture

**Local-first AI chat app** — Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4.

All user data (conversations, settings) lives in the browser's **IndexedDB** via `idb`. There is no backend database. The only server-side route is `/api/chat`, which validates requests with Zod and proxies them to **OpenRouter** (OpenAI-compatible provider) using the Vercel AI SDK's streaming response.

### Data flow

1. `ChatApp` (root client component) loads conversations and settings from IndexedDB on mount
2. `ConversationSession` uses the AI SDK `useChat` hook → POST `/api/chat` → OpenRouter
3. Streamed responses render in real-time; completed messages persist back to IndexedDB
4. `ChatSidebar` reflects conversation list changes (pinned → recent → archived)

### Key modules

| Path | Role |
|---|---|
| `app/api/chat/route.ts` | Chat endpoint: Zod validation, OpenRouter proxy, streaming |
| `components/chat-app.tsx` | Root state container: conversations, settings, active thread |
| `lib/persistence.ts` | IndexedDB CRUD (conversations store + settings store, DB v2) |
| `lib/conversations.ts` | Sort, search, title derivation, markdown export |
| `lib/models.ts` | Model registry (OpenAI, Anthropic, Google, DeepSeek, Qwen) |
| `lib/openrouter.ts` | OpenRouter client factory |
| `lib/chat-schema.ts` | Zod schema for chat request validation |
| `lib/app-config.ts` | App constants, theme options |

### Theming

Two themes (`warm-light`, `graphite-dark`) via CSS custom properties on `data-theme` attribute. Always verify changes in both themes.

### Testing

- **Unit tests** (`lib/*.test.ts`): Vitest with `fake-indexeddb` for IndexedDB simulation
- **E2E tests** (`e2e/`): Playwright against a production build with mocked API responses
