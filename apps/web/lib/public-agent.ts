import "server-only";
import {
  deriveAgent,
  prelaunchAgent,
  unknownAgent,
  type AgentLineInput,
  type AgentTradeInput,
  type PublicAgent,
} from "@heybit/shared/agent";
import { createPublicServerClient } from "./public-supabase";

/** Recent public activity. Missing views settle to an unknown agent, never invented totals. */
export async function readPublicAgent(launchState: "PRELAUNCH" | "LIVE" | null, nowMs = Date.now()): Promise<PublicAgent> {
  if (launchState !== "LIVE") {
    return prelaunchAgent();
  }
  try {
    const client = createPublicServerClient();
    const [trades, lines, thinking] = await Promise.all([
      client.from("bit_public_agent_trades").select("event_type, sol_amount, observed_at").limit(200),
      client.from("bit_public_lines").select("text, generated_at").limit(5),
      client.from("bit_public_thinking").select("thinking").limit(1).maybeSingle(),
    ]);
    if (trades.error) {
      return unknownAgent();
    }
    return deriveAgent({
      trades: (trades.data ?? []).flatMap(tradeRow),
      lines: lines.error ? [] : (lines.data ?? []).flatMap(lineRow),
      nowMs,
      launchState,
      thinking: !thinking.error && thinking.data?.thinking === true,
    });
  } catch {
    return unknownAgent();
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
