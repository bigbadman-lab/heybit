import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BitRuntimeError, getBitRuntime, parseBitRuntime } from "./index.js";

const VALID_MINT = "1".repeat(32);

function clientReturning(result: { data: unknown; error: { code?: string } | null }, calls: string[]): SupabaseClient {
  return {
    from(table: string) {
      calls.push(`from:${table}`);
      return {
        select(columns: string) {
          calls.push(`select:${columns}`);
          return {
            eq(column: string, value: number) {
              calls.push(`eq:${column}=${value}`);
              return {
                maybeSingle: async () => result,
              };
            },
            insert() {
              calls.push("insert");
            },
            update() {
              calls.push("update");
            },
            delete() {
              calls.push("delete");
            },
            upsert() {
              calls.push("upsert");
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

const prelaunchRow = {
  id: 1,
  canonical_mint: null,
  launch_state: "PRELAUNCH",
  activation_timestamp: null,
  launch_signature: null,
  launch_slot: null,
};

test("PRELAUNCH with a null mint is valid", () => {
  assert.deepEqual(parseBitRuntime(prelaunchRow), {
    canonicalMint: null,
    launchState: "PRELAUNCH",
    activationTimestamp: null,
    launchSignature: null,
    launchSlot: null,
  });
});

test("LIVE with a mint is valid", () => {
  const runtime = parseBitRuntime({
    ...prelaunchRow,
    canonical_mint: VALID_MINT,
    launch_state: "LIVE",
    activation_timestamp: "2026-09-30T16:00:00.000Z",
    launch_signature: "sig",
    launch_slot: "10",
  });
  assert.equal(runtime.launchState, "LIVE");
  assert.equal(runtime.canonicalMint, VALID_MINT);
  assert.equal(runtime.launchSlot, 10);
});

test("LIVE with a null mint is invalid", () => {
  assert.throws(() => parseBitRuntime({ ...prelaunchRow, launch_state: "LIVE" }), BitRuntimeError);
});

test("invalid launch states are rejected", () => {
  assert.throws(() => parseBitRuntime({ ...prelaunchRow, launch_state: "PAUSED" }), BitRuntimeError);
});

test("the repository maps one row and does not write", async () => {
  const calls: string[] = [];
  const runtime = await getBitRuntime(clientReturning({ data: prelaunchRow, error: null }, calls));
  assert.equal(runtime.launchState, "PRELAUNCH");
  assert.deepEqual(calls, [
    "from:bit_runtime",
    "select:id, canonical_mint, launch_state, activation_timestamp, launch_signature, launch_slot",
    "eq:id=1",
  ]);
});

test("a missing runtime row fails clearly", async () => {
  await assert.rejects(
    getBitRuntime(clientReturning({ data: null, error: null }, [])),
    (error: unknown) => error instanceof BitRuntimeError && error.code === "missing-row",
  );
});

test("a malformed runtime row fails clearly", async () => {
  await assert.rejects(
    getBitRuntime(clientReturning({ data: { id: 1, launch_state: "PRELAUNCH" }, error: null }, [])),
    (error: unknown) => error instanceof BitRuntimeError && error.code === "malformed",
  );
});

test("a missing table is reported without database details", async () => {
  await assert.rejects(
    getBitRuntime(clientReturning({ data: null, error: { code: "PGRST205" } }, [])),
    (error: unknown) => {
      assert.ok(error instanceof BitRuntimeError);
      assert.equal(error.code, "schema-missing");
      assert.equal(error.message, "Canonical runtime table is missing.");
      return true;
    },
  );
});
