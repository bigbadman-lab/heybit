import { isCanonicalMint } from "@heybit/shared";

export const COPY_FEEDBACK_MS = 1_600;

export interface TokenActionLinks {
  mint: string;
  solscan: string;
}

/**
 * Public destinations for a live canonical mint.
 * Pump.fun and a separate market page are omitted: the repo has no canonical URL for either.
 */
export function tokenActionLinks(launchState: string | null, mint: string | null): TokenActionLinks | null {
  if (launchState !== "LIVE" || !isCanonicalMint(mint)) {
    return null;
  }
  return {
    mint,
    solscan: `https://solscan.io/token/${encodeURIComponent(mint)}`,
  };
}

/** Development review only. Production ignores the query, and it does not change runtime. */
export function developmentActionMint(nodeEnv: string | undefined, search: string): string | null {
  if (nodeEnv === "production") {
    return null;
  }
  const mint = new URLSearchParams(search).get("bitActions");
  return isCanonicalMint(mint) ? mint : null;
}

export async function writeMint(mint: string, writeText: (value: string) => Promise<void>): Promise<boolean> {
  try {
    await writeText(mint);
    return true;
  } catch {
    return false;
  }
}
