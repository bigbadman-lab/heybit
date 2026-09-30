import type { ProcessedClaim, TransactionLedger } from "@heybit/shared/trade";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PROCESSED_TRANSACTIONS_TABLE = "processed_transactions";

export function createSupabaseLedger(client: SupabaseClient): TransactionLedger {
  return {
    // Atomic insert: the signature primary key decides the winner.
    // A prior SELECT would race and is intentionally not used.
    async claim(row: ProcessedClaim) {
      const { data, error } = await client
        .from(PROCESSED_TRANSACTIONS_TABLE)
        .upsert(toRow(row), { onConflict: "signature", ignoreDuplicates: true })
        .select("signature");
      if (error) {
        if (error.code === "23505") {
          return "duplicate";
        }
        throw new Error("Failed to record processed transaction.");
      }
      return Array.isArray(data) && data.length > 0 ? "inserted" : "duplicate";
    },
  };
}

function toRow(row: ProcessedClaim) {
  return {
    signature: row.signature,
    slot: row.slot,
    canonical_mint: row.canonicalMint,
    status: row.status,
    event_type: row.eventType,
    sol_amount: row.solAmount,
    token_amount: row.tokenAmount,
  };
}
