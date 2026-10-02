import { isCanonicalMint } from "@heybit/shared";
import { agentAdminSecret } from "../../../../lib/agent-admin";
import { issueChallenge } from "../../../../lib/agent-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const secret = agentAdminSecret();
  if (!secret) {
    return Response.json({ error: "Agent creation is unavailable." }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const wallet = typeof body === "object" && body !== null && "wallet" in body ? (body as { wallet?: unknown }).wallet : null;
  if (!isCanonicalMint(wallet) || (typeof body === "object" && body !== null && Object.keys(body).length !== 1)) {
    return Response.json({ error: "Wallet is invalid." }, { status: 400 });
  }
  return Response.json(issueChallenge(secret, wallet, Date.now()), { headers: { "cache-control": "no-store" } });
}
