import { afterEach, describe, expect, it, vi } from "vitest";

import {
  callMcpTool,
  createMcpToolKey,
  discoverMcpTools,
  getActiveMcpServers,
  listMcpTools,
  type McpServerConfig,
} from "./mcp";

const server: McpServerConfig = {
  enabled: true,
  headers: {
    Authorization: "Bearer test-token",
  },
  id: "server-1",
  name: "Test MCP",
  url: "https://example.com/mcp",
};

function jsonRpcResponse(id: number | string, result: unknown, init?: ResponseInit) {
  return new Response(
    JSON.stringify({
      id,
      jsonrpc: "2.0",
      result,
    }),
    {
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      status: init?.status,
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mcp client", () => {
  it("filters only enabled servers with usable name and url", () => {
    expect(
      getActiveMcpServers([
        server,
        { ...server, enabled: false, id: "disabled" },
        { ...server, id: "missing-url", url: "" },
        { ...server, id: "missing-name", name: " " },
      ]),
    ).toEqual([server]);
  });

  it("creates safe unique tool keys for MCP registration", () => {
    const usedKeys = new Set<string>();

    expect(
      createMcpToolKey({
        serverName: "GitHub MCP",
        toolName: "Get Issue",
        usedKeys,
      }),
    ).toBe("mcp_github_mcp__get_issue");
    expect(
      createMcpToolKey({
        serverName: "GitHub MCP",
        toolName: "Get Issue",
        usedKeys,
      }),
    ).toBe("mcp_github_mcp__get_issue_2");
    expect(
      createMcpToolKey({
        serverName: "!!!",
        toolName: "???",
        usedKeys,
      }),
    ).toBe("mcp_server__tool");
  });

  it("lists tools after initializing a streamable HTTP session", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          id?: number;
          method: string;
        };

        if (body.method === "initialize") {
          return jsonRpcResponse(
            body.id ?? 1,
            {
              protocolVersion: "2025-06-18",
              serverInfo: { name: "fixture", version: "1.0.0" },
            },
            {
              headers: {
                "Mcp-Session-Id": "session-123",
              },
            },
          );
        }

        if (body.method === "notifications/initialized") {
          return new Response(null, { status: 202 });
        }

        return new Response(
          [
            "data: " +
              JSON.stringify({
                id: body.id,
                jsonrpc: "2.0",
                result: {
                  tools: [
                    {
                      description: "Read issue details",
                      inputSchema: {
                        properties: {
                          id: { type: "string" },
                        },
                        required: ["id"],
                        type: "object",
                      },
                      name: "get_issue",
                    },
                  ],
                },
              }),
            "",
            "",
          ].join("\n"),
          {
            headers: {
              "content-type": "text/event-stream",
            },
          },
        );
      },
    );

    await expect(listMcpTools(server)).resolves.toMatchObject([
      {
        description: "Read issue details",
        name: "get_issue",
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        Authorization: "Bearer test-token",
        "Mcp-Method": "initialize",
      }),
      method: "POST",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      method: "initialize",
      params: {
        protocolVersion: "2025-11-25",
      },
    });
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        "MCP-Protocol-Version": "2025-11-25",
        "Mcp-Session-Id": "session-123",
        "Mcp-Method": "tools/list",
      }),
    });
  });

  it("keeps healthy MCP tools and reports partial discovery failures", async () => {
    const healthyServer = {
      ...server,
      id: "healthy-server",
      name: "Healthy MCP",
      url: "https://healthy.example.com/mcp",
    };
    const failingServer = {
      ...server,
      id: "failing-server",
      name: "Broken MCP",
      url: "https://broken.example.com/mcp",
    };

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).includes("broken.example.com")) {
        return new Response("unavailable", {
          status: 503,
          statusText: "Service Unavailable",
        });
      }

      const body = JSON.parse(String(init?.body ?? "{}")) as {
        id?: number;
        method: string;
      };

      if (body.method === "initialize") {
        return jsonRpcResponse(body.id ?? 1, {
          protocolVersion: "2025-06-18",
          serverInfo: { name: "fixture", version: "1.0.0" },
        });
      }

      if (body.method === "notifications/initialized") {
        return new Response(null, { status: 202 });
      }

      return jsonRpcResponse(body.id ?? 2, {
        tools: [
          {
            inputSchema: {
              type: "object",
            },
            name: "healthy_tool",
          },
        ],
      });
    });

    await expect(
      discoverMcpTools([healthyServer, failingServer], { timeoutMs: 1_000 }),
    ).resolves.toMatchObject({
      failures: [
        {
          message: expect.stringContaining("Service Unavailable"),
          serverName: "Broken MCP",
        },
      ],
      servers: [
        {
          server: healthyServer,
          tools: [
            {
              name: "healthy_tool",
            },
          ],
        },
      ],
    });
  });

  it("calls tools and extracts text content from MCP result blocks", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        id?: number;
        method: string;
      };

      if (body.method === "initialize") {
        return jsonRpcResponse(body.id ?? 1, {
          protocolVersion: "2025-06-18",
          serverInfo: { name: "fixture", version: "1.0.0" },
        });
      }

      if (body.method === "notifications/initialized") {
        return new Response(null, { status: 202 });
      }

      return jsonRpcResponse(body.id ?? 2, {
        content: [
          { text: "First line", type: "text" },
          { text: "Second line", type: "text" },
        ],
        structuredContent: {
          ok: true,
        },
      });
    });

    await expect(
      callMcpTool({
        args: { id: "issue-1" },
        server,
        toolName: "get_issue",
      }),
    ).resolves.toMatchObject({
      isError: false,
      structuredContent: { ok: true },
      text: "First line\n\nSecond line",
    });
  });
});
