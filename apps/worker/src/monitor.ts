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

  const queue = new IngestQueue<string>({
    onCapacity: (paused) => {
      if (paused) {
        listener?.pauseIntake();
        return;
      }
      listener?.resumeIntake();
    },
    process: (signature) => processSignature(signature, env, ledger, connection, reactions),
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
    const listenerMode = mode === "RECONNECTING" ? "RECONNECTING" : gate.listener;
    const text = formatWorkerStatus({
      runtime,
      alchemyReady,
      listener: listenerMode,
      reason: gate.reason,
      queue: metrics,
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
): Promise<StepResult> {
  if (!ledger || !connection) {
    return { kind: "retry", reason: "supabase" };
  }
  const runtime = await loadWorkerRuntime(env);
  const gate = listenerForRuntime(runtime);
  if (gate.listener !== "ACTIVE" || runtime.status !== "ok" || !runtime.runtime.canonicalMint) {
    return { kind: "done" };
  }
  const observedAt = new Date().toISOString();
  try {
    const response = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    const tx = fromConfirmedTransaction(signature, response);
    const outcome = await safelyProcessObservedTransaction({
      tx,
      mint: runtime.runtime.canonicalMint,
      observedAt,
      ledger,
    });
    if (outcome === "unavailable") {
      return { kind: "retry", reason: "unavailable" };
    }
    if (outcome === "retry") {
      return { kind: "retry", reason: "supabase" };
    }
    if (outcome === "trade" && tx) {
      const parsed = parseTrade(tx, runtime.runtime.canonicalMint, observedAt);
      if (parsed.kind === "trade") {
        reactions.note(parsed.event);
      }
    }
    return { kind: "done" };
  } catch {
    return { kind: "retry", reason: "rpc" };
  }
}

export function idleSnapshot(runtime: WorkerRuntimeRead): {
  listener: "IDLE" | "ACTIVE";
  reason: string;
} {
  return listenerForRuntime(runtime);
}
