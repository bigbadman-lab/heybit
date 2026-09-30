import type { BitRuntime } from "./index.js";
import type { InspectableTransaction } from "./trade.js";

export const FIXTURE_MINT = "1".repeat(32);
export const FIXTURE_TRADER = "2".repeat(32);
export const FIXTURE_OTHER_MINT = "3".repeat(32);
export const OBSERVED_AT = "2026-09-30T16:30:00.000Z";

const base = {
  signature: "fixture-signature",
  slot: 100,
  err: false,
  feeLamports: 5_000,
  feePayer: FIXTURE_TRADER,
  accountLamports: [{ pubkey: FIXTURE_TRADER, pre: 2_000_000_000, post: 1_499_995_000 }],
  preTokenBalances: [
    { owner: FIXTURE_TRADER, mint: FIXTURE_MINT, amount: "0", decimals: 6 },
  ],
  postTokenBalances: [
    { owner: FIXTURE_TRADER, mint: FIXTURE_MINT, amount: "1000000", decimals: 6 },
  ],
} satisfies InspectableTransaction;

export function buyFixture(): InspectableTransaction {
  return structuredClone(base);
}

export function sellFixture(): InspectableTransaction {
  const tx = buyFixture();
  tx.signature = "fixture-sell";
  tx.accountLamports = [{ pubkey: FIXTURE_TRADER, pre: 1_000_000_000, post: 1_499_995_000 }];
  tx.preTokenBalances = [{ owner: FIXTURE_TRADER, mint: FIXTURE_MINT, amount: "1000000", decimals: 6 }];
  tx.postTokenBalances = [{ owner: FIXTURE_TRADER, mint: FIXTURE_MINT, amount: "0", decimals: 6 }];
  return tx;
}

export function failedFixture(): InspectableTransaction {
  const tx = buyFixture();
  tx.signature = "fixture-failed";
  tx.err = true;
  return tx;
}

export function irrelevantFixture(): InspectableTransaction {
  const tx = buyFixture();
  tx.signature = "fixture-irrelevant";
  tx.preTokenBalances = [{ owner: FIXTURE_TRADER, mint: FIXTURE_OTHER_MINT, amount: "0", decimals: 6 }];
  tx.postTokenBalances = [{ owner: FIXTURE_TRADER, mint: FIXTURE_OTHER_MINT, amount: "1000000", decimals: 6 }];
  return tx;
}

export function prelaunchRuntime(): BitRuntime {
  return {
    canonicalMint: null,
    launchState: "PRELAUNCH",
    activationTimestamp: null,
    launchSignature: null,
    launchSlot: null,
  };
}

export function liveRuntime(): BitRuntime {
  return {
    canonicalMint: FIXTURE_MINT,
    launchState: "LIVE",
    activationTimestamp: OBSERVED_AT,
    launchSignature: null,
    launchSlot: 100,
  };
}
