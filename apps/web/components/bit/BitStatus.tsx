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
  const current = feed.presence;
  const shownLaunch = current ? current.launchState : launchState;
  const shownMint = current ? current.mint : mint;
  const shownKnown = current ? current.runtimeKnown : runtimeKnown;
  const facts = [
    ["RUNTIME", runtimeLabel(shownLaunch)],
    ["MARKET", marketStatus(shownLaunch, shownKnown)],
    ["MINT", mintLabel(shownMint, shownKnown)],
    ["FEED", feedLabel(feed.status, shownLaunch === "LIVE" ? "LIVE" : shownLaunch === "PRELAUNCH" ? "PRELAUNCH" : null)],
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
      <BitTokenActions launchState={shownLaunch} mint={shownMint} />
    </section>
  );
}
