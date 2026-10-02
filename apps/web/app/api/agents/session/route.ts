import { isCanonicalMint } from "@heybit/shared";
import { agentAdminSecret } from "../../../../lib/agent-admin";
import { challengeMessage, issueSession, sessionCookie, verifyChallenge, walletSignatureValid } from "../../../../lib/agent-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const secret = agentAdminSecret();
  if (!secret) {
    return Response.json({ error: "Agent creation is unavailable." }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  if (Object.keys(record).sort().join() !== "nonce,signature,wallet") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!isCanonicalMint(record.wallet) || typeof record.nonce !== "string" || typeof record.signature !== "string") {
    return Response.json({ error: "Wallet is invalid." }, { status: 400 });
  }
  if (!verifyChallenge(secret, record.wallet, record.nonce, Date.now())) {
    return Response.json({ error: "Challenge expired." }, { status: 401 });
  }
  if (!walletSignatureValid(record.wallet, challengeMessage(record.nonce), record.signature)) {
    return Response.json({ error: "Signature did not match." }, { status: 401 });
  }
  const token = issueSession(secret, record.wallet, Date.now());
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store", "set-cookie": sessionCookie(token) },
  });
}
