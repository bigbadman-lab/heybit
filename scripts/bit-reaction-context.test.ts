import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { reactionContextLabel } from "../apps/web/components/bit/bit-reaction-context.js";

test("reaction context labels follow the active one-shot", () => {
  assert.equal(reactionContextLabel("IDLE"), null);
  assert.equal(reactionContextLabel("BUSY"), null);
  assert.equal(reactionContextLabel("NOTICE"), "NOTICE");
  assert.equal(reactionContextLabel("BUY"), "BUY");
  assert.equal(reactionContextLabel("SELL"), "SELL");
  assert.equal(reactionContextLabel("BURN"), "BURN");
  assert.equal(reactionContextLabel("DEX_PAID"), "DEX PAID");
  assert.equal(reactionContextLabel("ROBOT"), null);
});

test("reaction context sits under BIT and does not add a second feed", () => {
  const page = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
  const context = readFileSync(new URL("../apps/web/components/bit/BitReactionContext.tsx", import.meta.url), "utf8");
  const helper = readFileSync(new URL("../apps/web/components/bit/bit-reaction-context.ts", import.meta.url), "utf8");
  const feed = readFileSync(new URL("../apps/web/components/bit/use-bit-visual.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../apps/web/app/globals.css", import.meta.url), "utf8");
  const labPage = readFileSync(new URL("../apps/web/app/lab/bit/page.tsx", import.meta.url), "utf8");
  const lab = readFileSync(new URL("../apps/web/components/bit/BitLab.tsx", import.meta.url), "utf8");
  assert.ok(page.indexOf('className="eyebrow"') < page.indexOf("<BitProduction />"));
  assert.ok(page.indexOf("<BitProduction />") < page.indexOf("<BitReactionContext />"));
  assert.ok(page.indexOf("<BitEventTape />") < page.indexOf("<BitStatus"));
  assert.match(context, /useBitFeed/);
  assert.match(context, /reactionContextLabel\(feed\.pose\.state\)/);
  assert.match(context, /aria-live="polite"/);
  assert.equal(context.includes('aria-live="assertive"'), false);
  assert.equal(context.includes("setTimeout"), false);
  assert.equal(context.includes("setInterval"), false);
  assert.equal(context.includes("fetch("), false);
  assert.equal(context.includes("SOL"), false);
  assert.equal(helper.includes("EVENT_DURATION_MS"), false);
  assert.equal(feed.split('fetch("/api/bit-visual"').length - 1, 1);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.bit-reaction-label \{\s*transform: none;/);
  assert.match(css, /bit-reaction-label\.is-on/);
  for (const forbidden of ["insert(", "update(", "upsert(", "delete(", "sendTransaction", "openai"]) {
    assert.equal(context.includes(forbidden), false);
  }
  for (const text of [labPage, lab]) {
    assert.equal(text.includes("BitReactionContext"), false);
  }
});
