import { ZodError, z } from "zod";

import {
  mcpServerConfigSchema,
  testMcpServerConnection,
} from "@/lib/mcp";

export const maxDuration = 15;

const mcpConnectionTestRequestSchema = z
  .object({
    server: mcpServerConfigSchema,
    timeoutMs: z.number().int().min(500).max(10_000).default(5_000),
  })
  .superRefine((body, context) => {
    if (!body.server.url.trim()) {
      context.addIssue({
        code: "custom",
        message: "MCP server URL is required.",
        path: ["server", "url"],
      });
    }
  });

export async function POST(request: Request) {
  try {
    const body = mcpConnectionTestRequestSchema.parse(await request.json());
    const result = await testMcpServerConnection(
      { ...body.server, enabled: true },
      { timeoutMs: body.timeoutMs },
    );

    return Response.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        {
          message: error.issues[0]?.message ?? "Invalid MCP server settings.",
          ok: false,
          toolCount: 0,
          tools: [],
        },
        { status: 400 },
      );
    }

    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "MCP connection test failed.",
        ok: false,
        toolCount: 0,
        tools: [],
      },
      { status: 500 },
    );
  }
}
