import { readBitVisualFeed } from "../../../lib/bit-visual-feed";
import { readPublicSpeech } from "../../../lib/public-speech";
import { readPublicPresence } from "../../../lib/public-supabase";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const [source, presence, reactionText] = await Promise.all([
    readBitVisualFeed(),
    readPublicPresence(),
    readPublicSpeech(),
  ]);
  const speech = presence.launchState === "LIVE" && presence.mint ? reactionText : null;
  const headers = { "cache-control": "no-store" };
  if (!source) {
    return Response.json({ available: false, events: [], busy: false, intensity: 0, presence, speech }, { headers });
  }
  return Response.json({ available: true, ...source, presence, speech }, { headers });
}
