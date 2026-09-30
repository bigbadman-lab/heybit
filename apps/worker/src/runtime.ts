import { getBitRuntime, type BitRuntime } from "@heybit/shared";
import { PROCESSOR_CONCURRENCY } from "@heybit/shared/ingest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

export type WorkerRuntimeRead =
  | { status: "ok"; runtime: BitRuntime }
  | { status: "unavailable" };

export async function loadWorkerRuntime(env: NodeJS.ProcessEnv = process.env): Promise<WorkerRuntimeRead> {
  try {
    loadRootEnv(env);
    const url = env.SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (typeof url !== "string" || url.trim() === "" || typeof key !== "string" || key.trim() === "") {
      return { status: "unavailable" };
    }
    const runtime = await getBitRuntime(createWorkerClient(url, key));
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
    processed: number;
    duplicates: number;
    retries: number;
    failures: number;
  };
  processing?: "IDLE" | "ACTIVE" | "BACKLOGGED" | "DEGRADED";
}): string {
  const runtimeState = snapshot.runtime.status === "ok" ? snapshot.runtime.runtime.launchState : "unavailable";
  const mint = snapshot.runtime.status === "ok" ? (snapshot.runtime.runtime.canonicalMint ?? "none") : "none";
  const queue = snapshot.queue ?? { depth: 0, active: 0, processed: 0, duplicates: 0, retries: 0, failures: 0 };
  const processing = snapshot.processing ?? (snapshot.listener === "IDLE" ? "IDLE" : "ACTIVE");
  return [
    "HEYBIT worker",
    "",
    `runtime state: ${runtimeState}`,
    `canonical mint: ${mint}`,
    `alchemy: ${snapshot.alchemyReady ? "READY" : "UNAVAILABLE"}`,
    `trade listener: ${snapshot.listener}`,
    `reason: ${snapshot.reason}`,
    `queue depth: ${queue.depth}`,
    `active processors: ${queue.active}/${PROCESSOR_CONCURRENCY}`,
    `processing: ${processing}`,
    `processed: ${queue.processed}`,
    `duplicates: ${queue.duplicates}`,
    `retries: ${queue.retries}`,
    `failures: ${queue.failures}`,
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

