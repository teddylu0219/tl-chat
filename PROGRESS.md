# Progress

## 2026-04-25T01:49:55+08:00

Completed: Added a compact route metadata chip for assistant messages when the route mode is `auto` or `fallback`; manual routes remain hidden to avoid noise.

Verification:

- `npm test`: passed, 10 files and 57 tests.
- `npm run lint`: passed.
- `npm run build`: passed.

Screenshots: none captured in this loop. The chip requires an assistant message with route metadata; this loop kept validation to code/build checks rather than fabricating UI state.

Findings:

- Existing UI already had route metadata in message metadata, but it was rendered as low-emphasis text.
- The chip now gives the route mode a clear label and keeps the route reason truncated with a full `title` tooltip.

## 2026-04-25T01:47:50+08:00

Completed: Created `PROMPT.md`, `PLAN.md`, `TODO.md`, `PROGRESS.md`, and `screenshots/.gitkeep` so future loops have Markdown control files as the repository source of truth.

Verification:

- `npm test`: passed, 10 files and 57 tests.
- `npm run lint`: passed.
- `npm run build`: passed.

Screenshots: none captured in this loop.

Findings:

- Existing progress before this loop was stored in `progress.json`; the Markdown control files now become the primary workflow record.
- `git switch -c main/autonomous-loop` failed because `refs/heads/main` already exists and blocks nested `main/...` refs.
- Recovery: switched to `main-autonomous-loop`, preserving the dirty worktree for checkpointing.

## Prior Checkpoint From progress.json

Completed before this Markdown control layer:

- Added MCP client tests for active server filtering, Streamable HTTP initialization, SSE tool listing, and tool call text extraction.
- Added chat schema coverage for text attachment data parts, MCP server settings, and long-term memory payloads.
- Allowed incomplete MCP server drafts without blocking chat requests.
- Replaced MCP header alerts with inline validation.
- Extracted multimodal attachment handling into `lib/attachments.ts`.
- Added tests for image encoding, size rejection, text detection, truncation, and attachment overflow.
- Improved auto-routing for large text attachments, explicit tool prompts, and Traditional Chinese code/deep/tool prompts.
- Improved MCP settings accessibility.
- Wrapped the OpenRouter key input in a form to remove browser console warnings.
- Moved memory tool operation extraction into `lib/memory.ts` with schema validation and tests.
- Resolved `auto/router` to a concrete model for background memory sync.
- Prevented MCP tool key collisions.
- Reset settings drafts by unmounting panel content on close.
- Ignored local `.playwright-cli/` inspection artifacts.

Latest full verification before this loop:

- `npm test`: passed, 10 files and 57 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
