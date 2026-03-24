import { expect, test, type Page } from "@playwright/test";

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
