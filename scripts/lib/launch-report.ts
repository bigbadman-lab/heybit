import { BitRuntimeError, getBitRuntime, type BitRuntime, type BitRuntimeFailure } from "@heybit/shared";
import { WORKER_FETCH_CONCURRENCY } from "../../apps/worker/src/monitor.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RuntimeReadResult =
  | { status: "ok"; runtime: BitRuntime }
  | { status: BitRuntimeFailure };

export async function readCanonicalRuntime(client: SupabaseClient): Promise<RuntimeReadResult> {
  try {
    return { status: "ok", runtime: await getBitRuntime(client) };
  } catch (error) {
    if (error instanceof BitRuntimeError) {
      return { status: error.code };
    }
    return { status: "unavailable" };
  }
}

const VALUE_COLUMN = 23;

export interface AlchemyGate {
  rpc: "PASS" | "FAIL";
  wss: "PASS" | "FAIL";
}

export function formatLaunchStatus(
  result: RuntimeReadResult,
  alchemy: AlchemyGate = { rpc: "FAIL", wss: "FAIL" },
  reactions: { openai: "PASS" | "FAIL"; reactionPipeline: "READY" | "BLOCKED"; reactionScheduler: "IDLE" | "ACTIVE" } = {
    openai: "FAIL",
    reactionPipeline: "READY",
    reactionScheduler: "IDLE",
  },
): string {
  if (result.status !== "ok") {
    return [
      "HEYBIT — LAUNCH STATUS",
      "",
      line("Canonical mint", "unavailable"),
      line("Launch state", "unavailable"),
      "",
      line("Database", result.status === "unavailable" ? "UNAVAILABLE" : "CONNECTED"),
      line("Runtime row", "FAIL"),
      "",
      line("Alchemy RPC", alchemy.rpc),
      line("Alchemy WSS", alchemy.wss),
      line("Trade listener", "IDLE"),
      "",
      line("Queue capacity", "READY"),
      line("Concurrency", String(WORKER_FETCH_CONCURRENCY)),
      line("Backpressure", "READY"),
      "",
      line("OpenAI", reactions.openai),
      line("Reaction pipeline", reactions.reactionPipeline),
      line("Reaction scheduler", "IDLE"),
      "",
      line("Null terminal", "provider miss, not a worker error"),
      line("Reason", "runtime unavailable"),
      "",
      "This is runtime and monitoring status, not launch approval.",
      "",
      "VERDICT: BLOCKED",
      "",
    ].join("\n");
  }

  const runtime = result.runtime;
  const live = runtime.launchState === "LIVE" && runtime.canonicalMint !== null;
  const alchemyReady = alchemy.rpc === "PASS" && alchemy.wss === "PASS";
  const listener = alchemyReady && live ? "ACTIVE" : "IDLE";
  const reason = !alchemyReady ? "alchemy unavailable" : live ? "canonical mint is live" : "token not live";

  return [
    "HEYBIT — LAUNCH STATUS",
    "",
    line("Canonical mint", runtime.canonicalMint ?? "none"),
    line("Launch state", runtime.launchState),
    "",
    line("Database", "CONNECTED"),
    line("Runtime row", "PASS"),
    "",
    line("Alchemy RPC", alchemy.rpc),
    line("Alchemy WSS", alchemy.wss),
    line("Trade listener", listener),
    "",
    line("Queue capacity", "READY"),
    line("Concurrency", String(WORKER_FETCH_CONCURRENCY)),
    line("Backpressure", "READY"),
    "",
    line("OpenAI", reactions.openai),
    line("Reaction pipeline", reactions.reactionPipeline),
    line("Reaction scheduler", live ? reactions.reactionScheduler : "IDLE"),
    "",
    line("Null terminal", "provider miss, not a worker error"),
    line("Reason", reason),
    "",
    "This is runtime and monitoring status, not launch approval.",
    "",
    `VERDICT: ${runtime.launchState}`,
    "",
  ].join("\n");
}

export function reportLine(label: string, value: string): string {
  return line(label, value);
}

function line(label: string, value: string): string {
  const dots = ".".repeat(Math.max(1, VALUE_COLUMN - label.length - 2));
  return `${label} ${dots} ${value}`;
}
