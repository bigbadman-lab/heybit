import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { checkLocalEnv, formatEnvReport } from "./lib/env-check.js";
import { loadLocalEnv } from "./lib/load-local-env.js";
import { loadManifest } from "./lib/manifest.js";

const DUMMY_SECRET = "dummy-local-env-secret-value";

function tempRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "heybit-env-"));
}

function captureStreams(run: () => void): string {
  let captured = "";
  const stdoutWrite = process.stdout.write;
  const stderrWrite = process.stderr.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    captured += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    captured += chunk.toString();
    return true;
  }) as typeof process.stderr.write;

  try {
    run();
    return captured;
  } finally {
    process.stdout.write = stdoutWrite;
    process.stderr.write = stderrWrite;
  }
}

test("loads names from .env.local without writing values to the console", () => {
  const root = tempRoot();
  const env: NodeJS.ProcessEnv = {};
  writeFileSync(path.join(root, ".env.local"), `OPENAI_API_KEY=${DUMMY_SECRET}\n`, "utf8");

  try {
    const output = captureStreams(() => {
      const result = loadLocalEnv({ root, env });
      assert.equal(result.loaded, true);
    });

    assert.equal(env.OPENAI_API_KEY, DUMMY_SECRET);
    assert.equal(output.includes(DUMMY_SECRET), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("does not overwrite variables already present in the environment", () => {
  const root = tempRoot();
  const env: NodeJS.ProcessEnv = { OPENAI_API_KEY: "shell-value" };
  writeFileSync(path.join(root, ".env.local"), `OPENAI_API_KEY=${DUMMY_SECRET}\n`, "utf8");

  try {
    loadLocalEnv({ root, env });
    assert.equal(env.OPENAI_API_KEY, "shell-value");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("missing .env.local does not crash and env check still reports absence", () => {
  const root = tempRoot();
  const env: NodeJS.ProcessEnv = {};

  try {
    const result = loadLocalEnv({ root, env });
    assert.equal(result.loaded, false);

    const report = checkLocalEnv(loadManifest(), env);
    const text = formatEnvReport(report);
    assert.equal(report.ok, false);
    assert.match(text, /OPENAI_API_KEY \.+ MISSING/);
    assert.match(text, /VERDICT: BLOCKED/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("env check output contains presence metadata only", () => {
  const root = tempRoot();
  const env: NodeJS.ProcessEnv = {};
  const manifest = loadManifest();
  const lines = manifest.variables
    .filter((variable) => variable.destinations.includes("local"))
    .map((variable) => `${variable.name}=${DUMMY_SECRET}`);
  writeFileSync(path.join(root, ".env.local"), `${lines.join("\n")}\n`, "utf8");

  try {
    const output = captureStreams(() => {
      loadLocalEnv({ root, env });
    });
    const text = formatEnvReport(checkLocalEnv(manifest, env));

    assert.equal(output.includes(DUMMY_SECRET), false);
    assert.equal(text.includes(DUMMY_SECRET), false);
    assert.match(text, /VERDICT: PASS/);

    for (const line of text.split("\n")) {
      if (line === "") {
        continue;
      }
      assert.match(
        line,
        /^(HEYBIT — LOCAL ENV CHECK|Required: every local variable below\.|VERDICT: (PASS|BLOCKED)|[A-Z][A-Z0-9_]* \.+ (PRESENT|MISSING))$/,
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
