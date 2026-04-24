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

  await expect(page.getByText("Attach up to 4 files")).toBeVisible();
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

test("exports memories and MCP settings without the OpenRouter key", async ({
  page,
}) => {
  await page.goto("/");

  await configureLocalKey(page);
  await sendPrompt(page, "i am a student from nycu");
  await page.getByRole("button", { name: "Review memory" }).click();

  await page.getByRole("button", { name: "Add server" }).click();
  await page.getByPlaceholder("GitHub MCP").fill("Fixture MCP");
  await page.getByPlaceholder("https://example.com/mcp").fill("https://example.com/mcp");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-settings-backup-button").click();
  const download = await downloadPromise;
  const downloadPath = await download.path();

  expect(download.suggestedFilename()).toMatch(/^tl-chat-settings-\d{4}-\d{2}-\d{2}\.json$/);
  expect(downloadPath).toBeTruthy();

  const backup = JSON.parse(await readFile(downloadPath!, "utf8")) as {
    mcpServers: Array<{ name: string; url: string }>;
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
  expect(backup.mcpServers).toEqual([
    expect.objectContaining({
      name: "Fixture MCP",
      url: "https://example.com/mcp",
    }),
  ]);
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
