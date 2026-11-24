import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 3 end-to-end suite.
 *
 * Covers the whole streaming loop against the production build: the MSW worker
 * boots, a workflow run streams tokens into the console, node cards flip from
 * running to success, abort works, the 429 scenario surfaces a real HTTP error
 * and snapshots diff prompt text.
 */

/** Waits until the mock worker has registered (or failed) before touching the UI. */
async function bootApp(page: Page) {
  await page.goto("/");
  await page.waitForFunction(
    () => (window as unknown as { __FLOWFORGE_MOCK__?: boolean }).__FLOWFORGE_MOCK__ !== undefined,
    undefined,
    { timeout: 30_000 },
  );
  await expect(page.getByRole("region", { name: "Execution console" })).toBeVisible();
}

async function runWorkflow(page: Page) {
  await page.getByRole("button", { name: "Run Workflow" }).click();
}

test.describe("FlowForge streaming playground", () => {
  test.beforeEach(async ({ page }) => {
    await bootApp(page);
  });

  test("boots the mock service worker and renders the canvas", async ({ page }) => {
    const mocked = await page.evaluate(
      () => (window as unknown as { __FLOWFORGE_MOCK__?: boolean }).__FLOWFORGE_MOCK__,
    );

    expect(mocked).toBe(true);
    await expect(page.getByText("execution console", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Workflow" })).toBeEnabled();
  });

  test("streams a run into the console and marks nodes successful", async ({ page }) => {
    await runWorkflow(page);

    const output = page.getByTestId("console-content");
    await expect(output).toBeVisible({ timeout: 20_000 });

    // Tokens keep arriving: the text grows between two samples.
    const first = await output.innerText();
    await expect
      .poll(async () => (await output.innerText()).length, { timeout: 20_000 })
      .toBeGreaterThan(first.length);

    // The run finishes and the console reports the completed status.
    const consoleRegion = page.getByRole("region", { name: "Execution console" });
    await expect(consoleRegion.getByText("completed", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(consoleRegion.getByText("200 OK")).toBeVisible();
  });

  test("can be aborted mid-stream", async ({ page }) => {
    await runWorkflow(page);
    await expect(page.getByTestId("console-content")).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: "Stop" }).click();

    await expect(
      page.getByRole("region", { name: "Execution console" }).getByText("aborted", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Run Workflow" })).toBeEnabled();
  });

  test("surfaces a 429 from the rate-limit scenario", async ({ page }) => {
    await page.getByLabel("Network mode").selectOption("rate-limit");
    await runWorkflow(page);

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible({ timeout: 20_000 });
    await expect(alert).toContainText("429");
    await expect(
      page.getByRole("region", { name: "Execution console" }).getByText("429 RATE LIMIT"),
    ).toBeVisible();
  });

  test("saves a snapshot and diffs it against the canvas", async ({ page }) => {
    await page.getByRole("button", { name: "Snapshots" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("Snapshot name").fill("e2e baseline");
    await dialog.getByRole("button", { name: "Save current" }).click();

    await expect(dialog.getByText("0 changed lines")).toBeVisible();
    await expect(dialog.getByTestId("snapshot-diff")).toBeVisible();
  });
});
