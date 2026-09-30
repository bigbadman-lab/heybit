import { PROCESSOR_CONCURRENCY } from "@heybit/shared/ingest";
import { decideMonitoring } from "@heybit/shared/trade";
import type { WorkerRuntimeRead } from "./runtime.js";

export interface WorkerHealth {
  process: "healthy" | "degraded";
  supabase: "connected" | "unavailable";
  runtimeState: "readable" | "unavailable";
  alchemyRpc: "ready" | "unavailable";
  alchemyWss: "ready" | "unavailable";
  tradeListener: "idle" | "active" | "reconnecting";
  externalWrites: "disabled";
  queueDepth: number;
  activeProcessors: number;
  maxConcurrency: number;
  processing: "IDLE" | "ACTIVE" | "BACKLOGGED" | "DEGRADED" | "UNAVAILABLE";
}

export function healthFromSnapshot(snapshot: {
  runtime: WorkerRuntimeRead;
  alchemyRpc: "ready" | "unavailable";
  alchemyWss: "ready" | "unavailable";
  tradeListener: "idle" | "active" | "reconnecting";
  queueDepth?: number;
  activeProcessors?: number;
  processing?: WorkerHealth["processing"];
}): WorkerHealth {
  const runtimeReadable = snapshot.runtime.status === "ok";
  const alchemyReady = snapshot.alchemyRpc === "ready" && snapshot.alchemyWss === "ready";
  return {
    process: runtimeReadable && alchemyReady ? "healthy" : "degraded",
    supabase: runtimeReadable ? "connected" : "unavailable",
    runtimeState: runtimeReadable ? "readable" : "unavailable",
    alchemyRpc: snapshot.alchemyRpc,
    alchemyWss: snapshot.alchemyWss,
    tradeListener: snapshot.tradeListener,
    externalWrites: "disabled",
    queueDepth: snapshot.queueDepth ?? 0,
    activeProcessors: snapshot.activeProcessors ?? 0,
    maxConcurrency: PROCESSOR_CONCURRENCY,
    processing:
      snapshot.processing ??
      (!runtimeReadable || !alchemyReady ? "DEGRADED" : snapshot.tradeListener === "idle" ? "IDLE" : "ACTIVE"),
  };
}

export function listenerForRuntime(runtime: WorkerRuntimeRead): {
  listener: "IDLE" | "ACTIVE";
  reason: string;
} {
  if (runtime.status !== "ok") {
    return { listener: "IDLE", reason: "runtime unavailable" };
  }
  const decision = decideMonitoring(runtime.runtime);
  return {
    listener: decision.action === "listen" ? "ACTIVE" : "IDLE",
    reason: decision.reason,
  };
}

export function createShutdownHandler(
  exit: (code: number) => void,
  log: (message: string) => void,
): (signal: string) => void {
  return (signal: string) => {
    log(`heybit-worker shutdown signal=${signal}`);
    exit(0);
  };
}
