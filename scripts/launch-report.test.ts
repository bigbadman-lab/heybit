import assert from "node:assert/strict";
import test from "node:test";
import { formatLaunchStatus } from "./lib/launch-report.js";
import { formatPreflight, runPreflight } from "./lib/preflight.js";

const SECRET = "super-secret-value-should-not-print";
const VALID_MINT = "1".repeat(32);

test("launch status formats PRELAUNCH without inventing a mint", () => {
  const text = formatLaunchStatus(
    {
      status: "ok",
      runtime: {
        canonicalMint: null,
        launchState: "PRELAUNCH",
        activationTimestamp: null,
        launchSignature: null,
        launchSlot: null,
      },
    },
    { rpc: "PASS", wss: "PASS" },
    { openai: "PASS", reactionPipeline: "READY", reactionScheduler: "IDLE" },
  );
  assert.match(text, /Canonical mint \.+ none/);
  assert.match(text, /Launch state \.+ PRELAUNCH/);
  assert.match(text, /Database \.+ CONNECTED/);
  assert.match(text, /Runtime row \.+ PASS/);
  assert.match(text, /Trade listener \.+ IDLE/);
  assert.match(text, /Queue capacity \.+ READY/);
  assert.match(text, /Concurrency \.+ 3/);
  assert.match(text, /Backpressure \.+ READY/);
  assert.match(text, /OpenAI \.+ PASS/);
  assert.match(text, /Reaction pipeline \.+ READY/);
  assert.match(text, /Reaction scheduler \.+ IDLE/);
  assert.match(text, /Reason \.+ token not live/);
  assert.match(text, /VERDICT: PRELAUNCH/);
  assert.equal(text.includes("BIT IS READY TO LAUNCH"), false);
});

test("launch status can show a public mint when LIVE", () => {
  const text = formatLaunchStatus(
    {
      status: "ok",
      runtime: {
        canonicalMint: VALID_MINT,
        launchState: "LIVE",
        activationTimestamp: "2026-09-30T16:00:00.000Z",
        launchSignature: "sig",
        launchSlot: 10,
      },
    },
    { rpc: "PASS", wss: "PASS" },
  );
  assert.match(text, new RegExp(`Canonical mint \\.+ ${VALID_MINT}`));
  assert.match(text, /Trade listener \.+ ACTIVE/);
  assert.match(text, /VERDICT: LIVE/);
  assert.match(text, /not launch approval/);
});

test("launch status hides database error details", () => {
  const text = formatLaunchStatus({ status: "unavailable" });
  assert.match(text, /Database \.+ UNAVAILABLE/);
  assert.match(text, /Runtime row \.+ FAIL/);
  assert.match(text, /VERDICT: BLOCKED/);
  assert.equal(text.includes(SECRET), false);
});

test("preflight stays short of production launch approval", async () => {
  const report = await runPreflight({});
  const text = formatPreflight(report);
  assert.equal(report.foundationOk, true);
  assert.equal(report.env.ok, false);
  assert.equal(report.phase4Ok, false);
  assert.match(text, /Local env \.+ BLOCKED/);
  assert.match(text, /Supabase \.+ FAIL/);
  assert.match(text, /Trade parser \.+ PASS/);
  assert.match(text, /Durable dedupe \.+ FAIL/);
  assert.match(text, /Trade stress \.+ PASS/);
  assert.match(text, /OpenAI \.+ FAIL/);
  assert.match(text, /Reaction aggregation \.+ PASS/);
  assert.match(text, /Reaction idempotency \.+ FAIL/);
  assert.match(text, /Reaction stress \.+ PASS/);
  assert.match(text, /Final website \.+ NOT IMPLEMENTED/);
  assert.match(text, /NOT PRODUCTION READY/);
  assert.match(text, /VERDICT: PHASE 4 BLOCKED/);
  assert.equal(text.includes("BIT IS READY TO LAUNCH"), false);
  assert.equal(text.includes(SECRET), false);
});
