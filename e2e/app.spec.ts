import { expect, test } from "@playwright/test";

test("can save a key, send a prompt, and persist history", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Your own calm AI corner.")).toBeVisible();

  await page.getByTestId("header-settings-button").click();
  await expect(page.getByTestId("settings-panel")).toBeVisible();

  await page.getByTestId("api-key-input").fill("sk-or-v1-playwright-local-key");
  await page.getByTestId("save-settings-button").click();

  await page.getByTestId("composer-input").fill("Write a tiny launch checklist.");
  await page.getByTestId("send-button").click();

  await expect(
    page.getByText(
      "Mock reply from openai/gpt-5.4-mini: Write a tiny launch checklist.",
    ),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByText(
      "Mock reply from openai/gpt-5.4-mini: Write a tiny launch checklist.",
    ),
  ).toBeVisible();
  await expect(page.getByTestId("message-user")).toContainText(
    "Write a tiny launch checklist.",
  );
});

test("switches models and uses the selected provider in the response", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByTestId("header-settings-button").click();
  await page.getByTestId("api-key-input").fill("sk-or-v1-playwright-local-key");
  await page.getByTestId("save-settings-button").click();

  await page.getByTestId("model-select").selectOption("anthropic/claude-sonnet-4");
  await expect(page.getByTestId("model-select")).toHaveValue(
    "anthropic/claude-sonnet-4",
  );
  await page.getByTestId("composer-input").fill("Summarize the current provider.");
  await page.getByTestId("send-button").click();

  await expect(
    page.getByText(
      "Mock reply from anthropic/claude-sonnet-4: Summarize the current provider.",
    ),
  ).toBeVisible();
});

test("opens and closes the mobile sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.getByTestId("floating-sidebar-toggle").click({ force: true });
  await expect(page.getByTestId("close-sidebar-button")).toBeVisible();

  await page.getByTestId("close-sidebar-button").click();
  await expect(page.getByTestId("close-sidebar-button")).not.toBeVisible();
});
