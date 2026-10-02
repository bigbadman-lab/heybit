import type { ReactionDraft, ReactionStore } from "@heybit/shared/reaction";
import type { SupabaseClient } from "@supabase/supabase-js";

export const BIT_REACTIONS_TABLE = "bit_reactions";

export function createSupabaseReactionStore(client: SupabaseClient): ReactionStore {
  return {
    async claim(draft: ReactionDraft) {
      const { data, error } = await client
        .from(BIT_REACTIONS_TABLE)
        .upsert(toInsert(draft), { onConflict: "source_key", ignoreDuplicates: true })
        .select("source_key");
      if (error) {
        if (error.code === "23505") {
          return "duplicate";
        }
        throw new Error("Failed to claim reaction.");
      }
      return Array.isArray(data) && data.length > 0 ? "owned" : "duplicate";
    },
    async finish(sourceKey, patch) {
      // The insert candidate must include every NOT NULL column. PostgreSQL checks
      // those columns before ON CONFLICT DO UPDATE, so a partial row stays PENDING.
      const { error } = await client.from(BIT_REACTIONS_TABLE).upsert(
        {
          source_key: sourceKey,
          reaction_type: patch.reactionType,
          source_mode: patch.sourceMode,
          source_window_start: patch.windowStartMs === null ? null : new Date(patch.windowStartMs).toISOString(),
          source_window_end: patch.windowEndMs === null ? null : new Date(patch.windowEndMs).toISOString(),
          source_event_count: patch.eventCount,
          activity_level: patch.activityLevel,
          status: patch.status,
          text: patch.text,
          model: patch.model,
          generated_at: patch.generatedAtMs === null ? null : new Date(patch.generatedAtMs).toISOString(),
        },
        { onConflict: "source_key" },
      );
      if (error) {
        throw new Error("Failed to finish reaction.");
      }
    },
  };
}

function toInsert(draft: ReactionDraft) {
  return {
    source_key: draft.sourceKey,
    reaction_type: draft.reactionType,
    source_mode: draft.sourceMode,
    source_window_start: draft.windowStartMs === null ? null : new Date(draft.windowStartMs).toISOString(),
    source_window_end: draft.windowEndMs === null ? null : new Date(draft.windowEndMs).toISOString(),
    source_event_count: draft.eventCount,
    activity_level: draft.activityLevel,
    status: "PENDING",
  };
}
