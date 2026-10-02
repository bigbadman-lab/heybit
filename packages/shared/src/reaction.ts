import type { OperatorEventType } from "./index.js";

export const REACTION_WINDOW_MS = 8_000;
export const NORMAL_REACTION_COOLDOWN_MS = 5_000;
export const HIGH_REACTION_COOLDOWN_MS = 15_000;
export const VERY_HIGH_REACTION_COOLDOWN_MS = 30_000;
export const NORMAL_REACTION_TTL_MS = 30_000;
export const MAX_OPENAI_REACTION_CONCURRENCY = 1;
export const OPENAI_MAX_ATTEMPTS = 2;
export const CIRCUIT_FAILURE_THRESHOLD = 3;
export const CIRCUIT_OPEN_MS = 60_000;
export const PRIORITY_QUEUE_LIMIT = 32;
export const BIT_REACTION_MODEL = "gpt-6-luna";
export const MAX_REACTION_CHARS = 120;
export const MAX_REACTION_LINES = 2;
export const NET_DIRECTION_RATIO = 1.2;

export const BIT_PERSONALITY_PROMPT = [
  "You are BIT, a minimal onchain presence.",
  "Speak in one short line. Two very short lines only when it helps.",
  "Be calm, observant, slightly strange, and concise.",
  "Describe only the confirmed past activity in the facts.",
  "Never tell anyone to buy, sell, or hold.",
  "Never shame a seller or encourage urgency.",
  "Never promise gains, predict a price, or give financial advice.",
  "Plain text only. No markdown.",
].join(" ");

export type ActivityLevel = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
export type NetDirection = "BUY_HEAVY" | "SELL_HEAVY" | "BALANCED";
export type ReactionMode = "INDIVIDUAL" | "BURST" | "PRIORITY";
export type ReactionStatus = "PENDING" | "GENERATED" | "FAILED" | "EXPIRED";

export interface TradeFact {
  signature: string;
  type: "BUY" | "SELL";
  solAmount: number;
  observedAt: string;
}

export interface ActivitySummary {
  kind: "activity";
  sourceKey: string;
  mode: "INDIVIDUAL" | "BURST";
  windowStartMs: number;
  windowEndMs: number;
  buyCount: number;
  sellCount: number;
  buySolTotal: number;
  sellSolTotal: number;
  largestTradeType: "BUY" | "SELL";
  largestTradeSol: number;
  netDirection: NetDirection;
  activityLevel: ActivityLevel;
  eventCount: number;
  createdAtMs: number;
}

export interface PrioritySummary {
  kind: "priority";
  sourceKey: string;
  eventType: OperatorEventType;
  eventId: string;
  createdAtMs: number;
}

export type ReactionSummary = ActivitySummary | PrioritySummary;

export interface ReactionFacts {
  mode: ReactionMode;
  activityLevel?: ActivityLevel;
  windowSeconds?: number;
  type?: "BUY" | "SELL";
  solAmount?: number;
  buyCount?: number;
  sellCount?: number;
  buySolTotal?: number;
  sellSolTotal?: number;
  netDirection?: NetDirection;
  largestTrade?: { type: "BUY" | "SELL"; solAmount: number };
  eventCount?: number;
  eventType?: OperatorEventType;
  eventId?: string;
}

export interface ReactionDraft {
  sourceKey: string;
  reactionType: "ACTIVITY" | OperatorEventType;
  sourceMode: ReactionMode;
  windowStartMs: number | null;
  windowEndMs: number | null;
  eventCount: number;
  activityLevel: ActivityLevel | null;
}

export interface ReactionWrite {
  status: ReactionStatus;
  text: string | null;
  model: string | null;
  generatedAtMs: number | null;
  reactionType: ReactionDraft["reactionType"];
  sourceMode: ReactionMode;
  eventCount: number;
  activityLevel: ActivityLevel | null;
  windowStartMs: number | null;
  windowEndMs: number | null;
}

export interface ReactionStore {
  claim(draft: ReactionDraft): Promise<"owned" | "duplicate">;
  finish(sourceKey: string, patch: ReactionWrite): Promise<void>;
}

export type InferenceResult =
  | { ok: true; text: string }
  | { ok: false; transient: boolean; reason: "timeout" | "rate_limit" | "empty" | "invalid" | "prohibited" | "unavailable" };

export interface ReactionCauseCounts {
  reaction_claim_error: number;
  reaction_prompt_error: number;
  openai_request_error: number;
  openai_response_error: number;
  reaction_store_error: number;
  fallback_store_error: number;
}

export interface SchedulerMetrics {
  queueDepth: number;
  openaiActive: number;
  maxOpenaiActive: number;
  attempts: number;
  successes: number;
  expired: number;
  superseded: number;
  failures: number;
  degraded: boolean;
  windows: number;
  causes: ReactionCauseCounts;
}

const PROHIBITED = [
  /\bbuy now\b/i,
  /\bbuy more\b/i,
  /\bdo not sell\b/i,
  /\bdon't sell\b/i,
  /\bdont sell\b/i,
  /\bhold\b/i,
  /\bmoon\b/i,
  /\bguaranteed\b/i,
  /\bgoing higher\b/i,
  /\bprice target\b/i,
  /\blast chance\b/i,
  /\bholders will win\b/i,
];

export function windowStartMs(observedAtMs: number): number {
  return Math.floor(observedAtMs / REACTION_WINDOW_MS) * REACTION_WINDOW_MS;
}

export function activityLevelFor(eventCount: number): ActivityLevel | null {
  if (eventCount <= 0) {
    return null;
  }
  if (eventCount <= 2) {
    return "LOW";
  }
  if (eventCount <= 9) {
    return "MEDIUM";
  }
  if (eventCount <= 29) {
    return "HIGH";
  }
  return "VERY_HIGH";
}

export function netDirectionFor(buySol: number, sellSol: number): NetDirection {
  if (buySol > sellSol * NET_DIRECTION_RATIO) {
    return "BUY_HEAVY";
  }
  if (sellSol > buySol * NET_DIRECTION_RATIO) {
    return "SELL_HEAVY";
  }
  return "BALANCED";
}

export function cooldownMs(level: ActivityLevel): number {
  if (level === "VERY_HIGH") {
    return VERY_HIGH_REACTION_COOLDOWN_MS;
  }
  if (level === "HIGH") {
    return HIGH_REACTION_COOLDOWN_MS;
  }
  return NORMAL_REACTION_COOLDOWN_MS;
}

export function aggregateTrades(events: TradeFact[], closedAtMs: number): ActivitySummary[] {
  const groups = new Map<number, TradeFact[]>();
  for (const event of events) {
    const at = Date.parse(event.observedAt);
    if (!Number.isFinite(at) || !Number.isFinite(event.solAmount) || event.solAmount < 0) {
      continue;
    }
    const start = windowStartMs(at);
    const group = groups.get(start) ?? [];
    group.push(event);
    groups.set(start, group);
  }
  return [...groups.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([start, group]) => summarizeGroup(start, group, closedAtMs));
}

export function reactionFacts(summary: ReactionSummary): ReactionFacts {
  if (summary.kind === "priority") {
    return { mode: "PRIORITY", eventType: summary.eventType, eventId: summary.eventId };
  }
  const facts: ReactionFacts = {
    mode: summary.mode,
    activityLevel: summary.activityLevel,
    windowSeconds: REACTION_WINDOW_MS / 1000,
    buyCount: summary.buyCount,
    sellCount: summary.sellCount,
    buySolTotal: summary.buySolTotal,
    sellSolTotal: summary.sellSolTotal,
    netDirection: summary.netDirection,
    largestTrade: { type: summary.largestTradeType, solAmount: summary.largestTradeSol },
    eventCount: summary.eventCount,
  };
  if (summary.mode === "INDIVIDUAL") {
    facts.type = summary.largestTradeType;
    facts.solAmount = summary.largestTradeSol;
  }
  return facts;
}

export function fallbackText(summary: ReactionSummary): string {
  if (summary.kind === "priority") {
    return "noted.";
  }
  if (summary.activityLevel === "HIGH" || summary.activityLevel === "VERY_HIGH") {
    return "a lot happened at once.";
  }
  if (summary.mode === "BURST") {
    return "things are moving.";
  }
  return "i saw that.";
}

export function sanitizeReactionText(raw: string): string {
  const withoutCode = raw.replace(/```[\s\S]*?```/g, " ");
  const lines = withoutCode
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").replace(/^["'`]+|["'`]+$/g, "").trim())
    .filter((line) => line.length > 0);
  return lines.join("\n").trim();
}

export function validateReactionText(raw: string): { ok: true; text: string } | { ok: false; reason: "empty" | "invalid" | "prohibited" } {
  const text = sanitizeReactionText(raw);
  if (text.length === 0) {
    return { ok: false, reason: "empty" };
  }
  const lines = text.split("\n");
  if (lines.length > MAX_REACTION_LINES || text.length > MAX_REACTION_CHARS) {
    return { ok: false, reason: "invalid" };
  }
  if (PROHIBITED.some((pattern) => pattern.test(text))) {
    return { ok: false, reason: "prohibited" };
  }
  return { ok: true, text };
}

export function createMemoryReactionStore(): ReactionStore & {
  rows: Map<string, { status: ReactionStatus; text: string | null }>;
} {
  const rows = new Map<string, { status: ReactionStatus; text: string | null }>();
  const inflight = new Map<string, Promise<"owned" | "duplicate">>();
  return {
    rows,
    claim(draft) {
      const pending = inflight.get(draft.sourceKey);
      if (pending) {
        return pending.then(() => "duplicate" as const);
      }
      if (rows.has(draft.sourceKey)) {
        return Promise.resolve("duplicate" as const);
      }
      const work = (async () => {
        await Promise.resolve();
        if (rows.has(draft.sourceKey)) {
          return "duplicate" as const;
        }
        rows.set(draft.sourceKey, { status: "PENDING", text: null });
        return "owned" as const;
      })();
      inflight.set(draft.sourceKey, work);
      void work.finally(() => {
        inflight.delete(draft.sourceKey);
      });
      return work;
    },
    async finish(sourceKey, patch) {
      const existing = rows.get(sourceKey);
      if (!existing || existing.status === "GENERATED") {
        return;
      }
      rows.set(sourceKey, { status: patch.status, text: patch.text });
    },
  };
}

export class ReactionScheduler {
  private normal: ActivitySummary | null = null;
  private readonly priority: PrioritySummary[] = [];
  private readonly done = new Set<string>();
  private lastNormalAt = Number.NEGATIVE_INFINITY;
  private openaiActive = 0;
  private maxOpenaiActive = 0;
  private attempts = 0;
  private successes = 0;
  private expired = 0;
  private superseded = 0;
  private failures = 0;
  private windows = 0;
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;
  private fallbackUsedWhileOpen = false;
  private speaking = false;
  private suspended = false;
  private readonly causes: ReactionCauseCounts = {
    reaction_claim_error: 0,
    reaction_prompt_error: 0,
    openai_request_error: 0,
    openai_response_error: 0,
    reaction_store_error: 0,
    fallback_store_error: 0,
  };

  constructor(
    private readonly options: {
      now: () => number;
      store: ReactionStore;
      infer: (facts: ReactionFacts) => Promise<InferenceResult>;
    },
  ) {}

  /** Drop queued rehearsal work so it cannot speak after the window closes. */
  hold(): void {
    this.suspended = true;
    this.normal = null;
    this.priority.length = 0;
  }

  resume(): void {
    this.suspended = false;
  }

  observe(events: TradeFact[]): void {
    if (this.suspended) {
      return;
    }
    for (const summary of aggregateTrades(events, this.options.now())) {
      this.windows += 1;
      if (this.done.has(summary.sourceKey)) {
        continue;
      }
      if (this.normal?.sourceKey === summary.sourceKey) {
        this.normal = summary;
        continue;
      }
      if (this.normal) {
        this.superseded += 1;
      }
      this.normal = summary;
    }
  }

  pushPriority(eventType: OperatorEventType, eventId: string): void {
    if (this.suspended) {
      return;
    }
    const sourceKey = `priority:${eventType}:${eventId}`;
    if (this.done.has(sourceKey) || this.priority.some((item) => item.sourceKey === sourceKey)) {
      return;
    }
    if (this.priority.length >= PRIORITY_QUEUE_LIMIT) {
      return;
    }
    this.priority.push({ kind: "priority", sourceKey, eventType, eventId, createdAtMs: this.options.now() });
  }

  metrics(): SchedulerMetrics {
    return {
      queueDepth: this.priority.length + (this.normal ? 1 : 0),
      openaiActive: this.openaiActive,
      maxOpenaiActive: this.maxOpenaiActive,
      attempts: this.attempts,
      successes: this.successes,
      expired: this.expired,
      superseded: this.superseded,
      failures: this.failures,
      degraded: this.circuitOpen(this.options.now()),
      windows: this.windows,
      causes: { ...this.causes },
    };
  }

  async pump(): Promise<void> {
    while (await this.next()) {
      // Each step handles one eligible summary.
    }
  }

  async next(): Promise<boolean> {
    if (this.suspended || this.speaking) {
      return false;
    }
    const now = this.options.now();
    const priority = this.priority.shift();
    if (priority) {
      await this.speak(priority, now);
      return true;
    }
    const summary = this.normal;
    if (!summary) {
      return false;
    }
    if (now - summary.createdAtMs >= NORMAL_REACTION_TTL_MS) {
      this.normal = null;
      await this.expire(summary, now);
      return true;
    }
    if (now < this.lastNormalAt + cooldownMs(summary.activityLevel)) {
      return false;
    }
    if (this.circuitOpen(now)) {
      if (this.fallbackUsedWhileOpen) {
        return false;
      }
      this.normal = null;
      this.fallbackUsedWhileOpen = true;
      await this.storeFallback(summary, now, false);
      return true;
    }
    this.normal = null;
    await this.speak(summary, now);
    return true;
  }

  private async speak(summary: ReactionSummary, now: number): Promise<void> {
    this.speaking = true;
    this.openaiActive += 1;
    this.maxOpenaiActive = Math.max(this.maxOpenaiActive, this.openaiActive);
    try {
      let claim: "owned" | "duplicate";
      try {
        claim = await this.options.store.claim(draftFrom(summary));
      } catch {
        this.causes.reaction_claim_error += 1;
        this.failures += 1;
        return;
      }
      if (claim === "duplicate") {
        this.done.add(summary.sourceKey);
        return;
      }
      if (this.suspended) {
        await this.finishExpired(summary, now);
        return;
      }
      let outcome: InferenceResult = { ok: false, transient: true, reason: "unavailable" };
      for (let attempt = 1; attempt <= OPENAI_MAX_ATTEMPTS; attempt += 1) {
        if (this.suspended) {
          await this.finishExpired(summary, now);
          return;
        }
        this.attempts += 1;
        let facts: ReturnType<typeof reactionFacts>;
        try {
          facts = reactionFacts(summary);
        } catch {
          this.causes.reaction_prompt_error += 1;
          await this.storeFallback(summary, now, true);
          return;
        }
        try {
          outcome = await this.options.infer(facts);
        } catch {
          outcome = { ok: false, transient: true, reason: "unavailable" };
        }
        if (this.suspended) {
          await this.finishExpired(summary, now);
          return;
        }
        if (outcome.ok) {
          const validated = validateReactionText(outcome.text);
          if (!validated.ok) {
            await this.storeFallback(summary, now, true);
            return;
          }
          const stored = await this.storeGenerated(summary, validated.text, BIT_REACTION_MODEL, now);
          if (!stored) {
            return;
          }
          this.successes += 1;
          this.consecutiveFailures = 0;
          this.done.add(summary.sourceKey);
          if (summary.kind === "activity") {
            this.lastNormalAt = now;
          }
          return;
        }
        this.noteInferenceFailure(outcome.reason);
        if (!outcome.transient) {
          break;
        }
      }
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
        this.circuitOpenUntil = now + CIRCUIT_OPEN_MS;
        this.fallbackUsedWhileOpen = false;
      }
      await this.storeFallback(summary, now, true);
    } catch {
      this.failures += 1;
    } finally {
      this.openaiActive -= 1;
      this.speaking = false;
    }
  }

  private async finishExpired(summary: ReactionSummary, now: number): Promise<void> {
    this.expired += 1;
    this.done.add(summary.sourceKey);
    try {
      await this.options.store.finish(summary.sourceKey, {
        ...storedFields(summary),
        status: "EXPIRED",
        text: null,
        model: null,
        generatedAtMs: now,
      });
    } catch {
      this.causes.reaction_store_error += 1;
      this.failures += 1;
    }
  }

  private async storeFallback(summary: ReactionSummary, now: number, alreadyClaimed: boolean): Promise<void> {
    if (this.suspended) {
      if (alreadyClaimed) {
        await this.finishExpired(summary, now);
      }
      return;
    }
    if (!alreadyClaimed) {
      try {
        const claim = await this.options.store.claim(draftFrom(summary));
        if (claim === "duplicate") {
          this.done.add(summary.sourceKey);
          return;
        }
      } catch {
        this.causes.reaction_claim_error += 1;
        this.failures += 1;
        return;
      }
    }
    const text = fallbackText(summary);
    const validated = validateReactionText(text);
    if (!validated.ok) {
      const failed = await this.storeStatus(summary, {
        status: "FAILED",
        text: null,
        model: null,
        generatedAtMs: now,
      });
      if (!failed) {
        return;
      }
      this.done.add(summary.sourceKey);
      return;
    }
    const stored = await this.storeStatus(summary, {
      status: "GENERATED",
      text: validated.text,
      model: "deterministic-fallback",
      generatedAtMs: now,
    });
    if (!stored) {
      this.causes.fallback_store_error += 1;
      return;
    }
    this.successes += 1;
    this.done.add(summary.sourceKey);
    if (summary.kind === "activity") {
      this.lastNormalAt = now;
    }
  }

  private async expire(summary: ActivitySummary, now: number): Promise<void> {
    this.expired += 1;
    this.done.add(summary.sourceKey);
    try {
      const claim = await this.options.store.claim(draftFrom(summary));
      if (claim === "duplicate") {
        return;
      }
      await this.options.store.finish(summary.sourceKey, {
        ...storedFields(summary),
        status: "EXPIRED",
        text: null,
        model: null,
        generatedAtMs: now,
      });
    } catch {
      this.causes.reaction_store_error += 1;
      this.failures += 1;
    }
  }

  private noteInferenceFailure(reason: "timeout" | "rate_limit" | "empty" | "invalid" | "prohibited" | "unavailable"): void {
    if (reason === "empty" || reason === "invalid" || reason === "prohibited") {
      this.causes.openai_response_error += 1;
      return;
    }
    this.causes.openai_request_error += 1;
  }

  private async storeGenerated(summary: ReactionSummary, text: string, model: string, now: number): Promise<boolean> {
    return this.storeStatus(summary, {
      status: "GENERATED",
      text,
      model,
      generatedAtMs: now,
    });
  }

  private async storeStatus(
    summary: ReactionSummary,
    patch: { status: ReactionStatus; text: string | null; model: string | null; generatedAtMs: number | null },
  ): Promise<boolean> {
    try {
      await this.options.store.finish(summary.sourceKey, { ...storedFields(summary), ...patch });
      return true;
    } catch {
      this.causes.reaction_store_error += 1;
      this.failures += 1;
      return false;
    }
  }

  private circuitOpen(now: number): boolean {
    if (this.circuitOpenUntil === 0) {
      return false;
    }
    if (now >= this.circuitOpenUntil) {
      this.circuitOpenUntil = 0;
      this.fallbackUsedWhileOpen = false;
      this.consecutiveFailures = 0;
      return false;
    }
    return true;
  }
}

export function reactionSchedulerMode(launchState: "PRELAUNCH" | "LIVE", canonicalMint: string | null): "IDLE" | "ACTIVE" {
  return launchState === "LIVE" && canonicalMint !== null ? "ACTIVE" : "IDLE";
}

function summarizeGroup(start: number, events: TradeFact[], closedAtMs: number): ActivitySummary {
  let buyCount = 0;
  let sellCount = 0;
  let buySol = 0;
  let sellSol = 0;
  let largest = events[0]!;
  for (const event of events) {
    if (event.type === "BUY") {
      buyCount += 1;
      buySol += event.solAmount;
    } else {
      sellCount += 1;
      sellSol += event.solAmount;
    }
    if (event.solAmount > largest.solAmount) {
      largest = event;
    }
  }
  const eventCount = events.length;
  const activityLevel = activityLevelFor(eventCount) ?? "LOW";
  return {
    kind: "activity",
    sourceKey: `window:${start}`,
    mode: activityLevel === "LOW" ? "INDIVIDUAL" : "BURST",
    windowStartMs: start,
    windowEndMs: start + REACTION_WINDOW_MS,
    buyCount,
    sellCount,
    buySolTotal: roundSol(buySol),
    sellSolTotal: roundSol(sellSol),
    largestTradeType: largest.type,
    largestTradeSol: roundSol(largest.solAmount),
    netDirection: netDirectionFor(buySol, sellSol),
    activityLevel,
    eventCount,
    createdAtMs: closedAtMs,
  };
}

function storedFields(summary: ReactionSummary): Omit<ReactionWrite, "status" | "text" | "model" | "generatedAtMs"> {
  const draft = draftFrom(summary);
  return {
    reactionType: draft.reactionType,
    sourceMode: draft.sourceMode,
    eventCount: draft.eventCount,
    activityLevel: draft.activityLevel,
    windowStartMs: draft.windowStartMs,
    windowEndMs: draft.windowEndMs,
  };
}

function draftFrom(summary: ReactionSummary): ReactionDraft {
  if (summary.kind === "priority") {
    return {
      sourceKey: summary.sourceKey,
      reactionType: summary.eventType,
      sourceMode: "PRIORITY",
      windowStartMs: null,
      windowEndMs: null,
      eventCount: 1,
      activityLevel: null,
    };
  }
  return {
    sourceKey: summary.sourceKey,
    reactionType: "ACTIVITY",
    sourceMode: summary.mode,
    windowStartMs: summary.windowStartMs,
    windowEndMs: summary.windowEndMs,
    eventCount: summary.eventCount,
    activityLevel: summary.activityLevel,
  };
}

function roundSol(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
