"use client";

import { useEffect, useRef, useState } from "react";
import { formatTapeAge, formatTapeClock, tapeKindLabel, tapeRows } from "./bit-tape";
import { useBitFeed } from "./use-bit-visual";

export function BitEventTape() {
  const feed = useBitFeed();
  const rows = tapeRows(feed.events);
  const now = useTapeNow(feed.status === "live" && rows.length > 0);
  const seen = useRef<Set<string> | null>(null);
  const rowsRef = useRef(rows);
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");
  const signature = rows.map((row) => row.id).join("\n");
  rowsRef.current = rows;

  useEffect(() => {
    if (feed.status === "pending") {
      return;
    }
    const ids = signature === "" ? [] : signature.split("\n");
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const arrived = ids.filter((id) => !seen.current?.has(id));
    for (const id of ids) {
      seen.current?.add(id);
    }
    if (arrived.length === 0) {
      return;
    }
    setFreshIds(new Set(arrived));
    const newest = rowsRef.current.find((row) => row.id === arrived[0]);
    if (newest) {
      setAnnouncement(tapeKindLabel(newest.kind));
    }
  }, [signature, feed.status]);

  return (
    <section className="bit-tape" aria-label="Activity">
      <p className="bit-tape-live" aria-live="polite">
        {announcement}
      </p>
      {feed.status === "unavailable" ? (
        <p className="bit-tape-note">Live feed unavailable.</p>
      ) : rows.length === 0 ? (
        <p className="bit-tape-note">no activity.</p>
      ) : (
        <ol className="bit-tape-list">
          {rows.map((row) => (
            <li key={row.id} className={freshIds.has(row.id) ? "bit-tape-row is-new" : "bit-tape-row"}>
              <span className="bit-tape-kind">{tapeKindLabel(row.kind)}</span>
              <span className="bit-tape-age">{formatTapeClock(row.atMs) ?? (now === null ? "\u00a0" : formatTapeAge(row.atMs, now))}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function useTapeNow(active: boolean): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!active) {
      return;
    }
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}
