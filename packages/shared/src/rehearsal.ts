import type { SupabaseClient } from "@supabase/supabase-js";
import { isCanonicalMint, type BitRuntime } from "./index.js";

/** The only rehearsal length this command path accepts. */
export const REHEARSAL_DURATION_MS = 10 * 60 * 1000;

export const REHEARSAL_DURATION_LABEL = "10m";

export const BIT_REHEARSAL_ID = 1;

export const BIT_REHEARSAL_COLUMNS = "id, mint, started_at, expires_at, stopped_at";

const SCHEMA_ERROR_CODES = new Set(["PGRST205", "42P01", "PGRST204"]);

export interface RehearsalRecord {
  mint: string;
  startedAt: string;
  expiresAt: string;
  stoppedAt: string | null;
}

export type RehearsalRead =
  | { status: "none" }
  | { status: "ready"; record: RehearsalRecord }
  | { status: "missing" }
  | { status: "unavailable" };

export interface EffectiveRuntime {
  mode: "PRELAUNCH" | "REHEARSAL" | "LIVE";
  launchState: "PRELAUNCH" | "LIVE";
  mint: string | null;
  effectiveLive: boolean;
  permanent: BitRuntime;
  rehearsal: RehearsalRecord | null;
}

export interface PublicPresence {
  launchState: "PRELAUNCH" | "LIVE" | null;
  mint: string | null;
  runtimeKnown: boolean;
}

export type RehearsalStartDecision = "ok" | "invalid-mint" | "bad-duration" | "permanent-live" | "already-active";

interface RehearsalQueryResult {
  data: unknown;
  error: { code?: string } | null;
}

interface RehearsalQuery {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: number): {
        maybeSingle(): PromiseLike<RehearsalQueryResult>;
      };
    };
  };
}

export function rehearsalWindow(startedAtMs: number): { startedAt: string; expiresAt: string } {
  return {
    startedAt: new Date(startedAtMs).toISOString(),
    expiresAt: new Date(startedAtMs + REHEARSAL_DURATION_MS).toISOString(),
  };
}

export function parseRehearsal(row: unknown): RehearsalRecord | null {
  if (typeof row !== "object" || row === null) {
    return null;
  }
  const record = row as Record<string, unknown>;
  if (record.id !== BIT_REHEARSAL_ID || !isCanonicalMint(record.mint)) {
    return null;
  }
  const startedAt = timestamp(record.started_at);
  const expiresAt = timestamp(record.expires_at);
  if (!startedAt || !expiresAt) {
    return null;
  }
  const stoppedAt = record.stopped_at === null ? null : timestamp(record.stopped_at);
  if (record.stopped_at !== null && stoppedAt === null) {
    return null;
  }
  return { mint: record.mint, startedAt, expiresAt, stoppedAt };
}

/** Active only while the stored window is exactly ten minutes and still in the future. */
export function isRehearsalEffective(record: RehearsalRecord | null, nowMs: number): boolean {
  if (!record || record.stoppedAt !== null) {
    return false;
  }
  const started = Date.parse(record.startedAt);
  const expires = Date.parse(record.expiresAt);
  if (!Number.isFinite(started) || !Number.isFinite(expires)) {
    return false;
  }
  if (expires - started !== REHEARSAL_DURATION_MS) {
    return false;
  }
  return nowMs < expires;
}

/**
 * Effective listen/display state. The permanent runtime object is never mutated.
 * An official LIVE row always wins over a rehearsal record.
 */
export function resolveEffective(
  permanent: BitRuntime,
  rehearsal: RehearsalRecord | null,
  nowMs: number,
): EffectiveRuntime {
  if (permanent.launchState === "LIVE") {
    return {
      mode: "LIVE",
      launchState: "LIVE",
      mint: permanent.canonicalMint,
      effectiveLive: permanent.canonicalMint !== null,
      permanent,
      rehearsal,
    };
  }
  if (isRehearsalEffective(rehearsal, nowMs) && rehearsal) {
    return {
      mode: "REHEARSAL",
      launchState: "LIVE",
      mint: rehearsal.mint,
      effectiveLive: true,
      permanent,
      rehearsal,
    };
  }
  return {
    mode: "PRELAUNCH",
    launchState: "PRELAUNCH",
    mint: permanent.canonicalMint,
    effectiveLive: false,
    permanent,
    rehearsal,
  };
}

export function publicPresence(
  permanent: BitRuntime | null,
  rehearsal: RehearsalRecord | null,
  nowMs: number,
): PublicPresence {
  if (!permanent) {
    return { launchState: null, mint: null, runtimeKnown: false };
  }
  const view = resolveEffective(permanent, rehearsal, nowMs);
  return { launchState: view.launchState, mint: view.mint, runtimeKnown: true };
}

export function decideRehearsalStart(input: {
  mint: string;
  duration: string | null;
  permanent: BitRuntime;
  existing: RehearsalRecord | null;
  nowMs: number;
}): RehearsalStartDecision {
  if (input.duration !== REHEARSAL_DURATION_LABEL) {
    return "bad-duration";
  }
  if (!isCanonicalMint(input.mint)) {
    return "invalid-mint";
  }
  if (input.permanent.launchState === "LIVE") {
    return "permanent-live";
  }
  if (isRehearsalEffective(input.existing, input.nowMs)) {
    return "already-active";
  }
  return "ok";
}

export function formatRemaining(record: RehearsalRecord | null, nowMs: number): string {
  if (!record) {
    return "none";
  }
  const expires = Date.parse(record.expiresAt);
  if (record.stoppedAt !== null && Number.isFinite(expires) && nowMs < expires) {
    return "aborted";
  }
  if (!isRehearsalEffective(record, nowMs)) {
    return "expired";
  }
  const totalSeconds = Math.floor((expires - nowMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export function formatRehearsalStatus(input: {
  permanent: BitRuntime;
  rehearsal: RehearsalRecord | null;
  nowMs: number;
}): string {
  const view = resolveEffective(input.permanent, input.rehearsal, input.nowMs);
  const listener = view.effectiveLive ? "ACTIVE" : "IDLE";
  return [
    "HEYBIT — REHEARSAL STATUS",
    "",
    statusLine("mode", view.mode),
    statusLine("rehearsal mint", input.rehearsal?.mint ?? "none"),
    statusLine("started at", input.rehearsal?.startedAt ?? "none"),
    statusLine("expires at", input.rehearsal?.expiresAt ?? "none"),
    statusLine("remaining", formatRemaining(input.rehearsal, input.nowMs)),
    statusLine("effective live", view.effectiveLive ? "YES" : "NO"),
    statusLine("worker listener", listener),
    statusLine("reaction scheduler", listener),
  ].join("\n");
}

export async function readRehearsal(client: SupabaseClient): Promise<RehearsalRead> {
  let result: RehearsalQueryResult;
  try {
    result = await (client as unknown as RehearsalQuery)
      .from("bit_rehearsal")
      .select(BIT_REHEARSAL_COLUMNS)
      .eq("id", BIT_REHEARSAL_ID)
      .maybeSingle();
  } catch {
    return { status: "unavailable" };
  }
  if (result.error) {
    return {
      status: result.error.code && SCHEMA_ERROR_CODES.has(result.error.code) ? "missing" : "unavailable",
    };
  }
  if (result.data === null || result.data === undefined) {
    return { status: "none" };
  }
  const record = parseRehearsal(result.data);
  return record ? { status: "ready", record } : { status: "unavailable" };
}

function timestamp(value: unknown): string | null {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return null;
  }
  return value;
}

function statusLine(label: string, value: string): string {
  const width = 22;
  const dots = ".".repeat(Math.max(1, width - label.length));
  return `${label} ${dots} ${value}`;
}
