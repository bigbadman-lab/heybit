import { IngestQueue, processingLabel, type StepResult } from "@heybit/shared/ingest";
import { safelyProcessObservedTransaction } from "@heybit/shared/trade";
import type { TransactionLedger } from "@heybit/shared/trade";
import { checkAlchemy, createReadOnlyConnection, readAlchemyConfig } from "./alchemy.js";
import { fromConfirmedTransaction } from "./decode-transaction.js";
import { listenerForRuntime } from "./health.js";
import { createSupabaseLedger } from "./ledger.js";
import { MintLogListener, type ListenerMode } from "./listener.js";
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
  let listener: MintLogListener | null = null;

  const queue = new IngestQueue<string>({
    onCapacity: (paused) => {
      if (paused) {
        listener?.pauseIntake();
        return;
      }
      listener?.resumeIntake();
    },
    process: (signature) => processSignature(signature, env, ledger, connection),
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
    if (gate.listener === "ACTIVE" && runtime.status === "ok" && runtime.runtime.canonicalMint && listener) {
      listener.start(runtime.runtime.canonicalMint);
    } else if (listener && mode !== "IDLE") {
      listener.stop();
    }
    const metrics = queue.metrics();
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
): Promise<StepResult> {
  if (!ledger || !connection) {
    return { kind: "retry", reason: "supabase" };
  }
  const runtime = await loadWorkerRuntime(env);
  const gate = listenerForRuntime(runtime);
  if (gate.listener !== "ACTIVE" || runtime.status !== "ok" || !runtime.runtime.canonicalMint) {
    return { kind: "done" };
  }
  try {
    const response = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    const outcome = await safelyProcessObservedTransaction({
      tx: fromConfirmedTransaction(signature, response),
      mint: runtime.runtime.canonicalMint,
      observedAt: new Date().toISOString(),
      ledger,
    });
    if (outcome === "unavailable") {
      return { kind: "retry", reason: "unavailable" };
    }
    if (outcome === "retry") {
      return { kind: "retry", reason: "supabase" };
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
