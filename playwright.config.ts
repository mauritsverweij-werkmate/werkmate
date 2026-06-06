import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "fs";

// Laad .env.test als het bestaat (nooit gecommit)
if (existsSync(".env.test")) {
  for (const line of readFileSync(".env.test", "utf8").split("\n")) {
    const [k, ...v] = line.trim().split("=");
    if (k && !k.startsWith("#") && !process.env[k]) process.env[k] = v.join("=");
  }
}

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "./e2e",
  timeout: 30000,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    headless: false,
    viewport: { width: 1280, height: 800 },
    storageState: "e2e/.auth/session.json",
    screenshot: "only-on-failure",
    video: "off",
    launchOptions: {
      slowMo: 200,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
