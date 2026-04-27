# Project Prompt

Build `tl.chat` into a local-first personal AI chat application that can serve as a practical self-hosted ChatGPT-style workspace.

## Product Goals

- Long-term memory: Store durable user facts and preferences locally, use them only when relevant, and keep memory operations reviewable.
- Multimodal chat: Support useful image and text-like file inputs with clear limits, visible attachment state, and robust request validation.
- Auto model routing: Select an appropriate OpenRouter model based on task shape, attachments, tool needs, and explicit user intent.
- Tool use and Web: Provide built-in memory/time tools plus explicit Web search/fetch access through OpenRouter server tools, while hiding raw tool activity from the primary chat UI.
- UI/UX: Keep the app fast, understandable, local-first, and usable for daily chat workflows.

## Operating Rules

- Treat repository files as the source of truth.
- Keep each loop to one small, focused change.
- Update `PLAN.md`, `TODO.md`, and `PROGRESS.md` when scope, status, or findings change.
- Run relevant verification before claiming success.
- Commit each completed loop with a clear message.
