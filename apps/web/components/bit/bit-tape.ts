export const TAPE_ROW_LIMIT = 5;

const TAPE_KINDS = ["BUY", "SELL", "BURN", "DEX_PAID"] as const;

export interface TapeEvent {
  id: string;
  kind: string;
  atMs?: number;
}

export function tapeRows(events: readonly TapeEvent[]): TapeEvent[] {
  const ordered = [...events].sort((left, right) => (right.atMs ?? 0) - (left.atMs ?? 0));
  const seen = new Set<string>();
  const rows: TapeEvent[] = [];
  for (const event of ordered) {
    if (!isTapeKind(event.kind) || event.id.trim() === "" || seen.has(event.id)) {
      continue;
    }
    seen.add(event.id);
    rows.push(event);
    if (rows.length === TAPE_ROW_LIMIT) {
      break;
    }
  }
  return rows;
}

export function tapeKindLabel(kind: string): string {
  if (kind === "DEX_PAID") {
    return "DEX PAID";
  }
  return kind;
}

export function formatTapeAge(atMs: number | undefined, nowMs: number): string {
  if (atMs === undefined || !Number.isFinite(atMs) || !Number.isFinite(nowMs)) {
    return "now";
  }
  const seconds = Math.max(0, Math.floor((nowMs - atMs) / 1000));
  if (seconds < 1) {
    return "now";
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours}h`;
  }
  return `${Math.floor(hours / 24)}d`;
}

function isTapeKind(kind: string): boolean {
  return TAPE_KINDS.some((supported) => supported === kind);
}
