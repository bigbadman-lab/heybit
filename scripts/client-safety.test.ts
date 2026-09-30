import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { getRepoRoot } from "./lib/manifest.js";

const FORBIDDEN = ["SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "BIT_DEPLOYER_KEYPAIR_PATH"];

test("web source does not reference privileged environment names", () => {
  const root = path.join(getRepoRoot(), "apps", "web");
  const files = listSourceFiles(root);
  assert.ok(files.length > 0);

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const name of FORBIDDEN) {
      assert.equal(text.includes(name), false, `${path.relative(root, file)} mentions ${name}`);
    }
  }
});

function listSourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules" || entry === ".next" || entry.endsWith(".tsbuildinfo")) {
      continue;
    }
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
    } else if (/\.(ts|tsx|js|mjs|css)$/.test(entry)) {
      files.push(fullPath);
    }
  }
  return files;
}
