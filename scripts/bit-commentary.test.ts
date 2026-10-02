import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BIT_MASCOT_STATES } from "../apps/web/components/bit/bit-mascot.constants.js";
import {
  COMMENTARY_POOLS,
  FALLBACK_COMMENTARY,
  IDLE_COMMENTARY_MS,
  commentarySeed,
  feedLabel,
  mintLabel,
  runtimeLabel,
  selectPhrase,
} from "../apps/web/components/bit/bit-commentary.js";

const FORBIDDEN = [
  "buy now",
  "sell now",
  "send it",
  "easy money",
  "guaranteed",
  "we're going higher",
  "bottom is in",
  "bullish",
  "bearish",
  "don't sell",
  "keep buying",
];

test("commentary pools stay state-specific and non-advisory", () => {
  const seen = new Set<string>();
  for (const state of BIT_MASCOT_STATES) {
    const pool = COMMENTARY_POOLS[state];
    assert.ok(pool.length >= 5 && pool.length <= 12, state);
    for (const phrase of pool) {
      assert.equal(seen.has(phrase), false, phrase);
      seen.add(phrase);
      for (const forbidden of FORBIDDEN) {
        assert.equal(phrase.toLowerCase().includes(forbidden), false, phrase);
      }
    }
  }
  assert.equal(COMMENTARY_POOLS.IDLE.includes(FALLBACK_COMMENTARY), true);
  assert.ok(IDLE_COMMENTARY_MS >= 15_000 && IDLE_COMMENTARY_MS <= 30_000);
});

test("phrase selection is stable and follows the state", () => {
  assert.equal(selectPhrase("BUY", "cue-1"), selectPhrase("BUY", "cue-1"));
  assert.equal(selectPhrase("BUY", "cue-1"), selectPhrase("BUY", "cue-1"));
  assert.ok(COMMENTARY_POOLS.BUY.includes(selectPhrase("BUY", "cue-1")));
  assert.ok(COMMENTARY_POOLS.SELL.includes(selectPhrase("SELL", "cue-1")));
  assert.notEqual(selectPhrase("BUY", "cue-1"), selectPhrase("SELL", "cue-1"));
  assert.equal(selectPhrase("BUY", commentarySeed("BUY", "cue-1", 0)), selectPhrase("BUY", commentarySeed("BUY", "cue-1", 4)));
  assert.notEqual(commentarySeed("BUY", "cue-1", 0), commentarySeed("BUY", "cue-2", 0));
  assert.ok(COMMENTARY_POOLS.IDLE.includes(selectPhrase("ROBOT", "x")));
  assert.equal(selectPhrase("IDLE", commentarySeed("IDLE", null, 0)), selectPhrase("IDLE", "idle:0"));
  assert.equal(commentarySeed("BUSY", null, 3), "busy");
  const commentary = readFileSync(new URL("../apps/web/components/bit/bit-commentary.ts", import.meta.url), "utf8");
  assert.equal(commentary.includes("Math.random"), false);
});

test("status facts come from runtime and the shared feed", () => {
  assert.equal(runtimeLabel(null), "UNAVAILABLE");
  assert.equal(runtimeLabel("PRELAUNCH"), "PRELAUNCH");
  assert.equal(runtimeLabel("LIVE"), "LIVE");
  assert.equal(mintLabel(null, false), "UNAVAILABLE");
  assert.equal(mintLabel(null, true), "NOT LAUNCHED");
  assert.equal(mintLabel("MintAddress", true), "MintAddress");
  assert.equal(feedLabel("live"), "LIVE");
  assert.equal(feedLabel("unavailable"), "UNAVAILABLE");
  assert.equal(feedLabel("pending"), "…");

  const page = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
  const status = readFileSync(new URL("../apps/web/components/bit/BitStatus.tsx", import.meta.url), "utf8");
  const speech = readFileSync(new URL("../apps/web/components/bit/BitSpeech.tsx", import.meta.url), "utf8");
  const feed = readFileSync(new URL("../apps/web/components/bit/use-bit-visual.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../apps/web/app/globals.css", import.meta.url), "utf8");
  const labPage = readFileSync(new URL("../apps/web/app/lab/bit/page.tsx", import.meta.url), "utf8");
  const lab = readFileSync(new URL("../apps/web/components/bit/BitLab.tsx", import.meta.url), "utf8");
  assert.match(page, /readPublicPresence/);
  assert.match(page, /launchState=\{presence\.launchState\}/);
  assert.match(page, /mint=\{presence\.mint\}/);
  assert.ok(page.indexOf("<BitEventTape />") < page.indexOf("<BitStatus"));
  assert.equal(page.includes("BIT runtime:"), false);
  assert.equal(page.includes("Official mint:"), false);
  assert.match(status, /useBitFeed/);
  assert.match(speech, /feed\.pose\.state/);
  assert.match(speech, /spokenLine/);
  assert.equal(status.includes("fetch("), false);
  assert.equal(status.includes("openai"), false);
  assert.equal(status.includes('aria-live="assertive"'), false);
  assert.equal(feed.split('fetch("/api/bit-visual"').length - 1, 1);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.bit-commentary/);
  for (const forbidden of ["insert(", "update(", "upsert(", "delete(", "sendTransaction", "openai"]) {
    assert.equal(status.includes(forbidden), false);
  }
  for (const text of [labPage, lab]) {
    assert.equal(text.includes("BitStatus"), false);
  }
});
