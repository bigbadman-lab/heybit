import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { IngestQueue, retryDelayMs } from "../packages/shared/src/ingest-queue.js";
import { ReactionScheduler, type InferenceResult, type ReactionStore, type ReactionWrite } from "../packages/shared/src/reaction.js";
import { classifyRpcFailure, signatureStep } from "../apps/worker/src/monitor.js";
import { MintLogListener } from "../apps/worker/src/listener.js";
import { formatWorkerStatus } from "../apps/worker/src/runtime.js";

function trade(signature: string) {
  return { signature, type: "BUY" as const, solAmount: 0.2, observedAt: new Date(0).toISOString() };
}

function strictStore(): ReactionStore & {
  rows: Map<string, { status: string; text: string | null; reactionType: string; sourceMode: string }>;
  writes: ReactionWrite[];
} {
  const rows = new Map<string, { status: string; text: string | null; reactionType: string; sourceMode: string }>();
  const writes: ReactionWrite[] = [];
  return {
    rows,
    writes,
    async claim(draft) {
      if (rows.has(draft.sourceKey)) {
        return "duplicate";
      }
      rows.set(draft.sourceKey, {
        status: "PENDING",
        text: null,
        reactionType: draft.reactionType,
        sourceMode: draft.sourceMode,
      });
      return "owned";
    },
    async finish(sourceKey, patch) {
      if (!patch.reactionType || !patch.sourceMode) {
        throw new Error("not null");
      }
      const existing = rows.get(sourceKey);
      if (!existing) {
        throw new Error("missing");
      }
      writes.push(patch);
      rows.set(sourceKey, {
        status: patch.status,
        text: patch.text,
        reactionType: patch.reactionType,
        sourceMode: patch.sourceMode,
      });
    },
  };
}

test("a signature burst stays inside the processor and queue caps", async () => {
  let current = 0;
  let maxActive = 0;
  const queue = new IngestQueue<string>({
    concurrency: 3,
    capacity: 20,
    highWater: 12,
    lowWater: 4,
    process: async () => {
      current += 1;
      maxActive = Math.max(maxActive, current);
      await new Promise((resolve) => setTimeout(resolve, 15));
      current -= 1;
      return { kind: "done" };
    },
  });
  for (let index = 0; index < 100; index += 1) {
    queue.enqueue(`burst-${index}`, `burst-${index}`);
  }
  assert.ok(queue.metrics().maxDepth <= 20);
  assert.ok(queue.metrics().dropped > 0);
  assert.equal(queue.metrics().paused, true);
  await queue.drain();
  assert.ok(maxActive <= 3);
  assert.equal(queue.metrics().active, 0);
  assert.equal(queue.metrics().depth, 0);
});

test("duplicate signatures do not multiply work", async () => {
  const seen: string[] = [];
  const queue = new IngestQueue<string>({
    concurrency: 2,
    delay: async () => undefined,
    process: async (signature) => {
      seen.push(signature);
      return { kind: "done" };
    },
  });
  assert.equal(queue.enqueue("same", "same"), "queued");
  assert.equal(queue.enqueue("same", "same"), "duplicate");
  await queue.drain();
  assert.deepEqual(seen, ["same"]);
  assert.equal(queue.metrics().duplicates, 1);
});

test("a transaction that is not ready retries a bounded number of times", async () => {
  const calls: number[] = [];
  const queue = new IngestQueue<string>({
    concurrency: 1,
    maxAttempts: 3,
    delay: async () => undefined,
    process: async (_signature, attempt) => {
      calls.push(attempt);
      return signatureStep({ ready: true, live: true, fetched: "null", outcome: null }, attempt).step;
    },
  });
  queue.enqueue("lag", "lag");
  await queue.drain();
  assert.deepEqual(calls, [1, 2]);
  assert.equal(queue.metrics().retries, 1);
  assert.equal(queue.metrics().failures, 1);
  assert.equal(queue.metrics().active, 0);
});

test("rpc failures use a longer backoff than the rehearsal delay", () => {
  assert.ok(retryDelayMs(1, "unavailable") >= 8_000);
  assert.ok(retryDelayMs(2, "unavailable") > retryDelayMs(1, "unavailable"));
  assert.ok(retryDelayMs(1, "rate_limited") >= 1_000);
  assert.ok(retryDelayMs(3, "rate_limited") > retryDelayMs(1, "rate_limited"));
  assert.equal(classifyRpcFailure({ status: 429 }), "rate_limited");
  assert.equal(classifyRpcFailure(new Error("Too Many Requests")), "rate_limited");
  assert.equal(classifyRpcFailure(new Error("socket hang up")), "rpc");
  const limited = signatureStep({ ready: true, live: true, fetched: "rate_limited", outcome: null });
  assert.equal(limited.cause, "rpc_rate_limited");
  assert.equal(limited.step.kind, "retry");
  const database = signatureStep({ ready: true, live: true, fetched: "transaction", outcome: "retry" });
  assert.equal(database.cause, "db_insert_error");
});

test("websocket reconnect waits, and intake pause is not a disconnect", async () => {
  const sockets: FakeSocket[] = [];
  class FakeSocket extends EventTarget {
    constructor(public url: string) {
      super();
      sockets.push(this);
    }
    send(): void {}
    close(): void {
      this.dispatchEvent(new Event("close"));
    }
  }
  const previous = globalThis.WebSocket;
  globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket;
  const modes: string[] = [];
  const listener = new MintLogListener("wss://example.test/socket", () => undefined, (mode) => {
    modes.push(mode);
  });
  const pauseModes: string[] = [];
  const paused = new MintLogListener("wss://example.test/socket", () => undefined, (mode) => {
    pauseModes.push(mode);
  });
  try {
    listener.start("Mint11111111111111111111111111111111");
    sockets[0]?.dispatchEvent(new Event("open"));
    sockets[0]?.dispatchEvent(new Event("close"));
    assert.equal(modes.at(-1), "RECONNECTING");
    assert.equal(listener.snapshot().ws_disconnect, 1);
    assert.equal(listener.snapshot().ws_reconnect, 1);
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(sockets.length, 1);
    listener.stop();

    paused.start("Mint11111111111111111111111111111111");
    const opened = sockets.length;
    sockets.at(-1)?.dispatchEvent(new Event("open"));
    paused.pauseIntake();
    assert.equal(pauseModes.at(-1), "PAUSED_BACKPRESSURE");
    assert.equal(paused.snapshot().ws_disconnect, 0);
    paused.resumeIntake();
    assert.equal(paused.snapshot().ws_reconnect, 1);
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(sockets.length, opened);
  } finally {
    listener.stop();
    paused.stop();
    globalThis.WebSocket = previous;
  }
});

test("the processor pool returns to idle after a burst", async () => {
  const queue = new IngestQueue<number>({
    concurrency: 3,
    process: async () => ({ kind: "done" }),
  });
  for (let index = 0; index < 12; index += 1) {
    queue.enqueue(`idle-${index}`, index);
  }
  await queue.drain();
  assert.equal(queue.metrics().active, 0);
  assert.equal(queue.metrics().depth, 0);
  assert.equal(queue.metrics().processed, 12);
});

test("a qualifying reaction is stored with the required columns", async () => {
  const store = strictStore();
  const scheduler = new ReactionScheduler({
    now: () => 0,
    store,
    infer: async () => ({ ok: true, text: "i saw that." }),
  });
  scheduler.observe([trade("buy")]);
  await scheduler.pump();
  const row = store.rows.get("window:0");
  assert.equal(row?.status, "GENERATED");
  assert.equal(row?.text, "i saw that.");
  assert.equal(row?.reactionType, "ACTIVITY");
  assert.equal(row?.sourceMode, "INDIVIDUAL");
  assert.equal(store.writes[0]?.reactionType, "ACTIVITY");
  assert.equal(scheduler.metrics().successes, 1);
  assert.equal(scheduler.metrics().failures, 0);
});

test("an openai failure is stored as fallback and counted as a success", async () => {
  const store = strictStore();
  const scheduler = new ReactionScheduler({
    now: () => 0,
    store,
    infer: async (): Promise<InferenceResult> => ({ ok: false, transient: true, reason: "rate_limit" }),
  });
  scheduler.observe([trade("buy")]);
  await scheduler.pump();
  assert.equal(store.rows.get("window:0")?.status, "GENERATED");
  assert.equal(store.rows.get("window:0")?.text, "i saw that.");
  assert.equal(scheduler.metrics().successes, 1);
  assert.equal(scheduler.metrics().failures, 0);
  assert.equal(scheduler.metrics().causes.openai_request_error, 2);
  assert.equal(scheduler.metrics().causes.fallback_store_error, 0);
});

test("reaction failures stay classified when claim or storage throws", async () => {
  const claimStore: ReactionStore = {
    async claim() {
      throw new Error("claim failed");
    },
    async finish() {
      throw new Error("unused");
    },
  };
  const claimScheduler = new ReactionScheduler({
    now: () => 0,
    store: claimStore,
    infer: async () => {
      throw new Error("should not run");
    },
  });
  claimScheduler.observe([trade("buy")]);
  await claimScheduler.pump();
  assert.equal(claimScheduler.metrics().causes.reaction_claim_error, 1);
  assert.equal(claimScheduler.metrics().attempts, 0);

  const finishStore: ReactionStore = {
    async claim() {
      return "owned";
    },
    async finish() {
      throw new Error("finish failed");
    },
  };
  const finishScheduler = new ReactionScheduler({
    now: () => 0,
    store: finishStore,
    infer: async () => ({ ok: false, transient: false, reason: "empty" }),
  });
  finishScheduler.observe([trade("sell")]);
  await finishScheduler.pump();
  assert.equal(finishScheduler.metrics().causes.openai_response_error, 1);
  assert.ok(finishScheduler.metrics().causes.reaction_store_error >= 1);
  assert.equal(finishScheduler.metrics().causes.fallback_store_error, 1);
});

test("no reaction starts after rehearsal expiry, including queued signatures", async () => {
  let calls = 0;
  const store = strictStore();
  const scheduler = new ReactionScheduler({
    now: () => 0,
    store,
    infer: async () => {
      calls += 1;
      return { ok: true, text: "i saw that." };
    },
  });
  scheduler.hold();
  scheduler.observe([trade("late")]);
  await scheduler.pump();
  assert.equal(calls, 0);
  assert.equal(store.rows.size, 0);

  let release: (value: InferenceResult) => void = () => undefined;
  const pending = new Promise<InferenceResult>((resolve) => {
    release = resolve;
  });
  const inflight = strictStore();
  const speaking = new ReactionScheduler({
    now: () => 0,
    store: inflight,
    infer: () => pending,
  });
  speaking.observe([trade("open")]);
  const running = speaking.pump();
  await new Promise((resolve) => setImmediate(resolve));
  speaking.hold();
  release({ ok: true, text: "i saw that." });
  await running;
  assert.equal(inflight.rows.get("window:0")?.status, "EXPIRED");
  assert.equal(inflight.rows.get("window:0")?.text, null);

  let live = true;
  const phases: string[] = [];
  const queue = new IngestQueue<string>({
    concurrency: 1,
    maxAttempts: 3,
    delay: async () => {
      live = false;
    },
    process: async () => {
      phases.push(live ? "live" : "idle");
      if (!live) {
        return signatureStep({ ready: true, live: false, fetched: "transaction", outcome: "trade" }).step;
      }
      return signatureStep({ ready: true, live: true, fetched: "null", outcome: null }).step;
    },
  });
  queue.enqueue("queued", "queued");
  await queue.drain();
  assert.equal(phases[0], "live");
  assert.ok(phases.includes("idle"));
  assert.equal(queue.metrics().active, 0);
  assert.equal(queue.metrics().failures, 0);
});

test("worker status prints the classified counters", () => {
  const text = formatWorkerStatus({
    runtime: {
      status: "ok",
      runtime: {
        launchState: "PRELAUNCH",
        canonicalMint: null,
        activationTimestamp: null,
        launchSignature: null,
        launchSlot: null,
      },
    },
    alchemyReady: true,
    listener: "IDLE",
    reason: "token not live",
    queue: { depth: 0, active: 0, concurrency: 3, processed: 1, duplicates: 0, retries: 2, failures: 1, dropped: 4 },
    causes: {
      rpc_pending_index: 5,
      rpc_fetch_null_terminal: 9,
      rpc_rate_limited: 6,
      rpc_fetch_error: 7,
      db_insert_error: 8,
      queue_dropped: 4,
    },
    socket: { ws_disconnect: 1, ws_reconnect: 2 },
    reactionCauses: {
      reaction_claim_error: 1,
      reaction_prompt_error: 0,
      openai_request_error: 2,
      openai_response_error: 3,
      reaction_store_error: 4,
      fallback_store_error: 5,
    },
  });
  assert.match(text, /active processors: 0\/3/);
  assert.match(text, /rpc pending index: 5/);
  assert.match(text, /rpc fetch null terminal: 9/);
  assert.match(text, /coverage class: provider miss, not a worker error/);
  assert.match(text, /rpc rate limited: 6/);
  assert.match(text, /queue dropped: 4/);
  assert.match(text, /fallback store error: 5/);
  assert.match(text, /ws disconnect: 1/);
});

test("the first tape snapshot is marked historical", () => {
  const source = readFileSync(new URL("../apps/web/components/bit/BitEventTape.tsx", import.meta.url), "utf8");
  assert.match(source, /is-history/);
  assert.match(source, /setHistoryIds/);
  const css = readFileSync(new URL("../apps/web/app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.bit-tape-row\.is-history/);
});
