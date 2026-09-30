import { buyFixture, failedFixture, FIXTURE_MINT, irrelevantFixture, OBSERVED_AT, sellFixture } from "./fixtures.js";
import { IngestQueue, PROCESSOR_CONCURRENCY } from "./ingest-queue.js";
import { createMemoryLedger, processObservedTransaction, type InspectableTransaction } from "./trade.js";

export interface StressReport {
  pass: boolean;
  submitted: number;
  uniqueSignatures: number;
  duplicateSubmissions: number;
  peakQueueDepth: number;
  maxConcurrency: number;
  configuredConcurrency: number;
  retries: number;
  permanentFailures: number;
  drained: boolean;
  recentCacheSize: number;
  heapStart: number;
  heapEnd: number;
}

interface StressJob {
  signature: string;
  tx: InspectableTransaction | null;
  rpcMisses: number;
  unavailableMisses: number;
  permanent: boolean;
}

export async function runMonitoringStress(): Promise<StressReport> {
  const heapStart = process.memoryUsage().heapUsed;
  const ledger = createMemoryLedger();
  const jobs = buildJobs();
  const attempts = new Map<string, number>();
  const queue = new IngestQueue<StressJob>({
    concurrency: PROCESSOR_CONCURRENCY,
    delay: async () => undefined,
    process: async (job) => {
      const seen = attempts.get(job.signature) ?? 0;
      attempts.set(job.signature, seen + 1);
      if (job.permanent) {
        return { kind: "permanent" };
      }
      if (job.rpcMisses > 0) {
        job.rpcMisses -= 1;
        return { kind: "retry", reason: "rpc" };
      }
      if (job.unavailableMisses > 0) {
        job.unavailableMisses -= 1;
        return { kind: "retry", reason: "unavailable" };
      }
      await processObservedTransaction({
        tx: job.tx,
        mint: FIXTURE_MINT,
        observedAt: OBSERVED_AT,
        ledger,
      });
      return { kind: "done" };
    },
  });

  let duplicateSubmissions = 0;
  for (const job of jobs) {
    const result = queue.enqueue(job.signature, job);
    if (result === "duplicate") {
      duplicateSubmissions += 1;
    }
  }
  await queue.drain();
  const metrics = queue.metrics();
  const pass =
    metrics.maxActive <= PROCESSOR_CONCURRENCY &&
    metrics.maxActive >= 1 &&
    metrics.depth === 0 &&
    metrics.active === 0 &&
    metrics.delayed === 0 &&
    ledger.rows.length === 790 &&
    duplicateSubmissions === 200 &&
    metrics.retries === 60 &&
    metrics.failures === 10 &&
    metrics.recentCacheSize <= 5_000;

  return {
    pass,
    submitted: jobs.length,
    uniqueSignatures: ledger.rows.length,
    duplicateSubmissions,
    peakQueueDepth: metrics.maxDepth,
    maxConcurrency: metrics.maxActive,
    configuredConcurrency: PROCESSOR_CONCURRENCY,
    retries: metrics.retries,
    permanentFailures: metrics.failures,
    drained: metrics.depth === 0 && metrics.active === 0,
    recentCacheSize: metrics.recentCacheSize,
    heapStart,
    heapEnd: process.memoryUsage().heapUsed,
  };
}

export async function backpressureSelfCheck(): Promise<boolean> {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queue = new IngestQueue<string>({
    concurrency: 1,
    capacity: 2,
    lowWater: 0,
    process: async () => {
      await gate;
      return { kind: "done" };
    },
  });
  queue.enqueue("a", "a");
  queue.enqueue("b", "b");
  await microtask();
  const filled = queue.enqueue("c", "c");
  const blocked = queue.enqueue("d", "d");
  const held = filled === "queued" && blocked === "paused" && queue.metrics().paused && queue.metrics().active === 1;
  release();
  await queue.drain();
  const resumed = queue.enqueue("d", "d") === "queued";
  await queue.drain();
  return held && resumed && queue.metrics().depth === 0 && queue.metrics().paused === false;
}

function buildJobs(): StressJob[] {
  const jobs: StressJob[] = [];
  for (let index = 0; index < 400; index += 1) {
    jobs.push(job(`buy-${index}`, buyFixture(), `buy-${index}`));
  }
  for (let index = 0; index < 200; index += 1) {
    jobs.push(job(`sell-${index}`, sellFixture(), `sell-${index}`));
  }
  for (let index = 0; index < 200; index += 1) {
    jobs.push(job(`buy-${index}`, buyFixture(), `buy-${index}`));
  }
  for (let index = 0; index < 80; index += 1) {
    jobs.push(job(`irr-${index}`, irrelevantFixture(), `irr-${index}`));
  }
  for (let index = 0; index < 50; index += 1) {
    jobs.push(job(`fail-${index}`, failedFixture(), `fail-${index}`));
  }
  for (let index = 0; index < 40; index += 1) {
    const item = job(`rpc-${index}`, buyFixture(), `rpc-${index}`);
    item.rpcMisses = 1;
    jobs.push(item);
  }
  for (let index = 0; index < 20; index += 1) {
    const item = job(`lag-${index}`, buyFixture(), `lag-${index}`);
    item.unavailableMisses = 1;
    jobs.push(item);
  }
  for (let index = 0; index < 10; index += 1) {
    const item = job(`perm-${index}`, buyFixture(), `perm-${index}`);
    item.permanent = true;
    jobs.push(item);
  }
  return jobs;
}

function job(signature: string, tx: InspectableTransaction, signatureOverride: string): StressJob {
  const copy = structuredClone(tx);
  copy.signature = signatureOverride;
  return {
    signature,
    tx: copy,
    rpcMisses: 0,
    unavailableMisses: 0,
    permanent: false,
  };
}

async function microtask(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}
