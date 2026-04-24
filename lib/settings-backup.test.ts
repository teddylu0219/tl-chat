import {
  SETTINGS_BACKUP_VERSION,
  createSettingsBackup,
  parseSettingsBackup,
} from "./settings-backup";

describe("settings backup helpers", () => {
  it("creates a versioned backup for memories and MCP servers", () => {
    expect(
      createSettingsBackup({
        exportedAt: "2026-04-25T00:00:00.000Z",
        mcpServers: [
          {
            enabled: true,
            headers: {
              Authorization: "Bearer token",
            },
            id: "mcp_1",
            name: "GitHub MCP",
            url: "https://example.com/mcp",
          },
        ],
        memories: [
          {
            content: "User prefers concise answers.",
            createdAt: "2026-04-24T00:00:00.000Z",
            id: "memory_1",
            updatedAt: "2026-04-24T00:00:00.000Z",
          },
        ],
      }),
    ).toEqual({
      exportedAt: "2026-04-25T00:00:00.000Z",
      mcpServers: [
        {
          enabled: true,
          headers: {
            Authorization: "Bearer token",
          },
          id: "mcp_1",
          name: "GitHub MCP",
          url: "https://example.com/mcp",
        },
      ],
      memories: [
        {
          content: "User prefers concise answers.",
          createdAt: "2026-04-24T00:00:00.000Z",
          id: "memory_1",
          updatedAt: "2026-04-24T00:00:00.000Z",
        },
      ],
      version: SETTINGS_BACKUP_VERSION,
    });
  });

  it("parses backup JSON and defaults missing optional collections", () => {
    expect(
      parseSettingsBackup(
        JSON.stringify({
          exportedAt: "2026-04-25T00:00:00.000Z",
          version: SETTINGS_BACKUP_VERSION,
        }),
      ),
    ).toEqual({
      exportedAt: "2026-04-25T00:00:00.000Z",
      mcpServers: [],
      memories: [],
      version: SETTINGS_BACKUP_VERSION,
    });
  });

  it("rejects invalid backup payloads", () => {
    expect(() =>
      parseSettingsBackup({
        exportedAt: "not-a-date",
        version: SETTINGS_BACKUP_VERSION,
      }),
    ).toThrow();

    expect(() =>
      parseSettingsBackup({
        exportedAt: "2026-04-25T00:00:00.000Z",
        mcpServers: [
          {
            enabled: true,
            headers: {},
            id: "mcp_1",
            name: "Broken MCP",
            url: "not a url",
          },
        ],
        version: SETTINGS_BACKUP_VERSION,
      }),
    ).toThrow();
  });
});
