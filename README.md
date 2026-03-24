# tl.chat

This project was created for **Assignment 1** of the course **Introduction to Generative Artificial Intelligence**.

It is a local-first AI chat app built with Next.js and OpenRouter, with support for standard chat, memory, and council mode.

## AI-Assisted Development

This codebase was developed with:

- Claude Code (Opus 4.6)
- Codex (GPT-5.4)

## Features

- Standard AI chat with local conversation history
- Memory across chats for user facts and preferences
- Council mode with multiple models and a host synthesis
- Local-first settings and browser-side persistence

## Tech

- Next.js 16 + React 19
- AI SDK 6 with OpenRouter
- IndexedDB for local storage
- Vitest and Playwright for testing

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
