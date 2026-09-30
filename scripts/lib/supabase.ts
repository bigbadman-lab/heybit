import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const CLIENT_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
  },
};

export function createServiceRoleClient(env: NodeJS.ProcessEnv = process.env): SupabaseClient {
  return createClient(required(env, "SUPABASE_URL"), required(env, "SUPABASE_SERVICE_ROLE_KEY"), CLIENT_OPTIONS);
}

export function createAnonClient(env: NodeJS.ProcessEnv = process.env): SupabaseClient {
  return createClient(required(env, "SUPABASE_URL"), required(env, "SUPABASE_ANON_KEY"), CLIENT_OPTIONS);
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required configuration: ${name}`);
  }
  return value;
}
