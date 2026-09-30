import assert from "node:assert/strict";
import test from "node:test";
import {
  buyFixture,
  failedFixture,
  FIXTURE_MINT,
  irrelevantFixture,
  liveRuntime,
  OBSERVED_AT,
  prelaunchRuntime,
  sellFixture,
} from "./fixtures.js";
import {
  createMemoryLedger,
  decideMonitoring,
  identifyCluster,
  MAINNET_GENESIS_HASH,
  parseTrade,
  processObservedTransaction,
  reconnectDelayMs,
  reduceListener,
  safelyProcessObservedTransaction,
  TESTNET_GENESIS_HASH,
} from "./trade.js";

test("genesis hash identifies mainnet and rejects other clusters", () => {
  assert.equal(identifyCluster(MAINNET_GENESIS_HASH), "mainnet");
  assert.equal(identifyCluster(TESTNET_GENESIS_HASH), "testnet");
  assert.equal(identifyCluster("not-a-cluster"), "unknown");
});

test("PRELAUNCH keeps the listener idle", () => {
  const decision = decideMonitoring(prelaunchRuntime());
  assert.deepEqual(decision, { action: "idle", mint: null, reason: "token not live" });
});

test("LIVE with a mint activates listening", () => {
  const decision = decideMonitoring(liveRuntime());
  assert.equal(decision.action, "listen");
  assert.equal(decision.mint, FIXTURE_MINT);
});

test("runtime transition from PRELAUNCH to LIVE changes the listener", () => {
  const idle = reduceListener({ mode: "IDLE", mint: null, attempt: 0 }, { type: "runtime", runtime: prelaunchRuntime() });
  const live = reduceListener(idle, { type: "runtime", runtime: liveRuntime() });
  assert.equal(idle.mode, "IDLE");
  assert.equal(live.mode, "ACTIVE");
  assert.equal(live.mint, FIXTURE_MINT);
});

test("classifies a fee-payer BUY and SELL from balance changes", () => {
  const buy = parseTrade(buyFixture(), FIXTURE_MINT, OBSERVED_AT);
  assert.equal(buy.kind, "trade");
  if (buy.kind === "trade") {
    assert.equal(buy.event.type, "BUY");
    assert.equal(buy.event.solAmount, 0.5);
    assert.equal(buy.event.tokenAmount, 1);
  }

  const sell = parseTrade(sellFixture(), FIXTURE_MINT, OBSERVED_AT);
  assert.equal(sell.kind, "trade");
  if (sell.kind === "trade") {
    assert.equal(sell.event.type, "SELL");
    assert.equal(sell.event.solAmount, 0.5);
    assert.equal(sell.event.tokenAmount, 1);
  }
});

test("ignores failed, irrelevant, and malformed transactions", () => {
  assert.equal(parseTrade(failedFixture(), FIXTURE_MINT, OBSERVED_AT).kind, "ignore");
  const irrelevant = parseTrade(irrelevantFixture(), FIXTURE_MINT, OBSERVED_AT);
  assert.deepEqual(irrelevant, { kind: "ignore", reason: "irrelevant" });
  const malformed = parseTrade({ ...buyFixture(), feePayer: "" }, FIXTURE_MINT, OBSERVED_AT);
  assert.deepEqual(malformed, { kind: "ignore", reason: "malformed" });
});

test("a duplicate signature does not create a second event after restart", async () => {
  const ledger = createMemoryLedger();
  const first = await processObservedTransaction({
    tx: buyFixture(),
    mint: FIXTURE_MINT,
    observedAt: OBSERVED_AT,
    ledger,
  });
  const second = await processObservedTransaction({
    tx: buyFixture(),
    mint: FIXTURE_MINT,
    observedAt: OBSERVED_AT,
    ledger,
  });
  assert.equal(first, "trade");
  assert.equal(second, "duplicate");
  assert.equal(ledger.rows.length, 1);
  assert.equal(ledger.rows[0]?.eventType, "BUY");
});

test("websocket close enters reconnect and supabase loss keeps the listener", () => {
  const active = reduceListener(
    { mode: "IDLE", mint: null, attempt: 0 },
    { type: "runtime", runtime: liveRuntime() },
  );
  const closed = reduceListener(active, { type: "socket-closed" });
  const stillActive = reduceListener(active, { type: "supabase-down" });
  const reopened = reduceListener(closed, { type: "socket-open" });
  assert.equal(closed.mode, "RECONNECTING");
  assert.equal(closed.mint, FIXTURE_MINT);
  assert.equal(stillActive.mode, "ACTIVE");
  assert.equal(reopened.mode, "ACTIVE");
  assert.equal(reconnectDelayMs(1), 1_000);
  assert.equal(reconnectDelayMs(6), 30_000);
});

test("a temporary ledger failure asks for a retry and does not throw", async () => {
  const result = await safelyProcessObservedTransaction({
    tx: buyFixture(),
    mint: FIXTURE_MINT,
    observedAt: OBSERVED_AT,
    ledger: {
      claim() {
        throw new Error("database unavailable");
      },
    },
  });
  assert.equal(result, "retry");
});
