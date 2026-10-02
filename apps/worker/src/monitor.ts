import { IngestQueue, processingLabel, type StepResult } from "@heybit/shared/ingest";
import { safelyProcessObservedTransaction, parseTrade } from "@heybit/shared/trade";
import type { TransactionLedger } from "@heybit/shared/trade";
import { checkAlchemy, createReadOnlyConnection, readAlchemyConfig } from "./alchemy.js";
import { fromConfirmedTransaction } from "./decode-transaction.js";
import { listenerForRuntime } from "./health.js";
import { createSupabaseLedger } from "./ledger.js";
import { MintLogListener, type ListenerMode } from "./listener.js";
import { createLiveReactions, type LiveReactions } from "./reactions.js";
import { formatWorkerStatus, loadWorkerRuntime, openWorkerSupabase, type WorkerRuntimeRead } from "./runtime.js";

export const RUNTIME_POLL_MS = 5_000;
export const WORKER_FETCH_CONCURRENCY = 3;
export const WORKER_QUEUE_CAPACITY = 800;
export const WORKER_QUEUE_HIGH_WATER = 400;
export const WORKER_QUEUE_LOW_WATER = 120;

export interface IngestCauseCounts {
  rpc_pending_index: number;
  rpc_fetch_null_terminal: number;
  rpc_rate_limited: number;
  rpc_fetch_error: number;
  db_insert_error: number;
  queue_dropped: number;
}

export function classifyRpcFailure(error: unknown): "rate_limited" | "rpc" {
  const status = statusOf(error);
  if (status === 429) {
    return "rate_limited";
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("429") || message.toLowerCase().includes("too many requests")) {
    return "rate_limited";
  }
  return "rpc";
}

export function signatureStep(
  input: {
    ready: boolean;
    live: boolean;
    fetched: "null" | "rate_limited" | "error" | "transaction";
    outcome: "trade" | "ignored" | "failed" | "duplicate" | "unavailable" | "retry" | null;
  },
  attempt = 1,
): { step: StepResult; cause: keyof IngestCauseCounts | null } {
  if (!input.ready) {
    return { step: { kind: "retry", reason: "supabase" }, cause: "db_insert_error" };
  }
  if (!input.live) {
    return { step: { kind: "done" }, cause: null };
  }
  if (input.fetched === "null" || input.outcome === "unavailable") {
    if (attempt < 2) {
      return { step: { kind: "retry", reason: "unavailable" }, cause: "rpc_pending_index" };
    }
    // One recheck already ran. A second null is a provider coverage miss, not a worker fault.
    return { step: { kind: "permanent" }, cause: "rpc_fetch_null_terminal" };
  }
  if (input.fetched === "rate_limited") {
    return { step: { kind: "retry", reason: "rate_limited" }, cause: "rpc_rate_limited" };
  }
  if (input.fetched === "error") {
    return { step: { kind: "retry", reason: "rpc" }, cause: "rpc_fetch_error" };
  }
  if (input.outcome === "retry") {
    return { step: { kind: "retry", reason: "supabase" }, cause: "db_insert_error" };
  }
  return { step: { kind: "done" }, cause: null };
}

function statusOf(error: unknown): number {
  if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
    return error.status;
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === 429) {
    return 429;
  }
  return 0;
}

export async function startWorker(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const config = readAlchemyConfig(env);
  let alchemy = await checkAlchemy(env);
  let lastLog = "";
  let mode: ListenerMode = "IDLE";
  const client = openWorkerSupabase(env);
  const ledger: TransactionLedger | null = client ? createSupabaseLedger(client) : null;
  const connection = config ? createReadOnlyConnection(config.rpcUrl) : null;
  const reactions = createLiveReactions(env, client);
  let listener: MintLogListener | null = null;

  const causes: IngestCauseCounts = {
    rpc_pending_index: 0,
    rpc_fetch_null_terminal: 0,
    rpc_rate_limited: 0,
    rpc_fetch_error: 0,
    db_insert_error: 0,
    queue_dropped: 0,
  };
  const queue = new IngestQueue<string>({
    concurrency: WORKER_FETCH_CONCURRENCY,
    capacity: WORKER_QUEUE_CAPACITY,
    highWater: WORKER_QUEUE_HIGH_WATER,
    lowWater: WORKER_QUEUE_LOW_WATER,
    onCapacity: (paused) => {
      if (paused) {
        listener?.pauseIntake();
        return;
      }
      listener?.resumeIntake();
    },
    process: (signature, attempt) => processSignature(signature, env, ledger, connection, reactions, causes, attempt),
  });

  listener = config
    ? new MintLogListener(
        config.wssUrl,
        (signature) => {
          queue.enqueue(signature, signature);
        },
        (next) => {
          mode = next;
        },
      )
    : null;

  const tick = async () => {
    const runtime = await loadWorkerRuntime(env);
    if (alchemy.rpc !== "PASS" || alchemy.wss !== "PASS") {
      alchemy = await checkAlchemy(env);
    }
    const gate = listenerForRuntime(runtime);
    reactions.setLive(gate.listener === "ACTIVE");
    if (gate.listener === "ACTIVE" && runtime.status === "ok" && runtime.runtime.canonicalMint && listener) {
      listener.start(runtime.runtime.canonicalMint);
    } else if (listener && mode !== "IDLE") {
      listener.stop();
    }
    const metrics = queue.metrics();
    const reactionMetrics = reactions.metrics();
    const alchemyReady = alchemy.rpc === "PASS" && alchemy.wss === "PASS";
    const listenerMode = mode === "RECONNECTING" || mode === "PAUSED_BACKPRESSURE" ? mode : gate.listener;
    const text = formatWorkerStatus({
      runtime,
      alchemyReady,
      listener: listenerMode,
      reason: gate.reason,
      queue: metrics,
      causes: { ...causes, queue_dropped: metrics.dropped },
      socket: listener?.snapshot() ?? { ws_disconnect: 0, ws_reconnect: 0 },
      reactionCauses: reactionMetrics.causes,
      processing: processingLabel({
        listenerIdle: listenerMode === "IDLE",
        alchemyReady,
        backlogged: metrics.backlogged,
        reconnecting: listenerMode === "RECONNECTING",
      }),
      reactions: {
        scheduler: gate.listener === "ACTIVE" ? "ACTIVE" : "IDLE",
        openai: reactionMetrics.degraded ? "DEGRADED" : "READY",
        queueDepth: gate.listener === "ACTIVE" ? reactionMetrics.queueDepth : 0,
        openaiActive: gate.listener === "ACTIVE" ? reactionMetrics.openaiActive : 0,
        recentReactions: reactionMetrics.successes,
        recentExpired: reactionMetrics.expired,
        recentFailures: reactionMetrics.failures,
      },
    });
    if (text !== lastLog) {
      console.log(text);
      lastLog = text;
    }
  };

  await tick();
  const timer = setInterval(() => {
    void tick();
  }, RUNTIME_POLL_MS);

  await new Promise<void>((resolve) => {
    const stop = () => {
      clearInterval(timer);
      listener?.stop();
      void queue.drain().then(() => resolve());
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
}

async function processSignature(
  signature: string,
  env: NodeJS.ProcessEnv,
  ledger: TransactionLedger | null,
  connection: ReturnType<typeof createReadOnlyConnection> | null,
  reactions: LiveReactions,
  causes: IngestCauseCounts,
  attempt = 1,
): Promise<StepResult> {
  if (!ledger || !connection) {
    return counted(causes, signatureStep({ ready: false, live: false, fetched: "transaction", outcome: null }, attempt));
  }
  const runtime = await loadWorkerRuntime(env);
  const gate = listenerForRuntime(runtime);
  const live = gate.listener === "ACTIVE" && runtime.status === "ok" && runtime.runtime.canonicalMint !== null;
  if (!live || runtime.status !== "ok" || !runtime.runtime.canonicalMint) {
    return { kind: "done" };
  }
  const observedAt = new Date().toISOString();
  let response: Awaited<ReturnType<typeof connection.getTransaction>> | null = null;
  try {
    response = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
  } catch (error) {
    const fetched = classifyRpcFailure(error) === "rate_limited" ? "rate_limited" : "error";
    return counted(causes, signatureStep({ ready: true, live: true, fetched, outcome: null }, attempt));
  }
  if (!response) {
    return counted(causes, signatureStep({ ready: true, live: true, fetched: "null", outcome: null }, attempt));
  }
  const tx = fromConfirmedTransaction(signature, response);
  const outcome = await safelyProcessObservedTransaction({
    tx,
    mint: runtime.runtime.canonicalMint,
    observedAt,
    ledger,
  });
  const decision = signatureStep(
    {
      ready: true,
      live: true,
      fetched: "transaction",
      outcome,
    },
    attempt,
  );
  if (decision.step.kind === "done" && outcome === "trade" && tx) {
    const parsed = parseTrade(tx, runtime.runtime.canonicalMint, observedAt);
    if (parsed.kind === "trade") {
      reactions.note(parsed.event);
    }
  }
  return counted(causes, decision);
}

function counted(
  causes: IngestCauseCounts,
  decision: { step: StepResult; cause: keyof IngestCauseCounts | null },
): StepResult {
  if (decision.cause && decision.cause !== "queue_dropped") {
    causes[decision.cause] += 1;
  }
  return decision.step;
}

export function idleSnapshot(runtime: WorkerRuntimeRead): {
  listener: "IDLE" | "ACTIVE";
  reason: string;
} {
  return listenerForRuntime(runtime);
}
