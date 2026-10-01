const PROMPTS: Record<string, string> = {
  IDLE: "waiting.",
  NOTICE: "noticed.",
  BUY: "buy observed.",
  SELL: "sell observed.",
  BUSY: "busy.",
  BURN: "burn detected.",
  DEX_PAID: "dex paid.",
};

/** Short terminal ending. Personality stays in the commentary pools. */
export function terminalPrompt(state: string): string {
  return PROMPTS[state] ?? "waiting.";
}
