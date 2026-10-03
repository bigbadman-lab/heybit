import "server-only";
import { ensureLocalEnv } from "./public-supabase";

export function readReownProjectId(): string | null {
  ensureLocalEnv();
  const value = process.env.REOWN_PROJECT_ID;
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}
