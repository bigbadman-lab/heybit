import { isCanonicalMint } from "@heybit/shared";
import { acceptChainFamily, requestDomain, requestOrigin } from "../../../../../../lib/human-wallet";
import { storeHumanChallenge } from "../../../../../../lib/human-wallet-store";
import { networkJson, readJson } from "../../../../../../lib/network";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const domain = requestDomain(request);
  const body = await readJson(request);
  const record = asRecord(body);
  if (!domain || !record || Object.keys(record).sort().join() !== "chainFamily,wallet") {
    return networkJson({ error: "Invalid request." }, 400);
  }
  if (!acceptChainFamily(record.chainFamily) || !isCanonicalMint(record.wallet)) {
    return networkJson({ error: "Wallet is invalid." }, 400);
  }
  const issued = await storeHumanChallenge(record.wallet, domain, Date.now(), `${requestOrigin(request, domain)}/join/human`);
  if (!issued) {
    return networkJson({ error: "Sign-in could not start." }, 503);
  }
  return networkJson({ nonce: issued.nonce, message: issued.message, signIn: issued.signIn });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
