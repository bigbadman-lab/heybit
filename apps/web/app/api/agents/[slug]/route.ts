import { decideEdit, parseEditBody, toPublicAgent } from "@heybit/shared/factory";
import { agentAdminClient, agentAdminSecret, loadAgentRecords, saveAgentEdit } from "../../../../lib/agent-admin";
import { sessionFromCookie } from "../../../../lib/agent-session";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ slug: string }> }): Promise<Response> {
  const secret = agentAdminSecret();
  const client = agentAdminClient();
  if (!secret || !client) {
    return Response.json({ error: "Agent editing is unavailable." }, { status: 503 });
  }
  const wallet = sessionFromCookie(request.headers.get("cookie"), secret, Date.now());
  if (!wallet) {
    return Response.json({ error: "Sign in with your wallet." }, { status: 401 });
  }
  const { slug } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = parseEditBody(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const existing = await loadAgentRecords(client);
  const agent = existing?.find((item) => item.slug === slug);
  if (!existing || !agent) {
    return Response.json({ error: "Agent not found." }, { status: 404 });
  }
  const decision = decideEdit({
    wallet,
    agent,
    patch: parsed.patch,
    activeCount: existing.filter((item) => item.status === "ACTIVE").length,
  });
  if (!decision.ok) {
    return Response.json({ error: decision.error }, { status: 403 });
  }
  const saved = await saveAgentEdit(client, decision.agent);
  if (!saved) {
    return Response.json({ error: "Agent was not updated." }, { status: 503 });
  }
  return Response.json({ agent: toPublicAgent(decision.agent) }, { headers: { "cache-control": "no-store" } });
}
