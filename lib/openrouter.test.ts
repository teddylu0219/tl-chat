import {
  appendOpenRouterPdfPlugin,
  appendOpenRouterWebTools,
  transformOpenRouterRequestBody,
} from "./openrouter";

describe("OpenRouter helpers", () => {
  it("appends server-side web search and fetch tools without dropping existing tools", () => {
    expect(
      appendOpenRouterWebTools({
        tools: [
          {
            function: { name: "remember_memory" },
            type: "function",
          },
        ],
      }),
    ).toMatchObject({
      tool_choice: "auto",
      tools: [
        {
          function: { name: "remember_memory" },
          type: "function",
        },
        {
          parameters: {
            max_results: 5,
            max_total_results: 10,
            search_context_size: "medium",
          },
          type: "openrouter:web_search",
        },
        {
          parameters: {
            max_content_tokens: 50_000,
            max_uses: 5,
          },
          type: "openrouter:web_fetch",
        },
      ],
    });
  });

  it("adds the OpenRouter PDF parser plugin with the free engine", () => {
    expect(appendOpenRouterPdfPlugin({})).toMatchObject({
      plugins: [
        {
          id: "file-parser",
          pdf: {
            engine: "cloudflare-ai",
          },
        },
      ],
    });
  });

  it("combines PDF parsing and web tools in one request transform", () => {
    expect(
      transformOpenRouterRequestBody({
        requestBody: {
          tools: [{ function: { name: "search_memories" }, type: "function" }],
        },
        webToolsEnabled: true,
      }),
    ).toMatchObject({
      plugins: [
        {
          id: "file-parser",
          pdf: {
            engine: "cloudflare-ai",
          },
        },
      ],
      tools: [
        { function: { name: "search_memories" }, type: "function" },
        { type: "openrouter:web_search" },
        { type: "openrouter:web_fetch" },
      ],
    });
  });
});
