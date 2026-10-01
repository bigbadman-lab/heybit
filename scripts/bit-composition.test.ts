import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("homepage composition keeps one column and the existing surfaces", () => {
  const page = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../apps/web/app/globals.css", import.meta.url), "utf8");
  const feed = readFileSync(new URL("../apps/web/components/bit/use-bit-visual.tsx", import.meta.url), "utf8");
  const labPage = readFileSync(new URL("../apps/web/app/lab/bit/page.tsx", import.meta.url), "utf8");
  const order = [
    'className="eyebrow"',
    "<BitProduction />",
    "<BitReactionContext />",
    "<BitSpeech />",
    "<BitEventTape />",
    "<BitStatus",
    "<BitPrompt />",
  ];
  let cursor = -1;
  for (const marker of order) {
    const index = page.indexOf(marker);
    assert.ok(index > cursor, marker);
    cursor = index;
  }
  for (const rejected of ["HOW BIT WORKS", "BIT HAS STATES", "THE SYSTEM", "HomeLower", "home-lower"]) {
    assert.equal(page.includes(rejected), false, rejected);
  }
  assert.equal(page.includes("BIT runtime:"), false);
  assert.equal(page.includes("Official mint:"), false);
  for (const forbidden of ["wallet", "chart", "hamburger", "swap"]) {
    assert.equal(page.toLowerCase().includes(forbidden), false);
  }
  assert.match(css, /--bit-column: 27\.5rem/);
  assert.match(css, /--bit-column: 24rem/);
  assert.match(css, /--bit-column: 16rem/);
  assert.equal(feed.split('fetch("/api/bit-visual"').length - 1, 1);
  assert.equal(labPage.includes("BitReactionContext"), false);
  assert.equal(labPage.includes("BitStatus"), false);
  assert.equal(labPage.includes("BitEventTape"), false);
});
