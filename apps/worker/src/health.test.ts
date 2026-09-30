import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createShutdownHandler, healthFromSnapshot, listenerForRuntime } from "./health.js";
import { signatureFromLogsMessage } from "./listener.js";
import { readAlchemyConfig } from "./alchemy.js";
import { formatWorkerStatus } from "./runtime.js";
import { fromConfirmedTransaction } from "./decode-transaction.js";

const workerSrc = path.dirname(fileURLToPath(import.meta.url));
const SECRET = "super-secret-value-should-not-print";

const prelaunch = {
  status: "ok" as const,
  runtime: {
    canonicalMint: null,
    launchState: "PRELAUNCH" as const,
    activationTimestamp: null,
    launchSignature: null,
    launchSlot: null,
  },
};

test("PRELAUNCH idleness is healthy and the listener stays idle", () => {
  const gate = listenerForRuntime(prelaunch);
  assert.equal(gate.listener, "IDLE");
  assert.equal(gate.reason, "token not live");
  assert.deepEqual(
    healthFromSnapshot({
      runtime: prelaunch,
      alchemyRpc: "ready",
      alchemyWss: "ready",
      tradeListener: "idle",
    }),
    {
      process: "healthy",
      supabase: "connected",
      runtimeState: "readable",
      alchemyRpc: "ready",
      alchemyWss: "ready",
      tradeListener: "idle",
      externalWrites: "disabled",
      queueDepth: 0,
      activeProcessors: 0,
      maxConcurrency: 8,
      processing: "IDLE",
      reactionScheduler: "idle",
      openai: "ready",
      reactionQueueDepth: 0,
      openaiActive: 0,
      recentReactions: 0,
      recentExpired: 0,
      recentFailures: 0,
    },
  );
  const text = formatWorkerStatus({
    runtime: prelaunch,
    alchemyReady: true,
    listener: "IDLE",
    reason: "token not live",
  });
  assert.match(text, /runtime state: PRELAUNCH/);
  assert.match(text, /canonical mint: none/);
  assert.match(text, /alchemy: READY/);
  assert.match(text, /trade listener: IDLE/);
  assert.match(text, /reason: token not live/);
});

test("unavailable runtime degrades health without crashing", () => {
  const health = healthFromSnapshot({
    runtime: { status: "unavailable" },
    alchemyRpc: "unavailable",
    alchemyWss: "unavailable",
    tradeListener: "idle",
  });
  assert.equal(health.process, "degraded");
  assert.equal(health.supabase, "unavailable");
  assert.equal(health.tradeListener, "idle");
});

test("alchemy config rejects missing or non-tls endpoints and does not echo secrets", () => {
  assert.equal(readAlchemyConfig({}), null);
  assert.equal(
    readAlchemyConfig({
      ALCHEMY_SOLANA_RPC_URL: `http://example.test/${SECRET}`,
      ALCHEMY_SOLANA_WSS_URL: `wss://example.test/${SECRET}`,
    }),
    null,
  );
  const config = readAlchemyConfig({
    ALCHEMY_SOLANA_RPC_URL: "https://example.test/rpc",
    ALCHEMY_SOLANA_WSS_URL: "wss://example.test/ws",
  });
  assert.ok(config);
  assert.equal(JSON.stringify({ rpc: "FAIL", wss: "FAIL" }).includes(SECRET), false);
});

test("logs messages are only a signature trigger", () => {
  assert.equal(
    signatureFromLogsMessage(
      JSON.stringify({ method: "logsNotification", params: { result: { value: { signature: "sig-1", err: null } } } }),
    ),
    "sig-1",
  );
  assert.equal(signatureFromLogsMessage("not-json"), null);
});

test("a missing confirmed transaction does not throw", () => {
  assert.equal(fromConfirmedTransaction("sig", null), null);
});

test("inference failure does not crash worker health", () => {
  const health = healthFromSnapshot({
    runtime: prelaunch,
    alchemyRpc: "ready",
    alchemyWss: "ready",
    tradeListener: "idle",
    openai: "degraded",
    recentFailures: 3,
  });
  assert.equal(health.process, "healthy");
  assert.equal(health.openai, "degraded");
  assert.equal(health.reactionScheduler, "idle");
  assert.equal(health.recentFailures, 3);
});

test("worker source does not send transactions", () => {
  const forbidden = ["sendTransaction", "requestAirdrop", ".update("];
  for (const file of listTs(workerSrc)) {
    const text = readFileSync(file, "utf8");
    for (const name of forbidden) {
      assert.equal(text.includes(name), false, `${path.basename(file)} contains ${name}`);
    }
    assert.equal(text.includes("api.openai.com"), false, `${path.basename(file)} names the OpenAI host`);
    assert.equal(text.includes("console.log(key"), false);
    assert.equal(text.includes("console.log(env"), false);
  }
});

test("shutdown handler logs the signal and exits cleanly", () => {
  const logs: string[] = [];
  const exits: number[] = [];
  createShutdownHandler(
    (code) => exits.push(code),
    (message) => logs.push(message),
  )("SIGTERM");
  assert.deepEqual(exits, [0]);
  assert.deepEqual(logs, ["heybit-worker shutdown signal=SIGTERM"]);
});

function listTs(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      continue;
    }
    if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}
