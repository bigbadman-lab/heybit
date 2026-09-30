import type { InspectableTransaction } from "@heybit/shared/trade";
import type { VersionedTransactionResponse } from "@solana/web3.js";

export function fromConfirmedTransaction(
  signature: string,
  response: VersionedTransactionResponse | null,
): InspectableTransaction | null {
  if (!response?.meta || !response.transaction) {
    return null;
  }
  const keys = accountKeys(response);
  const feePayer = keys[0];
  if (!feePayer) {
    return null;
  }
  return {
    signature,
    slot: response.slot,
    err: response.meta.err !== null,
    feeLamports: response.meta.fee,
    feePayer,
    accountLamports: keys.map((pubkey, index) => ({
      pubkey,
      pre: response.meta?.preBalances[index] ?? 0,
      post: response.meta?.postBalances[index] ?? 0,
    })),
    preTokenBalances: tokenBalances(response.meta.preTokenBalances),
    postTokenBalances: tokenBalances(response.meta.postTokenBalances),
  };
}

function accountKeys(response: VersionedTransactionResponse): string[] {
  const message = response.transaction.message;
  if ("accountKeys" in message && Array.isArray(message.accountKeys)) {
    return message.accountKeys.map((key) => (typeof key === "string" ? key : key.toString()));
  }
  const staticKeys = "staticAccountKeys" in message ? message.staticAccountKeys : [];
  const loaded = response.meta?.loadedAddresses;
  return [...staticKeys, ...(loaded?.writable ?? []), ...(loaded?.readonly ?? [])].map((key) => key.toString());
}

function tokenBalances(balances: unknown): InspectableTransaction["preTokenBalances"] {
  if (!Array.isArray(balances)) {
    return [];
  }
  const rows: InspectableTransaction["preTokenBalances"] = [];
  for (const balance of balances) {
    if (!balance || typeof balance !== "object") {
      continue;
    }
    const record = balance as {
      mint?: string;
      owner?: string;
      uiTokenAmount?: { amount?: string; decimals?: number };
    };
    if (!record.owner || !record.mint || !record.uiTokenAmount?.amount || typeof record.uiTokenAmount.decimals !== "number") {
      continue;
    }
    rows.push({
      owner: record.owner,
      mint: record.mint,
      amount: record.uiTokenAmount.amount,
      decimals: record.uiTokenAmount.decimals,
    });
  }
  return rows;
}
