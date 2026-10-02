export const INTRO_SESSION_KEY = "heybit.intro.seen";
/** How long the finished intro stays before the market line replaces it. */
export const INTRO_HOLD_MS = 3_600;
export const INTRO_FADE_MS = 560;

export const PRELAUNCH_INTRO = [
  "oh. hello.",
  "i’m BIT.",
  "i watch what happens around here onchain.",
  "when a market exists, i notice.",
  "when something matters, i’ll tell you.",
] as const;

export const LIVE_INTRO = [
  "oh. hello.",
  "i’m BIT.",
  "i’m watching the chain.",
  "when activity changes, i notice.",
  "when something matters, i’ll tell you.",
] as const;

export function introLines(launchState: "PRELAUNCH" | "LIVE" | null): readonly string[] {
  return launchState === "LIVE" ? LIVE_INTRO : PRELAUNCH_INTRO;
}

export function shouldStartIntro(seen: boolean, launchKnown: boolean): boolean {
  return launchKnown && !seen;
}

export function introCanYield(firstLineDone: boolean, launchState: "PRELAUNCH" | "LIVE" | null, reactionText: string | null): boolean {
  return firstLineDone && launchState === "LIVE" && Boolean(reactionText && reactionText.trim() !== "");
}
