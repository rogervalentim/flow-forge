import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env["E2E_PORT"] ?? 4173);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Playwright config for the Phase 3 streaming playground.
 *
 * The suite runs against a production build (`vite build` + `vite preview`) so
 * the MSW service worker is exercised exactly as it ships in the Docker image.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: process.env["CI"] !== undefined,
  retries: process.env["CI"] !== undefined ? 2 : 0,
  workers: process.env["CI"] !== undefined ? 1 : undefined,
  reporter: process.env["CI"] !== undefined ? [["github"], ["list"]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],

  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: process.env["CI"] === undefined,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
