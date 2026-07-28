import { defineConfig } from "@playwright/test";

import { getTestEnvironment } from "./tests/helpers/test-environment";

const rootDirectory = process.cwd();
const testEnvironment = getTestEnvironment(rootDirectory);
const baseURL = process.env.E2E_BASE_URL ?? testEnvironment.APP_BASE_URL;

if (!baseURL || !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
  throw new Error("E2E_BASE_URL must target localhost or 127.0.0.1.");
}

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  testDir: "tests/e2e",
  use: {
    baseURL,
  },
  webServer: {
    command: "pnpm dev",
    env: {
      ...testEnvironment,
      MEET_BACKEND_E2E: process.env.MEET_BACKEND_E2E ?? "",
      NODE_ENV: "test",
    },
    reuseExistingServer: !process.env.CI,
    stderr: "pipe",
    timeout: 120 * 1000,
    url: baseURL,
  },
  projects: [
    { name: "chromium-smoke", testIgnore: /meeting-backend-real\.spec\.ts/ },
    { name: "chromium-backend", testMatch: /meeting-backend-real\.spec\.ts/ },
  ],
});
