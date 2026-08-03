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
  globalTimeout: 240_000,
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
    command: `pnpm run build && pnpm exec next start -H 127.0.0.1 -p ${port}`,
    env: {
      ...testEnvironment,
      NEXT_DIST_DIR: ".next-verify",
      NODE_ENV: "production",
    },
    gracefulShutdown: {
      signal: "SIGTERM",
      timeout: 5_000,
    },
    reuseExistingServer: false,
    stderr: "pipe",
    stdout: "pipe",
    timeout: 120_000,
    url: baseURL,
  },
  workers: 1,
});
