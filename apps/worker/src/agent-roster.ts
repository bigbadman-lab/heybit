import type { SupabaseClient } from "@supabase/supabase-js";
import { agentsForMint, readRosterLog, selectRoster, type AgentRecord } from "@heybit/shared/factory";
import { createMemoryReactionStore, ReactionScheduler, type InferenceResult, type ReactionFacts, type ReactionStore } from "@heybit/shared/reaction";
import { parseTrade, reconnectDelayMs } from "@heybit/shared/trade";
import type { Connection } from "@solana/web3.js";
import { fromConfirmedTransaction } from "./decode-transaction.js";
import { requestBitReaction } from "./openai-reactions.js";

export interface AgentRoster {
  apply(agents: readonly AgentRecord[]): { watching: number; skipped: number };
  observe(mint: string, trade: { signature: string; type: "BUY" | "SELL"; solAmount: number; observedAt: string }): Promise<void>;
  route(raw: string): { mint: string; signature: string } | null;
  bindSubscription(requestId: number, mint: string, subscriptionId: number): void;
  mints(): string[];
  metrics(): { active: number; reactions: number; fallbacks: number; skipped: number };
  stop(): void;
}

export function createAgentRoster(options: {
  now?: () => number;
  infer?: (facts: ReactionFacts) => Promise<InferenceResult>;
  storeFor?: (agent: AgentRecord) => ReactionStore;
  onTrade?: (agent: AgentRecord, trade: { signature: string; type: "BUY" | "SELL"; solAmount: number; observedAt: string }) => Promise<void>;
} = {}): AgentRoster {
  const schedulers = new Map<string, { agent: AgentRecord; scheduler: ReactionScheduler }>();
  const subscriptions = new Map<number, string>();
  let skipped = 0;
  let reactions = 0;
  let fallbacks = 0;
  const now = options.now ?? (() => Date.now());

  const roster: AgentRoster = {
    apply(agents) {
      const plan = selectRoster(agents);
      skipped = plan.skipped.length;
      const next = new Set(plan.watch.map((agent) => agent.slug));
      for (const slug of schedulers.keys()) {
        if (!next.has(slug)) {
          schedulers.delete(slug);
        }
      }
      for (const agent of plan.watch) {
        if (schedulers.has(agent.slug)) {
          continue;
        }
        const scheduler = new ReactionScheduler({
          now,
          store: options.storeFor?.(agent) ?? createMemoryReactionStore(),
          infer: async (facts) => {
            const styled = { ...facts, style: agent.personality };
            const result = options.infer
              ? await options.infer(styled)
              : await requestBitReaction(readKey(), styled);
            if (result.ok) {
              reactions += 1;
            } else {
              fallbacks += 1;
            }
            return result;
          },
        });
        scheduler.resume();
        schedulers.set(agent.slug, { agent, scheduler });
      }
      return { watching: schedulers.size, skipped };
    },
    async observe(mint, trade) {
      const targets = agentsForMint(mint, [...schedulers.values()].map((entry) => entry.agent));
      for (const agent of targets) {
        const entry = schedulers.get(agent.slug);
        if (!entry) {
          continue;
        }
        try {
          await options.onTrade?.(agent, trade);
          entry.scheduler.observe([trade]);
          await entry.scheduler.pump();
        } catch {
          // One agent cannot stop the roster.
        }
      }
    },
    route(raw) {
      return readRosterLog(raw, subscriptions);
    },
    bindSubscription(requestId, mint, subscriptionId) {
      subscriptions.set(subscriptionId, mint);
      void requestId;
    },
    mints() {
      return [...new Set([...schedulers.values()].map((entry) => entry.agent.tokenMint))];
    },
    metrics() {
      return { active: schedulers.size, reactions, fallbacks, skipped };
    },
    stop() {
      for (const entry of schedulers.values()) {
        entry.scheduler.hold();
      }
    },
  };
  return roster;
}

export async function classifyAgentSignature(
  connection: Connection,
  roster: AgentRoster,
  event: { mint: string; signature: string },
): Promise<void> {
  try {
    const response = await connection.getTransaction(event.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!response) {
      return;
    }
    const tx = fromConfirmedTransaction(event.signature, response);
    if (!tx) {
      return;
    }
    const parsed = parseTrade(tx, event.mint, new Date().toISOString());
    if (parsed.kind !== "trade") {
      return;
    }
    await roster.observe(event.mint, {
      signature: parsed.event.signature,
      type: parsed.event.type,
      solAmount: parsed.event.solAmount,
      observedAt: parsed.event.observedAt,
    });
  } catch {
    // A bad mint or provider miss stays inside this agent path.
  }
}

export function startAgentRoster(input: {
  client: SupabaseClient;
  connection: Connection | null;
  wssUrl: string;
  onLog?: (line: string) => void;
}): { stop: () => void } {
  const roster = createAgentRoster({
    storeFor: (agent) => supabaseAgentStore(input.client, agent.slug),
    onTrade: async (agent, trade) => {
      await input.client.from("bit_agent_activity").insert({
        agent_slug: agent.slug,
        event_type: trade.type,
        sol_amount: trade.solAmount,
        observed_at: trade.observedAt,
        signature: trade.signature,
      });
    },
  });
  let stopped = false;
  let socket: WebSocket | null = null;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let subscribed = "";
  const requests = new Map<number, string>();
  const log = input.onLog ?? ((line: string) => console.log(line));

  const connect = () => {
    if (stopped || roster.mints().length === 0) {
      return;
    }
    try {
      socket = new WebSocket(input.wssUrl);
    } catch {
      timer = setTimeout(connect, reconnectDelayMs(attempt + 1));
      return;
    }
    socket.addEventListener("open", () => {
      attempt = 0;
      let requestId = 1;
      requests.clear();
      for (const mint of roster.mints()) {
        const id = requestId;
        requestId += 1;
        requests.set(id, mint);
        socket?.send(JSON.stringify({
          jsonrpc: "2.0",
          id,
          method: "logsSubscribe",
          params: [{ mentions: [mint] }, { commitment: "confirmed" }],
        }));
      }
    });
    socket.addEventListener("message", (event) => {
      const raw = String(event.data);
      try {
        const parsed = JSON.parse(raw) as { id?: number; result?: number };
        if (typeof parsed.id === "number" && typeof parsed.result === "number") {
          const mint = requests.get(parsed.id);
          if (mint) {
            roster.bindSubscription(parsed.id, mint, parsed.result);
          }
        }
      } catch {
        return;
      }
      const routed = roster.route(raw);
      if (routed && input.connection) {
        void classifyAgentSignature(input.connection, roster, routed);
      }
    });
    socket.addEventListener("close", () => {
      socket = null;
      if (stopped) {
        return;
      }
      attempt += 1;
      timer = setTimeout(connect, reconnectDelayMs(attempt));
    });
    socket.addEventListener("error", () => undefined);
  };

  const refresh = async () => {
    try {
      const result = await input.client
        .from("bit_agents")
        .select("slug, name, token_mint, personality, avatar_key, accent_key, created_by_wallet, status")
        .eq("status", "ACTIVE")
        .limit(25);
      if (result.error || !Array.isArray(result.data)) {
        log("agent roster: unavailable");
        return;
      }
      const plan = roster.apply(result.data.flatMap(rowToAgent));
      const metrics = roster.metrics();
      log(`agent roster: ${plan.watching} active, ${metrics.reactions} reactions, ${metrics.fallbacks} fallbacks, ${plan.skipped} skipped`);
      const key = roster.mints().sort().join(",");
      if (key !== subscribed) {
        subscribed = key;
        try {
          socket?.close();
        } catch {
          // Already closed.
        }
        socket = null;
        if (key) {
          connect();
        }
      }
    } catch {
      log("agent roster: unavailable");
    }
  };

  void refresh();
  const poll = setInterval(() => {
    void refresh();
  }, 30_000);
  return {
    stop() {
      stopped = true;
      clearInterval(poll);
      if (timer) {
        clearTimeout(timer);
      }
      roster.stop();
      try {
        socket?.close();
      } catch {
        // Already closed.
      }
    },
  };
}

function readKey(): string {
  const key = process.env.OPENAI_API_KEY;
  return typeof key === "string" ? key : "";
}

function rowToAgent(row: unknown): AgentRecord[] {
  if (typeof row !== "object" || row === null) {
    return [];
  }
  const record = row as Record<string, unknown>;
  if (
    typeof record.slug !== "string" ||
    typeof record.name !== "string" ||
    typeof record.token_mint !== "string" ||
    typeof record.created_by_wallet !== "string" ||
    (record.personality !== "DEADPAN" && record.personality !== "DEGEN" && record.personality !== "ANALYST" && record.personality !== "CHAOTIC" && record.personality !== "PARANOID" && record.personality !== "DRY") ||
    (record.avatar_key !== "mark" && record.avatar_key !== "square" && record.avatar_key !== "ring") ||
    (record.accent_key !== "bone" && record.accent_key !== "acid" && record.accent_key !== "signal" && record.accent_key !== "ember")
  ) {
    return [];
  }
  return [{
    slug: record.slug,
    name: record.name,
    tokenMint: record.token_mint,
    personality: record.personality,
    avatarKey: record.avatar_key,
    accentKey: record.accent_key,
    createdByWallet: record.created_by_wallet,
    status: record.status === "PAUSED" ? "PAUSED" : "ACTIVE",
    }];
}

function supabaseAgentStore(client: SupabaseClient, slug: string): ReactionStore {
  return {
    async claim(draft) {
      const inserted = await client.from("bit_agent_reactions").insert({
        agent_slug: slug,
        source_key: draft.sourceKey,
        status: "PENDING",
      });
      return inserted.error ? "duplicate" : "owned";
    },
    async finish(sourceKey, patch) {
      await client.from("bit_agent_reactions").insert({
        agent_slug: slug,
        source_key: `${sourceKey}:spoken`,
        status: patch.status,
        text: patch.text,
        model: patch.model,
        generated_at: patch.generatedAtMs ? new Date(patch.generatedAtMs).toISOString() : null,
      });
    },
  };
}
