import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  isAccent,
  isAgentStatus,
  isAvatar,
  isPersonality,
  type AgentRecord,
} from "@heybit/shared/factory";

export function agentAdminConfigured(): boolean {
  return adminKey() !== null && supabaseUrl() !== null;
}

export function agentAdminSecret(): string | null {
  return adminKey();
}

export function agentAdminClient(): SupabaseClient | null {
  const url = supabaseUrl();
  const key = adminKey();
  if (!url || !key) {
    return null;
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function loadAgentRecords(client: SupabaseClient): Promise<AgentRecord[] | null> {
  const result = await client
    .from("bit_agents")
    .select("slug, name, token_mint, personality, avatar_key, accent_key, created_by_wallet, status")
    .limit(200);
  if (result.error || !Array.isArray(result.data)) {
    return null;
  }
  const agents: AgentRecord[] = [];
  for (const row of result.data) {
    const agent = recordFromRow(row);
    if (agent) {
      agents.push(agent);
    }
  }
  return agents;
}

export async function insertAgent(client: SupabaseClient, agent: AgentRecord): Promise<boolean> {
  const result = await client.from("bit_agents").insert({
    slug: agent.slug,
    name: agent.name,
    token_mint: agent.tokenMint,
    personality: agent.personality,
    avatar_key: agent.avatarKey,
    accent_key: agent.accentKey,
    created_by_wallet: agent.createdByWallet,
    status: agent.status,
  });
  return !result.error;
}

export async function saveAgentEdit(client: SupabaseClient, agent: AgentRecord): Promise<boolean> {
  const result = await client
    .from("bit_agents")
    .update({
      name: agent.name,
      personality: agent.personality,
      avatar_key: agent.avatarKey,
      accent_key: agent.accentKey,
      status: agent.status,
      updated_at: new Date().toISOString(),
    })
    .eq("slug", agent.slug)
    .eq("created_by_wallet", agent.createdByWallet);
  return !result.error;
}

function recordFromRow(row: unknown): AgentRecord | null {
  if (typeof row !== "object" || row === null) {
    return null;
  }
  const record = row as Record<string, unknown>;
  if (
    typeof record.slug !== "string" ||
    typeof record.name !== "string" ||
    typeof record.token_mint !== "string" ||
    typeof record.created_by_wallet !== "string" ||
    !isPersonality(record.personality) ||
    !isAvatar(record.avatar_key) ||
    !isAccent(record.accent_key) ||
    !isAgentStatus(record.status)
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
    createdByWallet: record.created_by_wallet,
    status: record.status,
  };
}

function adminKey(): string | null {
  const name = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function supabaseUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
