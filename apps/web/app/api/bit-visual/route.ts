import { readBitVisualFeed } from "../../../lib/bit-visual-feed";
import { readPublicAgent } from "../../../lib/public-agent";
import { readPublicSpeech } from "../../../lib/public-speech";
import { readPublicPresence } from "../../../lib/public-supabase";
import { visiblePublicSpeech } from "../../../lib/visible-speech";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const [source, presence, reactionText] = await Promise.all([
    readBitVisualFeed(),
    readPublicPresence(),
    readPublicSpeech(),
  ]);
  const speech = visiblePublicSpeech(presence, reactionText);
  const agent = await readPublicAgent(presence.launchState);
  const headers = { "cache-control": "no-store" };
  if (!source) {
    return Response.json({ available: false, events: [], busy: false, intensity: 0, presence, speech, agent }, { headers });
  }
  return Response.json({ available: true, ...source, presence, speech, agent }, { headers });
}
