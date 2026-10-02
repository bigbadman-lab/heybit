import type { PublicAgent } from "@heybit/shared/agent";
import { tapeKindLabel, type TapeEvent } from "./bit-tape";

export const STREAM_ROW_LIMIT = 6;

export interface StreamRow {
  id: string;
  kind: "OBSERVED" | "THOUGHT" | "MEMORY" | "STATE";
  detail: string;
  atMs: number;
}

export function agentActivityRows(input: {
  observed: readonly TapeEvent[];
  speech: string | null;
  agent: PublicAgent | null;
  live: boolean;
  nowMs: number;
}): StreamRow[] {
  const rows: StreamRow[] = [];
  const priced = input.live && input.agent?.known ? input.agent.observations : [];
  if (priced.length > 0) {
    for (const event of priced) {
      const amount = event.solAmount === null ? "" : ` ${event.solAmount} SOL`;
      rows.push({
        id: `observed:${event.atMs}:${event.type}`,
        kind: "OBSERVED",
        detail: `${event.type}${amount}`,
        atMs: event.atMs,
      });
    }
  } else {
    for (const event of input.observed) {
      rows.push({
        id: event.id,
        kind: "OBSERVED",
        detail: tapeKindLabel(event.kind),
        atMs: event.atMs ?? input.nowMs,
      });
    }
  }
  const speech = input.speech?.trim() ?? "";
  if (speech !== "") {
    rows.push({
      id: `thought:${speech}`,
      kind: "THOUGHT",
      detail: speech,
      atMs: input.agent?.lastEventAt ? Date.parse(input.agent.lastEventAt) : input.nowMs,
    });
  }
  if (input.agent?.known) {
    rows.push({
      id: `state:${input.agent.state}`,
      kind: "STATE",
      detail: input.agent.state,
      atMs: input.agent.lastEventAt ? Date.parse(input.agent.lastEventAt) : input.nowMs,
    });
    const memory = memoryDetail(input.agent);
    if (memory) {
      rows.push({
        id: `memory:${memory}`,
        kind: "MEMORY",
        detail: memory,
        atMs: input.agent.lastEventAt ? Date.parse(input.agent.lastEventAt) : input.nowMs,
      });
    }
  }
  return rows.sort((left, right) => right.atMs - left.atMs).slice(0, STREAM_ROW_LIMIT);
}

export function memoryDetail(agent: PublicAgent): string | null {
  if (agent.memory.resumedAfterSilence) {
    return "quiet stretch, then activity resumed";
  }
  if (agent.memory.direction === "flips") {
    return "direction flipped from the previous window";
  }
  if (agent.memory.direction === "continues") {
    return "direction is the same as the previous window";
  }
  return null;
}
