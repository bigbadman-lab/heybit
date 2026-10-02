/** Stored speech is visible only while public presence is live and a mint is set. */
export function visiblePublicSpeech(
  presence: { launchState: string | null; mint: string | null },
  reactionText: string | null,
): string | null {
  const speech = presence.launchState === "LIVE" && presence.mint ? reactionText : null;
  return speech;
}
