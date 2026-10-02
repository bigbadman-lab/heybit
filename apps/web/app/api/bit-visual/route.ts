import { readBitVisualFeed } from "../../../lib/bit-visual-feed";
import { readPublicPresence } from "../../../lib/public-supabase";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const [source, presence] = await Promise.all([readBitVisualFeed(), readPublicPresence()]);
  const headers = { "cache-control": "no-store" };
  if (!source) {
    return Response.json({ available: false, events: [], busy: false, intensity: 0, presence }, { headers });
  }
  return Response.json({ available: true, ...source, presence }, { headers });
}
