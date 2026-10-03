import { isCanonicalMint } from "@heybit/shared";
import { acceptChainFamily, requestDomain } from "../../../../../../lib/human-wallet";
import { storeHumanChallenge } from "../../../../../../lib/human-wallet-store";
import { networkJson, readJson } from "../../../../../../lib/network";

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
  const issued = await storeHumanChallenge(record.wallet, domain, Date.now());
  if (!issued) {
    return networkJson({ error: "Wallet connect is unavailable." }, 503);
  }
  return networkJson({ nonce: issued.nonce, message: issued.message });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}
