# Plan

## Milestone 1: Stabilize Core Chat Capabilities

Status: complete for the current foundation pass.

- Long-term memory can be stored locally, searched by the model, and updated through validated memory operations.
- Multimodal attachments support image and text-like inputs with tested conversion and rejection paths.
- Auto routing has a dedicated router module with coverage for vision, code, deep reasoning, tools, and Traditional Chinese prompts.
- MCP support includes Streamable HTTP initialization, tool listing, tool calling, and collision-safe tool registration.

## Milestone 2: Improve Observability and UX

Status: in progress.

- Show routing decisions clearly enough for users to trust model selection without crowding the chat surface. Route details are now tucked away from the primary visual UI while concise model/tool chips remain visible.
- Make tool execution state, failures, and outputs easier to inspect without overwhelming the chat. Initial status badges and MCP output formatting are implemented.
- Make MCP discovery failures visible to the model instead of silently dropping unavailable servers. Discovery now has timeout handling and partial failure summaries.
- Let users test individual MCP server drafts from Settings before saving them.
- Improve settings safety for API keys, MCP headers, and draft cancellation. Settings save/cancel behavior now has Playwright coverage.
- Let users describe custom OpenRouter model capabilities so manual custom models do not get incorrectly bypassed by image/tool fallback routing.
- Protect custom model capability settings with e2e coverage for disabled/enabled controls and save/reopen persistence.
- Surface model capabilities directly in chat and council model controls, including routed assistant metadata chips.
- Add safer memory review and conflict handling. Automatic memory updates now expose a review action that opens settings.
- Make multimodal limits understandable without turning the composer into documentation. Attachment limits remain available to assistive tech and validation errors, while the visible composer stays focused.
- Make real OpenRouter multimodal requests robust by converting browser data URL image attachments into model file bytes before provider calls.
- Keep unsupported browser image formats, including HEIC, visible by generating browser-safe JPEG previews when possible and compact fallback cards otherwise.
- Clarify tool readiness with concise status chips instead of persistent MCP setup instructions in the composer.
- Keep Settings compact and action-oriented by removing explanatory paragraphs that duplicate labels or documentation.
- Record screenshots in `screenshots/` when UI changes are visually validated.

## Milestone 3: Expand Agentic Workflows

Status: planned.

- Add richer tool routing and tool result summarization.
- Add stronger import/export paths for conversations, settings, and memories. A versioned backup schema now covers memories and MCP server settings, and Settings can export/import that backup as JSON.
- Protect backup import reliability with e2e coverage for malformed JSON and schema-invalid payloads.
- Add richer model capability visibility and route diagnostics for custom models and Auto Router decisions.
- Expand daily-driver workflow ergonomics with prompt templates, stronger conversation search, and safer memory conflict handling. Conversation search now highlights visible title/preview matches, exposes result counts, and supports keyboard jump-to-first-result.
- Add end-to-end checks for the highest-value user flows.
