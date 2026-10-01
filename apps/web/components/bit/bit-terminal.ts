/** Short terminal ending. Personality stays in the commentary pools. */
export function terminalPrompt(state: string): string {
  if (state === "IDLE") {
    return "waiting.";
  }
  return "observing.";
}
