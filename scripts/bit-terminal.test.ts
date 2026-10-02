import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatTapeClock } from "../apps/web/components/bit/bit-tape.js";
import { terminalPrompt } from "../apps/web/components/bit/bit-terminal.js";

test("terminal prompt follows state and does not advise", () => {
  assert.equal(terminalPrompt("IDLE"), "waiting.");
  assert.equal(terminalPrompt("NOTICE"), "noticed.");
  assert.equal(terminalPrompt("BUY"), "buy observed.");
  assert.equal(terminalPrompt("SELL"), "sell observed.");
  assert.equal(terminalPrompt("BUSY"), "busy.");
  assert.equal(terminalPrompt("BURN"), "burn detected.");
  assert.equal(terminalPrompt("DEX_PAID"), "dex paid.");
  assert.equal(terminalPrompt("ROBOT"), "waiting.");
  for (const state of ["IDLE", "NOTICE", "BUY", "SELL", "BUSY", "BURN", "DEX_PAID", "ROBOT"]) {
    assert.equal(/buy now|sell now|pump|moon|bullish|bearish|good entry|bad exit/i.test(terminalPrompt(state)), false, state);
  }
  const at = Date.UTC(2026, 0, 1, 12, 31, 4);
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, "0");
  assert.equal(formatTapeClock(at), `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`);
  assert.equal(formatTapeClock(undefined), null);
});

test("homepage is a terminal and the rejected landing page is gone", () => {
  const page = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
  const speech = readFileSync(new URL("../apps/web/components/bit/BitSpeech.tsx", import.meta.url), "utf8");
  const prompt = readFileSync(new URL("../apps/web/components/bit/BitPrompt.tsx", import.meta.url), "utf8");
  const tape = readFileSync(new URL("../apps/web/components/bit/BitEventTape.tsx", import.meta.url), "utf8");
  const status = readFileSync(new URL("../apps/web/components/bit/BitStatus.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../apps/web/app/globals.css", import.meta.url), "utf8");
  const feed = readFileSync(new URL("../apps/web/components/bit/use-bit-visual.tsx", import.meta.url), "utf8");
  const labPage = readFileSync(new URL("../apps/web/app/lab/bit/page.tsx", import.meta.url), "utf8");

  assert.match(page, /readPublicPresence/);
  assert.match(page, /<BitProduction \/>/);
  assert.match(page, /<BitSpeech \/>/);
  assert.match(page, /<BitEventTape \/>/);
  assert.match(page, /<BitPrompt \/>/);
  assert.equal((page.match(/presence\.mint/g) ?? []).length, 1);
  assert.match(speech, /selectPhrase/);
  assert.match(speech, /<h1/);
  assert.match(tape, /tapeRows\(feed\.events\)/);
  assert.match(tape, /no activity\./);
  assert.match(status, /marketStatus\(shownLaunch, shownKnown\)/);
  assert.match(status, /<BitTokenActions/);
  assert.match(prompt, /aria-hidden="true"/);
  assert.match(css, /--bit-column: 27\.5rem/);
  assert.match(css, /--bit-xs:/);
  assert.match(css, /--bit-xl:/);
  assert.equal(css.includes("min(72rem"), false);
  assert.equal(feed.split('fetch("/api/bit-visual"').length - 1, 1);

  for (const source of [page, speech, prompt, tape, status]) {
    for (const rejected of ["HOW BIT WORKS", "BIT HAS STATES", "THE SYSTEM", "HomeLower", "wallet", "swap", "PRICE", "HOLDERS"]) {
      assert.equal(source.includes(rejected), false, rejected);
    }
    for (const write of ["insert(", "update(", "upsert(", "delete(", "fetch("]) {
      assert.equal(source.includes(write), false, write);
    }
  }
  assert.equal(labPage.includes("BitSpeech"), false);
  assert.equal(labPage.includes("BitPrompt"), false);
  assert.equal(labPage.includes("BitStatus"), false);
  assert.equal(labPage.includes("BitEventTape"), false);
});
