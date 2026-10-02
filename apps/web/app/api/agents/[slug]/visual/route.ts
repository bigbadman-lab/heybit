import { unknownAgent } from "@heybit/shared/agent";
import { readAgentState, readPublicAgentProfile } from "../../../../../lib/public-factory";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await context.params;
  const profile = await readPublicAgentProfile(slug);
  if (!profile) {
    return Response.json({ profile: null, agent: null, speech: null }, { status: 404, headers: { "cache-control": "no-store" } });
  }
  const agent = (await readAgentState(slug)) ?? unknownAgent();
  const speech = agent.memory.lines[0] ?? null;
  return Response.json({ profile, agent, speech }, { headers: { "cache-control": "no-store" } });
}
