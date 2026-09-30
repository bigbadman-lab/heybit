import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  aggregateTrades,
  BIT_REACTION_MODEL,
  CIRCUIT_OPEN_MS,
  createMemoryReactionStore,
  fallbackText,
  MAX_OPENAI_REACTION_CONCURRENCY,
  ReactionScheduler,
  reactionSchedulerMode,
  validateReactionText,
  type InferenceResult,
  type ReactionFacts,
  type TradeFact,
} from "./reaction.js";
import { runReactionStress } from "./reaction-stress.js";

function trade(signature: string, type: "BUY" | "SELL", solAmount: number, atMs: number): TradeFact {
  return { signature, type, solAmount, observedAt: new Date(atMs).toISOString() };
}

function many(count: number, type: "BUY" | "SELL", solAmount: number, atMs: number): TradeFact[] {
  return Array.from({ length: count }, (_, index) => trade(`${type}-${atMs}-${index}`, type, solAmount, atMs));
}

function harness(infer: (facts: ReactionFacts) => Promise<InferenceResult>) {
  let now = 0;
  const store = createMemoryReactionStore();
  const scheduler = new ReactionScheduler({ now: () => now, store, infer });
  return {
    store,
    scheduler,
    at(value: number) {
      now = value;
    },
  };
}

test("low activity summarizes one BUY and one SELL individually", () => {
  const buy = aggregateTrades([trade("b", "BUY", 0.42, 1_000)], 1_000);
  assert.equal(buy.length, 1);
  assert.equal(buy[0]?.mode, "INDIVIDUAL");
  assert.equal(buy[0]?.activityLevel, "LOW");
  assert.equal(buy[0]?.largestTradeType, "BUY");
  assert.equal(buy[0]?.largestTradeSol, 0.42);
  const sell = aggregateTrades([trade("s", "SELL", 0.18, 1_000)], 1_000);
  assert.equal(sell[0]?.largestTradeType, "SELL");
  assert.equal(sell[0]?.activityLevel, "LOW");
});

test("medium, high, and very high bursts stay deterministic", () => {
  assert.equal(aggregateTrades(many(5, "BUY", 0.2, 0), 0)[0]?.activityLevel, "MEDIUM");
  assert.equal(aggregateTrades(many(12, "BUY", 0.2, 0), 0)[0]?.activityLevel, "HIGH");
  assert.equal(aggregateTrades(many(30, "BUY", 0.2, 0), 0)[0]?.activityLevel, "VERY_HIGH");
  assert.equal(aggregateTrades(many(12, "BUY", 0.2, 0), 0)[0]?.mode, "BURST");
});

test("net direction compares confirmed sol flow only", () => {
  const buyHeavy = aggregateTrades([...many(3, "BUY", 2, 0), trade("s", "SELL", 1, 0)], 0)[0];
  const sellHeavy = aggregateTrades([...many(3, "SELL", 2, 0), trade("b", "BUY", 1, 0)], 0)[0];
  const balanced = aggregateTrades([...many(2, "BUY", 1, 0), ...many(2, "SELL", 1, 0)], 0)[0];
  assert.equal(buyHeavy?.netDirection, "BUY_HEAVY");
  assert.equal(sellHeavy?.netDirection, "SELL_HEAVY");
  assert.equal(balanced?.netDirection, "BALANCED");
  assert.equal(balanced?.activityLevel, "MEDIUM");
});

test("cooldown holds a second normal reaction and very high activity speaks less often", async () => {
  let calls = 0;
  const { scheduler, at } = harness(async () => {
    calls += 1;
    return { ok: true, text: "i saw that." };
  });
  scheduler.observe([trade("a", "BUY", 0.2, 0)]);
  await scheduler.pump();
  scheduler.observe([trade("b", "SELL", 0.2, 8_000)]);
  at(1_000);
  await scheduler.pump();
  assert.equal(calls, 1);
  at(5_000);
  await scheduler.pump();
  assert.equal(calls, 2);

  const busy = harness(async () => {
    calls += 1;
    return { ok: true, text: "a lot happened at once." };
  });
  for (let window = 0; window < 6; window += 1) {
    busy.at(window * 8_000);
    busy.scheduler.observe(many(30, "BUY", 0.1, window * 8_000));
    await busy.scheduler.pump();
  }
  assert.ok(busy.scheduler.metrics().attempts < 6);
  assert.ok(busy.scheduler.metrics().superseded >= 1);
});

test("openai concurrency stays at one under overlapping pumps", async () => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let active = 0;
  let maxActive = 0;
  const { scheduler } = harness(async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await gate;
    active -= 1;
    return { ok: true, text: "i saw that." };
  });
  scheduler.observe([trade("a", "BUY", 0.2, 0)]);
  scheduler.observe([trade("b", "BUY", 0.3, 0)]);
  const first = scheduler.pump();
  const second = scheduler.pump();
  assert.equal(scheduler.metrics().openaiActive, 1);
  assert.equal(scheduler.metrics().maxOpenaiActive, 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(maxActive, 1);
  assert.equal(MAX_OPENAI_REACTION_CONCURRENCY, 1);
  release();
  await Promise.all([first, second]);
  assert.equal(scheduler.metrics().maxOpenaiActive, 1);
});

test("one thousand trades become few attempts and stale summaries are not replayed", async () => {
  const report = await runReactionStress();
  assert.equal(report.pass, true);
  assert.equal(report.tradeEvents, 1_000);
  assert.equal(report.maxOpenaiConcurrency, 1);
  assert.ok(report.openaiAttempts < report.tradeEvents / 10);
  assert.equal(report.priorityFirst, true);
  assert.equal(report.duplicateAfterRestart, false);
  assert.ok(report.expiredOrSuperseded >= 10);
  assert.ok(report.recoveryAttempts <= 2);
});

test("a stale summary expires and an outage does not replay it", async () => {
  let calls = 0;
  const { scheduler, store, at } = harness(async () => {
    calls += 1;
    return { ok: false, transient: true, reason: "unavailable" };
  });
  scheduler.observe([trade("old", "BUY", 0.2, 0)]);
  at(30_000);
  await scheduler.pump();
  assert.equal(calls, 0);
  assert.equal(store.rows.get("window:0")?.status, "EXPIRED");
  at(90_000);
  await scheduler.pump();
  assert.equal(calls, 0);
});

test("a priority event is spoken before a queued activity summary", async () => {
  const order: string[] = [];
  const { scheduler } = harness(async (facts) => {
    order.push(facts.mode);
    return { ok: true, text: facts.mode === "PRIORITY" ? "noted." : "i saw that." };
  });
  scheduler.observe([trade("a", "BUY", 0.4, 0)]);
  scheduler.pushPriority("DEX_PAID", "synthetic-dex");
  await scheduler.next();
  assert.equal(order[0], "PRIORITY");
  assert.equal(scheduler.metrics().queueDepth, 1);
});

test("the same reaction source is not stored twice", async () => {
  const store = createMemoryReactionStore();
  const now = 0;
  const infer = async (): Promise<InferenceResult> => ({ ok: true, text: "i saw that." });
  const first = new ReactionScheduler({ now: () => now, store, infer });
  first.observe([trade("a", "BUY", 0.2, 0)]);
  await first.pump();
  const second = new ReactionScheduler({ now: () => now, store, infer });
  second.observe([trade("a", "BUY", 0.2, 0)]);
  await second.pump();
  const generated = [...store.rows.values()].filter((row) => row.status === "GENERATED");
  assert.equal(generated.length, 1);
  assert.equal(second.metrics().attempts, 0);
});

test("timeout, rate limit, empty, and prohibited output fall back once", async () => {
  const cases: Array<{ result: InferenceResult; attempts: number }> = [
    { result: { ok: false, transient: true, reason: "timeout" }, attempts: 2 },
    { result: { ok: false, transient: true, reason: "rate_limit" }, attempts: 2 },
    { result: { ok: false, transient: false, reason: "empty" }, attempts: 1 },
    { result: { ok: true, text: "buy now." }, attempts: 1 },
    { result: { ok: true, text: "" }, attempts: 1 },
  ];
  for (const [index, item] of cases.entries()) {
    let calls = 0;
    const { scheduler, store } = harness(async () => {
      calls += 1;
      return item.result;
    });
    scheduler.observe([trade(`t-${index}`, "BUY", 0.2, index * 8_000)]);
    await scheduler.pump();
    assert.equal(calls, item.attempts);
    assert.equal(store.rows.get(`window:${index * 8_000}`)?.text, "i saw that.");
    assert.equal(store.rows.get(`window:${index * 8_000}`)?.text?.includes("buy now"), false);
  }
});

test("fallback lines stay inside the output contract", () => {
  const summary = aggregateTrades([trade("a", "BUY", 0.2, 0)], 0)[0];
  assert.ok(summary);
  for (const text of [fallbackText(summary), "things are moving.", "a lot happened at once.", "noted."]) {
    const validated = validateReactionText(text);
    assert.equal(validated.ok, true);
  }
  assert.equal(validateReactionText("buy now.").ok, false);
  assert.equal(validateReactionText("don't sell.").ok, false);
  assert.equal(validateReactionText("hold.").ok, false);
  assert.equal(validateReactionText("we're going higher.").ok, false);
  assert.equal(validateReactionText("```\ncode\n```").ok, false);
  assert.equal(validateReactionText("the threshold moved.").ok, true);
});

test("repeated inference failures open and then close the circuit", async () => {
  let down = true;
  let calls = 0;
  const { scheduler, at } = harness(async () => {
    calls += 1;
    if (down) {
      return { ok: false, transient: true, reason: "unavailable" };
    }
    return { ok: true, text: "i saw that." };
  });
  for (let step = 0; step < 3; step += 1) {
    at(step * 5_000);
    scheduler.observe([trade(`c-${step}`, "BUY", 0.2, step * 8_000)]);
    await scheduler.pump();
  }
  assert.equal(scheduler.metrics().degraded, true);
  const paused = calls;
  at(15_000);
  scheduler.observe([trade("paused", "BUY", 0.2, 24_000)]);
  await scheduler.pump();
  assert.equal(calls, paused);
  down = false;
  at(15_000 + CIRCUIT_OPEN_MS);
  scheduler.observe([trade("back", "BUY", 0.2, 80_000)]);
  await scheduler.pump();
  assert.equal(scheduler.metrics().degraded, false);
  assert.ok(calls > paused);
});

test("prelaunch keeps the reaction scheduler idle", () => {
  assert.equal(reactionSchedulerMode("PRELAUNCH", null), "IDLE");
  assert.equal(reactionSchedulerMode("LIVE", null), "IDLE");
  assert.equal(reactionSchedulerMode("LIVE", "1".repeat(32)), "ACTIVE");
  assert.equal(BIT_REACTION_MODEL, "gpt-6-luna");
});

test("reaction source does not fan out openai calls", () => {
  const text = readFileSync(new URL("./reaction.ts", import.meta.url), "utf8");
  assert.equal(text.includes("Promise.all"), false);
  assert.equal(text.includes("sendTransaction"), false);
});
