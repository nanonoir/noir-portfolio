import { defineConfig } from "@playwright/test";

import { getTestEnvironment } from "./tests/helpers/test-environment";

const port = Number(process.env.E2E_VERIFY_PORT ?? 3007);
const baseURL = `http://127.0.0.1:${port}`;
const testEnvironment = getTestEnvironment(process.cwd());

export default defineConfig({
  expect: {
    timeout: 5_000,
  },
  forbidOnly: true,
  fullyParallel: false,
  globalTimeout: 120_000,
  projects: [
    {
      name: "chromium-foundation",
      use: { browserName: "chromium" },
    },
  ],
  reporter: [["list"]],
  retries: 0,
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    actionTimeout: 5_000,
    baseURL,
    navigationTimeout: 15_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: {
    command: `pnpm exec next dev -H 127.0.0.1 -p ${port}`,
    env: {
      ...testEnvironment,
      NODE_ENV: "test",
    },
    gracefulShutdown: {
      signal: "SIGTERM",
      timeout: 5_000,
    },
    reuseExistingServer: false,
    stderr: "pipe",
    stdout: "pipe",
    timeout: 30_000,
    url: baseURL,
  },
  workers: 1,
});
