import assert from "node:assert/strict";
import test from "node:test";
import { EVENT_TYPES, RUNTIME_STATES } from "./index.js";

test("shared event contracts are BUY, SELL, TOKEN_BURN, and DEX_PAID", () => {
  assert.deepEqual([...EVENT_TYPES], ["BUY", "SELL", "TOKEN_BURN", "DEX_PAID"]);
});

test("runtime state contracts are PRELAUNCH and LIVE", () => {
  assert.deepEqual([...RUNTIME_STATES], ["PRELAUNCH", "LIVE"]);
});
