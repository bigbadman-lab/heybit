import { EVENT_DURATION_MS, type BitMascotState } from "./bit-mascot.constants.js";

export const VISUAL_EVENT_KINDS = ["BUY", "SELL", "BURN", "DEX_PAID", "NOTICE"] as const;

export type VisualEventKind = (typeof VISUAL_EVENT_KINDS)[number];

export const VISUAL_QUEUE_LIMIT = 4;

const PRIORITY: Record<VisualEventKind, number> = {
  BURN: 5,
  DEX_PAID: 4,
  BUY: 3,
  SELL: 3,
  NOTICE: 2,
};

export interface VisualEvent {
  id: string;
  kind: VisualEventKind;
  atMs?: number;
}

export interface VisualSource {
  events: VisualEvent[];
  busy: boolean;
  intensity: number;
}

export interface VisualPose {
  state: BitMascotState;
  intensity: number;
}

export interface RehearsalStep {
  at: number;
  event?: VisualEvent;
  busy?: boolean;
  intensity?: number;
}

export const VISUAL_REHEARSALS: Record<string, readonly RehearsalStep[]> = {
  buy: [{ at: 80, event: { id: "rehearse-buy", kind: "BUY" } }],
  sell: [{ at: 80, event: { id: "rehearse-sell", kind: "SELL" } }],
  burn: [{ at: 80, event: { id: "rehearse-burn", kind: "BURN" } }],
  "dex-paid": [{ at: 80, event: { id: "rehearse-dex", kind: "DEX_PAID" } }],
  notice: [{ at: 80, event: { id: "rehearse-notice", kind: "NOTICE" } }],
  busy: [
    { at: 80, busy: true, intensity: 0.4 },
    { at: 900, busy: false, intensity: 0 },
  ],
  "busy-buy": [
    { at: 40, busy: true, intensity: 0.55 },
    { at: 180, event: { id: "rehearse-busy-buy", kind: "BUY" } },
  ],
  "busy-burn": [
    { at: 40, busy: true, intensity: 0.8 },
    { at: 180, event: { id: "rehearse-busy-burn", kind: "BURN" } },
  ],
  "buy-sell-buy": [
    { at: 40, event: { id: "rehearse-1", kind: "BUY" } },
    { at: 80, event: { id: "rehearse-2", kind: "SELL" } },
    { at: 120, event: { id: "rehearse-3", kind: "BUY" } },
  ],
};

export function idleVisualPose(): VisualPose {
  return { state: "IDLE", intensity: 0 };
}

export function createBitVisualController() {
  let active: { event: VisualEvent; startedAt: number } | null = null;
  const pending: VisualEvent[] = [];
  const seen = new Set<string>();
  const seenOrder: string[] = [];
  let busy = false;
  let intensity = 0;

  function remember(id: string): boolean {
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    seenOrder.push(id);
    if (seenOrder.length > 200) {
      const oldest = seenOrder.shift();
      if (oldest) {
        seen.delete(oldest);
      }
    }
    return true;
  }

  function trim(): void {
    while (pending.length > VISUAL_QUEUE_LIMIT) {
      let drop = 0;
      for (let index = 1; index < pending.length; index += 1) {
        const rank = PRIORITY[pending[index].kind];
        const dropRank = PRIORITY[pending[drop].kind];
        if (rank < dropRank) {
          drop = index;
        }
      }
      pending.splice(drop, 1);
    }
  }

  function takeNext(): VisualEvent | undefined {
    if (pending.length === 0) {
      return undefined;
    }
    let best = 0;
    for (let index = 1; index < pending.length; index += 1) {
      if (PRIORITY[pending[index].kind] > PRIORITY[pending[best].kind]) {
        best = index;
      }
    }
    return pending.splice(best, 1)[0];
  }

  return {
    push(event: VisualEvent): void {
      if (!isVisualKind(event.kind) || event.id.trim() === "") {
        return;
      }
      if (!remember(event.id)) {
        return;
      }
      pending.push(event);
      trim();
    },
    setBusy(activeBusy: boolean, level: number): void {
      busy = activeBusy;
      intensity = clampIntensity(level);
    },
    ingest(source: VisualSource, baseline: boolean): void {
      this.setBusy(source.busy, source.intensity);
      const ordered = [...source.events].sort((left, right) => (left.atMs ?? 0) - (right.atMs ?? 0));
      for (const event of ordered) {
        if (baseline) {
          if (event.id.trim() !== "") {
            remember(event.id);
          }
          continue;
        }
        this.push(event);
      }
    },
    fail(): void {
      active = null;
      pending.length = 0;
      busy = false;
      intensity = 0;
    },
    sample(nowMs: number): VisualPose {
      if (active) {
        const duration = EVENT_DURATION_MS[active.event.kind] ?? 0;
        if (nowMs - active.startedAt >= duration) {
          active = null;
        }
      }
      if (!active) {
        const next = takeNext();
        if (next) {
          active = { event: next, startedAt: nowMs };
        }
      }
      if (active) {
        return { state: active.event.kind, intensity };
      }
      if (busy) {
        return { state: "BUSY", intensity };
      }
      return idleVisualPose();
    },
  };
}

export type BitVisualController = ReturnType<typeof createBitVisualController>;

export function mapFeedRows(rows: unknown): VisualSource | null {
  if (!Array.isArray(rows)) {
    return null;
  }
  const events: VisualEvent[] = [];
  for (const row of rows) {
    const event = parseFeedRow(row);
    if (event) {
      events.push(event);
    }
  }
  events.sort((left, right) => (left.atMs ?? 0) - (right.atMs ?? 0));
  return { events, busy: false, intensity: 0 };
}

export function playRehearsal(name: string): BitMascotState[] {
  const steps = VISUAL_REHEARSALS[name];
  if (!steps) {
    return ["IDLE"];
  }
  const controller = createBitVisualController();
  const trace: BitMascotState[] = [];
  const end = steps.reduce((max, step) => Math.max(max, step.at), 0) + 4_000;
  let index = 0;
  for (let now = 0; now <= end; now += 20) {
    while (index < steps.length && steps[index].at <= now) {
      const step = steps[index];
      if (step.busy !== undefined) {
        controller.setBusy(step.busy, step.intensity ?? 0);
      }
      if (step.event) {
        controller.push(step.event);
      }
      index += 1;
    }
    const state = controller.sample(now).state;
    if (trace[trace.length - 1] !== state) {
      trace.push(state);
    }
  }
  return trace;
}

function parseFeedRow(row: unknown): VisualEvent | null {
  if (typeof row !== "object" || row === null) {
    return null;
  }
  const record = row as Record<string, unknown>;
  const id = typeof record.cue_id === "string" ? record.cue_id.trim() : "";
  const kind = feedKind(record.kind);
  const atMs = typeof record.observed_at === "string" ? Date.parse(record.observed_at) : Number.NaN;
  if (id === "" || !kind || !Number.isFinite(atMs)) {
    return null;
  }
  return { id, kind, atMs };
}

function feedKind(value: unknown): VisualEventKind | null {
  if (value === "TOKEN_BURN") {
    return "BURN";
  }
  if (value === "BUY" || value === "SELL" || value === "BURN" || value === "DEX_PAID" || value === "NOTICE") {
    return value;
  }
  return null;
}

function isVisualKind(value: string): value is VisualEventKind {
  return VISUAL_EVENT_KINDS.includes(value as VisualEventKind);
}

function clampIntensity(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
