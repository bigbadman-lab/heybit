import { createMemoryReactionStore, ReactionScheduler, type SchedulerMetrics } from "@heybit/shared/reaction";
import type { BitTradeEvent } from "@heybit/shared/trade";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requestBitReaction } from "./openai-reactions.js";
import { createSupabaseReactionStore } from "./reaction-store.js";

export interface LiveReactions {
  note(event: BitTradeEvent): void;
  metrics(): SchedulerMetrics;
}

export function createLiveReactions(env: NodeJS.ProcessEnv, client: SupabaseClient | null): LiveReactions {
  const store = client ? createSupabaseReactionStore(client) : createMemoryReactionStore();
  const scheduler = new ReactionScheduler({
    now: () => Date.now(),
    store,
    infer: (facts) => requestBitReaction(readKey(env), facts),
  });
  return {
    note(event) {
      scheduler.observe([
        {
          signature: event.signature,
          type: event.type,
          solAmount: event.solAmount,
          observedAt: event.observedAt,
        },
      ]);
      void scheduler.pump().catch(() => {
        console.log("reaction scheduling failed");
      });
    },
    metrics: () => scheduler.metrics(),
  };
}

function readKey(env: NodeJS.ProcessEnv): string {
  const key = env.OPENAI_API_KEY;
  return typeof key === "string" ? key : "";
}
