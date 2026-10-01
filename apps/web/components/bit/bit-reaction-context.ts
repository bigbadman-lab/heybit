const CONTEXT_LABELS: Record<string, string> = {
  NOTICE: "NOTICE",
  BUY: "BUY",
  SELL: "SELL",
  BURN: "BURN",
  DEX_PAID: "DEX PAID",
};

/** Factual label for the active one-shot. IDLE and BUSY stay blank. */
export function reactionContextLabel(state: string): string | null {
  return CONTEXT_LABELS[state] ?? null;
}
