import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBitRuntime, type BitRuntime } from "@heybit/shared";
import { publicPresence, readRehearsal, type PublicPresence } from "@heybit/shared/rehearsal";
import { config as loadDotenv } from "dotenv";

let envLoaded = false;

function loadRootEnv(): void {
  if (envLoaded) {
    return;
  }
  envLoaded = true;
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const filePath = path.join(repoRoot, ".env.local");
  if (!existsSync(filePath)) {
    return;
  }
  const result = loadDotenv({
    path: filePath,
    override: false,
    quiet: true,
  });
  if (result.error) {
    throw new Error("Failed to load .env.local.");
  }
}

export function readPublicSupabaseConfig(): { url: string; anonKey: string } | null {
  loadRootEnv();
  const url = firstPresent("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const anonKey = firstPresent("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    return null;
  }
  return { url, anonKey };
}

export function createPublicServerClient(): SupabaseClient {
  const config = readPublicSupabaseConfig();
  if (!config) {
    throw new Error("Public Supabase configuration is missing.");
  }
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function tryCreatePublicServerClient(): SupabaseClient | null {
  const config = readPublicSupabaseConfig();
  if (!config) {
    return null;
  }
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function readPublicRuntime(): Promise<BitRuntime | null> {
  try {
    return await getBitRuntime(createPublicServerClient());
  } catch {
    return null;
  }
}

/** Server-evaluated token presence. An expired rehearsal is already inactive here. */
export async function readPublicPresence(nowMs = Date.now()): Promise<PublicPresence> {
  try {
    const client = createPublicServerClient();
    const runtime = await getBitRuntime(client);
    const stored = await readRehearsal(client);
    const rehearsal = stored.status === "ready" ? stored.record : null;
    return publicPresence(runtime, rehearsal, nowMs);
  } catch {
    return { launchState: null, mint: null, runtimeKnown: false };
  }
}

function firstPresent(primary: string, fallback: string): string | null {
  const primaryValue = process.env[primary];
  if (typeof primaryValue === "string" && primaryValue.trim() !== "") {
    return primaryValue;
  }
  const fallbackValue = process.env[fallback];
  if (typeof fallbackValue === "string" && fallbackValue.trim() !== "") {
    return fallbackValue;
  }
  return null;
}
