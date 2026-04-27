# TODO

## Active

- [ ] Add conversation backup export/import UI.
- [ ] Add per-model routing diagnostics explaining why Auto Router chose or rejected a model.
- [ ] Add saved prompt templates for common daily-driver workflows.
- [ ] Add memory conflict detection before applying automatic memory updates.
- [ ] Add source citations/summary styling for Web answers without exposing raw tool events.

## Done

- [x] Create repository control files for autonomous loop tracking.
- [x] Add visible route metadata chips for auto/fallback decisions in assistant messages.
- [x] Improve tool activity rendering so MCP failures and structured outputs are easier to scan.
- [x] Add Playwright coverage for settings save/cancel behavior.
- [x] Add a memory review affordance after automatic memory updates.
- [x] Add user-facing help text for attachment limits and supported file types near the composer.
- [x] Add timeout and partial failure summaries when some MCP servers fail during tool discovery.
- [x] Add backup schema helpers for memories and MCP server settings.
- [x] Add Settings UI export action for memories and MCP server settings.
- [x] Add Settings UI import action for memories and MCP server settings.
- [x] Add custom model capability flags in Settings so auto-routing can treat custom OpenRouter models accurately.
- [x] Add invalid backup import e2e coverage for rejected JSON/schema files.
- [x] Add e2e coverage for custom model capability persistence in Settings.
- [x] Add MCP server connectivity test action in Settings.
- [x] Add capability badges to model pickers and route metadata chips.
- [x] Add conversation search result highlighting and jump-to-thread keyboard support.
- [x] Fix real OpenRouter image uploads, HEIC fallback previews, and Tools/MCP composer guidance.
- [x] Add real HEIC previews and simplify chat/settings UI copy.
- [x] Replace Settings MCP configuration with a composer Web toggle backed by OpenRouter web search/fetch tools.
