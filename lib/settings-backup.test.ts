import {
  SETTINGS_BACKUP_VERSION,
  createSettingsBackup,
  parseSettingsBackup,
} from "./settings-backup";

describe("settings backup helpers", () => {
  it("creates a versioned backup for memories", () => {
    expect(
      createSettingsBackup({
        exportedAt: "2026-04-25T00:00:00.000Z",
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
      memories: [],
      version: SETTINGS_BACKUP_VERSION,
    });
  });

  it("ignores legacy MCP server fields in old backup files", () => {
    expect(
      parseSettingsBackup({
        exportedAt: "2026-04-25T00:00:00.000Z",
        mcpServers: [
          {
            enabled: true,
            headers: {},
            id: "mcp_1",
            name: "Legacy MCP",
            url: "https://example.com/mcp",
          },
        ],
        version: SETTINGS_BACKUP_VERSION,
      }),
    ).toEqual({
      exportedAt: "2026-04-25T00:00:00.000Z",
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
        memories: [{ content: "", createdAt: "", id: "", updatedAt: "" }],
        version: SETTINGS_BACKUP_VERSION,
      }),
    ).toThrow();
  });
});
