import { isCanonicalMint } from "@heybit/shared";
import { acceptChainFamily, requestDomain } from "../../../../../../lib/human-wallet";
import { consumeHumanChallenge, findHumanByWallet, openHumanSession } from "../../../../../../lib/human-wallet-store";
import { humanAuthJson, networkJson, readJson } from "../../../../../../lib/network";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const domain = requestDomain(request);
  const body = await readJson(request);
  const record = asRecord(body);
  if (!domain || !record || Object.keys(record).sort().join() !== "chainFamily,nonce,signature,wallet") {
    return networkJson({ error: "Invalid request." }, 400);
  }
  if (
    !acceptChainFamily(record.chainFamily) ||
    !isCanonicalMint(record.wallet) ||
    typeof record.nonce !== "string" ||
    typeof record.signature !== "string"
  ) {
    return networkJson({ error: "Wallet is invalid." }, 400);
  }
  const proof = await consumeHumanChallenge({
    wallet: record.wallet,
    domain,
    nonce: record.nonce,
    signature: record.signature,
    nowMs: Date.now(),
  });
  if (!proof.ok) {
    const status = proof.reason === "unavailable" ? 503 : 401;
    const error = proof.reason === "expired"
      ? "That wallet check expired. Try again."
      : proof.reason === "used"
        ? "That wallet check was already used. Try again."
        : proof.reason === "domain"
          ? "The site address did not match this check. Try again."
          : proof.reason === "unavailable"
            ? "Wallet connect is unavailable."
            : "The wallet signature was not accepted. Try again.";
    return networkJson({ error }, status);
  }
  const sealed = await openHumanSession(Date.now(), proof.wallet);
  if (!sealed) {
    return networkJson({ error: "Wallet connect is unavailable." }, 503);
  }
  const account = await findHumanByWallet(proof.wallet);
  if (!account) {
    return humanAuthJson({ status: "needs-profile" }, 200, sealed.token);
  }
  return humanAuthJson({ status: "ready", username: account.username }, 200, sealed.token);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
