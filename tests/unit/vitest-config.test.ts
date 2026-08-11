import { describe, expect, it } from "vitest";

import config from "../../vitest.config";
import packageJson from "../../package.json";

describe("Vitest configuration", () => {
  it("rejects focused tests in every environment", () => {
    expect(config.test?.allowOnly).toBe(false);
  });

  it("keeps coverage and focused-test checks in the CI path", () => {
    expect(config.test?.coverage).toMatchObject({
      provider: "v8",
      reporter: ["text-summary", "json", "html"],
      thresholds: { branches: 25, functions: 35, lines: 40, statements: 40 },
    });
    expect(packageJson.scripts["test:focus-check"]).toContain("assert-no-focused-tests");
    expect(config.test?.exclude).toContain("tests/e2e/**/*.spec.ts");
    expect(packageJson.scripts["test:ci"]).toBe(
      "pnpm test:focus-check && pnpm test:unit && pnpm test:service && pnpm test:api && pnpm test:integration",
    );
  });
});
