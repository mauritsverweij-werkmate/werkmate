/**
 * Playwright config voor de WerkMate demo-video.
 * Draai: npx playwright test --config playwright.demo.config.ts
 * Output: demo-videos/*.webm
 */

import { defineConfig } from "@playwright/test";
import { existsSync, readFileSync } from "fs";

if (existsSync(".env.test")) {
  for (const line of readFileSync(".env.test", "utf8").split("\n")) {
    const [k, ...v] = line.trim().split("=");
    if (k && !k.startsWith("#") && !process.env[k]) process.env[k] = v.join("=");
  }
}

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  testMatch: "**/demo.spec.ts",
  timeout: 420_000,
  retries: 0,
  reporter: [["line"]],
  use: {
    baseURL: "http://localhost:5173",
    headless: false,
    viewport: { width: 1280, height: 800 },
    storageState: "e2e/.auth/session.json",
    screenshot: "off",
    recordVideo: {
      dir: "demo-videos/",
      size: { width: 1280, height: 800 },
    },
    launchOptions: { slowMo: 0 },
  },
  projects: [{ name: "chromium" }],
});
