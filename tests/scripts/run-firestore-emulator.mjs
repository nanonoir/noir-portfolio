import net from "node:net";
import { spawn, spawnSync } from "node:child_process";

const projectId = "demo-noir-portfolio";
const emulatorHost = "127.0.0.1:8080";
const environment = {
  ...process.env,
  FIREBASE_PROJECT_ID: projectId,
  FIRESTORE_EMULATOR_HOST: emulatorHost,
  NODE_ENV: "test",
};

const guard = spawnSync(process.execPath, ["tests/scripts/assert-test-environment.mjs"], { stdio: "inherit" });
if (guard.status !== 0) process.exit(guard.status ?? 1);

function spawnWindowsCommand(command) {
  return spawn("cmd.exe", ["/d", "/s", "/c", command], { env: environment, shell: false, stdio: "inherit" });
}

function startEmulator() {
  const command = `npx -y firebase-tools@latest emulators:start --only firestore --project ${projectId}`;
  return process.platform === "win32"
    ? spawnWindowsCommand(command)
    : spawn("npx", ["-y", "firebase-tools@latest", "emulators:start", "--only", "firestore", "--project", projectId], { env: environment, stdio: "inherit" });
}

function waitForPort(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const probe = () => {
      const socket = net.createConnection({ host: "127.0.0.1", port: 8080 });
      socket.once("connect", () => { socket.destroy(); resolve(); });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() >= deadline) reject(new Error("Firestore emulator did not become ready within 30 seconds."));
        else setTimeout(probe, 250);
      });
    };
    probe();
  });
}

async function stopEmulator(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }
  child.kill("SIGTERM");
}

let emulator;
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await stopEmulator(emulator);
}
process.once("SIGINT", () => { shutdown().finally(() => process.exit(130)); });
process.once("SIGTERM", () => { shutdown().finally(() => process.exit(143)); });

try {
  emulator = startEmulator();
  await waitForPort();
  const vitest = process.platform === "win32"
    ? spawnWindowsCommand("pnpm exec vitest run tests/integration --no-file-parallelism --maxWorkers=1")
    : spawn("pnpm", ["exec", "vitest", "run", "tests/integration", "--no-file-parallelism", "--maxWorkers=1"], { env: environment, stdio: "inherit" });
  const code = await new Promise((resolve) => vitest.once("exit", (exitCode) => resolve(exitCode ?? 1)));
  process.exitCode = code;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await shutdown();
}
