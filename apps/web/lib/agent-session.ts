import { createHash, createHmac, createPublicKey, timingSafeEqual, verify } from "node:crypto";
import { decodeBase58 } from "@heybit/shared/factory";

const CHALLENGE_MS = 10 * 60 * 1000;
const SESSION_MS = 12 * 60 * 60 * 1000;

export function challengeMessage(nonce: string): string {
  return `HEYBIT agent\n${nonce}`;
}

export function issueChallenge(secret: string, wallet: string, nowMs: number): { nonce: string; message: string } {
  const exp = nowMs + CHALLENGE_MS;
  const nonce = `${wallet}.${exp}.${hmac(secret, `${wallet}.${exp}`)}`;
  return { nonce, message: challengeMessage(nonce) };
}

export function verifyChallenge(secret: string, wallet: string, nonce: string, nowMs: number): boolean {
  const parts = nonce.split(".");
  if (parts.length !== 3 || parts[0] !== wallet) {
    return false;
  }
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < nowMs) {
    return false;
  }
  const expected = hmac(secret, `${wallet}.${parts[1]}`);
  return safeEqual(expected, parts[2] ?? "");
}

export function walletSignatureValid(wallet: string, message: string, signature: string): boolean {
  const publicKey = decodeBase58(wallet);
  const sig = decodeBase58(signature);
  if (!publicKey || publicKey.length !== 32 || !sig || sig.length !== 64) {
    return false;
  }
  try {
    const key = createPublicKey({
      key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicKey)]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(message), key, Buffer.from(sig));
  } catch {
    return false;
  }
}

export function issueSession(secret: string, wallet: string, nowMs: number): string {
  const exp = nowMs + SESSION_MS;
  return `${wallet}.${exp}.${hmac(secret, `session.${wallet}.${exp}`)}`;
}

export function readSession(secret: string, token: string, nowMs: number): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < nowMs) {
    return null;
  }
  const expected = hmac(secret, `session.${parts[0]}.${parts[1]}`);
  if (!safeEqual(expected, parts[2] ?? "")) {
    return null;
  }
  return parts[0] ?? null;
}

export function sessionFromCookie(header: string | null, secret: string, nowMs: number): string | null {
  const token = readCookie(header, "heybit_agent");
  return token ? readSession(secret, token, nowMs) : null;
}

export function sessionCookie(token: string): string {
  return `heybit_agent=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}`;
}

function hmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return rest.join("=");
    }
  }
  return null;
}
