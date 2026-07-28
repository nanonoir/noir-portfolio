import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const TEST_ROOT = path.resolve("tests");
const FOCUSED_TEST_PATTERN = /\b(?:test|it|describe)\s*\.\s*only\s*\(/;

async function findTestFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findTestFiles(filePath);
    return /\.(?:[cm]?[jt]sx?)$/.test(entry.name) ? [filePath] : [];
  }));
  return files.flat();
}

const focusedFiles = [];
for (const filePath of await findTestFiles(TEST_ROOT)) {
  const source = await readFile(filePath, "utf8");
  if (FOCUSED_TEST_PATTERN.test(source)) focusedFiles.push(path.relative(process.cwd(), filePath));
}

if (focusedFiles.length > 0) {
  console.error(`Focused tests are forbidden: ${focusedFiles.join(", ")}`);
  process.exitCode = 1;
}
