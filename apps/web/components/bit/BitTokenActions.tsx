"use client";

import { useEffect, useState } from "react";
import { COPY_FEEDBACK_MS, developmentActionMint, tokenActionLinks, writeMint } from "./bit-token-actions";

export function BitTokenActions({
  launchState,
  mint,
}: {
  launchState: string | null;
  mint: string | null;
}) {
  const [devMint, setDevMint] = useState<string | null>(null);
  const [copyTick, setCopyTick] = useState(0);
  const links = tokenActionLinks(launchState, mint) ?? (devMint ? tokenActionLinks("LIVE", devMint) : null);

  useEffect(() => {
    setDevMint(developmentActionMint(process.env.NODE_ENV, window.location.search));
  }, []);

  useEffect(() => {
    if (copyTick === 0) {
      return;
    }
    const timer = window.setTimeout(() => setCopyTick(0), COPY_FEEDBACK_MS);
    return () => window.clearTimeout(timer);
  }, [copyTick]);

  if (!links) {
    return null;
  }

  const active = links;

  async function onCopy(): Promise<void> {
    const copied = await writeMint(active.mint, (value) => navigator.clipboard.writeText(value));
    if (copied) {
      setCopyTick((tick) => tick + 1);
    }
  }

  return (
    <nav className="bit-actions" aria-label="Official token">
      <a href={active.solscan} target="_blank" rel="noopener noreferrer">
        SOLSCAN
      </a>
      <button type="button" onClick={() => void onCopy()} aria-live="polite">
        {copyTick > 0 ? "COPIED" : "COPY MINT"}
      </button>
    </nav>
  );
}
