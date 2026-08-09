import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import type { IssuedActionToken } from "./action-tokens";

const CIPHER = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const GENERATED_TEST_RECOVERY_KEY = randomBytes(32).toString("base64url");

function isTestOrEmulator(): boolean {
  return process.env.NODE_ENV === "test" || Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

function getRecoveryKey(): Buffer {
  const configuredKey = process.env.RECOVERY_ENCRYPTION_KEY;
  if (configuredKey?.trim()) {
    return createHash("sha256").update(configuredKey, "utf8").digest();
  }

  if (!isTestOrEmulator()) {
    throw new Error("Missing required server environment variable: RECOVERY_ENCRYPTION_KEY");
  }

  // The generated value is process-local and test/emulator-only. It is never a
  // production fallback and cannot decrypt envelopes after the process exits.
  const testKey = process.env.RECOVERY_TEST_KEY?.trim() || GENERATED_TEST_RECOVERY_KEY;
  return createHash("sha256")
    .update(testKey, "utf8")
    .digest();
}

/** Encrypts owner tokens for server-only retry without minting duplicates. */
export function sealInitialOwnerTokens(tokens: readonly IssuedActionToken[]): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER, getRecoveryKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(tokens), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function unsealInitialOwnerTokens(envelope: string | null): IssuedActionToken[] | null {
  if (!envelope) return null;

  try {
    const encoded = Buffer.from(envelope, "base64url");
    if (encoded.length <= IV_BYTES + TAG_BYTES) return null;
    const iv = encoded.subarray(0, IV_BYTES);
    const tag = encoded.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const ciphertext = encoded.subarray(IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv(CIPHER, getRecoveryKey(), iv);
    decipher.setAuthTag(tag);
    const parsed: unknown = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8"));
    return Array.isArray(parsed) ? parsed as IssuedActionToken[] : null;
  } catch {
    return null;
  }
}
