import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { marketStatus } from "../apps/web/components/bit/bit-market.js";

const FORBIDDEN_FLAGS = ["MARKET_ENABLED", "TOKEN_LIVE", "SHOW_MARKET_DATA"];
const FAKE_ZEROS = ["$0.00", "0 holders", "0 volume", "0 liquidity"];

test("market status follows canonical runtime and ignores a mint by itself", () => {
  assert.equal(marketStatus(null, false), "UNAVAILABLE");
  assert.equal(marketStatus("PRELAUNCH", false), "UNAVAILABLE");
  assert.equal(marketStatus("LIVE", false), "UNAVAILABLE");
  assert.equal(marketStatus("PRELAUNCH", true), "NOT LIVE");
  assert.equal(marketStatus("LIVE", true), "LIVE");
  assert.equal(marketStatus("PAUSED", true), "UNAVAILABLE");
  assert.equal(marketStatus(null, true), "UNAVAILABLE");
});

test("homepage market row reuses the runtime snapshot and adds no market infrastructure", () => {
  const page = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
  const status = readFileSync(new URL("../apps/web/components/bit/BitStatus.tsx", import.meta.url), "utf8");
  const market = readFileSync(new URL("../apps/web/components/bit/bit-market.ts", import.meta.url), "utf8");
  const commentary = readFileSync(new URL("../apps/web/components/bit/bit-commentary.ts", import.meta.url), "utf8");
  const tape = readFileSync(new URL("../apps/web/components/bit/bit-tape.ts", import.meta.url), "utf8");
  const feed = readFileSync(new URL("../apps/web/components/bit/use-bit-visual.tsx", import.meta.url), "utf8");
  const labPage = readFileSync(new URL("../apps/web/app/lab/bit/page.tsx", import.meta.url), "utf8");
  const manifest = readFileSync(new URL("../config/env-manifest.json", import.meta.url), "utf8");

  assert.match(page, /readPublicRuntime/);
  assert.match(page, /mint=\{runtime \? runtime\.canonicalMint : null\}/);
  assert.match(page, /launchState=\{runtime \? runtime\.launchState : null\}/);
  assert.equal(page.includes("canonicalMint"), true);
  assert.equal((page.match(/canonicalMint/g) ?? []).length, 1);

  const runtimeIndex = status.indexOf('["RUNTIME"');
  const marketIndex = status.indexOf('["MARKET"');
  const mintIndex = status.indexOf('["MINT"');
  const feedIndex = status.indexOf('["FEED"');
  assert.ok(runtimeIndex < marketIndex && marketIndex < mintIndex && mintIndex < feedIndex);
  assert.equal(status.includes('["STATE"'), false);
  assert.match(status, /marketStatus\(launchState, runtimeKnown\)/);
  assert.equal(status.includes("aria-live"), false);
  assert.equal(status.includes("fetch("), false);

  for (const source of [page, status, market, manifest]) {
    for (const flag of FORBIDDEN_FLAGS) {
      assert.equal(source.includes(flag), false, flag);
    }
    for (const zero of FAKE_ZEROS) {
      assert.equal(source.includes(zero), false, zero);
    }
    for (const forbidden of ["wallet", "swap", "slippage", "sendTransaction", "Connection(", "getBalance"]) {
      assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
    }
  }

  for (const source of [market, status, page]) {
    for (const write of ["insert(", "update(", "upsert(", "delete("]) {
      assert.equal(source.includes(write), false, write);
    }
  }

  assert.equal(market.includes("fetch("), false);
  assert.equal(market.includes("process.env"), false);
  assert.equal(commentary.includes("price is pumping"), false);
  assert.equal(commentary.includes("good time to buy"), false);
  assert.equal(tape.includes("marketStatus"), false);
  assert.equal(feed.split('fetch("/api/bit-visual"').length - 1, 1);
  assert.equal(labPage.includes("BitStatus"), false);
  assert.equal(labPage.includes("marketStatus"), false);
});
