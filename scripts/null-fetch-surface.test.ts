import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { IngestQueue, retryDelayMs } from "../packages/shared/src/ingest-queue.js";
import { signatureStep } from "../apps/worker/src/monitor.js";
import { spokenLine } from "../apps/web/components/bit/bit-commentary.js";

test("a null fetch waits once without holding a processor, then succeeds", async () => {
  let activeWhileWaiting = -1;
  const queue = new IngestQueue<string>({
    concurrency: 1,
    maxAttempts: 3,
    delay: async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      activeWhileWaiting = queue.metrics().active;
    },
    process: async (_signature, attempt) => {
      if (attempt === 1) {
        return signatureStep({ ready: true, live: true, fetched: "null", outcome: null }, attempt).step;
      }
      return { kind: "done" };
    },
  });
  queue.enqueue("lag", "lag");
  await queue.drain();
  assert.equal(activeWhileWaiting, 0);
  assert.equal(queue.metrics().retries, 1);
  assert.equal(queue.metrics().failures, 0);
  assert.equal(queue.metrics().processed, 1);
  assert.equal(queue.metrics().active, 0);
  assert.ok(retryDelayMs(1, "unavailable") >= 8_000);
});

test("a null that is still missing after the recheck is terminal", async () => {
  const causes: string[] = [];
  const queue = new IngestQueue<string>({
    concurrency: 1,
    delay: async () => undefined,
    process: async (_signature, attempt) => {
      const decision = signatureStep({ ready: true, live: true, fetched: "null", outcome: null }, attempt);
      if (decision.cause) {
        causes.push(decision.cause);
      }
      return decision.step;
    },
  });
  queue.enqueue("missing", "missing");
  await queue.drain();
  assert.deepEqual(causes, ["rpc_pending_index", "rpc_fetch_null_terminal"]);
  assert.equal(queue.metrics().retries, 1);
  assert.equal(queue.metrics().failures, 1);
  assert.equal(queue.metrics().depth, 0);
});

test("null retries stay bounded and duplicates do not multiply", async () => {
  const calls: string[] = [];
  const queue = new IngestQueue<string>({
    concurrency: 2,
    capacity: 4,
    highWater: 3,
    lowWater: 1,
    delay: async () => undefined,
    process: async (signature, attempt) => {
      calls.push(`${signature}:${attempt}`);
      return signatureStep({ ready: true, live: true, fetched: "null", outcome: null }, attempt).step;
    },
  });
  for (let index = 0; index < 12; index += 1) {
    queue.enqueue(`sig-${index}`, `sig-${index}`);
  }
  assert.equal(queue.enqueue("sig-0", "sig-0"), "duplicate");
  assert.ok(queue.metrics().maxDepth <= 4);
  assert.ok(queue.metrics().dropped > 0);
  await queue.drain();
  const missing = calls.filter((call) => call.startsWith("sig-0:"));
  assert.ok(missing.length <= 2);
  assert.equal(queue.metrics().active, 0);
});

test("a stored reaction is spoken only while presence is live", () => {
  const live = spokenLine({
    launchState: "LIVE",
    reactionText: "i saw that.",
    state: "IDLE",
    seed: "idle:0",
  });
  assert.equal(live.text, "i saw that.");
  assert.equal(live.source, "reaction");

  const prelaunch = spokenLine({
    launchState: "PRELAUNCH",
    reactionText: "i saw that.",
    state: "IDLE",
    seed: "idle:0",
  });
  assert.notEqual(prelaunch.text, "i saw that.");
  assert.equal(prelaunch.source, "pool");

  const expired = spokenLine({
    launchState: null,
    reactionText: "i saw that.",
    state: "BUY",
    seed: "cue",
  });
  assert.equal(expired.source, "pool");
});

test("the public speech path is a read of generated text and stays off prelaunch", () => {
  const route = readFileSync(new URL("../apps/web/app/api/bit-visual/route.ts", import.meta.url), "utf8");
  const reader = readFileSync(new URL("../apps/web/lib/public-speech.ts", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../supabase/migrations/20261002160000_create_bit_public_speech.sql", import.meta.url),
    "utf8",
  );
  const speech = readFileSync(new URL("../apps/web/components/bit/BitSpeech.tsx", import.meta.url), "utf8");
  assert.match(route, /presence\.launchState === "LIVE"/);
  assert.equal(route.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.match(reader, /bit_public_speech/);
  assert.equal(reader.includes("SUPABASE_SERVICE_ROLE_KEY"), false);
  assert.match(migration, /status = 'GENERATED'/);
  assert.match(migration, /grant select on table public\.bit_public_speech to anon, authenticated/);
  assert.match(speech, /spokenLine/);
  assert.equal(speech.includes("bit-commentary-in"), false);
});
