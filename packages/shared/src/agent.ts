export const AGENT_HORIZON_MS = 15 * 60 * 1000;
export const AGENT_SPEECH_LIMIT = 5;
export const AGENT_WINDOW_LIMIT = 5;
export const AGENT_WINDOW_MS = 8_000;
export const AGENT_QUIET_GAP_MS = 3 * 60 * 1000;
export const AGENT_BURST_MS = 60_000;
export const AGENT_BURST_COUNT = 8;
export const AGENT_ACTIVE_COUNT = 6;
export const AGENT_ACTIVE_GAP_MS = 90_000;

export const ASK_ACTIONS = ["what_changed", "what_watching", "summarise_15m"] as const;

export type AskAction = (typeof ASK_ACTIONS)[number];
export type AgentMood = "QUIET" | "WATCHING" | "ACTIVE" | "CHAOTIC";
export type AgentLifecycle = "IDLE" | "WATCHING" | "THINKING" | "REACTING";
export type ActivityTrend = "increasing" | "stable" | "slowing";
export type AgentDirection = "continues" | "flips" | "none";
export type AgentNet = "BUY_HEAVY" | "SELL_HEAVY" | "BALANCED";

export interface AgentTradeInput {
  type: "BUY" | "SELL";
  solAmount: number | null;
  observedAtMs: number;
}

export interface AgentLineInput {
  text: string;
  atMs: number;
}

export interface AgentRecent {
  buyCount: number | null;
  sellCount: number | null;
  buySol: number | null;
  sellSol: number | null;
  trend: ActivityTrend;
  netDirection: AgentNet;
  largestTrade: { type: "BUY" | "SELL"; solAmount: number } | null;
}

export interface AgentWindow {
  buyCount: number;
  sellCount: number;
  netDirection: AgentNet;
}

export interface AgentObservation {
  type: "BUY" | "SELL";
  solAmount: number | null;
  atMs: number;
}

export interface PublicAgent {
  known: boolean;
  state: AgentMood;
  lifecycle: AgentLifecycle;
  lastEventAt: string | null;
  msSinceLastTrade: number | null;
  recent: AgentRecent;
  memory: {
    lines: string[];
    windows: AgentWindow[];
    resumedAfterSilence: boolean;
    direction: AgentDirection;
  };
  observations: AgentObservation[];
}

export interface AgentPromptContext {
  state: AgentMood;
  recentLines: string[];
  buyCount: number;
  sellCount: number;
  buySol: number | null;
  sellSol: number | null;
  netDirection: AgentNet;
  trend: ActivityTrend;
  msSincePreviousTrade: number | null;
  resumedAfterSilence: boolean;
  direction: AgentDirection;
}

const ADVICE = /\b(buy now|sell now|hold|moon|guaranteed|price target|you should)\b/i;

export function parseAskAction(body: unknown): AskAction | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }
  const record = body as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || !Object.hasOwn(record, "action")) {
    return null;
  }
  const action = record.action;
  return ASK_ACTIONS.some((allowed) => allowed === action) ? (action as AskAction) : null;
}

export function prelaunchAgent(): PublicAgent {
  return {
    known: true,
    state: "QUIET",
    lifecycle: "IDLE",
    lastEventAt: null,
    msSinceLastTrade: null,
    recent: emptyRecent(),
    memory: { lines: [], windows: [], resumedAfterSilence: false, direction: "none" },
    observations: [],
  };
}

export function unknownAgent(): PublicAgent {
  return { ...prelaunchAgent(), known: false };
}

export function deriveAgent(input: {
  trades: readonly AgentTradeInput[];
  lines: readonly AgentLineInput[];
  nowMs: number;
  launchState: "PRELAUNCH" | "LIVE" | null;
  thinking: boolean;
  reacting?: boolean;
}): PublicAgent {
  if (input.launchState !== "LIVE") {
    return prelaunchAgent();
  }
  const trades = input.trades
    .filter((trade) => Number.isFinite(trade.observedAtMs) && input.nowMs - trade.observedAtMs <= AGENT_HORIZON_MS && input.nowMs >= trade.observedAtMs)
    .sort((left, right) => left.observedAtMs - right.observedAtMs);
  const lines = boundedLines(input.lines);
  const windows = closedWindows(trades, input.nowMs);
  const last = trades.length > 0 ? trades[trades.length - 1] : null;
  const previous = trades.length > 1 ? trades[trades.length - 2] : null;
  const gap = last ? input.nowMs - last.observedAtMs : null;
  const resumedAfterSilence = Boolean(
    last &&
      gap !== null &&
      gap < 2 * 60 * 1000 &&
      (!previous || last.observedAtMs - previous.observedAtMs >= AGENT_QUIET_GAP_MS),
  );
  const recent = summarize(trades);
  const state = moodFor(trades, input.nowMs, gap);
  const direction = directionFor(windows);
  return {
    known: true,
    state,
    lifecycle: lifecycleFor(input.launchState, state, input.thinking, input.reacting === true),
    lastEventAt: last ? new Date(last.observedAtMs).toISOString() : null,
    msSinceLastTrade: gap,
    recent,
    memory: { lines, windows, resumedAfterSilence, direction },
    observations: [...trades]
      .reverse()
      .slice(0, AGENT_WINDOW_LIMIT)
      .map((trade) => ({
        type: trade.type,
        solAmount: trade.solAmount === null || !Number.isFinite(trade.solAmount) ? null : roundSol(trade.solAmount),
        atMs: trade.observedAtMs,
      })),
  };
}

export function presentedLifecycle(lifecycle: AgentLifecycle, reacting: boolean): AgentLifecycle {
  if (reacting && lifecycle !== "IDLE") {
    return "REACTING";
  }
  return lifecycle;
}

export function promptContext(agent: PublicAgent): AgentPromptContext {
  return {
    state: agent.state,
    recentLines: agent.memory.lines.slice(0, AGENT_SPEECH_LIMIT),
    buyCount: agent.recent.buyCount ?? 0,
    sellCount: agent.recent.sellCount ?? 0,
    buySol: agent.recent.buySol,
    sellSol: agent.recent.sellSol,
    netDirection: agent.recent.netDirection,
    trend: agent.recent.trend,
    msSincePreviousTrade: agent.msSinceLastTrade,
    resumedAfterSilence: agent.memory.resumedAfterSilence,
    direction: agent.memory.direction,
  };
}

export function deterministicAsk(action: AskAction, launchState: "PRELAUNCH" | "LIVE" | null, agent: PublicAgent): string {
  if (launchState !== "LIVE") {
    if (action === "what_changed") {
      return "nothing yet. i’m still waiting for my market to exist.";
    }
    if (action === "what_watching") {
      return "right now? mostly the door.";
    }
    return "no live market yet. nothing to summarise.";
  }
  if (!agent.known) {
    return "i can’t see the chain right now.";
  }
  if (action === "what_changed") {
    return changedLine(agent);
  }
  if (action === "what_watching") {
    return watchingLine(agent);
  }
  return summariseLine(agent);
}

export function answerAsk(input: {
  action: AskAction;
  launchState: "PRELAUNCH" | "LIVE" | null;
  agent: PublicAgent;
  phrased?: string | null;
}): string {
  const base = deterministicAsk(input.action, input.launchState, input.agent);
  const phrased = input.phrased?.trim() ?? "";
  if (phrased === "" || !safeAskLine(phrased)) {
    return base;
  }
  return phrased;
}

export function safeAskLine(text: string): boolean {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  return lines.length > 0 && lines.length <= 3 && text.length <= 280 && !ADVICE.test(text);
}

export function allowAsk(stamps: number[], nowMs: number, limit = 8, windowMs = 60_000): { allowed: boolean; next: number[] } {
  const next = stamps.filter((stamp) => nowMs - stamp < windowMs);
  if (next.length >= limit) {
    return { allowed: false, next };
  }
  next.push(nowMs);
  return { allowed: true, next };
}

function moodFor(trades: readonly AgentTradeInput[], nowMs: number, gap: number | null): AgentMood {
  if (trades.length === 0 || gap === null || gap >= AGENT_QUIET_GAP_MS) {
    return "QUIET";
  }
  const burst = trades.filter((trade) => nowMs - trade.observedAtMs <= AGENT_BURST_MS).length;
  if (burst >= AGENT_BURST_COUNT) {
    return "CHAOTIC";
  }
  if (trades.length >= AGENT_ACTIVE_COUNT && gap <= AGENT_ACTIVE_GAP_MS) {
    return "ACTIVE";
  }
  return "WATCHING";
}

function lifecycleFor(
  launchState: "PRELAUNCH" | "LIVE" | null,
  state: AgentMood,
  thinking: boolean,
  reacting: boolean,
): AgentLifecycle {
  if (launchState !== "LIVE") {
    return "IDLE";
  }
  if (reacting) {
    return "REACTING";
  }
  if (thinking) {
    return "THINKING";
  }
  if (state === "QUIET") {
    return "IDLE";
  }
  return "WATCHING";
}

function summarize(trades: readonly AgentTradeInput[]): AgentRecent {
  let buyCount = 0;
  let sellCount = 0;
  let buySol = 0;
  let sellSol = 0;
  let amountsKnown = true;
  let largest: { type: "BUY" | "SELL"; solAmount: number } | null = null;
  for (const trade of trades) {
    if (trade.type === "BUY") {
      buyCount += 1;
    } else {
      sellCount += 1;
    }
    if (trade.solAmount === null || !Number.isFinite(trade.solAmount)) {
      amountsKnown = false;
      continue;
    }
    if (trade.type === "BUY") {
      buySol += trade.solAmount;
    } else {
      sellSol += trade.solAmount;
    }
    if (!largest || trade.solAmount > largest.solAmount) {
      largest = { type: trade.type, solAmount: roundSol(trade.solAmount) };
    }
  }
  return {
    buyCount,
    sellCount,
    buySol: amountsKnown ? roundSol(buySol) : null,
    sellSol: amountsKnown ? roundSol(sellSol) : null,
    trend: trendFor(trades),
    netDirection: netFor(buySol, sellSol, buyCount, sellCount, amountsKnown),
    largestTrade: amountsKnown ? largest : null,
  };
}

function trendFor(trades: readonly AgentTradeInput[]): ActivityTrend {
  if (trades.length === 0) {
    return "stable";
  }
  const latest = trades[trades.length - 1]!.observedAtMs;
  const recent = trades.filter((trade) => latest - trade.observedAtMs <= 5 * 60 * 1000).length;
  const prior = trades.filter((trade) => {
    const age = latest - trade.observedAtMs;
    return age > 5 * 60 * 1000 && age <= 10 * 60 * 1000;
  }).length;
  if (prior === 0) {
    return recent > 0 ? "increasing" : "stable";
  }
  if (recent >= prior * 1.4 && recent > prior) {
    return "increasing";
  }
  if (recent <= prior * 0.7 && recent < prior) {
    return "slowing";
  }
  return "stable";
}

function closedWindows(trades: readonly AgentTradeInput[], nowMs: number): AgentWindow[] {
  const groups = new Map<number, AgentTradeInput[]>();
  for (const trade of trades) {
    const start = Math.floor(trade.observedAtMs / AGENT_WINDOW_MS) * AGENT_WINDOW_MS;
    if (start + AGENT_WINDOW_MS > nowMs) {
      continue;
    }
    const group = groups.get(start) ?? [];
    group.push(trade);
    groups.set(start, group);
  }
  return [...groups.entries()]
    .sort((left, right) => right[0] - left[0])
    .slice(0, AGENT_WINDOW_LIMIT)
    .reverse()
    .map(([, group]) => {
      const summary = summarize(group);
      return {
        buyCount: summary.buyCount ?? 0,
        sellCount: summary.sellCount ?? 0,
        netDirection: summary.netDirection,
      };
    });
}

function directionFor(windows: readonly AgentWindow[]): AgentDirection {
  if (windows.length < 2) {
    return "none";
  }
  const previous = windows[windows.length - 2]!;
  const current = windows[windows.length - 1]!;
  if (previous.netDirection === "BALANCED" || current.netDirection === "BALANCED") {
    return "none";
  }
  return previous.netDirection === current.netDirection ? "continues" : "flips";
}

function boundedLines(lines: readonly AgentLineInput[]): string[] {
  return [...lines]
    .filter((line) => line.text.trim() !== "" && Number.isFinite(line.atMs))
    .sort((left, right) => right.atMs - left.atMs)
    .slice(0, AGENT_SPEECH_LIMIT)
    .map((line) => line.text.trim());
}

function changedLine(agent: PublicAgent): string {
  const buy = agent.recent.buyCount ?? 0;
  const sell = agent.recent.sellCount ?? 0;
  if (agent.state === "QUIET") {
    return agent.msSinceLastTrade === null
      ? "nothing meaningful in the last 15 minutes."
      : `mostly quiet. the last trade was ${formatGap(agent.msSinceLastTrade)} ago.`;
  }
  const ahead = buy === sell ? "buys and sells are even" : buy > sell ? `buys are ahead ${buy}–${sell}` : `sells are ahead ${sell}–${buy}`;
  const largest = agent.recent.largestTrade
    ? ` and the largest move was ${agent.recent.largestTrade.solAmount} SOL`
    : "";
  if (agent.memory.resumedAfterSilence) {
    return `activity woke up. ${ahead}${largest}.`;
  }
  return `${ahead}${largest}.`;
}

function watchingLine(agent: PublicAgent): string {
  if (agent.state === "QUIET") {
    return "mostly quiet. i’m waiting for something unusual.";
  }
  if (agent.recent.netDirection === "BUY_HEAVY" && agent.recent.trend === "slowing") {
    return "buy activity is still ahead, but the pace is slowing.";
  }
  if (agent.recent.netDirection === "SELL_HEAVY" && agent.recent.trend === "slowing") {
    return "sells are still ahead, but the pace is slowing.";
  }
  if (agent.recent.trend === "increasing") {
    return agent.recent.netDirection === "SELL_HEAVY" ? "sells are picking up." : "the pace is picking up.";
  }
  if (agent.state === "CHAOTIC") {
    return "a lot is landing at once.";
  }
  if (agent.recent.netDirection === "SELL_HEAVY") {
    return "sells are ahead right now.";
  }
  if (agent.recent.netDirection === "BUY_HEAVY") {
    return "buys are still ahead.";
  }
  return "buys and sells are close.";
}

function summariseLine(agent: PublicAgent): string {
  const buy = agent.recent.buyCount ?? 0;
  const sell = agent.recent.sellCount ?? 0;
  const totals =
    agent.recent.buySol !== null && agent.recent.sellSol !== null
      ? ` ${agent.recent.buySol} SOL bought, ${agent.recent.sellSol} SOL sold.`
      : "";
  const largest = agent.recent.largestTrade ? ` largest was ${agent.recent.largestTrade.solAmount} SOL.` : "";
  const silence = agent.memory.resumedAfterSilence ? " it resumed after a quiet stretch." : "";
  return `${agent.state.toLowerCase()}. ${buy} buys and ${sell} sells in the last 15 minutes.${totals}${largest} activity is ${agent.recent.trend}.${silence}`;
}

function emptyRecent(): AgentRecent {
  return {
    buyCount: null,
    sellCount: null,
    buySol: null,
    sellSol: null,
    trend: "stable",
    netDirection: "BALANCED",
    largestTrade: null,
  };
}

function netFor(buySol: number, sellSol: number, buyCount: number, sellCount: number, amountsKnown: boolean): AgentNet {
  const buy = amountsKnown ? buySol : buyCount;
  const sell = amountsKnown ? sellSol : sellCount;
  if (buy > sell * 1.2) {
    return "BUY_HEAVY";
  }
  if (sell > buy * 1.2) {
    return "SELL_HEAVY";
  }
  return "BALANCED";
}

function roundSol(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function formatGap(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  return `${Math.floor(minutes / 60)}h`;
}
