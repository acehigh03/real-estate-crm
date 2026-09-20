import { expect, test } from "@playwright/test";

const hasAuthenticatedSession = Boolean(process.env.PLAYWRIGHT_STORAGE_STATE);

test.describe("Inbox command center", () => {
  test.skip(!hasAuthenticatedSession, "Set PLAYWRIGHT_STORAGE_STATE to run authenticated Inbox checks.");

  test("loads and supports safe no-send controls", async ({ page }) => {
    await page.goto("/inbox");

    await expect(page.getByRole("heading", { name: "Inbox", exact: true })).toBeVisible();

    const allTab = page.getByRole("tab", { name: /^All/ });
    if (await allTab.count()) {
      await allTab.click();
      await expect(allTab).toHaveAttribute("aria-selected", "true");
    }

    const thread = page.locator("button.command-conversation-row").first();
    if (await thread.count()) {
      await thread.click();
      const composer = page.locator("textarea");
      await expect(composer).toBeVisible();

      const quickReply = page.locator(".command-quick-reply").first();
      if (await quickReply.count()) {
        await quickReply.click();
        await expect(composer).not.toHaveValue("");
      }
    } else {
      await expect(page.getByText("No conversations yet")).toBeVisible();
    }
  });

  test("opens and closes the new-conversation composer without sending", async ({ page }) => {
    await page.goto("/inbox");
    const start = page.getByRole("button", { name: "Start conversation", exact: true }).first();
    await start.click();
    await expect(page.getByRole("heading", { name: "Start conversation" })).toBeVisible();
    await page.locator(".fixed.inset-0 button").first().click();
    await expect(page.getByRole("heading", { name: "Start conversation" })).toBeHidden();
  });
});
