import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const TEST_FIREBASE_PROJECT_ID = "demo-noir-portfolio";

const PRODUCTION_FIREBASE_PROJECT_ID = "noir-portfolio-f8f20";
const FORBIDDEN_TEST_CREDENTIAL_KEYS = [
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS",
] as const;

export type TestEnvironment = Record<string, string>;

export function getTestEnvironment(rootDirectory = process.cwd()): TestEnvironment {
  const testEnvironmentPath = path.join(rootDirectory, ".env.test");

  if (!existsSync(testEnvironmentPath)) {
    throw new Error("Missing .env.test. Copy .env.test.example before running tests.");
  }

  const testEnvironment = parseEnvironmentFile(testEnvironmentPath);
  assertSafeTestEnvironment(testEnvironment);

  return testEnvironment;
}

function parseEnvironmentFile(filePath: string): TestEnvironment {
  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim() !== "" && !line.trim().startsWith("#"))
      .map((line) => {
        const separatorIndex = line.indexOf("=");

        if (separatorIndex === -1) {
          throw new Error(`Invalid test environment line: ${line}`);
        }

        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^(["'])(.*)\1$/, "$2");
        return [key, value];
      }),
  );
}

export function applyTestEnvironment(rootDirectory = process.cwd()): TestEnvironment {
  const testEnvironment = getTestEnvironment(rootDirectory);
  Object.assign(process.env, testEnvironment, { NODE_ENV: "test" });
  return testEnvironment;
}

export function assertSafeTestEnvironment(testEnvironment: TestEnvironment): void {
  const projectId = testEnvironment.FIREBASE_PROJECT_ID;

  if (projectId === PRODUCTION_FIREBASE_PROJECT_ID) {
    throw new Error("Tests must never use the production Firebase project.");
  }

  if (projectId !== TEST_FIREBASE_PROJECT_ID) {
    throw new Error(
      `Unsafe Firebase project for tests: expected ${TEST_FIREBASE_PROJECT_ID}, received ${projectId ?? "unset"}.`,
    );
  }

  if (!testEnvironment.FIRESTORE_EMULATOR_HOST) {
    throw new Error("FIRESTORE_EMULATOR_HOST must be set for every test run.");
  }

  for (const key of FORBIDDEN_TEST_CREDENTIAL_KEYS) {
    if (testEnvironment[key] || process.env[key]) {
      throw new Error(`Test environment must not include Firebase credentials (${key}).`);
    }
  }

  if (
    testEnvironment.RESEND_API_KEY ||
    testEnvironment.GOOGLE_REFRESH_TOKEN ||
    process.env.RESEND_API_KEY ||
    process.env.GOOGLE_REFRESH_TOKEN
  ) {
    throw new Error("Test environment must not include live Resend or Google Calendar credentials.");
  }
}
