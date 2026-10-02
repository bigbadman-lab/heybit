import { decideCreate, parseCreateBody, toPublicAgent } from "@heybit/shared/factory";
import { agentAdminClient, agentAdminSecret, insertAgent, loadAgentRecords } from "../../../lib/agent-admin";
import { sessionFromCookie } from "../../../lib/agent-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const secret = agentAdminSecret();
  const client = agentAdminClient();
  if (!secret || !client) {
    return Response.json({ error: "Agent creation is unavailable." }, { status: 503 });
  }
  const wallet = sessionFromCookie(request.headers.get("cookie"), secret, Date.now());
  if (!wallet) {
    return Response.json({ error: "Sign in with your wallet." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = parseCreateBody(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const existing = await loadAgentRecords(client);
  if (!existing) {
    return Response.json({ error: "Agent registry is unavailable." }, { status: 503 });
  }
  const decision = decideCreate({ wallet, draft: parsed.draft, existing });
  if (!decision.ok) {
    return Response.json({ error: decision.error }, { status: 409 });
  }
  const saved = await insertAgent(client, decision.agent);
  if (!saved) {
    return Response.json({ error: "Agent was not created." }, { status: 503 });
  }
  return Response.json({ agent: toPublicAgent(decision.agent) }, { status: 201, headers: { "cache-control": "no-store" } });
}
