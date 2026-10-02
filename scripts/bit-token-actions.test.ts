import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  developmentActionMint,
  tokenActionLinks,
  writeMint,
} from "../apps/web/components/bit/bit-token-actions.js";

const VALID_MINT = "1".repeat(32);
const LONG_MINT = "9".repeat(44);

test("token actions stay hidden until the runtime is live with a valid mint", () => {
  assert.equal(tokenActionLinks("PRELAUNCH", null), null);
  assert.equal(tokenActionLinks("PRELAUNCH", VALID_MINT), null);
  assert.equal(tokenActionLinks("LIVE", null), null);
  assert.equal(tokenActionLinks("LIVE", ""), null);
  assert.equal(tokenActionLinks("LIVE", "not-a-mint"), null);
  assert.equal(tokenActionLinks("LIVE", `${VALID_MINT}/extra`), null);
  assert.equal(tokenActionLinks("LIVE", "0".repeat(32)), null);
  assert.equal(tokenActionLinks(null, VALID_MINT), null);

  const live = tokenActionLinks("LIVE", VALID_MINT);
  assert.deepEqual(live, {
    mint: VALID_MINT,
    solscan: `https://solscan.io/token/${VALID_MINT}`,
  });
  const longer = tokenActionLinks("LIVE", LONG_MINT);
  assert.equal(longer?.mint, LONG_MINT);
  assert.equal(longer?.solscan, `https://solscan.io/token/${LONG_MINT}`);
});

test("copy writes the exact mint and a clipboard failure stays quiet", async () => {
  const seen: string[] = [];
  assert.equal(await writeMint(VALID_MINT, async (value) => {
    seen.push(value);
  }), true);
  assert.deepEqual(seen, [VALID_MINT]);
  assert.equal(await writeMint(VALID_MINT, async () => {
    throw new Error("denied");
  }), false);
});

test("development preview cannot activate production links", () => {
  assert.equal(developmentActionMint("production", `?bitActions=${VALID_MINT}`), null);
  assert.equal(developmentActionMint("development", "?bitActions=not-a-mint"), null);
  assert.equal(developmentActionMint("development", `?bitActions=${VALID_MINT}`), VALID_MINT);
});

test("homepage actions reuse the canonical mint and add no trading surface", () => {
  const page = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
  const status = readFileSync(new URL("../apps/web/components/bit/BitStatus.tsx", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../apps/web/components/bit/bit-token-actions.ts", import.meta.url), "utf8");
  const view = readFileSync(new URL("../apps/web/components/bit/BitTokenActions.tsx", import.meta.url), "utf8");
  const commentary = readFileSync(new URL("../apps/web/components/bit/bit-commentary.ts", import.meta.url), "utf8");
  const tape = readFileSync(new URL("../apps/web/components/bit/bit-tape.ts", import.meta.url), "utf8");
  const market = readFileSync(new URL("../apps/web/components/bit/bit-market.ts", import.meta.url), "utf8");
  const labPage = readFileSync(new URL("../apps/web/app/lab/bit/page.tsx", import.meta.url), "utf8");
  const manifest = readFileSync(new URL("../config/env-manifest.json", import.meta.url), "utf8");
  const shared = readFileSync(new URL("../packages/shared/src/index.ts", import.meta.url), "utf8");

  assert.match(page, /mint=\{presence\.mint\}/);
  assert.equal((page.match(/presence\.mint/g) ?? []).length, 1);
  assert.match(status, /<BitTokenActions launchState=\{shownLaunch\} mint=\{shownMint\} \/>/);
  assert.ok(status.indexOf('["FEED"') < status.indexOf("<BitTokenActions"));
  assert.match(status, /marketStatus\(shownLaunch, shownKnown\)/);
  assert.match(view, /navigator\.clipboard\.writeText/);
  assert.match(view, /rel="noopener noreferrer"/);
  assert.match(view, /target="_blank"/);
  assert.match(view, /type="button"/);
  assert.equal(view.includes('aria-live="assertive"'), false);
  assert.match(actions, /isCanonicalMint/);
  assert.match(shared, /export function isCanonicalMint/);
  assert.equal(actions.includes("pump.fun"), false);
  assert.equal(view.includes("pump.fun"), false);
  assert.equal(actions.includes("dexscreener"), false);
  assert.equal(actions.includes("jup.ag"), false);

  for (const source of [page, status, actions, view, manifest]) {
    for (const flag of ["TOKEN_LINKS_ENABLED", "SHOW_ACTIONS", "MARKET_ENABLED"]) {
      assert.equal(source.includes(flag), false, flag);
    }
    for (const forbidden of ["wallet", "phantom", "reown", "slippage", "sendTransaction", "BUY NOW", "TRADE NOW"]) {
      assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
    }
    for (const write of ["insert(", "update(", "upsert(", "delete("]) {
      assert.equal(source.includes(write), false, write);
    }
  }

  assert.equal(commentary.includes("tokenActionLinks"), false);
  assert.equal(tape.includes("tokenActionLinks"), false);
  assert.equal(market.includes("solscan"), false);
  assert.equal(labPage.includes("BitTokenActions"), false);
  assert.equal(labPage.includes("BitStatus"), false);
});
