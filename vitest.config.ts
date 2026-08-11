import path from "node:path";

import { configDefaults, defineConfig } from "vitest/config";

import { getTestEnvironment } from "./tests/helpers/test-environment";

const rootDirectory = process.cwd();

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "src"),
    },
  },
  test: {
    environment: "node",
    env: getTestEnvironment(rootDirectory),
    globals: false,
    pool: "forks",
    setupFiles: ["tests/setup.ts"],
    allowOnly: false,
    exclude: [...configDefaults.exclude, "tests/e2e/**/*.spec.ts"],
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.d.ts"],
      provider: "v8",
      reporter: ["text-summary", "json", "html"],
      thresholds: {
        branches: 25,
        functions: 35,
        lines: 40,
        statements: 40,
      },
    },
  },
});
