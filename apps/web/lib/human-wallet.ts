import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isCanonicalMint } from "@heybit/shared";
import { walletSignatureValid } from "./agent-session";

export const HUMAN_CHAIN_FAMILY = "solana" as const;
export type HumanChainFamily = typeof HUMAN_CHAIN_FAMILY;

export const HUMAN_COOKIE = "heybit_human";
export const HUMAN_CHALLENGE_MS = 5 * 60 * 1000;
export const HUMAN_SESSION_MS = 12 * 60 * 60 * 1000;

const ACTOR_ACCOUNT_KEYS = ["author_account_id", "account_id", "authorAccountId", "accountId"] as const;
const ACTOR_WALLET_KEYS = ["wallet_address", "walletAddress", "wallet"] as const;
const ACTOR_OWNER_KEYS = ["owner_account_id", "ownerAccountId"] as const;

export interface HumanChallenge {
  wallet: string;
  domain: string;
  chainFamily: HumanChainFamily;
  nonce: string;
  message: string;
  expiresAtMs: number;
  used: boolean;
}

export interface HumanActorAccount {
  id: string;
  username: string;
  accountType: "HUMAN" | "AGENT";
}

export function humanChallengeMessage(input: {
  domain: string;
  wallet: string;
  nonce: string;
}): string {
  return [
    "HEYBIT human",
    `domain:${input.domain}`,
    "chain:solana",
    `wallet:${input.wallet}`,
    `nonce:${input.nonce}`,
  ].join("\n");
}

export function newHumanNonce(): string {
  return randomBytes(16).toString("hex");
}

export function normalizeHumanDomain(raw: string): string | null {
  const domain = raw.trim().toLowerCase().replace(/:(?:443|80)$/, "");
  if (domain.length < 1 || domain.length > 255 || /[\s\u0000/\\]/.test(domain)) {
    return null;
  }
  return domain;
}

export function requestDomain(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");
  const candidate = forwarded?.split(",")[0]?.trim() || host || new URL(request.url).host;
  return normalizeHumanDomain(candidate);
}

export function issueHumanChallenge(input: {
  wallet: string;
  domain: string;
  nowMs: number;
  nonce?: string;
}): HumanChallenge | null {
  const domain = normalizeHumanDomain(input.domain);
  if (!isCanonicalMint(input.wallet) || !domain) {
    return null;
  }
  const nonce = input.nonce ?? newHumanNonce();
  if (!/^[a-f0-9]{32}$/.test(nonce)) {
    return null;
  }
  return {
    wallet: input.wallet,
    domain,
    chainFamily: HUMAN_CHAIN_FAMILY,
    nonce,
    message: humanChallengeMessage({ domain, wallet: input.wallet, nonce }),
    expiresAtMs: input.nowMs + HUMAN_CHALLENGE_MS,
    used: false,
  };
}

export function acceptHumanProof(input: {
  challenge: HumanChallenge;
  wallet: string;
  domain: string;
  signature: string;
  nowMs: number;
}): { ok: true; challenge: HumanChallenge } | { ok: false; reason: "expired" | "used" | "wallet" | "domain" | "chain" | "signature"; challenge: HumanChallenge } {
  const domain = normalizeHumanDomain(input.domain);
  if (input.challenge.chainFamily !== HUMAN_CHAIN_FAMILY) {
    return { ok: false, reason: "chain", challenge: input.challenge };
  }
  if (input.challenge.used) {
    return { ok: false, reason: "used", challenge: input.challenge };
  }
  if (!domain || domain !== input.challenge.domain) {
    return { ok: false, reason: "domain", challenge: input.challenge };
  }
  if (input.wallet !== input.challenge.wallet || !isCanonicalMint(input.wallet)) {
    return { ok: false, reason: "wallet", challenge: input.challenge };
  }
  if (input.nowMs > input.challenge.expiresAtMs) {
    return { ok: false, reason: "expired", challenge: input.challenge };
  }
  const burned: HumanChallenge = { ...input.challenge, used: true };
  if (!walletSignatureValid(input.challenge.wallet, input.challenge.message, input.signature)) {
    return { ok: false, reason: "signature", challenge: burned };
  }
  return { ok: true, challenge: burned };
}

export function acceptChainFamily(value: unknown): value is HumanChainFamily {
  return value === HUMAN_CHAIN_FAMILY;
}

export function sealHumanSession(secret: string, sessionId: string, wallet: string, nowMs: number): { token: string; expiresAtMs: number } {
  const expiresAtMs = nowMs + HUMAN_SESSION_MS;
  const mac = humanSessionMac(secret, sessionId, wallet, expiresAtMs);
  return { token: `${sessionId}.${expiresAtMs}.${mac}`, expiresAtMs };
}

export function humanSessionMatches(secret: string, token: string, wallet: string, nowMs: number): boolean {
  const parts = token.split(".");
  if (parts.length !== 3 || !isCanonicalMint(wallet)) {
    return false;
  }
  const sessionId = parts[0] ?? "";
  const expiresAtMs = Number(parts[1]);
  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !Number.isFinite(expiresAtMs) || expiresAtMs < nowMs) {
    return false;
  }
  const expected = humanSessionMac(secret, sessionId, wallet, expiresAtMs);
  return safeEqual(expected, parts[2] ?? "");
}

export function readHumanSessionId(token: string): { sessionId: string; expiresAtMs: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const expiresAtMs = Number(parts[1]);
  const sessionId = parts[0] ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !Number.isFinite(expiresAtMs)) {
    return null;
  }
  return { sessionId, expiresAtMs };
}

export function humanSessionCookie(token: string, secure: boolean): string {
  const secureFlag = secure ? "; Secure" : "";
  return `${HUMAN_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${HUMAN_SESSION_MS / 1000}${secureFlag}`;
}

export function clearHumanSessionCookie(secure: boolean): string {
  const secureFlag = secure ? "; Secure" : "";
  return `${HUMAN_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureFlag}`;
}

export function readHumanCookie(header: string | null): string | null {
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === HUMAN_COOKIE) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export function sessionIsActive(row: { revoked: boolean; expiresAtMs: number }, nowMs: number): boolean {
  return !row.revoked && row.expiresAtMs >= nowMs;
}

export function shortenWallet(address: string): string {
  if (address.length <= 10) {
    return address;
  }
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function gateHumanSession(input: {
  sessionWallet: string | null;
  account: HumanActorAccount | null;
  clientAccountId: string | null;
  clientWallet: string | null;
  clientOwnerId: string | null;
}): { ok: true; wallet: string; accountId: string | null } | { ok: false; reason: "unauthenticated" | "spoof" } {
  if (!input.sessionWallet || !isCanonicalMint(input.sessionWallet)) {
    return { ok: false, reason: "unauthenticated" };
  }
  if (input.clientWallet && input.clientWallet !== input.sessionWallet) {
    return { ok: false, reason: "spoof" };
  }
  if (input.clientAccountId && input.clientAccountId !== input.account?.id) {
    return { ok: false, reason: "spoof" };
  }
  if (input.clientOwnerId && input.clientOwnerId !== input.account?.id) {
    return { ok: false, reason: "spoof" };
  }
  if (input.account && (input.account.accountType !== "HUMAN" || input.account.username === "bit")) {
    return { ok: false, reason: "spoof" };
  }
  return { ok: true, wallet: input.sessionWallet, accountId: input.account?.id ?? null };
}

export function clientActorFields(body: unknown): {
  clientAccountId: string | null;
  clientWallet: string | null;
  clientOwnerId: string | null;
} {
  const record = asRecord(body);
  return {
    clientAccountId: firstString(record, ACTOR_ACCOUNT_KEYS),
    clientWallet: firstString(record, ACTOR_WALLET_KEYS),
    clientOwnerId: firstString(record, ACTOR_OWNER_KEYS),
  };
}

function humanSessionMac(secret: string, sessionId: string, wallet: string, expiresAtMs: number): string {
  return createHmac("sha256", secret).update(`human.${sessionId}.${wallet}.${expiresAtMs}`).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function firstString(record: Record<string, unknown> | null, keys: readonly string[]): string | null {
  if (!record) {
    return null;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return null;
}
