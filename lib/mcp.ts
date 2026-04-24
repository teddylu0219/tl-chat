import { z } from "zod";

const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;

const mcpContentBlockSchema = z
  .object({
    text: z.string().optional(),
    type: z.string(),
  })
  .passthrough();

const mcpToolSchema = z
  .object({
    _meta: z.record(z.string(), z.unknown()).optional(),
    annotations: z
      .object({
        destructiveHint: z.boolean().optional(),
        idempotentHint: z.boolean().optional(),
        openWorldHint: z.boolean().optional(),
        readOnlyHint: z.boolean().optional(),
        title: z.string().optional(),
      })
      .optional(),
    description: z.string().optional(),
    inputSchema: z
      .object({
        properties: z.record(z.string(), z.unknown()).optional(),
        required: z.array(z.string()).optional(),
        type: z.literal("object"),
      })
      .passthrough(),
    name: z.string().min(1),
    title: z.string().optional(),
  })
  .passthrough();

const mcpJsonRpcResponseSchema = z
  .object({
    error: z
      .object({
        code: z.number(),
        data: z.unknown().optional(),
        message: z.string(),
      })
      .optional(),
    id: z.union([z.number(), z.string(), z.null()]).optional(),
    jsonrpc: z.literal("2.0"),
    result: z.unknown().optional(),
  })
  .passthrough();

export const mcpServerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  headers: z.record(z.string(), z.string()).default({}),
  id: z.string().trim().min(1),
  name: z.string().trim().min(1, "MCP server name is required."),
  url: z
    .string()
    .trim()
    .refine((value) => {
      if (!value) {
        return true;
      }

      return URL.canParse(value);
    }, "MCP server URL must be a valid URL."),
});

export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>;
export type McpToolDefinition = z.infer<typeof mcpToolSchema>;
export type McpDiscoveryFailure = {
  message: string;
  serverName: string;
};
export type McpDiscoveryResult = {
  failures: McpDiscoveryFailure[];
  servers: Array<{
    server: McpServerConfig;
    tools: McpToolDefinition[];
  }>;
};

type JsonRpcRequest = {
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
};

type McpSession = {
  protocolVersion: string;
  sessionId?: string;
};

function nextRequestId() {
  return Math.floor(Math.random() * 1_000_000_000);
}

function getUnknownErrorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "Unknown MCP discovery error.";
}

function withTimeout<T>({
  message,
  promise,
  timeoutMs,
}: {
  message: string;
  promise: Promise<T>;
  timeoutMs: number;
}) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function parseSseResponse(text: string) {
  const events = text
    .split(/\r?\n\r?\n/)
    .map((chunk) =>
      chunk
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s?/, ""))
        .join("\n"),
    )
    .filter(Boolean);

  return events.flatMap((event) => {
    const parsed = JSON.parse(event);
    return Array.isArray(parsed) ? parsed : [parsed];
  });
}

async function readJsonRpcResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (response.status === 202 || response.status === 204) {
    return [];
  }

  if (contentType.includes("text/event-stream")) {
    const text = await response.text();
    return parseSseResponse(text).map((entry) =>
      mcpJsonRpcResponseSchema.parse(entry),
    );
  }

  const text = await response.text();

  if (!text.trim()) {
    return [];
  }

  const parsed = JSON.parse(text);
  const entries = Array.isArray(parsed) ? parsed : [parsed];

  return entries.map((entry) => mcpJsonRpcResponseSchema.parse(entry));
}

function buildHeaders({
  method,
  name,
  protocolVersion,
  server,
  sessionId,
}: {
  method: string;
  name?: string;
  protocolVersion?: string;
  server: McpServerConfig;
  sessionId?: string;
}) {
  return {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    ...(protocolVersion ? { "MCP-Protocol-Version": protocolVersion } : {}),
    ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    ...(name ? { "Mcp-Name": name } : {}),
    "Mcp-Method": method,
    ...server.headers,
  };
}

async function postJsonRpc({
  protocolVersion,
  request,
  server,
  sessionId,
}: {
  protocolVersion?: string;
  request: JsonRpcRequest;
  server: McpServerConfig;
  sessionId?: string;
}) {
  const response = await fetch(server.url, {
    body: JSON.stringify({
      id: request.id,
      jsonrpc: "2.0",
      method: request.method,
      ...(request.params ? { params: request.params } : {}),
    }),
    headers: buildHeaders({
      method: request.method,
      name:
        request.method === "tools/call"
          ? String(request.params?.name ?? "")
          : undefined,
      protocolVersion,
      server,
      sessionId,
    }),
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(
      `MCP ${request.method} failed for ${server.name}: ${response.status} ${response.statusText}`,
    );
  }

  const messages = await readJsonRpcResponse(response);
  const matching =
    request.id == null
      ? undefined
      : messages.find((message) => message.id === request.id);

  if (matching?.error) {
    throw new Error(
      `MCP ${request.method} failed for ${server.name}: ${matching.error.message}`,
    );
  }

  return {
    response,
    result: matching?.result,
  };
}

async function initializeSession(server: McpServerConfig): Promise<McpSession> {
  let lastError: unknown;

  for (const protocolVersion of SUPPORTED_PROTOCOL_VERSIONS) {
    try {
      const requestId = nextRequestId();
      const { response, result } = await postJsonRpc({
        request: {
          id: requestId,
          method: "initialize",
          params: {
            capabilities: {},
            clientInfo: {
              name: "tl.chat",
              version: "0.1.0",
            },
            protocolVersion,
          },
        },
        server,
      });

      if (!result || typeof result !== "object") {
        throw new Error("MCP initialize returned no result.");
      }

      const sessionId = response.headers.get("Mcp-Session-Id") ?? undefined;

      await postJsonRpc({
        protocolVersion,
        request: {
          method: "notifications/initialized",
        },
        server,
        sessionId,
      });

      return {
        protocolVersion,
        sessionId,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to initialize MCP server ${server.name}.`);
}

function extractToolTextContent(content: unknown) {
  const parsed = z.array(mcpContentBlockSchema).safeParse(content);

  if (!parsed.success) {
    return [];
  }

  return parsed.data
    .map((block) => block.text?.trim())
    .filter((value): value is string => Boolean(value));
}

function slugifyToolName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function createMcpToolKey({
  serverName,
  toolName,
  usedKeys,
}: {
  serverName: string;
  toolName: string;
  usedKeys: Set<string>;
}) {
  const serverSlug = slugifyToolName(serverName) || "server";
  const toolSlug = slugifyToolName(toolName) || "tool";
  const baseKey = `mcp_${serverSlug}__${toolSlug}`;
  let candidate = baseKey;
  let suffix = 2;

  while (usedKeys.has(candidate)) {
    candidate = `${baseKey}_${suffix}`;
    suffix += 1;
  }

  usedKeys.add(candidate);
  return candidate;
}

export function createMcpServerConfig(): McpServerConfig {
  return {
    enabled: true,
    headers: {},
    id: crypto.randomUUID(),
    name: "New MCP server",
    url: "",
  };
}

export function getActiveMcpServers(servers: McpServerConfig[]) {
  return servers.filter(
    (server) => server.enabled && server.name.trim() && server.url.trim(),
  );
}

export async function discoverMcpTools(
  servers: McpServerConfig[],
  { timeoutMs = 8_000 }: { timeoutMs?: number } = {},
): Promise<McpDiscoveryResult> {
  const discovered = await Promise.all(
    getActiveMcpServers(servers).map(async (server) => {
      try {
        const tools = await withTimeout({
          message: `MCP tool discovery timed out after ${timeoutMs}ms.`,
          promise: listMcpTools(server),
          timeoutMs,
        });

        return {
          server,
          tools,
        };
      } catch (error) {
        return {
          failure: {
            message: getUnknownErrorMessage(error),
            serverName: server.name,
          },
        };
      }
    }),
  );

  return discovered.reduce<McpDiscoveryResult>(
    (result, item) => {
      if ("failure" in item && item.failure) {
        result.failures.push(item.failure);
        return result;
      }

      result.servers.push(item);
      return result;
    },
    { failures: [], servers: [] },
  );
}

export async function listMcpTools(server: McpServerConfig) {
  const session = await initializeSession(server);
  const tools: McpToolDefinition[] = [];
  let cursor: string | undefined;

  do {
    const requestId = nextRequestId();
    const { result } = await postJsonRpc({
      protocolVersion: session.protocolVersion,
      request: {
        id: requestId,
        method: "tools/list",
        ...(cursor ? { params: { cursor } } : {}),
      },
      server,
      sessionId: session.sessionId,
    });

    const parsed = z
      .object({
        nextCursor: z.string().optional(),
        tools: z.array(mcpToolSchema),
      })
      .parse(result);

    tools.push(...parsed.tools);
    cursor = parsed.nextCursor;
  } while (cursor);

  return tools;
}

export async function callMcpTool({
  args,
  server,
  toolName,
}: {
  args: Record<string, unknown>;
  server: McpServerConfig;
  toolName: string;
}) {
  const session = await initializeSession(server);
  const requestId = nextRequestId();
  const { result } = await postJsonRpc({
    protocolVersion: session.protocolVersion,
    request: {
      id: requestId,
      method: "tools/call",
      params: {
        arguments: args,
        name: toolName,
      },
    },
    server,
    sessionId: session.sessionId,
  });

  const parsed = z
    .object({
      content: z.array(mcpContentBlockSchema).default([]),
      isError: z.boolean().optional(),
      structuredContent: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough()
    .parse(result);

  return {
    content: parsed.content,
    isError: parsed.isError ?? false,
    structuredContent: parsed.structuredContent,
    text: extractToolTextContent(parsed.content).join("\n\n"),
  };
}
