import "server-only";
import { deriveAgent, type AgentLineInput, type AgentTradeInput, type PublicAgent } from "@heybit/shared/agent";
import {
  isAccent,
  isAvatar,
  isPersonality,
  type PublicAgentProfile,
} from "@heybit/shared/factory";
import { createPublicServerClient } from "./public-supabase";

export async function readPublicAgents(): Promise<PublicAgentProfile[] | null> {
  try {
    const result = await createPublicServerClient().from("bit_public_agents").select("slug, name, token_mint, personality, avatar_key, accent_key, status, created_at").limit(25);
    if (result.error || !Array.isArray(result.data)) {
      return null;
    }
    return result.data.flatMap((row) => {
      const profile = profileFromRow(row);
      return profile ? [profile] : [];
    });
  } catch {
    return null;
  }
}

export async function readPublicAgentProfile(slug: string): Promise<PublicAgentProfile | null> {
  try {
    const result = await createPublicServerClient()
      .from("bit_public_agents")
      .select("slug, name, token_mint, personality, avatar_key, accent_key, status, created_at")
      .eq("slug", slug)
      .maybeSingle();
    if (result.error || !result.data) {
      return null;
    }
    return profileFromRow(result.data);
  } catch {
    return null;
  }
}

export async function readAgentState(slug: string, nowMs = Date.now()): Promise<PublicAgent | null> {
  try {
    const client = createPublicServerClient();
    const [trades, lines] = await Promise.all([
      client.from("bit_public_agent_trades").select("event_type, sol_amount, observed_at").eq("slug", slug).limit(200),
      client.from("bit_public_agent_lines").select("text, generated_at").eq("slug", slug).limit(5),
    ]);
    if (trades.error) {
      return null;
    }
    return deriveAgent({
      trades: (trades.data ?? []).flatMap(tradeRow),
      lines: lines.error ? [] : (lines.data ?? []).flatMap(lineRow),
      nowMs,
      launchState: "LIVE",
      thinking: false,
    });
  } catch {
    return null;
  }
}

function profileFromRow(row: unknown): PublicAgentProfile | null {
  if (typeof row !== "object" || row === null) {
    return null;
  }
  const record = row as Record<string, unknown>;
  if (
    typeof record.slug !== "string" ||
    typeof record.name !== "string" ||
    typeof record.token_mint !== "string" ||
    !isPersonality(record.personality) ||
    !isAvatar(record.avatar_key) ||
    !isAccent(record.accent_key) ||
    record.status !== "ACTIVE"
  ) {
    return null;
  }
  return {
    slug: record.slug,
    name: record.name,
    tokenMint: record.token_mint,
    personality: record.personality,
    avatarKey: record.avatar_key,
    accentKey: record.accent_key,
    status: "ACTIVE",
    createdAt: typeof record.created_at === "string" ? record.created_at : null,
  };
}

function tradeRow(row: { event_type?: unknown; sol_amount?: unknown; observed_at?: unknown }): AgentTradeInput[] {
  if (row.event_type !== "BUY" && row.event_type !== "SELL") {
    return [];
  }
  const observedAtMs = typeof row.observed_at === "string" ? Date.parse(row.observed_at) : Number.NaN;
  if (!Number.isFinite(observedAtMs)) {
    return [];
  }
  const amount = typeof row.sol_amount === "number" ? row.sol_amount : typeof row.sol_amount === "string" ? Number(row.sol_amount) : null;
  return [{ type: row.event_type, solAmount: amount !== null && Number.isFinite(amount) ? amount : null, observedAtMs }];
}

function lineRow(row: { text?: unknown; generated_at?: unknown }): AgentLineInput[] {
  if (typeof row.text !== "string" || row.text.trim() === "") {
    return [];
  }
  const atMs = typeof row.generated_at === "string" ? Date.parse(row.generated_at) : Number.NaN;
  return Number.isFinite(atMs) ? [{ text: row.text, atMs }] : [];
}
