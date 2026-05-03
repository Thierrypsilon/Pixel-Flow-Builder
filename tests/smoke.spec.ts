import { test, expect } from "@playwright/test";
import { TOOLS } from "../src/tools/registry";

const BASE = "/Pixel-Flow-Builder";

for (const tool of TOOLS) {
  test(`${tool.id} loads without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (tool.expectedConsoleErrors?.some((rx) => rx.test(text))) return;
      errors.push(`console: ${text}`);
    });

    await page.goto(`${BASE}${tool.path}`);
    await expect(
      page.locator('[data-testid="button-back-to-tools"]')
    ).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(1000);

    expect(
      errors,
      `Errors on ${tool.path}:\n${errors.join("\n")}`
    ).toEqual([]);
  });
}

test("home renders all tool cards", async ({ page }) => {
  await page.goto(`${BASE}/`);
  for (const tool of TOOLS) {
    await expect(
      page.locator(`[data-testid="card-tool-${tool.id}"]`)
    ).toBeVisible();
  }
});
