"use client";

import { useEffect, useState } from "react";
import { commentarySeed, idleCommentaryActive, IDLE_COMMENTARY_MS, spokenLine } from "./bit-commentary";
import { useBitFeed } from "./use-bit-visual";

export function BitSpeech() {
  const feed = useBitFeed();
  const [idleTick, setIdleTick] = useState(0);
  const state = feed.pose.state;
  const spoken = spokenLine({
    launchState: feed.presence?.launchState ?? null,
    reactionText: feed.speech,
    state,
    seed: commentarySeed(state, feed.cueId, idleTick),
  });
  const phrase = spoken.text;

  useEffect(() => {
    if (!idleCommentaryActive(state)) {
      return;
    }
    const timer = window.setInterval(() => setIdleTick((tick) => tick + 1), IDLE_COMMENTARY_MS);
    return () => window.clearInterval(timer);
  }, [state]);

  return (
    <h1 key={phrase} className={spoken.source === "reaction" ? "bit-speech" : "bit-speech bit-commentary"}>
      {phrase}
    </h1>
  );
}
