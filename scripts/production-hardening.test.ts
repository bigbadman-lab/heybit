import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { IngestQueue, processingLabel } from "@heybit/shared/ingest";
import { MintLogListener } from "../apps/worker/src/listener.js";
import { signatureStep } from "../apps/worker/src/monitor.js";
import { formatWorkerStatus } from "../apps/worker/src/runtime.js";
import { feedLabel } from "../apps/web/components/bit/bit-commentary.js";
import { decideStalePending, STALE_PENDING_MIN_AGE_MS } from "./lib/stale-reactions.js";

test("a terminal null stays a coverage miss and does not degrade the worker", () => {
  const first = signatureStep({ ready: true, live: true, fetched: "null", outcome: null }, 1);
  const second = signatureStep({ ready: true, live: true, fetched: "null", outcome: null }, 2);
  assert.equal(first.step.kind, "retry");
  assert.equal(second.step.kind, "permanent");
  assert.equal(second.cause, "rpc_fetch_null_terminal");
  assert.equal(
    processingLabel({ listenerIdle: false, alchemyReady: true, backlogged: false, reconnecting: false }),
    "ACTIVE",
  );
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
    listener: "ACTIVE",
    reason: "canonical mint is live",
    causes: {
      rpc_pending_index: 1223,
      rpc_fetch_null_terminal: 1220,
      rpc_rate_limited: 0,
      rpc_fetch_error: 0,
      db_insert_error: 0,
      queue_dropped: 0,
    },
  });
  assert.match(text, /rpc fetch null terminal: 1220/);
  assert.match(text, /rpc fetch error: 0/);
  assert.match(text, /coverage class: provider miss, not a worker error/);
  assert.match(text, /processing: ACTIVE/);
});

test("the feed label is LIVE only while presence is live", () => {
  assert.equal(feedLabel("live", "LIVE"), "LIVE");
  assert.equal(feedLabel("live", "PRELAUNCH"), "IDLE");
  assert.equal(feedLabel("pending", "PRELAUNCH"), "IDLE");
  assert.equal(feedLabel("live", null), "IDLE");
  const status = readFileSync(new URL("../apps/web/components/bit/BitStatus.tsx", import.meta.url), "utf8");
  const tape = readFileSync(new URL("../apps/web/components/bit/BitEventTape.tsx", import.meta.url), "utf8");
  assert.match(status, /feedLabel\(feed\.status,/);
  assert.match(tape, /tapeRows\(feed\.events\)/);
  assert.match(tape, /is-history/);
  assert.equal(tape.includes("PRELAUNCH"), false);
});

test("stale pending cleanup is dry-run unless confirmed and cannot touch recent rows", () => {
  const nowMs = 10_000_000;
  const cutoffMs = nowMs - STALE_PENDING_MIN_AGE_MS;
  const rows = [
    { status: "PENDING", createdAtMs: cutoffMs - 1 },
    { status: "PENDING", createdAtMs: cutoffMs },
    { status: "PENDING", createdAtMs: nowMs - 1_000 },
    { status: "GENERATED", createdAtMs: cutoffMs - 5_000 },
    { status: "EXPIRED", createdAtMs: cutoffMs - 5_000 },
  ];
  const dryRun = decideStalePending({ nowMs, cutoffMs, rows, confirm: false });
  assert.equal(dryRun.eligible, 1);
  assert.equal(dryRun.protectedPending, 2);
  assert.equal(dryRun.mutate, false);
  assert.equal(dryRun.refusal, null);

  const confirmed = decideStalePending({ nowMs, cutoffMs, rows, confirm: true });
  assert.equal(confirmed.mutate, true);
  const again = decideStalePending({
    nowMs,
    cutoffMs,
    rows: rows.map((row) => (row.status === "PENDING" && row.createdAtMs < cutoffMs ? { ...row, status: "EXPIRED" } : row)),
    confirm: true,
  });
  assert.equal(again.eligible, 0);

  const tooRecent = decideStalePending({
    nowMs,
    cutoffMs: nowMs - STALE_PENDING_MIN_AGE_MS + 1,
    rows,
    confirm: true,
  });
  assert.equal(tooRecent.mutate, false);
  assert.equal(tooRecent.eligible, 0);
  assert.match(tooRecent.refusal ?? "", /1 hour/);

  const source = readFileSync(new URL("./expire-stale-reactions.ts", import.meta.url), "utf8");
  assert.ok(source.indexOf("if (!confirm)") < source.indexOf(".update("));
  assert.match(source, /dry-run/);
});

test("a synthetic burst pauses at high water and resumes without a disconnect", async () => {
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
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queue = new IngestQueue<number>({
    concurrency: 3,
    capacity: 800,
    highWater: 400,
    lowWater: 120,
    onCapacity: (paused) => {
      if (paused) {
        listener.pauseIntake();
      } else {
        listener.resumeIntake();
      }
    },
    process: async () => {
      await gate;
      return { kind: "done" };
    },
  });
  try {
    listener.start("Mint11111111111111111111111111111111");
    sockets[0]?.dispatchEvent(new Event("open"));
    assert.equal(modes.at(-1), "ACTIVE");

    for (let index = 0; index < 450; index += 1) {
      assert.equal(queue.enqueue(`burst-${index}`, index), "queued");
    }
    assert.equal(queue.metrics().paused, true);
    assert.equal(modes.at(-1), "PAUSED_BACKPRESSURE");
    assert.equal(listener.snapshot().ws_disconnect, 0);
    assert.equal(queue.metrics().dropped, 0);
    assert.ok(queue.metrics().maxDepth >= 400);
    assert.equal(queue.metrics().maxActive, 3);
    assert.equal(modes.includes("RECONNECTING"), false);

    let dropped = 0;
    for (let index = 450; index < 1_200; index += 1) {
      const result = queue.enqueue(`burst-${index}`, index);
      if (result === "paused") {
        dropped += 1;
      }
    }
    assert.ok(dropped > 0);
    assert.ok(queue.metrics().maxDepth <= 800);
    assert.equal(queue.metrics().maxActive, 3);

    release();
    await queue.drain();
    assert.equal(queue.metrics().depth, 0);
    assert.equal(queue.metrics().active, 0);
    assert.equal(queue.metrics().paused, false);
    assert.equal(listener.snapshot().ws_disconnect, 0);
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    sockets.at(-1)?.dispatchEvent(new Event("open"));
    assert.equal(modes.at(-1), "ACTIVE");
    assert.equal(modes.includes("RECONNECTING"), false);
  } finally {
    listener.stop();
    globalThis.WebSocket = previous;
  }
});
