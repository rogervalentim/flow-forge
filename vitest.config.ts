import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./vitest.setup.ts"],
      css: false,
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      reporters: process.env["CI"] === "true" ? ["default", "junit"] : ["default"],
      outputFile: { junit: "./reports/vitest-junit.xml" },
    },
  }),
);
