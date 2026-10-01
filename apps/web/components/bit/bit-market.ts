/**
 * Market status is the canonical launch state, not a price feed.
 * LIVE is taken only from bit_runtime. A mint alone does not make the market live.
 */
export function marketStatus(launchState: string | null, runtimeKnown: boolean): string {
  if (!runtimeKnown) {
    return "UNAVAILABLE";
  }
  if (launchState === "LIVE") {
    return "LIVE";
  }
  if (launchState === "PRELAUNCH") {
    return "NOT LIVE";
  }
  return "UNAVAILABLE";
}
