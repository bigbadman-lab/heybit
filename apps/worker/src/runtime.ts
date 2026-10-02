import { getBitRuntime, type BitRuntime } from "@heybit/shared";
import { readRehearsal, resolveEffective } from "@heybit/shared/rehearsal";
import { PROCESSOR_CONCURRENCY } from "@heybit/shared/ingest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

export type WorkerRuntimeRead =
  | { status: "ok"; runtime: BitRuntime; label?: "REHEARSAL" }
  | { status: "unavailable" };

export async function loadWorkerRuntime(env: NodeJS.ProcessEnv = process.env): Promise<WorkerRuntimeRead> {
  try {
    loadRootEnv(env);
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (typeof url !== "string" || url.trim() === "" || typeof key !== "string" || key.trim() === "") {
      return { status: "unavailable" };
    }
    const client = createWorkerClient(url, key);
    const runtime = await getBitRuntime(client);
    if (runtime.launchState === "LIVE") {
      return { status: "ok", runtime };
    }
    const stored = await readRehearsal(client);
    const rehearsal = stored.status === "ready" ? stored.record : null;
    const view = resolveEffective(runtime, rehearsal, Date.now());
    if (view.mode === "REHEARSAL" && view.mint) {
      return {
        status: "ok",
        label: "REHEARSAL",
        runtime: { ...runtime, launchState: "LIVE", canonicalMint: view.mint },
      };
    }
    return { status: "ok", runtime };
  } catch {
    return { status: "unavailable" };
  }
}

export function formatWorkerStatus(snapshot: {
  runtime: WorkerRuntimeRead;
  alchemyReady: boolean;
  listener: "IDLE" | "ACTIVE" | "RECONNECTING";
  reason: string;
  queue?: {
    depth: number;
    active: number;
    concurrency?: number;
    processed: number;
    duplicates: number;
    retries: number;
    failures: number;
    dropped?: number;
  };
  causes?: {
    rpc_fetch_null: number;
    rpc_rate_limited: number;
    rpc_fetch_error: number;
    db_insert_error: number;
    queue_dropped: number;
  };
  socket?: { ws_disconnect: number; ws_reconnect: number };
  reactionCauses?: {
    reaction_claim_error: number;
    reaction_prompt_error: number;
    openai_request_error: number;
    openai_response_error: number;
    reaction_store_error: number;
    fallback_store_error: number;
  };
  processing?: "IDLE" | "ACTIVE" | "BACKLOGGED" | "DEGRADED";
  reactions?: {
    scheduler: "IDLE" | "ACTIVE";
    openai: "READY" | "DEGRADED";
    queueDepth: number;
    openaiActive: number;
    recentReactions: number;
    recentExpired: number;
    recentFailures: number;
  };
}): string {
  const runtimeState =
    snapshot.runtime.status !== "ok"
      ? "unavailable"
      : snapshot.runtime.label === "REHEARSAL"
        ? "REHEARSAL"
        : snapshot.runtime.runtime.launchState;
  const mint = snapshot.runtime.status === "ok" ? (snapshot.runtime.runtime.canonicalMint ?? "none") : "none";
  const queue = snapshot.queue ?? { depth: 0, active: 0, processed: 0, duplicates: 0, retries: 0, failures: 0 };
  const causes = snapshot.causes ?? {
    rpc_fetch_null: 0,
    rpc_rate_limited: 0,
    rpc_fetch_error: 0,
    db_insert_error: 0,
    queue_dropped: queue.dropped ?? 0,
  };
  const socket = snapshot.socket ?? { ws_disconnect: 0, ws_reconnect: 0 };
  const reactionCauses = snapshot.reactionCauses ?? {
    reaction_claim_error: 0,
    reaction_prompt_error: 0,
    openai_request_error: 0,
    openai_response_error: 0,
    reaction_store_error: 0,
    fallback_store_error: 0,
  };
  const processing = snapshot.processing ?? (snapshot.listener === "IDLE" ? "IDLE" : "ACTIVE");
  const lanes = queue.concurrency ?? PROCESSOR_CONCURRENCY;
  const reactions = snapshot.reactions ?? {
    scheduler: "IDLE" as const,
    openai: "READY" as const,
    queueDepth: 0,
    openaiActive: 0,
    recentReactions: 0,
    recentExpired: 0,
    recentFailures: 0,
  };
  return [
    "HEYBIT worker",
    "",
    `runtime state: ${runtimeState}`,
    `canonical mint: ${mint}`,
    `alchemy: ${snapshot.alchemyReady ? "READY" : "UNAVAILABLE"}`,
    `trade listener: ${snapshot.listener}`,
    `reason: ${snapshot.reason}`,
    `queue depth: ${queue.depth}`,
    `active processors: ${queue.active}/${lanes}`,
    `processing: ${processing}`,
    `processed: ${queue.processed}`,
    `duplicates: ${queue.duplicates}`,
    `retries: ${queue.retries}`,
    `failures: ${queue.failures}`,
    `queue dropped: ${causes.queue_dropped}`,
    `rpc fetch null: ${causes.rpc_fetch_null}`,
    `rpc rate limited: ${causes.rpc_rate_limited}`,
    `rpc fetch error: ${causes.rpc_fetch_error}`,
    `db insert error: ${causes.db_insert_error}`,
    `ws disconnect: ${socket.ws_disconnect}`,
    `ws reconnect: ${socket.ws_reconnect}`,
    `reaction scheduler: ${reactions.scheduler}`,
    `openai: ${reactions.openai}`,
    `reaction queue: ${reactions.queueDepth}`,
    `openai active: ${reactions.openaiActive}`,
    `recent reactions: ${reactions.recentReactions}`,
    `recent expired: ${reactions.recentExpired}`,
    `recent failures: ${reactions.recentFailures}`,
    `reaction claim error: ${reactionCauses.reaction_claim_error}`,
    `reaction prompt error: ${reactionCauses.reaction_prompt_error}`,
    `openai request error: ${reactionCauses.openai_request_error}`,
    `openai response error: ${reactionCauses.openai_response_error}`,
    `reaction store error: ${reactionCauses.reaction_store_error}`,
    `fallback store error: ${reactionCauses.fallback_store_error}`,
  ].join("\n");
}

function loadRootEnv(env: NodeJS.ProcessEnv): void {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const filePath = path.join(repoRoot, ".env.local");
  if (!existsSync(filePath)) {
    return;
  }
  const result = loadDotenv({
    path: filePath,
    override: false,
    processEnv: env,
    quiet: true,
  });
  if (result.error) {
    throw new Error("Failed to load .env.local.");
  }
}

export function openWorkerSupabase(env: NodeJS.ProcessEnv = process.env): SupabaseClient | null {
  try {
    loadRootEnv(env);
  } catch {
    return null;
  }
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (typeof url !== "string" || url.trim() === "" || typeof key !== "string" || key.trim() === "") {
    return null;
  }
  return createWorkerClient(url, key);
}

function createWorkerClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
    },
  });
}

