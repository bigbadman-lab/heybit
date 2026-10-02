import { answerAsk, parseAskAction, allowAsk } from "@heybit/shared/agent";
import { readPublicAgent } from "../../../lib/public-agent";
import { readPublicPresence } from "../../../lib/public-supabase";

export const dynamic = "force-dynamic";

const buckets = new Map<string, number[]>();

export async function POST(request: Request): Promise<Response> {
  const headers = { "cache-control": "no-store" };
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
  const key = clientKey(request);
  const decision = allowAsk(buckets.get(key) ?? [], Date.now());
  buckets.set(key, decision.next);
  if (!decision.allowed) {
    return Response.json({ text: "give me a second." }, { status: 429, headers });
  }
  const presence = await readPublicPresence();
  const launchState = presence.launchState === "LIVE" || presence.launchState === "PRELAUNCH" ? presence.launchState : null;
  const agent = await readPublicAgent(launchState);
  const text = answerAsk({ action, launchState, agent });
  return Response.json({ text }, { headers });
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const cleaned = forwarded.replace(/[^\d.a-fA-F:]/g, "").slice(0, 64);
  return cleaned === "" ? "local" : cleaned;
}
