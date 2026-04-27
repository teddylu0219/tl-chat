import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function configureLocalKey(page: Page) {
  await page.getByTestId("header-settings-button").click();
  await expect(page.getByTestId("settings-panel")).toBeVisible();
  await page.getByTestId("api-key-input").fill("sk-or-v1-playwright-local-key");
  await page.getByTestId("save-settings-button").click();
}

async function sendPrompt(page: Page, prompt: string) {
  await page.getByTestId("composer-input").fill(prompt);
  await page.getByTestId("send-button").click();

  await expect(page.getByTestId("message-user").last()).toContainText(prompt);
  await expect(page.getByTestId("message-assistant").last()).toContainText(
    prompt,
  );
}

async function openHeaderActions(page: Page) {
  await page.getByTestId("active-conversation-actions").click();
}

function conversationItems(page: Page) {
  return visibleSidebar(page).locator('[data-testid^="conversation-item-"]');
}

function visibleSidebar(page: Page) {
  return page.locator('[data-testid="chat-sidebar"]:visible');
}

test("discards canceled settings drafts and persists saved settings", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByTestId("composer-input")).toBeVisible();
  await page.getByTestId("header-settings-button").click();
  await expect(page.getByTestId("settings-panel")).toBeVisible();
  await page.getByTestId("api-key-input").fill("sk-or-v1-unsaved-key");
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByTestId("settings-panel")).toHaveCount(0);
  await page.getByTestId("header-settings-button").click();
  await expect(page.getByTestId("api-key-input")).toHaveValue("");

  await page.getByTestId("api-key-input").fill("sk-or-v1-saved-key");
  await page.getByTestId("save-settings-button").click();

  await expect(page.getByTestId("settings-panel")).toHaveCount(0);
  await page.getByTestId("header-settings-button").click();
  await expect(page.getByTestId("api-key-input")).toHaveValue("sk-or-v1-saved-key");
});

test("keeps custom model settings simple and defaults capabilities on", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByTestId("header-settings-button").click();
  await expect(page.getByTestId("settings-panel")).toBeVisible();

  await page.getByLabel("Custom model id").fill("custom/omni-router");
  await expect(page.getByTestId(/^custom-model-capability-/)).toHaveCount(0);

  await page.getByTestId("save-settings-button").click();

  await expect(page.getByTestId("settings-panel")).toHaveCount(0);
  await page.getByTestId("header-settings-button").click();
  await expect(page.getByLabel("Custom model id")).toHaveValue(
    "custom/omni-router",
  );
  await expect(page.getByTestId(/^custom-model-capability-/)).toHaveCount(0);

  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByTestId("model-select").selectOption("custom/omni-router");

  const activeCapabilities = page.getByTestId("active-model-capabilities");
  await expect(activeCapabilities).toContainText("Vision");
  await expect(activeCapabilities).toContainText("Tools");
  await expect(activeCapabilities).toContainText("Code");
  await expect(activeCapabilities).toContainText("Reasoning");
});

test("renders HEIC previews and keeps the composer quiet", async ({
  page,
}) => {
  const previewUrl =
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDgwIDgwIj48cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9IiM5ZTdlNjEiLz48Y2lyY2xlIGN4PSI0MCIgY3k9IjQwIiByPSIyMiIgZmlsbD0iI2YzZWVlNiIvPjwvc3ZnPg==";

  await page.route("**/api/attachment-preview", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ mediaType: "image/jpeg", previewUrl }),
      contentType: "application/json",
      status: 200,
    });
  });

  await page.goto("/");
  await configureLocalKey(page);

  await expect(page.getByTestId("tool-mcp-guide")).toHaveCount(0);
  await expect(page.getByText("Configure MCP")).toHaveCount(0);

  await page.getByTestId("composer-file-input").setInputFiles({
    buffer: Buffer.from("fake-heic-bytes"),
    mimeType: "image/heic",
    name: "IMG_3547.HEIC",
  });

  await expect(page.getByTestId("pending-attachment")).toContainText(
    "IMG_3547.HEIC",
  );
  await expect(page.getByTestId("pending-attachment").locator("img")).toBeVisible();

  await page.getByTestId("composer-input").fill("這是什麼");
  await page.getByTestId("send-button").click();

  const userMessage = page.getByTestId("message-user").last();
  await expect(
    userMessage.getByTestId("message-image-attachment").locator("img"),
  ).toHaveAttribute("src", previewUrl);
  await expect(page.getByText("Fallback route")).toHaveCount(0);
  await expect(page.getByText("GPT-5.4 Mini does not support image input.")).toHaveCount(
    0,
  );
  await expect(userMessage).toContainText("這是什麼");
  await expect(page.getByTestId("message-assistant").last()).toContainText(
    "Mock reply from google/gemini-2.5-flash",
  );
});

test("sends web-enabled chat requests from the composer toggle", async ({
  page,
}) => {
  let capturedRequest: { webSearchEnabled?: boolean } | null = null;

  await page.route("**/api/chat", async (route) => {
    capturedRequest = route.request().postDataJSON() as typeof capturedRequest;
    await route.continue();
  });

  await page.goto("/");
  await configureLocalKey(page);

  const webToggle = page.getByTestId("web-search-toggle");
  await expect(webToggle).toHaveAttribute("aria-pressed", "false");
  await webToggle.click();
  await expect(webToggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Web on")).toBeVisible();

  await page.getByTestId("composer-input").fill("今天的黃金價格是多少？");
  await page.getByTestId("send-button").click();

  await expect(page.getByTestId("message-assistant").last()).toContainText(
    "今天的黃金價格是多少？",
  );
  expect(capturedRequest).toMatchObject({ webSearchEnabled: true });
});

test("exports memories without the OpenRouter key", async ({
  page,
}) => {
  await page.goto("/");

  await configureLocalKey(page);
  await sendPrompt(page, "i am a student from nycu");
  await page.getByRole("button", { name: "Review memory" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-settings-backup-button").click();
  const download = await downloadPromise;
  const downloadPath = await download.path();

  expect(download.suggestedFilename()).toMatch(/^tl-chat-settings-\d{4}-\d{2}-\d{2}\.json$/);
  expect(downloadPath).toBeTruthy();

  const backup = JSON.parse(await readFile(downloadPath!, "utf8")) as {
    mcpServers?: unknown;
    memories: Array<{ content: string }>;
    openRouterApiKey?: string;
    version: number;
  };

  expect(backup.version).toBe(1);
  expect(backup.openRouterApiKey).toBeUndefined();
  expect(backup.memories).toEqual([
    expect.objectContaining({
      content: "User is a student from NYCU",
    }),
  ]);
  expect(backup.mcpServers).toBeUndefined();
});

test("imports memories while preserving the OpenRouter key", async ({
  page,
}) => {
  await page.goto("/");

  await configureLocalKey(page);
  await page.getByTestId("header-settings-button").click();

  const backup = {
    exportedAt: "2026-04-25T00:00:00.000Z",
    mcpServers: [
      {
        enabled: true,
        headers: {
          Authorization: "Bearer imported-token",
        },
        id: "imported_mcp",
        name: "Imported MCP",
        url: "https://imported.example.com/mcp",
      },
    ],
    memories: [
      {
        content: "User prefers imported backups.",
        createdAt: "2026-04-24T00:00:00.000Z",
        id: "imported_memory",
        updatedAt: "2026-04-24T00:00:00.000Z",
      },
    ],
    version: 1,
  };

  await page.getByTestId("import-settings-backup-input").setInputFiles({
    buffer: Buffer.from(JSON.stringify(backup)),
    mimeType: "application/json",
    name: "tl-chat-settings.json",
  });

  await expect(page.getByText("Imported 1 memories")).toBeVisible();
  await expect(
    page.getByText("User prefers imported backups.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Imported MCP")).toHaveCount(0);
  await expect(page.getByTestId("api-key-input")).toHaveValue(
    "sk-or-v1-playwright-local-key",
  );

  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByTestId("header-settings-button").click();
  await expect(
    page.getByText("User prefers imported backups.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Imported MCP")).toHaveCount(0);
});

test("rejects invalid settings backup imports without changing local settings", async ({
  page,
}) => {
  await page.goto("/");

  await configureLocalKey(page);
  await page.getByTestId("header-settings-button").click();

  const settingsPanel = page.getByTestId("settings-panel");
  const settingsError = settingsPanel.locator('[aria-live="polite"]');

  await page.getByTestId("import-settings-backup-input").setInputFiles({
    buffer: Buffer.from("{bad-json"),
    mimeType: "application/json",
    name: "broken-settings.json",
  });

  await expect(settingsError).toBeVisible();
  await expect(page.getByTestId("api-key-input")).toHaveValue(
    "sk-or-v1-playwright-local-key",
  );

  const invalidBackup = {
    exportedAt: "not-a-date",
    memories: [
      {
        content: "Should not import this invalid backup.",
        createdAt: "2026-04-24T00:00:00.000Z",
        id: "rejected_memory",
        updatedAt: "2026-04-24T00:00:00.000Z",
      },
    ],
    version: 999,
  };

  await page.getByTestId("import-settings-backup-input").setInputFiles({
    buffer: Buffer.from(JSON.stringify(invalidBackup)),
    mimeType: "application/json",
    name: "invalid-settings.json",
  });

  await expect(settingsError).toContainText("Invalid");
  await expect(page.getByTestId("api-key-input")).toHaveValue(
    "sk-or-v1-playwright-local-key",
  );
  await expect(
    settingsPanel.getByText("Should not import this invalid backup.", {
      exact: true,
    }),
  ).toHaveCount(0);
});

test("renames a thread and keeps it after refresh", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Start with a real question.")).toBeVisible();
  await configureLocalKey(page);
  await sendPrompt(page, "Plan a Kyoto coffee route.");

  await openHeaderActions(page);
  await page.getByTestId("active-conversation-actions-rename").click();
  await page.getByTestId("rename-thread-input").fill("Kyoto coffee map");
  await page.getByTestId("rename-thread-save").click();

  await expect(
    page.getByRole("heading", { name: "Kyoto coffee map" }),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Kyoto coffee map" }),
  ).toBeVisible();

  await page.getByTestId("sidebar-search-input").fill("Kyoto coffee map");
  await expect(conversationItems(page)).toHaveCount(1);
});

test("filters threads through search", async ({ page }) => {
  await page.goto("/");

  await configureLocalKey(page);
  await sendPrompt(page, "First note about roadmap");

  await page.getByTestId("new-chat-button").click();
  await expect(page.getByRole("heading", { name: "New thread" })).toBeVisible();
  await sendPrompt(page, "Second note about launch");

  await page.getByTestId("sidebar-search-input").fill("roadmap");
  await expect(conversationItems(page)).toHaveCount(1);
  await expect(conversationItems(page).first()).toContainText(
    "First note about roadmap",
  );
  await expect(
    visibleSidebar(page).getByTestId("conversation-search-highlight").first(),
  ).toHaveText("roadmap");
  await expect(visibleSidebar(page).getByTestId("sidebar-search-hint")).toContainText(
    "1 match",
  );

  await page.getByTestId("sidebar-search-input").press("ArrowDown");
  await expect(conversationItems(page).first()).toBeFocused();

  await page.getByTestId("sidebar-search-input").focus();
  await page.getByTestId("sidebar-search-input").press("Enter");
  await expect(
    page.getByRole("heading", { name: "First note about roadmap" }),
  ).toBeVisible();
});

test("saves durable memories from user facts", async ({ page }) => {
  await page.goto("/");

  await configureLocalKey(page);
  await sendPrompt(page, "i am a student from nycu");

  await expect(
    page.getByRole("button", { name: "Review memory" }),
  ).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Review memory" }).click();
  await expect(page.getByTestId("settings-panel")).toBeVisible();
  await expect(
    page.getByText("User is a student from NYCU", { exact: true }),
  ).toBeVisible();
});

test("saves chinese memories and remembers them on request", async ({ page }) => {
  await page.goto("/");

  await configureLocalKey(page);
  await sendPrompt(page, "我是交大的學生");
  await sendPrompt(page, "記住他");

  await page.getByTestId("header-settings-button").click();
  await expect(page.getByTestId("settings-panel")).toBeVisible();
  await expect(
    page.getByText(
      "User is a student at National Yang Ming Chiao Tung University (NYCU)",
      { exact: true },
    ),
  ).toBeVisible();
});

test("runs council mode with a host synthesis", async ({ page }) => {
  await page.goto("/");

  await configureLocalKey(page);
  await page.getByRole("button", { name: "New council" }).click();

  await expect(
    page.getByText("Multi-model discussion with a host.", { exact: true }),
  ).toBeVisible();

  await page
    .getByTestId("council-host-select")
    .selectOption({ label: "Gemini 2.5 Flash" });
  await page
    .getByTestId("council-composer-input")
    .fill("What do you think about relationships with AI?");
  await page.getByTestId("council-send-button").click();

  await expect(
    page.getByText("Gemini 2.5 Flash · Host synthesis · Round 1", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("returned no response")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Copy .* message/i }).first(),
  ).toBeVisible();
});

test("switches back to standard chat from an empty council thread", async ({
  page,
}) => {
  await page.goto("/");

  await configureLocalKey(page);
  await page.getByRole("button", { name: "New council" }).click();

  await expect(
    page.getByText("Multi-model discussion with a host.", { exact: true }),
  ).toBeVisible();

  await page.getByTestId("new-chat-button").click();

  await expect(page.getByText("Start with a real question.")).toBeVisible();
  await expect(
    page.getByText("Multi-model discussion with a host.", { exact: true }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "New council" }).click();

  await expect(
    page.getByText("Multi-model discussion with a host.", { exact: true }),
  ).toBeVisible();
});

test("archives and restores a thread", async ({ page }) => {
  await page.goto("/");

  await configureLocalKey(page);
  await sendPrompt(page, "Archive this thread please");

  await openHeaderActions(page);
  await page.getByTestId("active-conversation-actions-archive").click();

  await expect(page.getByRole("heading", { name: "New thread" })).toBeVisible();
  await page.getByTestId("header-settings-button").click();
  await expect(page.getByTestId("archived-threads-section")).toBeVisible();
  await page.getByRole("button", { name: "Restore" }).click();
  await page.getByTestId("save-settings-button").click();

  await expect(
    page.getByRole("heading", { name: "Archive this thread please" }),
  ).toBeVisible();
});

test("exports and deletes a thread", async ({ page }) => {
  await page.goto("/");

  await configureLocalKey(page);
  await sendPrompt(page, "Delete and export me");

  const downloadPromise = page.waitForEvent("download");
  await openHeaderActions(page);
  await page.getByTestId("active-conversation-actions-export").click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toContain("delete-and-export-me");

  await openHeaderActions(page);
  await page.getByTestId("active-conversation-actions-delete").click();
  await page.getByTestId("delete-thread-confirm").click();

  await expect(page.getByRole("heading", { name: "New thread" })).toBeVisible();
  await expect(
    page.getByText("Start a new chat to build your first thread."),
  ).toBeVisible();
});

test("renders code tools and references for rich answers", async ({ page }) => {
  await page.goto("/");

  await configureLocalKey(page);
  const richPrompt = [
    "Use this exact markdown:",
    "```ts",
    "const answer: number = 42;",
    "console.log(answer);",
    "```",
    "",
    "Check note[^1].",
    "",
    "[^1]: Local references should stay readable.",
  ].join("\n");

  await page.getByTestId("composer-input").fill(richPrompt);
  await page.getByTestId("send-button").click();

  const assistantMessage = page.getByTestId("message-assistant").last();

  await expect(assistantMessage).toContainText("Mock reply from");
  await expect(assistantMessage.getByText("ts", { exact: true })).toBeVisible();
  await expect(
    assistantMessage.getByRole("button", { name: "Copy code" }),
  ).toBeVisible();
  await expect(
    assistantMessage.getByText("References", { exact: true }),
  ).toBeVisible();
});

test("supports keyboard navigation in the thread list", async ({ page }) => {
  await page.goto("/");

  await configureLocalKey(page);
  await sendPrompt(page, "Keyboard navigation first thread");

  await page.getByTestId("new-chat-button").click();
  await expect(page.getByRole("heading", { name: "New thread" })).toBeVisible();
  await sendPrompt(page, "Keyboard navigation second thread");

  await expect(conversationItems(page)).toHaveCount(2);

  const items = conversationItems(page);

  await items.first().focus();
  await expect(items.first()).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(items.nth(1)).toBeFocused();

  await page.keyboard.press("Home");
  await expect(items.first()).toBeFocused();

  await page.keyboard.press("End");
  await expect(items.nth(1)).toBeFocused();
});

test("supports search and thread actions from the mobile sidebar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await configureLocalKey(page);
  await sendPrompt(page, "Mobile rename target");

  await page.getByTestId("floating-sidebar-toggle").click({ force: true });
  await expect(page.getByTestId("close-sidebar-button")).toBeVisible();

  await page.locator('[data-testid="sidebar-search-input"]:visible').fill("mobile");
  await expect(conversationItems(page)).toHaveCount(1);

  await visibleSidebar(page).locator('[data-testid^="conversation-actions-"]').first().click();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await page.getByTestId("rename-thread-input").fill("Mobile thread");
  await page.getByTestId("rename-thread-save").click();

  await expect(page.getByRole("heading", { name: "Mobile thread" })).toBeVisible();
});
