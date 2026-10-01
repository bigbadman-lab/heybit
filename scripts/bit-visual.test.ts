import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { BIT_MASCOT_STATES, EVENT_DURATION_MS } from "../apps/web/components/bit/bit-mascot.constants.js";
import {
  createBitVisualController,
  mapFeedRows,
  playRehearsal,
  VISUAL_QUEUE_LIMIT,
  type VisualEvent,
} from "../apps/web/components/bit/bit-visual.js";

test("visual states stay the locked mascot list", () => {
  assert.deepEqual([...BIT_MASCOT_STATES], ["IDLE", "NOTICE", "BUY", "SELL", "BUSY", "BURN", "DEX_PAID"]);
});

test("production pose comes from the feed and durations stay shared", () => {
  const production = readFileSync(new URL("../apps/web/components/bit/BitProduction.tsx", import.meta.url), "utf8");
  const page = readFileSync(new URL("../apps/web/app/page.tsx", import.meta.url), "utf8");
  const controller = readFileSync(new URL("../apps/web/components/bit/bit-visual.ts", import.meta.url), "utf8");
  assert.match(production, /useBitVisualPose/);
  assert.equal(production.includes('state="IDLE"'), false);
  assert.equal(page.includes("setTimeout"), false);
  assert.match(controller, /EVENT_DURATION_MS/);
  for (const duration of Object.values(EVENT_DURATION_MS)) {
    assert.equal(controller.includes(String(duration)), false);
  }
});

test("feed rows map trades and priority reactions without inventing busy", () => {
  const source = mapFeedRows([
    { cue_id: "sig-buy", kind: "BUY", observed_at: "2026-09-30T18:00:02.000Z" },
    { cue_id: "sig-sell", kind: "SELL", observed_at: "2026-09-30T18:00:01.000Z" },
    { cue_id: "priority:TOKEN_BURN:1", kind: "BURN", observed_at: "2026-09-30T18:00:03.000Z" },
    { cue_id: "priority:DEX_PAID:1", kind: "DEX_PAID", observed_at: "2026-09-30T18:00:04.000Z" },
    { cue_id: "priority:ACTIVITY:1", kind: "ACTIVITY", observed_at: "2026-09-30T18:00:05.000Z" },
    { cue_id: "notice", kind: "NOTICE", observed_at: "2026-09-30T18:00:00.000Z" },
  ]);
  assert.ok(source);
  assert.deepEqual(
    source.events.map((event) => event.kind),
    ["NOTICE", "SELL", "BUY", "BURN", "DEX_PAID"],
  );
  assert.equal(source.busy, false);
  assert.equal(source.intensity, 0);
  assert.equal(mapFeedRows(null), null);
});

test("one shot returns to idle and busy resumes when work remains", () => {
  const idle = createBitVisualController();
  idle.push(event("buy-1", "BUY"));
  assert.equal(idle.sample(0).state, "BUY");
  assert.equal(idle.sample(EVENT_DURATION_MS.BUY ?? 0).state, "IDLE");

  const busy = createBitVisualController();
  busy.setBusy(true, 1.8);
  busy.push(event("buy-2", "BUY"));
  assert.equal(busy.sample(0).state, "BUY");
  assert.equal(busy.sample(0).intensity, 1);
  const resumed = busy.sample(EVENT_DURATION_MS.BUY ?? 0);
  assert.equal(resumed.state, "BUSY");
  assert.equal(resumed.intensity, 1);
  busy.setBusy(false, Number.NaN);
  assert.deepEqual(busy.sample((EVENT_DURATION_MS.BUY ?? 0) + 1), { state: "IDLE", intensity: 0 });
});

test("duplicate ids and a failed source do not replay or stick", () => {
  const controller = createBitVisualController();
  const cue = event("same", "SELL");
  controller.push(cue);
  controller.push(cue);
  assert.equal(controller.sample(0).state, "SELL");
  assert.equal(controller.sample(EVENT_DURATION_MS.SELL ?? 0).state, "IDLE");

  const live = createBitVisualController();
  live.ingest({ events: [event("old", "BURN", 1)], busy: false, intensity: 0 }, true);
  assert.equal(live.sample(0).state, "IDLE");
  live.ingest({ events: [event("old", "BURN", 1), event("new", "BUY", 2)], busy: false, intensity: 0 }, false);
  assert.equal(live.sample(10).state, "BUY");
  live.fail();
  assert.deepEqual(live.sample(20), { state: "IDLE", intensity: 0 });
});

test("rapid events stay bounded and stronger reactions win", () => {
  const bounded = createBitVisualController();
  for (let index = 0; index < 8; index += 1) {
    bounded.push(event(`notice-${index}`, "NOTICE"));
  }
  bounded.push(event("burn-now", "BURN"));
  assert.equal(bounded.sample(0).state, "BURN");
  let played = 1;
  let now = 0;
  while (played < VISUAL_QUEUE_LIMIT + 1) {
    now += EVENT_DURATION_MS.NOTICE ?? 0;
    const state = bounded.sample(now).state;
    if (state === "IDLE") {
      break;
    }
    played += 1;
  }
  assert.ok(played <= VISUAL_QUEUE_LIMIT + 1);

  const priority = createBitVisualController();
  priority.push(event("notice", "NOTICE"));
  priority.push(event("buy", "BUY"));
  priority.push(event("burn", "BURN"));
  assert.equal(priority.sample(0).state, "BURN");
  const afterBurn = EVENT_DURATION_MS.BURN ?? 0;
  assert.equal(priority.sample(afterBurn).state, "BUY");
  assert.equal(priority.sample(afterBurn + (EVENT_DURATION_MS.BUY ?? 0)).state, "NOTICE");
});

test("required sequences settle without a stuck state", () => {
  const chain = createBitVisualController();
  chain.push(event("a", "BUY"));
  chain.push(event("b", "BUY"));
  chain.push(event("c", "SELL"));
  chain.push(event("d", "BUY"));
  const buy = EVENT_DURATION_MS.BUY ?? 0;
  const sell = EVENT_DURATION_MS.SELL ?? 0;
  assert.equal(chain.sample(0).state, "BUY");
  assert.equal(chain.sample(buy).state, "BUY");
  assert.equal(chain.sample(buy * 2).state, "SELL");
  assert.equal(chain.sample(buy * 2 + sell).state, "BUY");
  assert.equal(chain.sample(buy * 3 + sell).state, "IDLE");

  const work = createBitVisualController();
  work.setBusy(true, 0.4);
  assert.equal(work.sample(0).state, "BUSY");
  work.push(event("during", "BUY"));
  assert.equal(work.sample(1).state, "BUY");
  assert.equal(work.sample(1 + buy).state, "BUSY");
  work.push(event("burn-during", "BURN"));
  assert.equal(work.sample(2 + buy).state, "BURN");
  assert.equal(work.sample(2 + buy + (EVENT_DURATION_MS.BURN ?? 0)).state, "BUSY");
  work.setBusy(false, 0);
  assert.equal(work.sample(3 + buy + (EVENT_DURATION_MS.BURN ?? 0)).state, "IDLE");
});

test("development rehearsal traces the required sequences", () => {
  assert.deepEqual(playRehearsal("buy"), ["IDLE", "BUY", "IDLE"]);
  assert.deepEqual(playRehearsal("sell"), ["IDLE", "SELL", "IDLE"]);
  assert.deepEqual(playRehearsal("burn"), ["IDLE", "BURN", "IDLE"]);
  assert.deepEqual(playRehearsal("dex-paid"), ["IDLE", "DEX_PAID", "IDLE"]);
  assert.deepEqual(playRehearsal("notice"), ["IDLE", "NOTICE", "IDLE"]);
  assert.deepEqual(playRehearsal("busy"), ["IDLE", "BUSY", "IDLE"]);
  assert.deepEqual(playRehearsal("busy-buy"), ["IDLE", "BUSY", "BUY", "BUSY"]);
  assert.deepEqual(playRehearsal("busy-burn"), ["IDLE", "BUSY", "BURN", "BUSY"]);
  assert.deepEqual(playRehearsal("buy-sell-buy"), ["IDLE", "BUY", "SELL", "BUY", "IDLE"]);
});

test("lab stays manual and the visual path does not write", () => {
  const lab = readFileSync(new URL("../apps/web/components/bit/BitLab.tsx", import.meta.url), "utf8");
  const labPage = readFileSync(new URL("../apps/web/app/lab/bit/page.tsx", import.meta.url), "utf8");
  const mascot = readFileSync(new URL("../apps/web/components/bit/BitMascot3D.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../apps/web/components/bit/BitScene.tsx", import.meta.url), "utf8");
  const feed = readFileSync(new URL("../apps/web/lib/bit-visual-feed.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../apps/web/app/api/bit-visual/route.ts", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../supabase/migrations/20260930221500_create_bit_visual_feed.sql", import.meta.url),
    "utf8",
  );
  for (const text of [lab, labPage]) {
    assert.equal(text.includes("use-bit-visual"), false);
    assert.equal(text.includes("/api/bit-visual"), false);
  }
  for (const text of [mascot, scene]) {
    assert.equal(text.includes("bit-visual"), false);
    assert.equal(text.includes("supabase"), false);
    assert.equal(text.includes("sendTransaction"), false);
  }
  for (const forbidden of ["insert(", "update(", "upsert(", "delete(", "sendTransaction", "bit_runtime"]) {
    assert.equal(feed.includes(forbidden), false, feed);
    assert.equal(route.includes(forbidden), false, route);
  }
  assert.match(migration, /grant select on table public\.bit_visual_feed to anon, authenticated/);
  assert.match(migration, /-- Does not alter bit_runtime, processed_transactions, or bit_reactions\./);
  const sql = migration.replace(/--.*$/gm, "");
  assert.equal(/\b(insert|update|delete|alter)\b/i.test(sql), false);
  const reader = readFileSync(new URL("../apps/web/lib/public-supabase.ts", import.meta.url), "utf8");
  const climb = reader.match(/fileURLToPath\(import\.meta\.url\)\), "(\.\.\/\.\.\/\.\.)"\)/);
  assert.ok(climb);
  const root = path.resolve(path.dirname(fileURLToPath(new URL("../apps/web/lib/public-supabase.ts", import.meta.url))), climb[1]);
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { name?: string };
  assert.equal(pkg.name, "heybit");
});

function event(id: string, kind: VisualEvent["kind"], atMs?: number): VisualEvent {
  return { id, kind, atMs };
}
