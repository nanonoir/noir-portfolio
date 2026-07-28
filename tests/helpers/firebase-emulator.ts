import { TEST_FIREBASE_PROJECT_ID } from "./test-environment";

export async function clearFirestore(projectId = TEST_FIREBASE_PROJECT_ID): Promise<void> {
  if (projectId !== TEST_FIREBASE_PROJECT_ID) {
    throw new Error(`Refusing to clear a non-test Firestore project: ${projectId}`);
  }

  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

  if (!emulatorHost) {
    throw new Error("FIRESTORE_EMULATOR_HOST must be set before clearing Firestore.");
  }

  const response = await fetch(
    `http://${emulatorHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: "DELETE" },
  );

  if (!response.ok) {
    throw new Error(`Firestore emulator cleanup failed with HTTP ${response.status}.`);
  }
}
