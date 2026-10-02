import { BIT_MASCOT_STATES, type BitMascotState } from "./bit-mascot.constants.js";

export const FALLBACK_COMMENTARY = "still watching";

export const IDLE_COMMENTARY_MS = 20_000;

/** Idle lines rotate only while BIT is actually idle. */
export function idleCommentaryActive(state: string): boolean {
  return state === "IDLE";
}

export const COMMENTARY_POOLS: Record<BitMascotState, readonly string[]> = {
  IDLE: [
    "quiet out there",
    "waiting for something interesting",
    "nothing to report",
    "suspiciously calm",
    "still watching",
    "timeline is suspiciously calm",
  ],
  NOTICE: ["hmm", "interesting", "saw that", "one sec", "what was that", "eyes open"],
  BUY: ["someone's feeling brave", "that's one way to do it", "a buy just landed", "in it comes", "observed", "there it is"],
  SELL: ["there goes another one", "someone changed their mind", "out they go", "fair enough", "departure detected", "a sell just landed"],
  BUSY: ["processing the chaos", "doing computer things", "one moment", "sorting through it", "bit is busy", "still in it"],
  BURN: ["less supply. noted.", "gone", "supply got lighter", "that one isn't coming back", "clean", "reduced"],
  DEX_PAID: ["the machine has been fed", "payment received", "nice", "business concluded", "fee settled", "the desk is paid"],
};

export function commentarySeed(state: string, cueId: string | null, idleTick: number): string {
  if (state === "IDLE") {
    return `idle:${idleTick}`;
  }
  if (state === "BUSY") {
    return "busy";
  }
  if (cueId && cueId.trim() !== "") {
    return cueId;
  }
  return state;
}

/** A stored reaction is spoken only while the public presence is live. */
export function spokenLine(input: {
  launchState: "PRELAUNCH" | "LIVE" | null;
  reactionText: string | null;
  state: string;
  seed: string;
}): { text: string; source: "reaction" | "pool" } {
  const reaction = input.reactionText?.trim() ?? "";
  if (input.launchState === "LIVE" && reaction !== "") {
    return { text: reaction, source: "reaction" };
  }
  return { text: selectPhrase(input.state, input.seed), source: "pool" };
}

export function selectPhrase(state: string, seed: string): string {
  const pool = poolFor(state);
  if (pool.length === 0) {
    return FALLBACK_COMMENTARY;
  }
  return pool[hash(`${state}:${seed}`) % pool.length] ?? FALLBACK_COMMENTARY;
}

export function runtimeLabel(launchState: string | null): string {
  if (!launchState) {
    return "UNAVAILABLE";
  }
  return launchState;
}

export function mintLabel(mint: string | null, runtimeKnown: boolean): string {
  if (!runtimeKnown) {
    return "UNAVAILABLE";
  }
  if (!mint) {
    return "NOT LAUNCHED";
  }
  return mint;
}

export function feedLabel(status: "pending" | "live" | "unavailable"): string {
  if (status === "live") {
    return "LIVE";
  }
  if (status === "unavailable") {
    return "UNAVAILABLE";
  }
  return "…";
}

function poolFor(state: string): readonly string[] {
  if (isMascotState(state)) {
    return COMMENTARY_POOLS[state];
  }
  return COMMENTARY_POOLS.IDLE;
}

function isMascotState(state: string): state is BitMascotState {
  return BIT_MASCOT_STATES.some((known) => known === state);
}

function hash(value: string): number {
  let hashValue = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hashValue ^= value.charCodeAt(index);
    hashValue = Math.imul(hashValue, 16_777_619);
  }
  return hashValue >>> 0;
}
