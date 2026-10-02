export const PROCESSOR_CONCURRENCY = 8;
export const QUEUE_CAPACITY = 2_000;
export const QUEUE_LOW_WATER = 500;
export const RECENT_SIGNATURE_LIMIT = 5_000;
export const MAX_PROCESS_ATTEMPTS = 3;

export type RetryReason = "rpc" | "unavailable" | "supabase" | "rate_limited";

export type StepResult = { kind: "done" } | { kind: "retry"; reason: RetryReason } | { kind: "permanent" };

const RETRY_DELAYS_MS: Record<RetryReason, readonly number[]> = {
  unavailable: [8_000, 20_000, 20_000],
  rate_limited: [1_000, 4_000, 12_000],
  rpc: [500, 2_000, 6_000],
  supabase: [400, 1_200, 4_000],
};

/** Bounded delay for one retry. Jitter is deterministic so tests can assert the shape. */
export function retryDelayMs(attempt: number, reason: RetryReason): number {
  const steps = RETRY_DELAYS_MS[reason];
  const base = steps[Math.min(Math.max(attempt, 1), steps.length) - 1] ?? steps[steps.length - 1] ?? 2_000;
  return base + Math.floor(base * 0.1 * ((attempt * 3) % 4));
}

export interface QueueMetrics {
  depth: number;
  active: number;
  concurrency: number;
  maxActive: number;
  maxDepth: number;
  processed: number;
  duplicates: number;
  retries: number;
  failures: number;
  dropped: number;
  paused: boolean;
  backlogged: boolean;
  delayed: number;
  recentCacheSize: number;
}

interface Job<T> {
  signature: string;
  payload: T;
  attempt: number;
}

/**
 * Websocket callbacks only enqueue. A fixed worker pool performs the expensive work.
 * The in-memory queue is not durable. Already stored signatures stay unique in Supabase.
 * If the queue reaches capacity, intake pauses instead of dropping a signature.
 * Completion order may differ from slot order.
 */
export class IngestQueue<T> {
  private readonly pending: Job<T>[] = [];
  private readonly recentOrder: string[] = [];
  private readonly recentSet = new Set<string>();
  private active = 0;
  private maxActive = 0;
  private maxDepth = 0;
  private processed = 0;
  private duplicates = 0;
  private retries = 0;
  private failures = 0;
  private dropped = 0;
  private paused = false;
  private limitedUntil = 0;
  private delayed = 0;
  private readonly idleWaiters: Array<() => void> = [];

  private readonly concurrency: number;
  private readonly capacity: number;
  private readonly lowWater: number;
  private readonly recentLimit: number;
  private readonly maxAttempts: number;
  private readonly highWater: number;
  private readonly delay: (attempt: number, reason: RetryReason) => Promise<void>;

  constructor(
    private readonly options: {
      process: (payload: T, attempt: number) => Promise<StepResult>;
      concurrency?: number;
      capacity?: number;
      lowWater?: number;
      recentLimit?: number;
      maxAttempts?: number;
      highWater?: number;
      delay?: (attempt: number, reason: RetryReason) => Promise<void>;
      onCapacity?: (paused: boolean) => void;
    },
  ) {
    this.concurrency = options.concurrency ?? PROCESSOR_CONCURRENCY;
    this.capacity = options.capacity ?? QUEUE_CAPACITY;
    this.lowWater = options.lowWater ?? QUEUE_LOW_WATER;
    this.recentLimit = options.recentLimit ?? RECENT_SIGNATURE_LIMIT;
    this.maxAttempts = options.maxAttempts ?? MAX_PROCESS_ATTEMPTS;
    this.highWater = options.highWater ?? this.capacity;
    this.delay =
      options.delay ??
      (async (attempt, reason) => {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt, reason)));
      });
  }

  enqueue(signature: string, payload: T): "queued" | "duplicate" | "paused" {
    if (this.recentSet.has(signature)) {
      this.duplicates += 1;
      return "duplicate";
    }
    if (this.pending.length >= this.capacity) {
      this.dropped += 1;
      this.markPaused(true);
      return "paused";
    }
    this.remember(signature);
    this.pending.push({ signature, payload, attempt: 1 });
    this.noteDepth();
    if (this.pending.length >= this.highWater) {
      this.markPaused(true);
    }
    this.fill();
    return "queued";
  }

  metrics(): QueueMetrics {
    return {
      depth: this.pending.length,
      active: this.active,
      concurrency: this.concurrency,
      maxActive: this.maxActive,
      maxDepth: this.maxDepth,
      processed: this.processed,
      duplicates: this.duplicates,
      retries: this.retries,
      failures: this.failures,
      dropped: this.dropped,
      paused: this.paused,
      backlogged: this.pending.length > 0 && this.active >= this.effectiveConcurrency(),
      delayed: this.delayed,
      recentCacheSize: this.recentSet.size,
    };
  }

  async drain(): Promise<void> {
    this.fill();
    if (this.isIdle()) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  private remember(signature: string): void {
    this.recentOrder.push(signature);
    this.recentSet.add(signature);
    while (this.recentOrder.length > this.recentLimit) {
      const oldest = this.recentOrder.shift();
      if (oldest) {
        this.recentSet.delete(oldest);
      }
    }
  }

  private fill(): void {
    while (this.active < this.effectiveConcurrency() && this.pending.length > 0) {
      const job = this.pending.shift();
      if (!job) {
        break;
      }
      this.active += 1;
      this.maxActive = Math.max(this.maxActive, this.active);
      void this.run(job);
    }
    this.maybeResume();
    this.notifyIdle();
  }

  private async run(job: Job<T>): Promise<void> {
    let result: StepResult;
    try {
      result = await this.options.process(job.payload, job.attempt);
    } catch {
      result = { kind: "retry", reason: "rpc" };
    }

    if (result.kind === "retry" && job.attempt < this.maxAttempts) {
      if (result.reason === "rate_limited") {
        this.limitedUntil = Date.now() + 8_000;
      }
      this.retries += 1;
      this.delayed += 1;
      void this.delay(job.attempt, result.reason).then(() => {
        this.delayed -= 1;
        this.pending.push({ ...job, attempt: job.attempt + 1 });
        this.noteDepth();
        this.fill();
      });
    } else if (result.kind === "done") {
      this.processed += 1;
    } else {
      this.failures += 1;
      this.processed += 1;
    }

    this.active -= 1;
    this.fill();
  }

  private effectiveConcurrency(): number {
    if (Date.now() < this.limitedUntil) {
      return 1;
    }
    return this.concurrency;
  }

  private noteDepth(): void {
    this.maxDepth = Math.max(this.maxDepth, this.pending.length);
  }

  private markPaused(paused: boolean): void {
    if (this.paused === paused) {
      return;
    }
    this.paused = paused;
    this.options.onCapacity?.(paused);
  }

  private maybeResume(): void {
    if (this.paused && this.pending.length <= this.lowWater) {
      this.markPaused(false);
    }
  }

  private isIdle(): boolean {
    return this.pending.length === 0 && this.active === 0 && this.delayed === 0;
  }

  private notifyIdle(): void {
    if (!this.isIdle()) {
      return;
    }
    const waiters = this.idleWaiters.splice(0);
    for (const waiter of waiters) {
      waiter();
    }
  }
}

export function processingLabel(input: {
  listenerIdle: boolean;
  alchemyReady: boolean;
  backlogged: boolean;
  reconnecting: boolean;
}): "IDLE" | "ACTIVE" | "BACKLOGGED" | "DEGRADED" {
  if (!input.alchemyReady || input.reconnecting) {
    return "DEGRADED";
  }
  if (input.listenerIdle) {
    return "IDLE";
  }
  if (input.backlogged) {
    return "BACKLOGGED";
  }
  return "ACTIVE";
}
