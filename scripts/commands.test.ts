import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { BIT_BURN_MESSAGE, BIT_DEX_PAID_MESSAGE, LAUNCH_ACTIVATE_MESSAGE } from "./lib/refuse.js";

function runCommand(script: string): { status: number | null; stdout: string } {
  const result = spawnSync("tsx", [script, "--confirm-production", "ExampleMint111111111111111111111111111111"], {
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout };
}

test("mutation commands refuse and perform no writes", () => {
  const activate = runCommand("scripts/launch-activate.ts");
  assert.equal(activate.status, 1);
  assert.equal(activate.stdout, LAUNCH_ACTIVATE_MESSAGE);
  assert.equal(activate.stdout.includes("ExampleMint"), false);

  const burn = runCommand("scripts/bit-burn.ts");
  assert.equal(burn.status, 1);
  assert.equal(burn.stdout, BIT_BURN_MESSAGE);
  assert.match(burn.stdout, /No Solana transaction was created/);

  const dexPaid = runCommand("scripts/bit-dex-paid.ts");
  assert.equal(dexPaid.status, 1);
  assert.equal(dexPaid.stdout, BIT_DEX_PAID_MESSAGE);
  assert.match(dexPaid.stdout, /No production state was changed/);
});
