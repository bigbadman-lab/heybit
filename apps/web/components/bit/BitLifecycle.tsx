"use client";

import { useEffect, useRef, useState } from "react";
import { presentedLifecycle, type AgentLifecycle } from "@heybit/shared/agent";
import { useBitFeed } from "./use-bit-visual";

const REACTING_MS = 4_000;

export function BitLifecycle() {
  const lifecycle = useAgentLifecycle();
  return (
    <p className="bit-lifecycle" data-lifecycle={lifecycle}>
      {lifecycleLabel(lifecycle)}
    </p>
  );
}

export function useAgentLifecycle(): AgentLifecycle {
  const feed = useBitFeed();
  return presentedLifecycle(feed.agent?.lifecycle ?? "IDLE", useReacting(feed.speech));
}

function useReacting(speech: string | null): boolean {
  const previous = useRef<string | null>(null);
  const [reacting, setReacting] = useState(false);
  useEffect(() => {
    if (speech && speech !== previous.current) {
      previous.current = speech;
      setReacting(true);
      const timer = window.setTimeout(() => setReacting(false), REACTING_MS);
      return () => window.clearTimeout(timer);
    }
    previous.current = speech;
    return undefined;
  }, [speech]);
  return reacting;
}

function lifecycleLabel(lifecycle: AgentLifecycle): string {
  if (lifecycle === "WATCHING") {
    return "ONLINE · WATCHING CHAIN";
  }
  if (lifecycle === "THINKING") {
    return "ONLINE · THINKING";
  }
  if (lifecycle === "REACTING") {
    return "ONLINE · SPEAKING";
  }
  return "IDLE · WAITING";
}
