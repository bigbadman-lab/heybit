/** Pending rows newer than this stay untouched, including anything still in flight. */
export const STALE_PENDING_MIN_AGE_MS = 60 * 60 * 1000;

export interface StalePendingCandidate {
  status: string;
  createdAtMs: number;
}

export interface StalePendingDecision {
  eligible: number;
  protectedPending: number;
  mutate: boolean;
  refusal: string | null;
}

/**
 * Selects PENDING rows older than the cutoff. The cutoff itself must be at least
 * one hour before now. Confirmation is required before any write, and a repeat
 * selection skips rows that are no longer PENDING.
 */
export function decideStalePending(input: {
  nowMs: number;
  cutoffMs: number;
  rows: readonly StalePendingCandidate[];
  confirm: boolean;
}): StalePendingDecision {
  const protectedPending = input.rows.filter(
    (row) => row.status === "PENDING" && row.createdAtMs >= input.cutoffMs,
  ).length;
  if (!Number.isFinite(input.cutoffMs) || input.cutoffMs > input.nowMs - STALE_PENDING_MIN_AGE_MS) {
    return {
      eligible: 0,
      protectedPending,
      mutate: false,
      refusal: "cutoff must be at least 1 hour before now",
    };
  }
  const eligible = input.rows.filter(
    (row) => row.status === "PENDING" && row.createdAtMs < input.cutoffMs,
  ).length;
  return {
    eligible,
    protectedPending,
    mutate: input.confirm,
    refusal: null,
  };
}
