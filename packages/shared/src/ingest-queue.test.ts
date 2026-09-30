import assert from "node:assert/strict";
import test from "node:test";
import { IngestQueue, PROCESSOR_CONCURRENCY, processingLabel, type StepResult } from "./ingest-queue.js";
import { backpressureSelfCheck, runMonitoringStress } from "./stress.js";
import { buyFixture, FIXTURE_MINT, OBSERVED_AT } from "./fixtures.js";
import { createMemoryLedger, type ProcessedClaim } from "./trade.js";

function claim(signature: string): ProcessedClaim {
  return {
    signature,
    slot: 1,
    canonicalMint: FIXTURE_MINT,
    status: "trade",
    eventType: "BUY",
    solAmount: 0.5,
    tokenAmount: 1,
  };
}

async function settled(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

test("active processors never exceed the configured concurrency", async () => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queue = new IngestQueue<number>({
    concurrency: PROCESSOR_CONCURRENCY,
    capacity: 5_000,
    process: async () => {
      await gate;
      return { kind: "done" };
    },
  });
  for (let index = 0; index < 40; index += 1) {
    assert.equal(queue.enqueue(`sig-${index}`, index), "queued");
  }
  await settled();
  assert.equal(queue.metrics().active, PROCESSOR_CONCURRENCY);
  assert.equal(queue.metrics().maxActive, PROCESSOR_CONCURRENCY);
  assert.ok(queue.metrics().depth > 0);
  assert.equal(queue.metrics().backlogged, true);
  release();
  await queue.drain();
  assert.equal(queue.metrics().depth, 0);
  assert.equal(queue.metrics().active, 0);
  assert.equal(queue.metrics().backlogged, false);
  assert.equal(processingLabel({ listenerIdle: false, alchemyReady: true, backlogged: false, reconnecting: false }), "ACTIVE");
});

test("duplicate signatures collapse before processing and a reconnect burst stays unique", async () => {
  const seen: string[] = [];
  const queue = new IngestQueue<string>({
    concurrency: 4,
    delay: async () => undefined,
    process: async (signature) => {
      seen.push(signature);
      return { kind: "done" };
    },
  });
  for (let index = 0; index < 25; index += 1) {
    queue.enqueue(`burst-${index}`, `burst-${index}`);
  }
  for (let index = 0; index < 25; index += 1) {
    assert.equal(queue.enqueue(`burst-${index}`, `burst-${index}`), "duplicate");
  }
  await queue.drain();
  assert.equal(seen.length, 25);
  assert.equal(queue.metrics().duplicates, 25);
  assert.equal(queue.metrics().depth, 0);
});

test("concurrent claims of one signature insert once", async () => {
  const ledger = createMemoryLedger();
  const row = claim("race-signature");
  const results = await Promise.all(Array.from({ length: 20 }, () => ledger.claim(row)));
  assert.equal(results.filter((result) => result === "inserted").length, 1);
  assert.equal(ledger.rows.length, 1);
});

test("temporary rpc and unavailable fetches retry, then stop at the attempt limit", async () => {
  const calls = new Map<string, number>();
  const queue = new IngestQueue<string>({
    concurrency: 2,
    maxAttempts: 3,
    delay: async () => undefined,
    process: async (signature): Promise<StepResult> => {
      const count = (calls.get(signature) ?? 0) + 1;
      calls.set(signature, count);
      if (signature === "rpc" && count < 3) {
        return { kind: "retry", reason: "rpc" };
      }
      if (signature === "lag" && count < 2) {
        return { kind: "retry", reason: "unavailable" };
      }
      if (signature === "supabase" && count < 2) {
        throw new Error("temporary database outage");
      }
      if (signature === "permanent") {
        return { kind: "permanent" };
      }
      if (signature === "parser") {
        return { kind: "done" };
      }
      return { kind: "done" };
    },
  });
  queue.enqueue("rpc", "rpc");
  queue.enqueue("lag", "lag");
  queue.enqueue("supabase", "supabase");
  queue.enqueue("permanent", "permanent");
  queue.enqueue("parser", "parser");
  await queue.drain();
  assert.equal(calls.get("rpc"), 3);
  assert.equal(calls.get("lag"), 2);
  assert.equal(calls.get("supabase"), 2);
  assert.equal(calls.get("permanent"), 1);
  assert.equal(calls.get("parser"), 1);
  assert.equal(queue.metrics().failures, 1);
  assert.ok(queue.metrics().retries >= 3);
});

test("the recent signature cache stays bounded", async () => {
  const queue = new IngestQueue<number>({
    concurrency: 8,
    capacity: 10_000,
    recentLimit: 100,
    delay: async () => undefined,
    process: async () => ({ kind: "done" }),
  });
  for (let index = 0; index < 250; index += 1) {
    queue.enqueue(`cache-${index}`, index);
  }
  await queue.drain();
  assert.equal(queue.metrics().recentCacheSize, 100);
  assert.equal(queue.metrics().depth, 0);
});

test("synthetic burst of 1000 signatures stays bounded and drains", async () => {
  const report = await runMonitoringStress();
  assert.equal(report.submitted, 1_000);
  assert.equal(report.pass, true);
  assert.equal(report.drained, true);
  assert.equal(report.maxConcurrency <= PROCESSOR_CONCURRENCY, true);
  assert.equal(report.duplicateSubmissions, 200);
  assert.equal(report.uniqueSignatures, 790);
  assert.equal(report.permanentFailures, 10);
  assert.ok(report.retries >= 60);
});

test("backpressure pauses intake and accepts the signature after drain", async () => {
  assert.equal(await backpressureSelfCheck(), true);
});

test("a buy still classifies once under the queue", async () => {
  const ledger = createMemoryLedger();
  const tx = buyFixture();
  const queue = new IngestQueue<Inspectable>({
    concurrency: 1,
    delay: async () => undefined,
    process: async (payload) => {
      await payload.run(ledger);
      return { kind: "done" };
    },
  });
  queue.enqueue(tx.signature, {
    async run(target) {
      const { processObservedTransaction } = await import("./trade.js");
      await processObservedTransaction({
        tx,
        mint: FIXTURE_MINT,
        observedAt: OBSERVED_AT,
        ledger: target,
      });
    },
  });
  await queue.drain();
  assert.equal(ledger.rows.length, 1);
  assert.equal(ledger.rows[0]?.eventType, "BUY");
});

interface Inspectable {
  run(ledger: ReturnType<typeof createMemoryLedger>): Promise<void>;
}

test("prelaunch backlog label stays idle when the listener is idle", () => {
  assert.equal(processingLabel({ listenerIdle: true, alchemyReady: true, backlogged: false, reconnecting: false }), "IDLE");
  assert.equal(processingLabel({ listenerIdle: false, alchemyReady: true, backlogged: true, reconnecting: false }), "BACKLOGGED");
  assert.equal(processingLabel({ listenerIdle: false, alchemyReady: false, backlogged: true, reconnecting: false }), "DEGRADED");
});
