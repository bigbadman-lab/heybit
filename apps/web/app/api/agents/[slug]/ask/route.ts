import { allowAsk, deterministicAsk, parseAskAction, unknownAgent } from "@heybit/shared/agent";
import { readAgentState, readPublicAgentProfile } from "../../../../../lib/public-factory";

export const dynamic = "force-dynamic";

const buckets = new Map<string, number[]>();

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }): Promise<Response> {
  const headers = { "cache-control": "no-store" };
  const { slug } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ text: null }, { status: 400, headers });
  }
  const action = parseAskAction(body);
  if (!action) {
    return Response.json({ text: null }, { status: 400, headers });
  }
  const key = `${slug}:${clientKey(request)}`;
  const decision = allowAsk(buckets.get(key) ?? [], Date.now());
  buckets.set(key, decision.next);
  if (!decision.allowed) {
    return Response.json({ text: "give me a second." }, { status: 429, headers });
  }
  const profile = await readPublicAgentProfile(slug);
  if (!profile) {
    return Response.json({ text: "i can’t see that agent." }, { headers });
  }
  const state = await readAgentState(slug);
  const factual = deterministicAsk(action, "LIVE", state ?? unknownAgent());
  return Response.json({ text: `${profile.name}: ${factual}` }, { headers });
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const cleaned = forwarded.replace(/[^\d.a-fA-F:]/g, "").slice(0, 64);
  return cleaned === "" ? "local" : cleaned;
}
