import net from "node:net";
import { spawn, spawnSync } from "node:child_process";

const projectId = "demo-noir-portfolio";
const environment = {
  ...process.env,
  FIREBASE_PROJECT_ID: projectId,
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  MEET_BACKEND_E2E: "1",
  NODE_ENV: "test",
};

const guard = spawnSync(process.execPath, ["tests/scripts/assert-test-environment.mjs"], { env: environment, stdio: "inherit" });
if (guard.status !== 0) process.exit(guard.status ?? 1);

function start(command, args) {
  return process.platform === "win32"
    ? spawn("cmd.exe", ["/d", "/s", "/c", [command, ...args].join(" ")], { env: environment, shell: false, stdio: "inherit" })
    : spawn(command, args, { env: environment, stdio: "inherit" });
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

function stop(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}

let emulator;
try {
  emulator = start("npx", ["-y", "firebase-tools@latest", "emulators:start", "--only", "firestore", "--project", projectId]);
  await waitForPort();
  const playwright = start("pnpm", ["exec", "playwright", "test", "--project=chromium-backend"]);
  process.exitCode = await new Promise((resolve) => playwright.once("exit", (code) => resolve(code ?? 1)));
} finally {
  stop(emulator);
}
