"use client";

import { formatTapeAge } from "./bit-tape";
import { useBitFeed } from "./use-bit-visual";

export function BitState() {
  const feed = useBitFeed();
  const agent = feed.agent;
  const buy = agent?.recent.buyCount;
  const sell = agent?.recent.sellCount;
  const last = agent?.msSinceLastTrade;
  return (
    <section className="bit-state" aria-label="BIT state">
      <p>
        <span>BIT STATE</span>
        {agent?.state ?? "QUIET"}
      </p>
      <p>
        <span>LAST 15M</span>
        {buy === null || buy === undefined || sell === null || sell === undefined ? "—" : `${buy} buys · ${sell} sells`}
      </p>
      <p>
        <span>ACTIVITY</span>
        {agent?.known ? trendLabel(agent.recent.trend) : "—"}
      </p>
      <p>
        <span>LAST EVENT</span>
        {typeof last === "number" ? formatTapeAge(Date.now() - last, Date.now()) + " ago" : "none"}
      </p>
    </section>
  );
}

function trendLabel(trend: "increasing" | "stable" | "slowing"): string {
  if (trend === "increasing") {
    return "↑ increasing";
  }
  if (trend === "slowing") {
    return "↓ slowing";
  }
  return "→ stable";
}
