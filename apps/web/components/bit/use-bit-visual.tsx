"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  createBitVisualController,
  idleVisualPose,
  VISUAL_REHEARSALS,
  type VisualEvent,
  type VisualPose,
  type VisualSource,
} from "./bit-visual";

const POLL_MS = 2_000;

export type BitFeedStatus = "pending" | "live" | "unavailable";

export interface BitFeedModel {
  pose: VisualPose;
  status: BitFeedStatus;
  events: readonly VisualEvent[];
  cueId: string | null;
}

const pendingFeed: BitFeedModel = { pose: idleVisualPose(), status: "pending", events: [], cueId: null };

const BitFeedContext = createContext<BitFeedModel | null>(null);

/** One production poll shared by the mascot and the event tape. */
export function BitVisualFeed({ children }: { children: ReactNode }) {
  const model = useSharedBitFeed();
  return <BitFeedContext.Provider value={model}>{children}</BitFeedContext.Provider>;
}

export function useBitVisualPose(): VisualPose {
  return useContext(BitFeedContext)?.pose ?? idleVisualPose();
}

export function useBitFeed(): BitFeedModel {
  return useContext(BitFeedContext) ?? { pose: idleVisualPose(), status: "unavailable", events: [], cueId: null };
}

function useSharedBitFeed(): BitFeedModel {
  const [model, setModel] = useState<BitFeedModel>(pendingFeed);

  useEffect(() => {
    const rehearsal = readRehearsal();
    const fixture = rehearsal ? null : readTapeFixture();
    const controller = createBitVisualController();
    let cancelled = false;

    const publish = (status: BitFeedStatus, events: readonly VisualEvent[]) => {
      const pose = controller.sample(rehearsal ? performance.now() : Date.now());
      const cueId = controller.activeCueId();
      if (cancelled) {
        return;
      }
      setModel((current) =>
        sameFeed(current, { pose, status, events, cueId }) ? current : { pose, status, events, cueId },
      );
    };

    if (rehearsal) {
      const steps = VISUAL_REHEARSALS[rehearsal];
      const started = performance.now();
      const played: VisualEvent[] = [];
      let index = 0;
      const timer = window.setInterval(() => {
        const elapsed = performance.now() - started;
        while (index < steps.length && steps[index].at <= elapsed) {
          const step = steps[index];
          if (step.busy !== undefined) {
            controller.setBusy(step.busy, step.intensity ?? 0);
          }
          if (step.event) {
            played.push({ ...step.event, atMs: Date.now() });
            controller.push(step.event);
          }
          index += 1;
        }
        publish("live", played.slice());
      }, 50);
      return () => {
        cancelled = true;
        window.clearInterval(timer);
      };
    }

    if (fixture === "empty") {
      publish("live", []);
      return () => {
        cancelled = true;
      };
    }

    if (fixture === "preview") {
      const now = Date.now();
      publish("live", [
        { id: "preview-buy", kind: "BUY", atMs: now - 4_000 },
        { id: "preview-sell", kind: "SELL", atMs: now - 12_000 },
        { id: "preview-burn", kind: "BURN", atMs: now - 31_000 },
        { id: "preview-dex", kind: "DEX_PAID", atMs: now - 60_000 },
      ]);
      return () => {
        cancelled = true;
      };
    }

    let baseline = true;
    const pull = async () => {
      try {
        const response = await fetch("/api/bit-visual", { cache: "no-store" });
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          controller.fail();
          publish("unavailable", []);
          return;
        }
        const body: unknown = await response.json();
        const source = availableSource(body);
        if (!source) {
          controller.fail();
          publish("unavailable", []);
          return;
        }
        controller.ingest(source, baseline);
        baseline = false;
        publish("live", source.events);
      } catch {
        if (!cancelled) {
          controller.fail();
          publish("unavailable", []);
        }
      }
    };

    void pull();
    const poll = window.setInterval(() => void pull(), POLL_MS);
    const frame = window.setInterval(() => {
      if (!cancelled) {
        setModel((current) => {
          if (current.status !== "live") {
            return current;
          }
          const pose = controller.sample(Date.now());
          const cueId = controller.activeCueId();
          if (current.pose.state === pose.state && current.pose.intensity === pose.intensity && current.cueId === cueId) {
            return current;
          }
          return { ...current, pose, cueId };
        });
      }
    }, 100);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.clearInterval(frame);
    };
  }, []);

  return model;
}

function sameFeed(current: BitFeedModel, next: BitFeedModel): boolean {
  if (
    current.status !== next.status ||
    current.pose.state !== next.pose.state ||
    current.pose.intensity !== next.pose.intensity ||
    current.cueId !== next.cueId
  ) {
    return false;
  }
  if (current.events.length !== next.events.length) {
    return false;
  }
  return current.events.every((event, index) => {
    const other = next.events[index];
    return event.id === other.id && event.kind === other.kind && event.atMs === other.atMs;
  });
}

function isPoseKind(value: unknown): value is VisualSource["events"][number]["kind"] {
  return value === "BUY" || value === "SELL" || value === "BURN" || value === "DEX_PAID" || value === "NOTICE";
}

function readRehearsal(): string | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  const name = new URLSearchParams(window.location.search).get("bitRehearse");
  if (!name || !(name in VISUAL_REHEARSALS)) {
    return null;
  }
  return name;
}

function readTapeFixture(): "empty" | "preview" | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  const name = new URLSearchParams(window.location.search).get("bitTape");
  if (name === "empty" || name === "preview") {
    return name;
  }
  return null;
}

function availableSource(value: unknown): VisualSource | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.available !== true || !Array.isArray(record.events)) {
    return null;
  }
  const events: VisualSource["events"] = [];
  for (const item of record.events) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const event = item as Record<string, unknown>;
    if (typeof event.id !== "string" || !isPoseKind(event.kind)) {
      continue;
    }
    events.push({ id: event.id, kind: event.kind, atMs: typeof event.atMs === "number" ? event.atMs : 0 });
  }
  return {
    events,
    busy: record.busy === true,
    intensity: typeof record.intensity === "number" ? record.intensity : 0,
  };
}
