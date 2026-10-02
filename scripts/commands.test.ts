import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { isCanonicalMint } from "@heybit/shared";
import { BIT_BURN_MESSAGE, BIT_DEX_PAID_MESSAGE } from "./lib/refuse.js";

const REJECTED_MINT = "ExampleMint111111111111111111111111111111";

function runCommand(script: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync("tsx", [script, "--confirm-production", REJECTED_MINT], {
    encoding: "utf8",
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("mutation commands refuse and perform no writes", () => {
  assert.equal(isCanonicalMint(REJECTED_MINT), false);
  const activate = runCommand("scripts/launch-activate.ts");
  assert.equal(activate.status, 1);
  assert.match(activate.stderr, /Mint format is invalid/);
  assert.equal(activate.stdout.includes(REJECTED_MINT), false);
  assert.equal(activate.stdout.includes("Read-back matched"), false);

  const burn = runCommand("scripts/bit-burn.ts");
  assert.equal(burn.status, 1);
  assert.equal(burn.stdout, BIT_BURN_MESSAGE);
  assert.match(burn.stdout, /No Solana transaction was created/);

  const dexPaid = runCommand("scripts/bit-dex-paid.ts");
  assert.equal(dexPaid.status, 1);
  assert.equal(dexPaid.stdout, BIT_DEX_PAID_MESSAGE);
  assert.match(dexPaid.stdout, /No production state was changed/);
});
