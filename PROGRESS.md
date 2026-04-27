# Progress

## 2026-04-27T13:32:04+08:00

Completed: Reworked multimodal preview and reduced chat/settings UI copy so the product feels like a focused chat app instead of inline documentation. HEIC/HEIF images now get a browser-safe JPEG preview through `/api/attachment-preview`, pending and sent image attachments render real thumbnails when conversion succeeds, and fallback cards stay compact when preview conversion is unavailable. Removed the visible fallback route strip, header capability badge clutter, composer MCP explainer, and unnecessary attachment-limit copy from the main UI; route/model capability details remain available to assistive tech only. Settings copy was tightened so each section is labeled by action instead of long explanatory paragraphs.

Verification:

- `npm run lint`: passed.
- `npm test`: passed, 12 files and 70 tests.
- `npm run build`: passed.
- `npm run test:e2e`: passed, 18 tests.
- Computer Use manual visual test in Zen: passed. Started `npm run dev`, opened `http://localhost:3000`, confirmed the existing HEIC message displays an actual image thumbnail, the visible fallback route row is gone, the composer no longer shows the MCP configure card, and Settings has a cleaner compact layout.

Screenshots:

- `screenshots/2026-04-27-heic-preview-clean-chat.png`: Browser validation showing the HEIC thumbnail in the user message and the simplified composer/status area.

Findings:

- The previous OpenRouter sending path was fixed, but the product still looked broken because browser-unsupported formats such as HEIC had no visual preview. A small local conversion route gives the UI a real preview without changing the model payload.
- Routing and MCP details are useful state, but they should not dominate the chat surface. The primary UI now only exposes concise status chips; deeper detail belongs in diagnostics or Settings.

Resolved errors:

- The already-open browser initially showed `localhost:3000` as unavailable because the dev server was not running; started `npm run dev` and reloaded.
- The first screenshot capture grabbed Codex instead of Zen after the terminal command took focus; reactivated Zen and overwrote the screenshot with the correct app view.

## 2026-04-27T13:12:00+08:00

Completed: Fixed the real OpenRouter multimodal failure and clarified the tool/MCP experience. Browser `data:` image attachments are now converted server-side into AI SDK file bytes before model calls, so OpenRouter no longer rejects them with `URL scheme must be http or https, got data:`. HEIC and other browser-unsupported image formats now render a clear attachment card instead of an empty frame. The composer now explains that built-in tools run automatically and that MCP servers are configured in Settings.

Verification:

- `npm test -- lib/model-message-parts.test.ts`: passed, 4 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm test`: passed, 12 files and 70 tests.
- `npm run test:e2e`: passed, 18 tests.
- Computer Use manual test with the already-open Zen browser: passed. Retried the existing `IMG_3547.HEIC` prompt against real OpenRouter; the route fell back to Gemini 2.5 Flash, the previous `data:` URL error disappeared, and the model answered that the image shows a pack of tissue/paper.
- Computer Use manual tool test with real OpenRouter: passed. Sent `請使用工具告訴我台北現在時間，並用一句話回答。`; the UI showed `GET CURRENT TIME` with `DONE` status and the assistant returned the Taipei time in Chinese.

Screenshots:

- `screenshots/2026-04-27-1311-tool-time-openrouter.png`: Browser validation showing the built-in time tool card and assistant answer after the Tools/MCP guide change.

Findings:

- The failing image path was not routing; routing correctly selected Gemini for vision. The actual bug was that UI file parts persisted browser `data:` URLs and `convertToModelMessages` passed those URLs through to the OpenRouter-compatible provider.
- HEIC can be attached and sent to vision-capable providers, but common browsers cannot preview it with `<img>`, so the UI must show a fallback card rather than treating preview failure as upload failure.
- Tool use was technically working, but the composer did not explain the automatic behavior or the difference between built-in tools and configured MCP servers.

Resolved errors:

- `playwright` was not on the shell PATH for a targeted rerun after `npm run build`; used `npx --no-install playwright test ...` for the focused check, then reran `npm run test:e2e`.
- Initial `screencapture` failed with `could not create image from display`; after Computer Use permission was granted, reran screenshot capture successfully.

## 2026-04-25T03:43:48+08:00

Completed: Added conversation search result highlighting and keyboard jump support. Search results now mark visible title/preview matches, show a result count with an Enter hint, let ArrowDown move focus from the search box to the first result, and let Enter open the first result. Search-result action menus now keep pin/unpin available.

Verification:

- `npm test`: passed, 11 files and 66 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:e2e`: passed, 17 tests.
- Playwright screenshot capture: passed after running the local production server and installed Playwright browser with approved sandbox escalation.

Screenshots:

- `screenshots/2026-04-25-0336-search-highlight.png`: Desktop sidebar search showing one filtered thread, highlighted `roadmap` match, and the keyboard hint.

Findings:

- Search previously filtered threads without showing where the match happened, which made long histories harder to scan.
- The visible desktop and mobile sidebars previously reused a fixed search input id when both could exist in the DOM; `useId` now gives each sidebar instance unique search label and hint ids.

Resolved errors:

- `next start` failed inside the restricted sandbox with `listen EPERM` on `127.0.0.1:3100`; reran the local server with approved escalation and stopped it after screenshot capture.
- Direct Chromium launch failed inside the sandbox with a macOS Mach port permission error; reran Playwright with approved escalation.
- The Playwright CLI wrapper attempted to fetch `@playwright/cli` from npm and failed under restricted network access; used the repository-installed `playwright` package directly instead.

## 2026-04-25T03:28:43+08:00

Completed: Added model capability badges to standard chat model controls, route metadata chips, council model selection buttons, council host controls, and selected council model pills. The badges reuse one shared component and expose an accessible capabilities label.

Verification:

- `npm test`: passed, 11 files and 66 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:e2e`: passed, 17 tests.

Screenshots: none captured in this loop. The standard chat model picker badge path is covered by Playwright assertions; the remaining badge placements are covered by build and existing e2e council flows.

Findings:

- Native `<select>` options cannot show rich badges reliably, so badges are rendered adjacent to the current selection and inside button-based council pickers.
- `TODO.md` active items were down to two after this loop, so four next-stage tasks were promoted into Active.

## 2026-04-25T03:12:54+08:00

Completed: Added a Settings MCP connectivity test action. Each MCP server draft now has a `Test` button that sends the current unsaved name, URL, and headers to a server-side `/api/mcp-test` route, lists tools through the existing MCP client, and shows per-server success or error status without requiring the settings draft to be saved first.

Verification:

- `npm test`: passed, 11 files and 66 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:e2e`: passed, 17 tests.

Screenshots: none captured in this loop. The Settings connectivity flow is covered by Playwright route interception and visible status assertions.

Findings:

- Connectivity testing should happen server-side, not from the browser, so custom headers and MCP Streamable HTTP behavior match chat-time tool discovery.
- The first e2e attempt exposed duplicate invalid-header messages from per-server and global error regions; the final UI keeps connection-test errors scoped to the server card while preserving global errors for Save/Import/Export failures.

Resolved error:

- A temporary route-level Vitest test failed because this project’s Vitest setup does not resolve the Next `@/` alias when importing App Router route modules directly. The route test was removed; coverage remains on the MCP helper plus the Playwright Settings flow, and `npm run build` verifies the new route compiles.

## 2026-04-25T02:57:28+08:00

Completed: Added Playwright coverage for custom model capability persistence in Settings. The test verifies capability checkboxes are disabled before a custom model id exists, can be checked after entering a model id, and persist correctly after saving and reopening Settings.

Verification:

- `npm test`: passed, 11 files and 65 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:e2e`: passed, 16 tests.

Screenshots: none captured in this loop. The Settings persistence behavior is covered by browser assertions.

Findings:

- The custom capability UI and routing logic were implemented, but the save/reopen IndexedDB path did not yet have browser coverage.
- The test also protects the disabled precondition so users cannot toggle capability flags before defining a custom model id.

## 2026-04-25T02:44:44+08:00

Completed: Added Playwright coverage for invalid Settings backup imports. The new e2e test uploads malformed JSON and schema-invalid JSON, verifies the inline Settings error appears, and confirms the existing OpenRouter key plus memory/MCP state are not changed.

Verification:

- `npm test`: passed, 11 files and 65 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:e2e`: passed, 15 tests.

Screenshots: none captured in this loop. The invalid import behavior is directly covered by browser assertions.

Findings:

- The import error path was already handled in UI, but only successful imports were covered by Playwright.
- The test avoids matching browser-specific JSON parse wording and instead asserts the Settings error region is visible and local settings remain unchanged.

## 2026-04-25T02:29:59+08:00

Completed: Added custom OpenRouter model capability flags. Settings now lets users mark a custom model as Vision, Tools + MCP, Reasoning, and Code capable; those flags flow through local settings, chat request validation, model option metadata, Auto Router candidate selection, fallback routing, and tool gating.

Verification:

- `npm test`: passed, 11 files and 65 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:e2e`: passed, 14 tests.

Screenshots: none captured in this loop. The routing behavior is covered by unit tests, and the Settings UI change passed build plus the existing browser regression suite.

Findings:

- Custom models previously had no way to declare image or tool support, so manual custom selections could be forced into fallback routes even when the model actually supported the task.
- The chat API now accepts `customModelCapabilities` with a strict boolean-only shape and uses it for custom Auto Router candidates, route decisions, and tool availability.
- `TODO.md` active items were down to two after this loop, so four next-stage tasks were promoted into Active.

## 2026-04-25T02:18:36+08:00

Completed: Added Settings UI import action for memories and MCP server settings. Importing a valid backup replaces memories and MCP servers, preserves the OpenRouter API key, updates the open Settings draft, persists imported data to IndexedDB, and shows an import toast.

Verification:

- `npm test`: passed, 11 files and 61 tests.
- `npm run lint`: passed.
- `npm run build`: passed after rerunning outside the restricted sandbox because `next/font` needed Google Fonts access.
- `npm run test:e2e`: passed, 14 tests.

Screenshots: none captured in this loop. The import flow is covered by Playwright assertions for persistence, visible Settings values, and API key preservation.

Findings:

- The Settings import/export path now covers the complete backup round trip for memories and MCP server settings.
- `TODO.md` active items became empty after this loop, so three next-stage tasks were promoted into Active.

Resolved error:

- `npm run test:e2e` initially failed because the new Playwright test used `page.getByDisplayValue`, which is not available in this project setup.
- `npm run build` and the first `npm run test:e2e` attempt hit restricted-sandbox Google Fonts fetch failures from `next/font`; rerunning with approved escalation resolved the environment issue.

Recovery:

- Replaced it with placeholder locators plus `toHaveValue`.
- Approved scoped prefixes for `npm run build` and `npm run test:e2e` so future heartbeat loops can verify Next builds that fetch fonts.

## 2026-04-25T02:03:14+08:00

Completed: Added a Settings UI export action for memories and MCP server settings. The exported JSON uses the versioned backup schema and intentionally excludes the OpenRouter API key.

Verification:

- `npm test`: passed, 11 files and 61 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:e2e`: passed, 13 tests.

Screenshots: none captured in this loop. The export flow is covered by a Playwright download assertion that reads and validates the JSON payload.

Findings:

- Exporting validates current MCP header drafts first, so invalid header JSON blocks backup export with the existing inline error path.
- The new e2e test verifies the backup includes a memory and an MCP server, while excluding `openRouterApiKey`.

## 2026-04-25T02:00:18+08:00

Completed: Added versioned backup schema helpers for memories and MCP server settings. The helper can create and parse backup payloads, defaults missing collections, and rejects invalid dates or invalid MCP server URLs.

Verification:

- `npm test -- lib/settings-backup.test.ts`: passed, 3 tests.
- `npm test`: passed, 11 files and 61 tests.
- `npm run lint`: passed.
- `npm run build`: passed.

Screenshots: none captured in this loop. This was non-UI validation logic.

Findings:

- The export/import TODO was too broad for one loop, so it is now split into export UI and import UI tasks.
- Backup payloads intentionally cover memories and MCP server settings only; OpenRouter API keys are not part of this backup helper.

## 2026-04-25T01:58:51+08:00

Completed: Added MCP discovery timeout and partial failure summaries. Healthy MCP servers still register tools while failed servers produce a warning that is included in the system prompt for relevant user requests.

Verification:

- `npm test -- lib/mcp.test.ts`: passed, 5 tests.
- `npm test`: passed, 10 files and 58 tests.
- `npm run lint`: passed.
- `npm run build`: passed.

Screenshots: none captured in this loop. This was server-side/tool-discovery behavior.

Resolved error:

- `npm run build` failed because TypeScript did not narrow `item.failure` in `discoverMcpTools`; `"failure" in item` still allowed `undefined`.

Recovery:

- Added an explicit truthy check before pushing the failure record.

## 2026-04-25T01:56:20+08:00

Completed: Added composer help text for multimodal attachment limits and supported file families, backed by the same constants used by attachment handling. The attach button now references the help text with `aria-describedby`.

Verification:

- `npm test`: passed, 10 files and 57 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:e2e`: passed, 12 tests.

Screenshots: none captured in this loop. The help text is covered by a Playwright visibility assertion.

Findings:

- Attachment rejection paths existed, but the user only learned limits after selecting files.
- The composer now states the 4-file limit, 4MB image limit, and 12k text extraction limit before upload.

## 2026-04-25T01:54:34+08:00

Completed: Added a memory review affordance after automatic memory updates. Automatic memory changes now show a toast with a `Review memory` action that opens Settings, and the durable memory Playwright test now clicks that action.

Verification:

- `npm test`: passed, 10 files and 57 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:e2e`: passed, 12 tests.

Screenshots: none captured in this loop. The affordance is covered by a browser assertion and does not need a screenshot artifact.

Findings:

- Automatic memory updates were previously silent unless the user opened Settings.
- `TODO.md` active items became empty after this loop, so three next-stage tasks were promoted into Active.

## 2026-04-25T01:52:40+08:00

Completed: Added Playwright coverage for settings save/cancel behavior. The test verifies a canceled API key draft is discarded and a saved key persists after reopening settings.

Verification:

- `npm test`: passed, 10 files and 57 tests.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:e2e`: passed, 12 tests.

Screenshots: none captured in this loop. The new Playwright assertion is state-based and did not require a screenshot artifact.

Findings:

- The existing settings panel reset fix is now protected by an e2e regression test.
- `npm run test:e2e` rebuilds the app before launching the mock OpenRouter Playwright server.

## 2026-04-25T01:51:05+08:00

Completed: Improved tool activity cards with Done/Calling/Failed status badges, explicit failed styling, and clearer MCP output formatting for `content` plus `structuredContent`.

Verification:

- `npm test`: passed, 10 files and 57 tests.
- `npm run lint`: passed.
- `npm run build`: passed.

Screenshots: none captured in this loop. Tool activity cards require a completed tool call in browser state; this loop used code/build verification only.

Findings:

- MCP tool outputs already include `isError`, `content`, and optional `structuredContent`; the UI was previously rendering that whole object as raw JSON.
- Failed tool calls are now identifiable from `errorText`, output `isError`, or an error state string.

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
