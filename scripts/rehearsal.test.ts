import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BitRuntime } from "@heybit/shared";
import { createMemoryReactionStore, ReactionScheduler } from "@heybit/shared/reaction";
import {
  decideRehearsalStart,
  formatRehearsalStatus,
  isRehearsalEffective,
  publicPresence,
  readRehearsal,
  rehearsalWindow,
  REHEARSAL_DURATION_MS,
  resolveEffective,
  type RehearsalRecord,
} from "@heybit/shared/rehearsal";
import { isCanonicalMint } from "@heybit/shared";
import { formatWorkerStatus } from "../apps/worker/src/runtime.js";
import { listenerForRuntime } from "../apps/worker/src/health.js";

const REHEARSAL_MINT = "XLBLxbY1Mr7aadnqAbmqSBXLEyUdjvUXtXCnz8Mpump";
const OFFICIAL_MINT = "1".repeat(32);
const STARTED_AT = Date.parse("2026-10-02T12:00:00.000Z");

function prelaunch(): BitRuntime {
  return {
    canonicalMint: null,
    launchState: "PRELAUNCH",
    activationTimestamp: null,
    launchSignature: null,
    launchSlot: null,
  };
}

function live(): BitRuntime {
  return { ...prelaunch(), canonicalMint: OFFICIAL_MINT, launchState: "LIVE" };
}

function record(overrides: Partial<RehearsalRecord> = {}): RehearsalRecord {
  const window = rehearsalWindow(STARTED_AT);
  return {
    mint: REHEARSAL_MINT,
    startedAt: window.startedAt,
    expiresAt: window.expiresAt,
    stoppedAt: null,
    ...overrides,
  };
}

test("the supplied rehearsal mint is a canonical address and the window is exactly ten minutes", () => {
  assert.equal(isCanonicalMint(REHEARSAL_MINT), true);
  assert.equal(REHEARSAL_DURATION_MS, 600_000);
  const window = rehearsalWindow(STARTED_AT);
  assert.equal(Date.parse(window.expiresAt) - Date.parse(window.startedAt), REHEARSAL_DURATION_MS);
});

test("PRELAUNCH with no rehearsal leaves the token inactive", () => {
  const permanent = prelaunch();
  const view = resolveEffective(permanent, null, STARTED_AT);
  assert.equal(view.mode, "PRELAUNCH");
  assert.equal(view.effectiveLive, false);
  assert.equal(view.mint, null);
  assert.equal(publicPresence(permanent, null, STARTED_AT).launchState, "PRELAUNCH");
  assert.equal(listenerForRuntime({ status: "ok", runtime: permanent }).listener, "IDLE");
});

test("an active rehearsal makes only the supplied mint effective", () => {
  const permanent = prelaunch();
  const rehearsal = record();
  const before = STARTED_AT + REHEARSAL_DURATION_MS - 1;
  const view = resolveEffective(permanent, rehearsal, before);
  assert.equal(view.mode, "REHEARSAL");
  assert.equal(view.effectiveLive, true);
  assert.equal(view.mint, REHEARSAL_MINT);
  assert.equal(view.launchState, "LIVE");
  const presence = publicPresence(permanent, rehearsal, before);
  assert.equal(presence.launchState, "LIVE");
  assert.equal(presence.mint, REHEARSAL_MINT);
  assert.equal(permanent.launchState, "PRELAUNCH");
  assert.equal(permanent.canonicalMint, null);
});

test("the rehearsal is inactive at and after expiry", () => {
  const permanent = prelaunch();
  const rehearsal = record();
  const expiry = Date.parse(rehearsal.expiresAt);
  for (const now of [expiry, expiry + 1]) {
    const view = resolveEffective(permanent, rehearsal, now);
    assert.equal(view.mode, "PRELAUNCH");
    assert.equal(view.effectiveLive, false);
    assert.equal(view.mint, null);
    const presence = publicPresence(permanent, rehearsal, now);
    assert.equal(presence.launchState, "PRELAUNCH");
    assert.equal(presence.mint, null);
    assert.equal(isRehearsalEffective(rehearsal, now), false);
  }
});

test("a rehearsal does not overwrite the permanent canonical mint", () => {
  const permanent = live();
  const rehearsal = record();
  const view = resolveEffective(permanent, rehearsal, STARTED_AT + 1_000);
  assert.equal(view.mode, "LIVE");
  assert.equal(view.mint, OFFICIAL_MINT);
  assert.equal(permanent.canonicalMint, OFFICIAL_MINT);
  assert.equal(permanent.launchState, "LIVE");
  assert.equal(decideRehearsalStart({
    mint: REHEARSAL_MINT,
    duration: "10m",
    permanent,
    existing: null,
    nowMs: STARTED_AT,
  }), "permanent-live");
});

test("invalid mints and durations other than 10m are rejected", () => {
  const permanent = prelaunch();
  assert.equal(decideRehearsalStart({
    mint: "not-a-mint",
    duration: "10m",
    permanent,
    existing: null,
    nowMs: STARTED_AT,
  }), "invalid-mint");
  assert.equal(decideRehearsalStart({
    mint: REHEARSAL_MINT,
    duration: "9m",
    permanent,
    existing: null,
    nowMs: STARTED_AT,
  }), "bad-duration");
  assert.equal(decideRehearsalStart({
    mint: REHEARSAL_MINT,
    duration: null,
    permanent,
    existing: null,
    nowMs: STARTED_AT,
  }), "bad-duration");
  const stretched = record({ expiresAt: new Date(STARTED_AT + 11 * 60 * 1000).toISOString() });
  assert.equal(isRehearsalEffective(stretched, STARTED_AT + 1_000), false);
});

test("starting again during an active rehearsal is refused and an expired one can be replaced", () => {
  const permanent = prelaunch();
  const rehearsal = record();
  assert.equal(decideRehearsalStart({
    mint: REHEARSAL_MINT,
    duration: "10m",
    permanent,
    existing: rehearsal,
    nowMs: STARTED_AT + 1_000,
  }), "already-active");
  assert.equal(decideRehearsalStart({
    mint: REHEARSAL_MINT,
    duration: "10m",
    permanent,
    existing: rehearsal,
    nowMs: Date.parse(rehearsal.expiresAt),
  }), "ok");
});

test("queued reaction work cannot stay live after the rehearsal is released", async () => {
  const calls: string[] = [];
  const store = createMemoryReactionStore();
  const scheduler = new ReactionScheduler({
    now: () => STARTED_AT,
    store,
    infer: async () => {
      calls.push("infer");
      return { ok: true as const, text: "i saw that." };
    },
  });
  scheduler.observe([
    { signature: "sig-rehearsal", type: "BUY", solAmount: 1, observedAt: new Date(STARTED_AT).toISOString() },
  ]);
  scheduler.hold();
  await scheduler.pump();
  assert.deepEqual(calls, []);
  assert.equal([...store.rows.values()].some((row) => row.status === "GENERATED"), false);

  const speaking = new ReactionScheduler({
    now: () => STARTED_AT,
    store,
    infer: async () => {
      speaking.hold();
      return { ok: true as const, text: "i saw that." };
    },
  });
  speaking.observe([
    { signature: "sig-inflight", type: "BUY", solAmount: 1, observedAt: new Date(STARTED_AT).toISOString() },
  ]);
  await speaking.pump();
  assert.equal([...store.rows.values()].every((row) => row.status !== "GENERATED"), true);
});

test("status output names the window and does not leak secrets", () => {
  const secret = "service_role eyJhbGci sk-live postgres://supabase";
  const active = formatRehearsalStatus({
    permanent: prelaunch(),
    rehearsal: record(),
    nowMs: STARTED_AT,
  });
  assert.match(active, /HEYBIT — REHEARSAL STATUS/);
  assert.match(active, /mode \.+ REHEARSAL/);
  assert.match(active, new RegExp(REHEARSAL_MINT));
  assert.match(active, /effective live \.+ YES/);
  assert.match(active, /worker listener \.+ ACTIVE/);
  assert.match(active, /reaction scheduler \.+ ACTIVE/);
  assert.equal(active.includes(secret), false);
  assert.equal(active.includes("eyJ"), false);
  assert.equal(active.includes("sk-"), false);

  const expired = formatRehearsalStatus({
    permanent: prelaunch(),
    rehearsal: record(),
    nowMs: Date.parse(record().expiresAt),
  });
  assert.match(expired, /mode \.+ PRELAUNCH/);
  assert.match(expired, /remaining \.+ expired/);
  assert.match(expired, /effective live \.+ NO/);
  assert.match(expired, /worker listener \.+ IDLE/);
  assert.match(expired, new RegExp(REHEARSAL_MINT));
  assert.equal(expired.includes(secret), false);
});

test("worker status shows rehearsal while the window is open and prelaunch after it", () => {
  const open = formatWorkerStatus({
    runtime: {
      status: "ok",
      label: "REHEARSAL",
      runtime: { ...prelaunch(), launchState: "LIVE", canonicalMint: REHEARSAL_MINT },
    },
    alchemyReady: true,
    listener: "ACTIVE",
    reason: "canonical mint is live",
  });
  assert.match(open, /runtime state: REHEARSAL/);
  assert.match(open, new RegExp(`canonical mint: ${REHEARSAL_MINT}`));
  assert.equal(open.includes("sk-"), false);

  const closed = formatWorkerStatus({
    runtime: { status: "ok", runtime: prelaunch() },
    alchemyReady: true,
    listener: "IDLE",
    reason: "token not live",
  });
  assert.match(closed, /runtime state: PRELAUNCH/);
  assert.match(closed, /canonical mint: none/);
  assert.match(closed, /trade listener: IDLE/);
  assert.match(closed, /reaction scheduler: IDLE/);
});

test("rehearsal reads do not write and the command path leaves bit_runtime alone", async () => {
  const calls: string[] = [];
  const client = {
    from(table: string) {
      calls.push(`from:${table}`);
      return {
        select(columns: string) {
          calls.push(`select:${columns}`);
          return {
            eq() {
              return { maybeSingle: async () => ({ data: null, error: null }) };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  const read = await readRehearsal(client);
  assert.equal(read.status, "none");
  assert.deepEqual(calls, ["from:bit_rehearsal", "select:id, mint, started_at, expires_at, stopped_at"]);

  const start = readFileSync(new URL("./rehearsal-start.ts", import.meta.url), "utf8");
  const stop = readFileSync(new URL("./rehearsal-stop.ts", import.meta.url), "utf8");
  const status = readFileSync(new URL("./rehearsal-status.ts", import.meta.url), "utf8");
  const migration = readFileSync(
    new URL("../supabase/migrations/20261002130000_create_bit_rehearsal.sql", import.meta.url),
    "utf8",
  );
  for (const source of [start, stop, status]) {
    assert.equal(source.includes("bit_runtime"), false, source);
    assert.equal(source.includes("canonical_mint"), false, source);
    assert.equal(source.includes("launch_state"), false, source);
    assert.equal(source.includes("sendTransaction"), false, source);
    assert.equal(source.includes("console.log(process.env"), false, source);
  }
  assert.match(start, /from\("bit_rehearsal"\)/);
  assert.match(start, /\.upsert\(/);
  assert.match(stop, /\.update\(/);
  assert.match(migration, /expires_at = started_at \+ interval '10 minutes'/);
  assert.match(migration, /Does not alter bit_runtime, processed_transactions, or bit_reactions\./);
  assert.equal(/alter table public\.bit_runtime/.test(migration), false);
  assert.match(migration, /revoke insert, update, delete on table public\.bit_rehearsal from anon, authenticated/);

  const monitor = readFileSync(new URL("../apps/worker/src/monitor.ts", import.meta.url), "utf8");
  const workerRuntime = readFileSync(new URL("../apps/worker/src/runtime.ts", import.meta.url), "utf8");
  assert.match(monitor, /reactions\.setLive\(gate\.listener === "ACTIVE"\)/);
  const process = monitor.slice(monitor.indexOf("async function processSignature"));
  assert.ok(process.indexOf('gate.listener !== "ACTIVE"') < process.indexOf("reactions.note"));
  assert.equal(workerRuntime.includes(".update("), false);
  assert.equal(workerRuntime.includes(".upsert("), false);

  const route = readFileSync(new URL("../apps/web/app/api/bit-visual/route.ts", import.meta.url), "utf8");
  const hook = readFileSync(new URL("../apps/web/components/bit/use-bit-visual.tsx", import.meta.url), "utf8");
  const statusView = readFileSync(new URL("../apps/web/components/bit/BitStatus.tsx", import.meta.url), "utf8");
  assert.match(route, /readPublicPresence/);
  assert.equal(route.includes("bit_runtime"), false);
  assert.match(hook, /readPresence/);
  assert.equal(hook.split('fetch("/api/bit-visual"').length - 1, 1);
  assert.match(statusView, /feed\.presence/);
  assert.equal(statusView.includes("fetch("), false);
  assert.equal(statusView.includes("setTimeout"), false);
  assert.equal(statusView.includes("setInterval"), false);
});
