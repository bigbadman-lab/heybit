"use client";

import { useEffect, useState } from "react";
import {
  commentarySeed,
  feedLabel,
  IDLE_COMMENTARY_MS,
  mintLabel,
  runtimeLabel,
  selectPhrase,
} from "./bit-commentary";
import { marketStatus } from "./bit-market";
import { BitTokenActions } from "./BitTokenActions";
import { useBitFeed } from "./use-bit-visual";

export function BitStatus({
  launchState,
  mint,
  runtimeKnown,
}: {
  launchState: string | null;
  mint: string | null;
  runtimeKnown: boolean;
}) {
  const feed = useBitFeed();
  const [idleTick, setIdleTick] = useState(0);
  const state = feed.pose.state;
  const phrase = selectPhrase(state, commentarySeed(state, feed.cueId, idleTick));

  useEffect(() => {
    if (state !== "IDLE") {
      return;
    }
    const timer = window.setInterval(() => setIdleTick((tick) => tick + 1), IDLE_COMMENTARY_MS);
    return () => window.clearInterval(timer);
  }, [state]);

  const facts = [
    ["RUNTIME", runtimeLabel(launchState)],
    ["MINT", mintLabel(mint, runtimeKnown)],
    ["MARKET", marketStatus(launchState, runtimeKnown)],
    ["STATE", state],
    ["FEED", feedLabel(feed.status)],
  ] as const;

  return (
    <section className="bit-status-block" aria-label="BIT status">
      <dl className="bit-status">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p key={phrase} className="bit-commentary">{phrase}</p>
      <BitTokenActions launchState={launchState} mint={mint} />
    </section>
  );
}
