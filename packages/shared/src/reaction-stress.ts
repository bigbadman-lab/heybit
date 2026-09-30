import {
  createMemoryReactionStore,
  ReactionScheduler,
  type InferenceResult,
  type ReactionFacts,
  type TradeFact,
} from "./reaction.js";

export interface ReactionStressReport {
  pass: boolean;
  tradeEvents: number;
  windows: number;
  openaiAttempts: number;
  successfulReactions: number;
  expiredOrSuperseded: number;
  maxOpenaiConcurrency: number;
  priorityFirst: boolean;
  recoveryAttempts: number;
  duplicateAfterRestart: boolean;
}

export async function runReactionStress(): Promise<ReactionStressReport> {
  const store = createMemoryReactionStore();
  let now = 0;
  let down = false;
  let active = 0;
  let maxActive = 0;
  const order: string[] = [];
  const infer = async (facts: ReactionFacts): Promise<InferenceResult> => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await Promise.resolve();
    active -= 1;
    if (active > 1) {
      maxActive = Math.max(maxActive, active);
    }
    if (down) {
      return { ok: false, transient: true, reason: "unavailable" };
    }
    order.push(facts.mode === "PRIORITY" ? "priority" : "activity");
    if (facts.mode === "PRIORITY") {
      return { ok: true, text: "noted." };
    }
    return { ok: true, text: facts.activityLevel === "LOW" ? "i saw that." : "things are moving." };
  };

  const scheduler = new ReactionScheduler({ now: () => now, store, infer });
  scheduler.observe([fact("priority-buy", "BUY", 0.2, 0)]);
  scheduler.pushPriority("TOKEN_BURN", "synthetic-burn");
  await scheduler.next();
  const priorityFirst = order[0] === "priority";

  down = true;
  const events: TradeFact[] = [];
  for (let index = 0; index < 1_000; index += 1) {
    const window = Math.floor(index / 50);
    events.push(fact(`trade-${index}`, index % 3 === 0 ? "SELL" : "BUY", 0.1, window * 8_000));
  }
  for (let window = 0; window < 20; window += 1) {
    now = window * 8_000;
    scheduler.observe(events.filter((event) => Date.parse(event.observedAt) === now));
    await scheduler.pump();
  }
  const attemptsDuringOutage = scheduler.metrics().attempts;
  now = 19 * 8_000 + 120_000;
  await scheduler.pump();
  const attemptsAfterExpiry = scheduler.metrics().attempts;
  down = false;
  now += 60_000;
  const beforeRecovery = scheduler.metrics().attempts;
  scheduler.observe([fact("fresh-buy", "BUY", 0.25, now)]);
  await scheduler.pump();
  const recoveryAttempts = scheduler.metrics().attempts - beforeRecovery;
  const generated = [...store.rows.values()].filter((row) => row.status === "GENERATED").length;

  const restarted = new ReactionScheduler({ now: () => now, store, infer });
  restarted.observe([fact("fresh-buy", "BUY", 0.25, now)]);
  await restarted.pump();
  const generatedAfterRestart = [...store.rows.values()].filter((row) => row.status === "GENERATED").length;

  const metrics = scheduler.metrics();
  const expiredOrSuperseded = metrics.expired + metrics.superseded;
  const pass =
    maxActive === 1 &&
    priorityFirst &&
    events.length === 1_000 &&
    metrics.windows >= 20 &&
    metrics.attempts <= 20 &&
    metrics.attempts < metrics.windows &&
    generated < 20 &&
    expiredOrSuperseded >= 10 &&
    attemptsAfterExpiry === attemptsDuringOutage &&
    recoveryAttempts <= 2 &&
    generatedAfterRestart === generated;

  return {
    pass,
    tradeEvents: events.length,
    windows: metrics.windows,
    openaiAttempts: metrics.attempts,
    successfulReactions: generated,
    expiredOrSuperseded,
    maxOpenaiConcurrency: maxActive,
    priorityFirst,
    recoveryAttempts,
    duplicateAfterRestart: generatedAfterRestart !== generated,
  };
}

function fact(signature: string, type: "BUY" | "SELL", solAmount: number, atMs: number): TradeFact {
  return { signature, type, solAmount, observedAt: new Date(atMs).toISOString() };
}
