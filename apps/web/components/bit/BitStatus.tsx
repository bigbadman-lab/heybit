"use client";

import { feedLabel, mintLabel, runtimeLabel } from "./bit-commentary";
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
  const facts = [
    ["RUNTIME", runtimeLabel(launchState)],
    ["MARKET", marketStatus(launchState, runtimeKnown)],
    ["MINT", mintLabel(mint, runtimeKnown)],
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
      <BitTokenActions launchState={launchState} mint={mint} />
    </section>
  );
}
