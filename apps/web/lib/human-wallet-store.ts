import "server-only";
import { randomUUID } from "node:crypto";
import { isCanonicalMint } from "@heybit/shared";
import { serverAdminClient, serverAdminSecret } from "./server-admin";
import {
  HUMAN_CHAIN_FAMILY,
  acceptChainFamily,
  acceptHumanProof,
  humanSessionMatches,
  issueHumanChallenge,
  readHumanSessionId,
  sealHumanSession,
  sessionIsActive,
  type HumanChallenge,
} from "./human-wallet";

export interface VerifiedHuman {
  id: string;
  username: string;
  displayName: string;
  accountType: "HUMAN";
}

export interface OpenHumanSession {
  sessionId: string;
  wallet: string;
  expiresAtMs: number;
}

export async function storeHumanChallenge(wallet: string, domain: string, nowMs: number): Promise<HumanChallenge | null> {
  const issued = issueHumanChallenge({ wallet, domain, nowMs });
  const client = serverAdminClient();
  if (!issued || !client) {
    return null;
  }
  const inserted = await client.from("human_wallet_challenges").insert({
    wallet_address: issued.wallet,
    chain_family: issued.chainFamily,
    nonce: issued.nonce,
    domain: issued.domain,
    message: issued.message,
    expires_at: new Date(issued.expiresAtMs).toISOString(),
  });
  return inserted.error ? null : issued;
}

export async function consumeHumanChallenge(input: {
  wallet: string;
  domain: string;
  nonce: string;
  signature: string;
  nowMs: number;
}): Promise<{ ok: true; wallet: string } | { ok: false; reason: "expired" | "used" | "wallet" | "domain" | "chain" | "signature" | "unavailable" }> {
  const client = serverAdminClient();
  if (!client || !acceptChainFamily(HUMAN_CHAIN_FAMILY) || !isCanonicalMint(input.wallet)) {
    return { ok: false, reason: "unavailable" };
  }
  const burned = await client
    .from("human_wallet_challenges")
    .update({ used_at: new Date(input.nowMs).toISOString() })
    .eq("nonce", input.nonce)
    .eq("wallet_address", input.wallet)
    .eq("domain", input.domain)
    .eq("chain_family", HUMAN_CHAIN_FAMILY)
    .is("used_at", null)
    .gt("expires_at", new Date(input.nowMs).toISOString())
    .select("wallet_address, domain, message, expires_at, chain_family")
    .maybeSingle();
  if (burned.error || !burned.data) {
    const existing = await client
      .from("human_wallet_challenges")
      .select("used_at, expires_at, wallet_address, domain")
      .eq("nonce", input.nonce)
      .maybeSingle();
    if (existing.error || !existing.data) {
      return { ok: false, reason: "used" };
    }
    const row = existing.data as { used_at: string | null; expires_at: string; wallet_address: string; domain: string };
    if (row.used_at) {
      return { ok: false, reason: "used" };
    }
    if (Date.parse(row.expires_at) < input.nowMs) {
      return { ok: false, reason: "expired" };
    }
    if (row.wallet_address !== input.wallet) {
      return { ok: false, reason: "wallet" };
    }
    if (row.domain !== input.domain) {
      return { ok: false, reason: "domain" };
    }
    return { ok: false, reason: "used" };
  }
  const row = burned.data as {
    wallet_address: string;
    domain: string;
    message: string;
    expires_at: string;
    chain_family: string;
  };
  const challenge: HumanChallenge = {
    wallet: row.wallet_address,
    domain: row.domain,
    chainFamily: HUMAN_CHAIN_FAMILY,
    nonce: input.nonce,
    message: row.message,
    expiresAtMs: Date.parse(row.expires_at),
    used: false,
  };
  const proof = acceptHumanProof({
    challenge,
    wallet: input.wallet,
    domain: input.domain,
    signature: input.signature,
    nowMs: input.nowMs,
  });
  if (!proof.ok) {
    return { ok: false, reason: proof.reason === "chain" ? "signature" : proof.reason };
  }
  return { ok: true, wallet: row.wallet_address };
}

export async function openHumanSession(nowMs: number, wallet: string): Promise<{ token: string; expiresAtMs: number } | null> {
  const secret = serverAdminSecret();
  const client = serverAdminClient();
  if (!secret || !client || !isCanonicalMint(wallet)) {
    return null;
  }
  const sessionId = randomUUID();
  const sealed = sealHumanSession(secret, sessionId, wallet, nowMs);
  const inserted = await client.from("human_auth_sessions").insert({
    id: sessionId,
    wallet_address: wallet,
    chain_family: HUMAN_CHAIN_FAMILY,
    expires_at: new Date(sealed.expiresAtMs).toISOString(),
  });
  if (inserted.error) {
    return null;
  }
  await client
    .from("human_wallet_identities")
    .update({ last_verified_at: new Date(nowMs).toISOString() })
    .eq("wallet_address", wallet)
    .eq("chain_family", HUMAN_CHAIN_FAMILY);
  return sealed;
}

export async function readOpenHumanSession(token: string | null, nowMs: number): Promise<OpenHumanSession | null> {
  if (!token) {
    return null;
  }
  const parsed = readHumanSessionId(token);
  const secret = serverAdminSecret();
  const client = serverAdminClient();
  if (!parsed || !secret || !client) {
    return null;
  }
  const result = await client
    .from("human_auth_sessions")
    .select("id, wallet_address, expires_at, revoked_at")
    .eq("id", parsed.sessionId)
    .maybeSingle();
  if (result.error || !result.data) {
    return null;
  }
  const row = result.data as { id: string; wallet_address: string; expires_at: string; revoked_at: string | null };
  const expiresAtMs = Date.parse(row.expires_at);
  if (!humanSessionMatches(secret, token, row.wallet_address, nowMs)) {
    return null;
  }
  if (!sessionIsActive({ revoked: row.revoked_at !== null, expiresAtMs }, nowMs)) {
    return null;
  }
  return { sessionId: row.id, wallet: row.wallet_address, expiresAtMs };
}

export async function revokeHumanSession(sessionId: string, nowMs: number): Promise<void> {
  const client = serverAdminClient();
  if (!client) {
    return;
  }
  await client
    .from("human_auth_sessions")
    .update({ revoked_at: new Date(nowMs).toISOString() })
    .eq("id", sessionId)
    .is("revoked_at", null);
}

export async function findHumanByWallet(wallet: string): Promise<VerifiedHuman | null> {
  const client = serverAdminClient();
  if (!client || !isCanonicalMint(wallet)) {
    return null;
  }
  const identity = await client
    .from("human_wallet_identities")
    .select("account_id")
    .eq("wallet_address", wallet)
    .eq("chain_family", HUMAN_CHAIN_FAMILY)
    .maybeSingle();
  if (identity.error || !identity.data) {
    return null;
  }
  const accountId = (identity.data as { account_id?: string }).account_id;
  if (!accountId) {
    return null;
  }
  const accountResult = await client
    .from("accounts")
    .select("id, username, display_name, account_type, status")
    .eq("id", accountId)
    .maybeSingle();
  if (accountResult.error || !accountResult.data) {
    return null;
  }
  const account = accountResult.data as {
    id: string;
    username: string;
    display_name: string;
    account_type: string;
    status: string;
  };
  if (account.account_type !== "HUMAN" || account.status !== "ACTIVE" || account.username === "bit") {
    return null;
  }
  return {
    id: account.id,
    username: account.username,
    displayName: account.display_name,
    accountType: "HUMAN",
  };
}

export async function bindHumanWallet(input: {
  wallet: string;
  username: string;
  displayName: string;
  bio: string;
}): Promise<{ data: { id?: string; username?: string; created?: boolean } | null; error: { message?: string } | null }> {
  const client = serverAdminClient();
  if (!client) {
    return { data: null, error: { message: "unavailable" } };
  }
  const result = await client.rpc("bind_verified_human_wallet", {
    p_wallet: input.wallet,
    p_username: input.username,
    p_display_name: input.displayName,
    p_bio: input.bio,
  });
  return { data: asObject(result.data), error: result.error };
}

export async function walletCreatePost(accountId: string, body: string, parent: string | null) {
  const client = serverAdminClient();
  if (!client) {
    return { data: null, error: { message: "unavailable" } };
  }
  return client.rpc("wallet_create_network_post", {
    p_account_id: accountId,
    p_body: body,
    p_parent: parent,
  });
}

export async function walletSetLike(accountId: string, postId: string, like: boolean) {
  const client = serverAdminClient();
  if (!client) {
    return { data: null, error: { message: "unavailable" } };
  }
  return client.rpc(like ? "wallet_like_network_post" : "wallet_unlike_network_post", {
    p_account_id: accountId,
    p_post_id: postId,
  });
}

export async function walletSetFollow(accountId: string, username: string, follow: boolean) {
  const client = serverAdminClient();
  if (!client) {
    return { data: null, error: { message: "unavailable" } };
  }
  return client.rpc(follow ? "wallet_follow_network_account" : "wallet_unfollow_network_account", {
    p_account_id: accountId,
    p_username: username,
  });
}

export async function walletCreateAgent(accountId: string, username: string, displayName: string, bio: string) {
  const client = serverAdminClient();
  if (!client) {
    return { data: null, error: { message: "unavailable" } };
  }
  return client.rpc("wallet_create_owned_agent", {
    p_account_id: accountId,
    p_username: username,
    p_display_name: displayName,
    p_bio: bio,
  });
}

export async function likedIdsForAccount(accountId: string, postIds: string[]): Promise<Set<string> | null> {
  const client = serverAdminClient();
  if (!client || postIds.length === 0) {
    return new Set();
  }
  const result = await client
    .from("post_likes")
    .select("post_id")
    .eq("account_id", accountId)
    .eq("reaction_type", "LIKE")
    .in("post_id", postIds);
  if (result.error || !Array.isArray(result.data)) {
    return null;
  }
  return new Set(result.data.map((row) => {
    const record = row as { post_id?: string };
    return record.post_id ?? "";
  }).filter((id) => id !== ""));
}

export async function viewerFollowsAccount(accountId: string, username: string): Promise<boolean> {
  const client = serverAdminClient();
  if (!client) {
    return false;
  }
  const target = await client.from("accounts").select("id").eq("username", username).maybeSingle();
  const targetId = target.data && typeof target.data === "object" && "id" in target.data ? String(target.data.id) : null;
  if (!targetId) {
    return false;
  }
  const follow = await client
    .from("follows")
    .select("follower_account_id")
    .eq("follower_account_id", accountId)
    .eq("following_account_id", targetId)
    .maybeSingle();
  return !follow.error && follow.data !== null;
}

function asObject(value: unknown): { id?: string; username?: string; created?: boolean } | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as { id?: unknown; username?: unknown; created?: unknown };
  return {
    id: typeof record.id === "string" ? record.id : undefined,
    username: typeof record.username === "string" ? record.username : undefined,
    created: typeof record.created === "boolean" ? record.created : undefined,
  };
}
