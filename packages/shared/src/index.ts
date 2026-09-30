import type { SupabaseClient } from "@supabase/supabase-js";

/** Confirmed market events BIT will eventually observe. */
export const MARKET_EVENT_TYPES = ["BUY", "SELL"] as const;

/** Operator events. These are not inferred by the model. */
export const OPERATOR_EVENT_TYPES = ["TOKEN_BURN", "DEX_PAID"] as const;

export const EVENT_TYPES = [...MARKET_EVENT_TYPES, ...OPERATOR_EVENT_TYPES] as const;

export type MarketEventType = (typeof MARKET_EVENT_TYPES)[number];
export type OperatorEventType = (typeof OPERATOR_EVENT_TYPES)[number];
export type EventType = (typeof EVENT_TYPES)[number];

export const RUNTIME_STATES = ["PRELAUNCH", "LIVE"] as const;

export type BitLaunchState = (typeof RUNTIME_STATES)[number];
export type RuntimeState = BitLaunchState;

/** Future identity of one normalized event. No chain calls live here. */
export interface EventIdentity {
  signature: string;
  eventType: EventType;
}

export const BIT_RUNTIME_ID = 1;

export const BIT_RUNTIME_COLUMNS =
  "id, canonical_mint, launch_state, activation_timestamp, launch_signature, launch_slot";

export interface BitRuntime {
  canonicalMint: string | null;
  launchState: BitLaunchState;
  activationTimestamp: string | null;
  launchSignature: string | null;
  launchSlot: number | null;
}

export type BitRuntimeFailure = "unavailable" | "schema-missing" | "missing-row" | "malformed";

const FAILURE_MESSAGES: Record<BitRuntimeFailure, string> = {
  unavailable: "Canonical runtime state is unavailable.",
  "schema-missing": "Canonical runtime table is missing.",
  "missing-row": "Canonical runtime row is missing.",
  malformed: "Canonical runtime row is malformed.",
};

export class BitRuntimeError extends Error {
  readonly code: BitRuntimeFailure;

  constructor(code: BitRuntimeFailure) {
    super(FAILURE_MESSAGES[code]);
    this.name = "BitRuntimeError";
    this.code = code;
  }
}

const MINT_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SCHEMA_ERROR_CODES = new Set(["PGRST205", "42P01", "PGRST204"]);

interface RuntimeQueryResult {
  data: unknown;
  error: { code?: string } | null;
}

interface RuntimeQuery {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: number): {
        maybeSingle(): PromiseLike<RuntimeQueryResult>;
      };
    };
  };
}

export function parseBitRuntime(row: unknown): BitRuntime {
  if (typeof row !== "object" || row === null) {
    throw new BitRuntimeError("malformed");
  }

  const record = row as Record<string, unknown>;
  if (record.id !== BIT_RUNTIME_ID) {
    throw new BitRuntimeError("malformed");
  }
  if (!isLaunchState(record.launch_state)) {
    throw new BitRuntimeError("malformed");
  }

  const canonicalMint = parseMint(record.canonical_mint);
  if (record.launch_state === "LIVE" && canonicalMint === null) {
    throw new BitRuntimeError("malformed");
  }

  return {
    canonicalMint,
    launchState: record.launch_state,
    activationTimestamp: parseTimestamp(record.activation_timestamp),
    launchSignature: parseOptionalText(record.launch_signature),
    launchSlot: parseSlot(record.launch_slot),
  };
}

export async function getBitRuntime(client: SupabaseClient): Promise<BitRuntime> {
  let result: RuntimeQueryResult;
  try {
    result = await (client as unknown as RuntimeQuery)
      .from("bit_runtime")
      .select(BIT_RUNTIME_COLUMNS)
      .eq("id", BIT_RUNTIME_ID)
      .maybeSingle();
  } catch {
    throw new BitRuntimeError("unavailable");
  }

  if (result.error) {
    throw new BitRuntimeError(
      result.error.code && SCHEMA_ERROR_CODES.has(result.error.code) ? "schema-missing" : "unavailable",
    );
  }
  if (result.data === null || result.data === undefined) {
    throw new BitRuntimeError("missing-row");
  }
  return parseBitRuntime(result.data);
}

function isLaunchState(value: unknown): value is BitLaunchState {
  return value === "PRELAUNCH" || value === "LIVE";
}

function parseMint(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || !MINT_PATTERN.test(value)) {
    throw new BitRuntimeError("malformed");
  }
  return value;
}

function parseTimestamp(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new BitRuntimeError("malformed");
  }
  return value;
}

function parseOptionalText(value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new BitRuntimeError("malformed");
  }
  return value;
}

function parseSlot(value: unknown): number | null {
  if (value === null) {
    return null;
  }
  const slot = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(slot) || slot < 0) {
    throw new BitRuntimeError("malformed");
  }
  return slot;
}
