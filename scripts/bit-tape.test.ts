import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatTapeAge, TAPE_ROW_LIMIT, tapeKindLabel, tapeRows } from "../apps/web/components/bit/bit-tape.js";

test("tape keeps the newest supported events and drops duplicates", () => {
  const rows = tapeRows([
    { id: "sell", kind: "SELL", atMs: 1_000 },
    { id: "buy", kind: "BUY", atMs: 4_000 },
    { id: "buy", kind: "BUY", atMs: 4_000 },
    { id: "burn", kind: "BURN", atMs: 3_000 },
    { id: "dex", kind: "DEX_PAID", atMs: 2_000 },
    { id: "notice", kind: "NOTICE", atMs: 9_000 },
    { id: "busy", kind: "BUSY", atMs: 8_000 },
    { id: "old", kind: "BUY", atMs: 100 },
    { id: "older", kind: "SELL", atMs: 50 },
    { id: " ", kind: "BUY", atMs: 7_000 },
  ]);
  assert.deepEqual(
    rows.map((row) => row.id),
    ["buy", "burn", "dex", "sell", "old"],
  );
  assert.equal(rows.length <= TAPE_ROW_LIMIT, true);
  assert.equal(tapeKindLabel("DEX_PAID"), "DEX PAID");
  assert.equal(tapeKindLabel("BUY"), "BUY");
  assert.equal(tapeKindLabel("SELL"), "SELL");
  assert.equal(tapeKindLabel("BURN"), "BURN");
});

test("tape ages stay short", () => {
  const now = 1_000_000;
  assert.equal(formatTapeAge(now, now), "now");
  assert.equal(formatTapeAge(now - 4_000, now), "4s");
  assert.equal(formatTapeAge(now - 18_000, now), "18s");
  assert.equal(formatTapeAge(now - 60_000, now), "1m");
  assert.equal(formatTapeAge(now - 180_000, now), "3m");
  assert.equal(formatTapeAge(undefined, now), "now");
});

test("homepage tape shares the visual feed and the lab stays clear", () => {
  const page = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
  const tape = readFileSync(new URL("../apps/web/components/bit/BitEventTape.tsx", import.meta.url), "utf8");
  const feed = readFileSync(new URL("../apps/web/components/bit/use-bit-visual.tsx", import.meta.url), "utf8");
  const production = readFileSync(new URL("../apps/web/components/bit/BitProduction.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../apps/web/app/globals.css", import.meta.url), "utf8");
  const labPage = readFileSync(new URL("../apps/web/app/lab/bit/page.tsx", import.meta.url), "utf8");
  const lab = readFileSync(new URL("../apps/web/components/bit/BitLab.tsx", import.meta.url), "utf8");
  const mascot = readFileSync(new URL("../apps/web/components/bit/BitMascot3D.tsx", import.meta.url), "utf8");
  assert.match(page, /<BitVisualFeed>/);
  assert.match(page, /<BitEventTape \/>/);
  assert.ok(page.indexOf("Official mint:") < page.indexOf("<BitEventTape />"));
  assert.match(tape, /Waiting for activity…/);
  assert.match(tape, /Live feed unavailable\./);
  assert.match(tape, /aria-live="polite"/);
  assert.equal(tape.includes('aria-live="assertive"'), false);
  assert.equal(tape.includes("fetch("), false);
  assert.equal(tape.includes("supabase"), false);
  assert.equal(tape.includes("SOL"), false);
  assert.equal(production.includes("fetch("), false);
  assert.equal(feed.split('fetch("/api/bit-visual"').length - 1, 1);
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.bit-tape-row\.is-new/);
  for (const text of [labPage, lab, mascot]) {
    assert.equal(text.includes("BitEventTape"), false);
    assert.equal(text.includes("/api/bit-visual"), false);
  }
  for (const forbidden of ["insert(", "update(", "upsert(", "delete(", "sendTransaction", "processed_transactions", "bit_reactions"]) {
    assert.equal(tape.includes(forbidden), false);
    assert.equal(feed.includes(forbidden), false);
  }
});
