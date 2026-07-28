import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const rootDirectory = process.cwd();
const testEnvironmentPath = path.join(rootDirectory, ".env.test");
const expectedProjectId = "demo-noir-portfolio";
const forbiddenCredentialKeys = [
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "GOOGLE_APPLICATION_CREDENTIALS",
];

if (!existsSync(testEnvironmentPath)) {
  throw new Error("Missing .env.test. Copy .env.test.example before running integration tests.");
}

const parsedEnvironment = Object.fromEntries(
  readFileSync(testEnvironmentPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "" && !line.trim().startsWith("#"))
    .map((line) => {
      const separatorIndex = line.indexOf("=");
      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      const value = rawValue.replace(/^(["'])(.*)\1$/, "$2");
      return [key, value];
    }),
);

if (parsedEnvironment.FIREBASE_PROJECT_ID !== expectedProjectId) {
  throw new Error(`Integration tests require FIREBASE_PROJECT_ID=${expectedProjectId}.`);
}

if (!parsedEnvironment.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Integration tests require FIRESTORE_EMULATOR_HOST.");
}

for (const key of forbiddenCredentialKeys) {
  if (parsedEnvironment[key] || process.env[key]) {
    throw new Error(`Integration tests refuse Firebase credentials (${key}).`);
  }
}

if (
  parsedEnvironment.RESEND_API_KEY ||
  parsedEnvironment.GOOGLE_REFRESH_TOKEN ||
  process.env.RESEND_API_KEY ||
  process.env.GOOGLE_REFRESH_TOKEN
) {
  throw new Error("Integration tests refuse environments containing live provider credentials.");
}

console.log(`Test environment guard passed for ${expectedProjectId}.`);
