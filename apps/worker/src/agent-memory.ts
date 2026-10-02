import { deriveAgent, promptContext, type AgentPromptContext, type AgentTradeInput } from "@heybit/shared/agent";
import type { SupabaseClient } from "@supabase/supabase-js";

const HORIZON_MS = 15 * 60 * 1000;

/** Service-role read used only while composing a reaction. Failures omit memory. */
export async function rememberAgent(client: SupabaseClient, nowMs = Date.now()): Promise<AgentPromptContext | null> {
  try {
    const since = new Date(nowMs - HORIZON_MS).toISOString();
    const [trades, lines] = await Promise.all([
      client
        .from("processed_transactions")
        .select("event_type, sol_amount, observed_at")
        .eq("status", "trade")
        .gte("observed_at", since)
        .order("observed_at", { ascending: false })
        .limit(200),
      client
        .from("bit_reactions")
        .select("text, generated_at")
        .eq("status", "GENERATED")
        .not("text", "is", null)
        .order("generated_at", { ascending: false })
        .limit(5),
    ]);
    if (trades.error || lines.error) {
      return null;
    }
    const agent = deriveAgent({
      trades: (trades.data ?? []).flatMap(tradeRow),
      lines: (lines.data ?? []).flatMap(lineRow),
      nowMs,
      launchState: "LIVE",
      thinking: false,
    });
    return promptContext(agent);
  } catch {
    return null;
  }
}

function tradeRow(row: { event_type?: unknown; sol_amount?: unknown; observed_at?: unknown }): AgentTradeInput[] {
  if (row.event_type !== "BUY" && row.event_type !== "SELL") {
    return [];
  }
  const observedAtMs = typeof row.observed_at === "string" ? Date.parse(row.observed_at) : Number.NaN;
  if (!Number.isFinite(observedAtMs)) {
    return [];
  }
  const solAmount = typeof row.sol_amount === "number" ? row.sol_amount : typeof row.sol_amount === "string" ? Number(row.sol_amount) : null;
  return [{ type: row.event_type, solAmount: solAmount !== null && Number.isFinite(solAmount) ? solAmount : null, observedAtMs }];
}

function lineRow(row: { text?: unknown; generated_at?: unknown }): { text: string; atMs: number }[] {
  if (typeof row.text !== "string" || row.text.trim() === "") {
    return [];
  }
  const atMs = typeof row.generated_at === "string" ? Date.parse(row.generated_at) : Number.NaN;
  if (!Number.isFinite(atMs)) {
    return [];
  }
  return [{ text: row.text, atMs }];
}
