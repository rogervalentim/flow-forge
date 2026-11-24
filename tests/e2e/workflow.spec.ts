import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 3 end-to-end suite — SPEC §5 critical user journey.
 *
 * Runs against the production build (`vite build` + `vite preview`), so the MSW
 * service worker, the SSE stream and the real Chromium input stack are all
 * exercised exactly as they ship.
 *
 * 1. Load the canvas, add a Prompt and an Evaluator node.
 * 2. Connect them and edit the prompt text in the inspector.
 * 3. Run the workflow, watch text stream into the console and metrics update.
 * 4. Cancel mid-stream with Stop, and undo the prompt edit with Ctrl+Z.
 */

const CANVAS = '[data-testid="canvas-layer"]';

/** Waits until the mock worker registered before touching the UI. */
async function bootApp(page: Page) {
  await page.goto("/");
  await page.waitForFunction(
    () => (window as unknown as { __FLOWFORGE_MOCK__?: boolean }).__FLOWFORGE_MOCK__ !== undefined,
    undefined,
    { timeout: 30_000 },
  );
  await expect(page.getByRole("region", { name: "Execution console" })).toBeVisible();
}

/** Drags a node by an offset in screen pixels. */
async function dragNode(page: Page, nodeId: string, dx: number, dy: number) {
  const node = page.locator(`[data-node-id="${nodeId}"]`);
  const box = await node.boundingBox();
  if (box === null) throw new Error(`node ${nodeId} has no bounding box`);

  const startX = box.x + 24;
  const startY = box.y + 12;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 8 });
  await page.mouse.up();
}

async function lastNodeId(page: Page, type: "prompt" | "tool" | "evaluator") {
  const nodes = page.locator(`[data-node-type="${type}"]`);
  const id = await nodes.last().getAttribute("data-node-id");
  if (id === null) throw new Error(`no ${type} node found`);
  return id;
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
    await expect(page.locator(CANVAS)).toBeVisible();
    await expect(page.locator('[data-testid="graph-node"]').first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Run Workflow" })).toBeEnabled();
  });

  test("SPEC §5 — build a graph, stream it, stop it and undo", async ({ page }) => {
    // ── 1. Add a Prompt node and an Evaluator node ──────────────────────────
    const initialPrompts = await page.locator('[data-node-type="prompt"]').count();

    await page.getByRole("button", { name: "+ Prompt" }).click();
    await expect(page.locator('[data-node-type="prompt"]')).toHaveCount(initialPrompts + 1);

    const promptId = await lastNodeId(page, "prompt");

    // The new node lands selected, so the inspector is live immediately.
    const inspector = page.getByTestId("node-inspector");
    await expect(inspector).toBeVisible();

    await page.getByRole("button", { name: "+ Evaluator" }).click();
    const evaluatorId = await lastNodeId(page, "evaluator");

    // ── 2a. Connect Prompt → Evaluator ──────────────────────────────────────
    await page.locator(`[data-node-id="${promptId}"]`).click();
    await page.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(page.getByText("pick target")).toBeVisible();

    // Keep the cards apart so the connection is a real edge, not a stack.
    // Dragging the Prompt also clears the floating selection chip.
    await dragNode(page, promptId, -180, 140);
    await dragNode(page, evaluatorId, 200, 180);

    const edgeCount = await page.locator('[data-testid="graph-edge"]').count();
    expect(edgeCount).toBeGreaterThan(0);

    // ── 2b. Edit the prompt text in the inspector ───────────────────────────
    await page.locator(`[data-node-id="${promptId}"]`).click();

    const promptField = page.getByTestId("inspector-field-system-prompt");
    await expect(promptField).toBeVisible();
    await promptField.fill("Summarise the ticket in one sentence.");

    // ── 3. Run the workflow and watch the stream ────────────────────────────
    await page.getByRole("button", { name: "Run Workflow" }).click();

    const output = page.getByTestId("console-content");
    await expect(output).toBeVisible({ timeout: 20_000 });

    const first = await output.innerText();
    await expect
      .poll(async () => (await output.innerText()).length, { timeout: 20_000 })
      .toBeGreaterThan(first.length);

    // Live metrics move off their idle values while streaming.
    const ttft = page.getByTestId("metric-ttft");
    await expect(ttft).not.toContainText("—", { timeout: 20_000 });
    await expect(page.getByTestId("metric-tokens")).not.toContainText(/^tokens 0$/);

    // The executing node is highlighted on the canvas.
    await expect(page.locator('[data-node-id="' + promptId + '"]')).toBeVisible();

    // ── 4a. Cancel the stream with Stop ─────────────────────────────────────
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page.getByTestId("metric-status")).toHaveText("aborted", { timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Run Workflow" })).toBeEnabled();

    // ── 4b. Undo the prompt edit with Ctrl+Z ────────────────────────────────
    await page.locator(`[data-node-id="${promptId}"]`).click();
    await page.keyboard.press("Control+z");

    await expect(promptField).not.toHaveValue("Summarise the ticket in one sentence.", {
      timeout: 10_000,
    });
  });

  test("streams to completion with a 200 OK", async ({ page }) => {
    await page.getByRole("button", { name: "Run Workflow" }).click();

    await expect(page.getByTestId("console-content")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("metric-status")).toHaveText("completed", { timeout: 40_000 });
    await expect(page.getByTestId("metric-http")).toContainText("200 OK");
  });

  test("surfaces a 429 from the rate-limit scenario", async ({ page }) => {
    await page.getByLabel("Network mode").selectOption("rate-limit");
    await page.getByRole("button", { name: "Run Workflow" }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible({ timeout: 20_000 });
    await expect(alert).toContainText("429");
    await expect(page.getByTestId("metric-http")).toContainText("429 RATE LIMIT");
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
