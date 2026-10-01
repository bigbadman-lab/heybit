import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { commentarySeed, idleCommentaryActive, selectPhrase } from "../apps/web/components/bit/bit-commentary.js";
import { EVENT_DURATION_MS } from "../apps/web/components/bit/bit-mascot.constants.js";
import { activeTapeId, tapeRows } from "../apps/web/components/bit/bit-tape.js";
import { terminalPrompt } from "../apps/web/components/bit/bit-terminal.js";
import { createBitVisualController, type VisualEvent } from "../apps/web/components/bit/bit-visual.js";

test("one cue holds one phrase and the idle clock stays still", () => {
  assert.equal(idleCommentaryActive("IDLE"), true);
  assert.equal(idleCommentaryActive("BUY"), false);
  assert.equal(idleCommentaryActive("BUSY"), false);
  assert.equal(selectPhrase("BUY", commentarySeed("BUY", "cue-1", 0)), selectPhrase("BUY", commentarySeed("BUY", "cue-1", 9)));
  assert.equal(selectPhrase("BUSY", commentarySeed("BUSY", "a", 0)), selectPhrase("BUSY", commentarySeed("BUSY", "b", 4)));

  let tick = 2;
  const before = selectPhrase("IDLE", commentarySeed("IDLE", null, tick));
  if (idleCommentaryActive("BUY")) {
    tick += 1;
  }
  const during = selectPhrase("BUY", commentarySeed("BUY", "cue-buy", tick));
  const after = selectPhrase("IDLE", commentarySeed("IDLE", null, tick));
  assert.equal(tick, 2);
  assert.equal(after, before);
  assert.notEqual(during, before);
});

test("prompt, speech, and the active row follow one cue", () => {
  const repeated = trace([
    { id: "buy-a", kind: "BUY", atMs: 2 },
    { id: "buy-b", kind: "BUY", atMs: 1 },
  ]);
  assert.deepEqual(repeated.map((frame) => frame.state), ["BUY", "BUY", "IDLE"]);
  assert.deepEqual(repeated.map((frame) => frame.cueId), ["buy-a", "buy-b", null]);
  assert.deepEqual(repeated.map((frame) => frame.prompt), ["buy observed.", "buy observed.", "waiting."]);
  assert.equal(repeated[0].phrase, selectPhrase("BUY", "buy-a"));
  assert.equal(repeated[1].phrase, selectPhrase("BUY", "buy-b"));
  assert.equal(repeated[0].activeRow, "buy-a");
  assert.equal(repeated[2].activeRow, null);

  const burnDuringBuy = trace([
    { id: "buy", kind: "BUY", atMs: 1 },
    { id: "burn", kind: "BURN", atMs: 2 },
  ]);
  assert.deepEqual(burnDuringBuy.map((frame) => frame.state), ["BURN", "BUY", "IDLE"]);
  assert.equal(burnDuringBuy[0].prompt, "burn detected.");
  assert.equal(burnDuringBuy[0].activeRow, "burn");
  assert.equal(burnDuringBuy[2].prompt, "waiting.");

  const dexNearBuy = trace([
    { id: "buy", kind: "BUY", atMs: 1 },
    { id: "dex", kind: "DEX_PAID", atMs: 2 },
  ]);
  assert.deepEqual(dexNearBuy.map((frame) => frame.state), ["DEX_PAID", "BUY", "IDLE"]);
  assert.equal(dexNearBuy[0].prompt, "dex paid.");

  const chain = trace([
    { id: "one", kind: "BUY", atMs: 3 },
    { id: "two", kind: "SELL", atMs: 2 },
    { id: "three", kind: "BUY", atMs: 1 },
  ]);
  assert.deepEqual(chain.map((frame) => frame.state), ["BUY", "SELL", "BUY", "IDLE"]);
  assert.deepEqual(chain.map((frame) => frame.prompt), ["buy observed.", "sell observed.", "buy observed.", "waiting."]);
  assert.deepEqual(chain.map((frame) => frame.activeRow), ["one", "two", "three", null]);
});

test("an in-progress cue finishes before a later higher-priority cue", () => {
  const controller = createBitVisualController();
  controller.push({ id: "buy", kind: "BUY" });
  assert.equal(controller.sample(0).state, "BUY");
  controller.push({ id: "burn", kind: "BURN" });
  assert.equal(controller.sample(10).state, "BUY");
  assert.equal(controller.activeCueId(), "buy");
  const afterBuy = EVENT_DURATION_MS.BUY ?? 0;
  assert.equal(controller.sample(afterBuy).state, "BURN");
  assert.equal(controller.activeCueId(), "burn");
  assert.equal(terminalPrompt("BURN"), "burn detected.");
  assert.equal(controller.sample(afterBuy + (EVENT_DURATION_MS.BURN ?? 0)).state, "IDLE");
  assert.equal(controller.activeCueId(), null);
});

test("the same cue does not replay speech or a ledger row", () => {
  const controller = createBitVisualController();
  const cue = { id: "same", kind: "SELL" as const };
  controller.push(cue);
  controller.push(cue);
  assert.equal(controller.sample(0).state, "SELL");
  assert.equal(controller.activeCueId(), "same");
  assert.equal(selectPhrase("SELL", commentarySeed("SELL", "same", 0)), selectPhrase("SELL", commentarySeed("SELL", "same", 3)));
  assert.equal(controller.sample(EVENT_DURATION_MS.SELL ?? 0).state, "IDLE");
  assert.deepEqual(tapeRows([cue, cue]).map((row) => row.id), ["same"]);
});

test("busy stays one phrase and notice is not invented by the reader", () => {
  const busy = trace([{ id: "burn", kind: "BURN", atMs: 1 }], true);
  assert.deepEqual(busy.map((frame) => frame.state), ["BURN", "BUSY"]);
  assert.equal(busy[1].prompt, "busy.");
  assert.equal(busy[1].phrase, selectPhrase("BUSY", "busy"));
  assert.equal(busy[1].activeRow, null);

  const reader = readFileSync(new URL("../apps/web/lib/bit-visual-feed.ts", import.meta.url), "utf8");
  const view = readFileSync(new URL("../supabase/migrations/20260930221500_create_bit_visual_feed.sql", import.meta.url), "utf8");
  assert.equal(reader.includes("busy: true"), false);
  assert.equal(reader.includes("setBusy"), false);
  assert.equal(view.includes("NOTICE"), false);
  assert.equal(view.includes("BUSY"), false);
});

test("empty and failed feeds stay factual and isolated", () => {
  assert.equal(tapeRows([]).length, 0);
  assert.equal(activeTapeId(null, []), null);
  const failed = createBitVisualController();
  failed.push({ id: "buy", kind: "BUY" });
  failed.sample(0);
  failed.fail();
  const pose = failed.sample(10);
  assert.equal(pose.state, "IDLE");
  assert.equal(failed.activeCueId(), null);
  assert.equal(terminalPrompt(pose.state), "waiting.");

  const tape = readFileSync(new URL("../apps/web/components/bit/BitEventTape.tsx", import.meta.url), "utf8");
  const speech = readFileSync(new URL("../apps/web/components/bit/BitSpeech.tsx", import.meta.url), "utf8");
  const prompt = readFileSync(new URL("../apps/web/components/bit/BitPrompt.tsx", import.meta.url), "utf8");
  const context = readFileSync(new URL("../apps/web/components/bit/BitReactionContext.tsx", import.meta.url), "utf8");
  const feed = readFileSync(new URL("../apps/web/components/bit/use-bit-visual.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../apps/web/app/globals.css", import.meta.url), "utf8");
  assert.match(tape, /no activity\./);
  assert.match(tape, /Live feed unavailable\./);
  assert.match(tape, /activeTapeId\(feed\.cueId/);
  assert.match(speech, /idleCommentaryActive\(state\)/);
  assert.equal(speech.includes("aria-live"), false);
  assert.match(prompt, /pose\.state/);
  assert.equal(prompt.includes("setInterval"), false);
  assert.equal(prompt.includes("setTimeout"), false);
  assert.equal(prompt.includes("aria-live"), false);
  assert.match(context, /label !== "NOTICE"/);
  assert.match(context, /aria-live="polite"/);
  assert.match(css, /bit-tape-row\.is-active/);
  assert.match(css, /bit-tape-in 220ms/);
  assert.equal(feed.split('fetch("/api/bit-visual"').length - 1, 1);
  assert.match(feed, /NODE_ENV === "production"/);
  for (const source of [tape, speech, prompt, context, feed]) {
    for (const forbidden of ["wallet", "swap", "sendTransaction", "openai"]) {
      assert.equal(source.includes(forbidden), false, forbidden);
    }
  }
});

function trace(events: readonly VisualEvent[], busy = false) {
  const controller = createBitVisualController();
  if (busy) {
    controller.setBusy(true, 0.4);
  }
  for (const event of events) {
    controller.push(event);
  }
  const frames = [];
  let now = 0;
  for (let step = 0; step < 8; step += 1) {
    const pose = controller.sample(now);
    const cueId = controller.activeCueId();
    frames.push({
      state: pose.state,
      cueId,
      prompt: terminalPrompt(pose.state),
      phrase: selectPhrase(pose.state, commentarySeed(pose.state, cueId, 3)),
      activeRow: activeTapeId(cueId, tapeRows(events)),
    });
    if (pose.state === "IDLE" || pose.state === "BUSY") {
      break;
    }
    now += EVENT_DURATION_MS[pose.state] ?? 0;
  }
  return frames;
}
