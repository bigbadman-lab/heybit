import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { readPublicSupabaseConfig } from "./public-supabase";

export async function hasAuthCookie(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.getAll().some((cookie) => cookie.name.includes("auth-token"));
}

export async function createRequestClient(): Promise<SupabaseClient | null> {
  const config = readPublicSupabaseConfig();
  if (!config) {
    return null;
  }
  const cookieStore = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot always write cookies. Route handlers can.
        }
      },
    },
  });
}
