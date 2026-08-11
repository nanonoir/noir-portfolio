import { randomUUID } from "node:crypto";

import { afterAll, afterEach, vi } from "vitest";

import { applyTestEnvironment } from "./helpers/test-environment";
import { resetFirestoreForEmulatorTests } from "@/lib/server/firestore";

applyTestEnvironment();
// Test-only generated value: no committed OAuth secret is needed for route tests.
process.env.GOOGLE_OAUTH_ADMIN_SECRET ||= `test-runtime-${randomUUID()}`;

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await resetFirestoreForEmulatorTests();
});
