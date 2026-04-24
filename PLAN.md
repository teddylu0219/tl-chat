# Plan

## Milestone 1: Stabilize Core Chat Capabilities

Status: in progress.

- Long-term memory can be stored locally, searched by the model, and updated through validated memory operations.
- Multimodal attachments support image and text-like inputs with tested conversion and rejection paths.
- Auto routing has a dedicated router module with coverage for vision, code, deep reasoning, tools, and Traditional Chinese prompts.
- MCP support includes Streamable HTTP initialization, tool listing, tool calling, and collision-safe tool registration.

## Milestone 2: Improve Observability and UX

Status: in progress.

- Show routing decisions clearly enough for users to trust model selection. Initial route chips are implemented for auto/fallback assistant messages.
- Make tool execution state, failures, and outputs easier to inspect without overwhelming the chat. Initial status badges and MCP output formatting are implemented.
- Improve settings safety for API keys, MCP headers, and draft cancellation.
- Record screenshots in `screenshots/` when UI changes are visually validated.

## Milestone 3: Expand Agentic Workflows

Status: planned.

- Add richer tool routing and tool result summarization.
- Add safer memory review and conflict handling.
- Add stronger import/export paths for conversations, settings, and memories.
- Add end-to-end checks for the highest-value user flows.
