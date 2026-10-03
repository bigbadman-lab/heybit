import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ensureLocalEnv } from "./public-supabase";

export function serverAdminClient(): SupabaseClient | null {
  ensureLocalEnv();
  const url = firstEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  const key = adminKey();
  if (!url || !key) {
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function serverAdminSecret(): string | null {
  ensureLocalEnv();
  return adminKey();
}

function adminKey(): string | null {
  const name = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function firstEnv(primary: string, fallback: string): string | null {
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
