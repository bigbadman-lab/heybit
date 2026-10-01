"use client";

import { useEffect, useRef, useState } from "react";
import { reactionContextLabel } from "./bit-reaction-context";
import { useBitFeed } from "./use-bit-visual";

export function BitReactionContext() {
  const feed = useBitFeed();
  const label = reactionContextLabel(feed.pose.state);
  const seen = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!label || !feed.cueId) {
      return;
    }
    if (seen.current === feed.cueId) {
      return;
    }
    seen.current = feed.cueId;
    setAnnouncement(label);
  }, [label, feed.cueId]);

  return (
    <div className="bit-reaction">
      <p className="bit-reaction-live" aria-live="polite">
        {announcement}
      </p>
      <p className={label ? "bit-reaction-label is-on" : "bit-reaction-label"} aria-hidden="true">
        {label ?? ""}
      </p>
    </div>
  );
}
