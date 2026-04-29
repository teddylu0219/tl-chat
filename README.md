# tl.chat

This project is the **Assignment 2** continuation of an **Assignment 1** project for the course **Introduction to Generative Artificial Intelligence**.

Assignment 1 built the original local-first AI chat foundation. Assignment 2 upgrades that foundation into a more practical personal AI workspace with long-term memory, multimodal input, automatic model routing, tool use, and MCP-ready integration support.

## AI-Assisted Development

This codebase was developed with:

- Claude Code (Opus 4.6)
- Codex (GPT-5.4)

## Features

- Standard AI chat with local conversation history.
- Long-term memory for durable user facts and preferences, stored locally in IndexedDB and reviewable from Settings.
- Automatic memory updates through validated `remember_memory`, `update_memory`, `delete_memory`, and background memory-manager flows.
- Multimodal chat with image, PDF, and text-like file attachments.
- HEIC/HEIF preview conversion for browser-unsupported image formats.
- Auto routing between OpenRouter models based on task type, attachments, reasoning needs, code prompts, and tool requirements.
- Tool use through built-in memory tools, current-time lookup, and an explicit Web toggle for OpenRouter-hosted Web search/fetch.
- MCP client support in the codebase for Streamable HTTP tool discovery and calls. The current main UI path uses built-in tools and OpenRouter Web tools rather than a user-facing MCP settings screen.
- Council mode with multiple models, panel replies, and a host synthesis.
- Voice input with conservative transcript refinement for mixed Chinese-English technical terms.
- Local backup import/export for memories, markdown export for conversations, archived threads, thread search, pinning, and local theme/settings persistence.

## Assignment 2 Focus

The Assignment 2 work expands the original chat app in these areas:

1. Long-term memory: persistent local memories, memory search, queued mutation tools, automatic extraction, duplicate prevention, and review affordances.
2. Multimodal: image, PDF, and text-like attachment support with request validation and model-readable conversion.
3. Auto routing between models: a dedicated router chooses or falls back to models for vision, code, deep reasoning, tool use, and Traditional Chinese prompts.
4. Tool use and MCP: built-in AI SDK tools are wired into chat, OpenRouter Web tools are enabled through the composer Web toggle, and a tested MCP client module remains available for tool integration work.
5. Other workflow improvements: council mode, voice refinement, settings backup, conversation search, markdown export, archive/restore, and local-first persistence.

## Tech

- Next.js 16 + React 19
- AI SDK 6 with OpenRouter
- IndexedDB for local storage
- Vitest and Playwright for testing

## Architecture

See [`docs/system-introduction.md`](docs/system-introduction.md) for the system introduction and architecture diagram, with emphasis on long-term memory and tool use.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## OpenRouter API Key

1. Create an API key from OpenRouter.
2. Run the app and open `Settings`.
3. Paste the key into the OpenRouter API key field and save.
4. The key is stored only in your browser for local use.
