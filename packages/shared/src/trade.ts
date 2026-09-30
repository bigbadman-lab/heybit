import type { BitRuntime } from "./index.js";

export const MAINNET_GENESIS_HASH = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
export const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const TESTNET_GENESIS_HASH = "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY";

export type SolanaCluster = "mainnet" | "devnet" | "testnet" | "unknown";

export function identifyCluster(genesisHash: string): SolanaCluster {
  if (genesisHash === MAINNET_GENESIS_HASH) {
    return "mainnet";
  }
  if (genesisHash === DEVNET_GENESIS_HASH) {
    return "devnet";
  }
  if (genesisHash === TESTNET_GENESIS_HASH) {
    return "testnet";
  }
  return "unknown";
}

export interface TokenBalanceSnapshot {
  owner: string;
  mint: string;
  amount: string;
  decimals: number;
}

export interface AccountLamports {
  pubkey: string;
  pre: number;
  post: number;
}

/** Sanitized transaction facts. Direction is judged for the fee payer only. */
export interface InspectableTransaction {
  signature: string;
  slot: number;
  err: boolean;
  feeLamports: number;
  feePayer: string;
  accountLamports: AccountLamports[];
  preTokenBalances: TokenBalanceSnapshot[];
  postTokenBalances: TokenBalanceSnapshot[];
}

export interface BitTradeEvent {
  type: "BUY" | "SELL";
  signature: string;
  slot: number;
  mint: string;
  solAmount: number;
  tokenAmount: number | null;
  observedAt: string;
}

export type ParseOutcome =
  | { kind: "trade"; event: BitTradeEvent }
  | { kind: "ignore"; reason: "failed" | "irrelevant" | "malformed" | "unclassified" };

export interface ProcessedClaim {
  signature: string;
  slot: number | null;
  canonicalMint: string;
  status: "trade" | "ignored" | "failed";
  eventType: "BUY" | "SELL" | null;
  solAmount: number | null;
  tokenAmount: number | null;
}

export interface TransactionLedger {
  claim(row: ProcessedClaim): Promise<"inserted" | "duplicate">;
}

export type ProcessResult = "trade" | "ignored" | "failed" | "duplicate" | "unavailable";

const LAMPORTS_PER_SOL = 1_000_000_000;

export function parseTrade(tx: InspectableTransaction, mint: string, observedAt: string): ParseOutcome {
  if (!tx || typeof tx.signature !== "string" || tx.signature.trim() === "" || mint.trim() === "") {
    return { kind: "ignore", reason: "malformed" };
  }
  if (typeof tx.slot !== "number" || !Number.isSafeInteger(tx.slot) || tx.slot < 0) {
    return { kind: "ignore", reason: "malformed" };
  }
  if (tx.err) {
    return { kind: "ignore", reason: "failed" };
  }
  if (typeof tx.feePayer !== "string" || tx.feePayer.trim() === "") {
    return { kind: "ignore", reason: "malformed" };
  }
  if (!Array.isArray(tx.accountLamports) || !Array.isArray(tx.preTokenBalances) || !Array.isArray(tx.postTokenBalances)) {
    return { kind: "ignore", reason: "malformed" };
  }
  if (typeof tx.feeLamports !== "number" || !Number.isSafeInteger(tx.feeLamports) || tx.feeLamports < 0) {
    return { kind: "ignore", reason: "malformed" };
  }

  let pre: bigint;
  let post: bigint;
  let decimals: number;
  try {
    const before = ownerMintTotal(tx.preTokenBalances, tx.feePayer, mint);
    const after = ownerMintTotal(tx.postTokenBalances, tx.feePayer, mint);
    if (before.missing && after.missing) {
      return { kind: "ignore", reason: "irrelevant" };
    }
    pre = before.amount;
    post = after.amount;
    decimals = before.missing ? after.decimals : before.decimals;
    if (!before.missing && !after.missing && before.decimals !== after.decimals) {
      return { kind: "ignore", reason: "malformed" };
    }
  } catch {
    return { kind: "ignore", reason: "malformed" };
  }

  const tokenDelta = post - pre;
  if (tokenDelta === 0n) {
    return { kind: "ignore", reason: "irrelevant" };
  }

  const lamports = tx.accountLamports.find((account) => account.pubkey === tx.feePayer);
  if (!lamports || !Number.isSafeInteger(lamports.pre) || !Number.isSafeInteger(lamports.post)) {
    return { kind: "ignore", reason: "malformed" };
  }

  // The fee payer's lamport delta includes the network fee. Add the fee back
  // so the trade amount is the SOL transferred, not the transaction fee.
  const tradeLamports = lamports.post - lamports.pre + tx.feeLamports;
  const bought = tokenDelta > 0n && tradeLamports < 0;
  const sold = tokenDelta < 0n && tradeLamports > 0;
  if (!bought && !sold) {
    return { kind: "ignore", reason: "unclassified" };
  }

  return {
    kind: "trade",
    event: {
      type: bought ? "BUY" : "SELL",
      signature: tx.signature,
      slot: tx.slot,
      mint,
      solAmount: Math.abs(tradeLamports) / LAMPORTS_PER_SOL,
      tokenAmount: uiAmount(tokenDelta < 0n ? -tokenDelta : tokenDelta, decimals),
      observedAt,
    },
  };
}

export function decideMonitoring(runtime: BitRuntime | null): {
  action: "idle" | "listen";
  mint: string | null;
  reason: string;
} {
  if (!runtime) {
    return { action: "idle", mint: null, reason: "runtime unavailable" };
  }
  if (runtime.launchState !== "LIVE" || !runtime.canonicalMint) {
    return { action: "idle", mint: null, reason: "token not live" };
  }
  return { action: "listen", mint: runtime.canonicalMint, reason: "canonical mint is live" };
}

export interface ListenerState {
  mode: "IDLE" | "ACTIVE" | "RECONNECTING";
  mint: string | null;
  attempt: number;
}

export type ListenerEvent =
  | { type: "runtime"; runtime: BitRuntime | null }
  | { type: "socket-closed" }
  | { type: "socket-open" }
  | { type: "supabase-down" };

export function reduceListener(state: ListenerState, event: ListenerEvent): ListenerState {
  if (event.type === "supabase-down") {
    return state;
  }
  if (event.type === "runtime") {
    const decision = decideMonitoring(event.runtime);
    if (decision.action === "idle") {
      return { mode: "IDLE", mint: null, attempt: 0 };
    }
    if (state.mode === "ACTIVE" && state.mint === decision.mint) {
      return state;
    }
    return { mode: "ACTIVE", mint: decision.mint, attempt: 0 };
  }
  if (event.type === "socket-closed") {
    if (state.mode !== "ACTIVE" || !state.mint) {
      return state;
    }
    return { mode: "RECONNECTING", mint: state.mint, attempt: state.attempt + 1 };
  }
  if (!state.mint) {
    return { mode: "IDLE", mint: null, attempt: 0 };
  }
  return { mode: "ACTIVE", mint: state.mint, attempt: 0 };
}

export function reconnectDelayMs(attempt: number): number {
  const exponent = Math.max(0, Math.min(attempt - 1, 5));
  return Math.min(30_000, 1_000 * 2 ** exponent);
}

export function createMemoryLedger(): TransactionLedger & { rows: ProcessedClaim[] } {
  const seen = new Map<string, ProcessedClaim>();
  const inflight = new Map<string, Promise<"inserted" | "duplicate">>();
  const rows: ProcessedClaim[] = [];
  return {
    rows,
    claim(row) {
      const pending = inflight.get(row.signature);
      if (pending) {
        return pending.then(() => "duplicate" as const);
      }
      if (seen.has(row.signature)) {
        return Promise.resolve("duplicate" as const);
      }
      const work = (async () => {
        await Promise.resolve();
        if (seen.has(row.signature)) {
          return "duplicate" as const;
        }
        seen.set(row.signature, row);
        rows.push(row);
        return "inserted" as const;
      })();
      inflight.set(row.signature, work);
      void work.finally(() => {
        inflight.delete(row.signature);
      });
      return work;
    },
  };
}

export async function processObservedTransaction(input: {
  tx: InspectableTransaction | null;
  mint: string;
  observedAt: string;
  ledger: TransactionLedger;
}): Promise<ProcessResult> {
  if (!input.tx) {
    return "unavailable";
  }
  const parsed = parseTrade(input.tx, input.mint, input.observedAt);
  const claim = claimFromParse(input.tx, input.mint, parsed);
  const stored = await input.ledger.claim(claim);
  if (stored === "duplicate") {
    return "duplicate";
  }
  if (parsed.kind === "trade") {
    return "trade";
  }
  return parsed.reason === "failed" ? "failed" : "ignored";
}

export async function safelyProcessObservedTransaction(
  input: Parameters<typeof processObservedTransaction>[0],
): Promise<ProcessResult | "retry"> {
  try {
    return await processObservedTransaction(input);
  } catch {
    return "retry";
  }
}

function claimFromParse(tx: InspectableTransaction, mint: string, parsed: ParseOutcome): ProcessedClaim {
  if (parsed.kind === "trade") {
    return {
      signature: tx.signature,
      slot: tx.slot,
      canonicalMint: mint,
      status: "trade",
      eventType: parsed.event.type,
      solAmount: parsed.event.solAmount,
      tokenAmount: parsed.event.tokenAmount,
    };
  }
  return {
    signature: tx.signature,
    slot: Number.isSafeInteger(tx.slot) ? tx.slot : null,
    canonicalMint: mint,
    status: parsed.reason === "failed" ? "failed" : "ignored",
    eventType: null,
    solAmount: null,
    tokenAmount: null,
  };
}

function ownerMintTotal(
  balances: TokenBalanceSnapshot[],
  owner: string,
  mint: string,
): { amount: bigint; decimals: number; missing: boolean } {
  const matches = balances.filter((balance) => balance.owner === owner && balance.mint === mint);
  if (matches.length === 0) {
    return { amount: 0n, decimals: 0, missing: true };
  }
  let total = 0n;
  const decimals = matches[0]?.decimals;
  if (typeof decimals !== "number" || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("malformed");
  }
  for (const balance of matches) {
    if (balance.decimals !== decimals || !/^\d+$/.test(balance.amount)) {
      throw new Error("malformed");
    }
    total += BigInt(balance.amount);
  }
  return { amount: total, decimals, missing: false };
}

function uiAmount(raw: bigint, decimals: number): number {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;
  if (decimals === 0) {
    return Number(whole);
  }
  const text = `${whole.toString()}.${fraction.toString().padStart(decimals, "0")}`;
  return Number(text);
}
